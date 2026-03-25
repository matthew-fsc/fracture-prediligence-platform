"""
End-to-end pipeline test — Traffic Management Company ($3M ARR)
==============================================================
Runs the complete chain:
  CSV IN → P2-P11 Ingestion Pipeline → Entity insertion →
  A1 Metrics → A2 EBITDA Recast → A3–A8 Category Scores →
  A9 DRS → A10 EV → A11 Value Gap → A13 Buyer Questions

All outputs are printed to terminal. Uses an in-memory SQLite database.

Run from backend/ directory:
    python scripts/test_traffic_mgmt_e2e.py
"""

from __future__ import annotations
import sys
import os
from pathlib import Path
from datetime import date
from decimal import Decimal

# Force UTF-8 output on Windows
if sys.stdout.encoding != "utf-8":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent.parent))

# Use SQLite in-memory for isolated testing
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_traffic_mgmt.db")

# Import after env set
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DB_PATH = Path(__file__).parent.parent / "test_traffic_mgmt.db"
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

import app.ontology.models as _m  # noqa — register all models with Base
import app.ontology.ingestion_models  # noqa
from app.core.database import Base

from app.ontology.models import (
    Company, Customer, Employee, Expense, Contract,
    RevenueStream, RevenueType, ExpenseCategory, EmployeeStatus, ConfidenceLevel,
)
from app.ingestion.pipeline import run_pipeline

# ─── Analytics ──────────────────────────────────────────────────────────────
from app.analytics.a1_metric_computation import compute_metrics
from app.analytics.a2_ebitda_recast import compute_ebitda_recast, ChallengeLikelihood
from app.analytics.a3_revenue_quality import compute_revenue_quality
from app.analytics.a4_operational_independence import compute_operational_independence
from app.analytics.a5_customer_risk import compute_customer_risk
from app.analytics.a6_management_team import compute_management_team
from app.analytics.a7_growth_drivers import compute_growth_drivers
from app.analytics.a8_financial_integrity import compute_financial_integrity
from app.analytics.a9_drs_composite import CategoryScores, compute_drs
from app.analytics.a10_enterprise_value import compute_enterprise_value
from app.analytics.a11_value_gap import compute_value_gap
from app.analytics.a13_buyer_questions import generate_buyer_questions

COMPANY_ID = 99   # isolated from sandbox data
CSV_PATH = Path(__file__).parent.parent / "app" / "demo" / "traffic_mgmt_test.csv"

SEP = "-" * 72


def banner(title: str) -> None:
    print(f"\n{SEP}")
    print(f"  {title}")
    print(SEP)


def fmt_pct(v: float) -> str:
    return f"{v:.1f}%"


def fmt_m(v) -> str:
    f = float(v) if not isinstance(v, float) else v
    if abs(f) >= 1_000_000:
        return f"${f/1_000_000:.2f}M"
    if abs(f) >= 1_000:
        return f"${f/1_000:.1f}K"
    return f"${f:.0f}"


def seed_entities(db) -> None:
    """Insert customers, employees, expenses, contracts directly."""

    # ── Customers ──────────────────────────────────────────────────────────
    customers = [
        Customer(company_id=COMPANY_ID, name="City of Hargrove",              tenure_start=date(2018, 3, 1),  industry="Government",   is_active=True),
        Customer(company_id=COMPANY_ID, name="Metro Transit Authority",        tenure_start=date(2019, 6, 1),  industry="Government",   is_active=True),
        Customer(company_id=COMPANY_ID, name="Riverside County DOT",           tenure_start=date(2020, 1, 1),  industry="Government",   is_active=True),
        Customer(company_id=COMPANY_ID, name="Hargrove City Parks",            tenure_start=date(2020, 9, 1),  industry="Government",   is_active=True),
        Customer(company_id=COMPANY_ID, name="Premier Logistics LLC",          tenure_start=date(2021, 4, 1),  industry="Logistics",    is_active=True),
        Customer(company_id=COMPANY_ID, name="Oakdale Unified School District",tenure_start=date(2021, 8, 1),  industry="Education",    is_active=True),
        Customer(company_id=COMPANY_ID, name="State DOT Region 7",             tenure_start=date(2022, 1, 1),  industry="Government",   is_active=True),
        Customer(company_id=COMPANY_ID, name="SunTech Industrial Park",        tenure_start=date(2022, 5, 1),  industry="Industrial",   is_active=True),
    ]
    db.add_all(customers)
    db.flush()  # get IDs

    # ── Employees ──────────────────────────────────────────────────────────
    employees = [
        Employee(company_id=COMPANY_ID, name="Marcus Chen",      role="Owner / CEO",           hire_date=date(2011, 1, 1),  status=EmployeeStatus.ACTIVE, comp_annual=Decimal("26667"),  is_owner=True,  is_key_person=True,  management_level=0),  # $320K / 12
        Employee(company_id=COMPANY_ID, name="Sandra Whitfield", role="Operations Manager",    hire_date=date(2015, 6, 1),  status=EmployeeStatus.ACTIVE, comp_annual=Decimal("8333"),   is_owner=False, is_key_person=True,  management_level=1),  # $100K / 12
        Employee(company_id=COMPANY_ID, name="Derek Pham",       role="Senior Engineer",       hire_date=date(2017, 3, 1),  status=EmployeeStatus.ACTIVE, comp_annual=Decimal("7500"),   is_owner=False, is_key_person=True,  management_level=2),  # $90K / 12
        Employee(company_id=COMPANY_ID, name="Aisha Townsend",   role="Project Manager",       hire_date=date(2019, 9, 1),  status=EmployeeStatus.ACTIVE, comp_annual=Decimal("6667"),   is_owner=False, is_key_person=False, management_level=2),  # $80K / 12
        Employee(company_id=COMPANY_ID, name="Brian Hooper",     role="Field Technician",      hire_date=date(2020, 2, 1),  status=EmployeeStatus.ACTIVE, comp_annual=Decimal("5000"),   is_owner=False, is_key_person=False, management_level=None), # $60K / 12
        Employee(company_id=COMPANY_ID, name="Nina Cruz",        role="Admin / Billing",       hire_date=date(2021, 7, 1),  status=EmployeeStatus.ACTIVE, comp_annual=Decimal("4583"),   is_owner=False, is_key_person=False, management_level=None), # $55K / 12
    ]
    db.add_all(employees)
    db.flush()

    # ── Expenses (TTM: Jan–Dec 2024) ───────────────────────────────────────
    ttm_expenses = []
    for mo in range(1, 13):
        mo_date = date(2024, mo, 28)
        ttm_expenses += [
            Expense(company_id=COMPANY_ID, amount=Decimal("5200"),  category=ExpenseCategory.OPEX,     description="Office lease",              period=mo_date, vendor="Hargrove Properties", is_recurring=True),
            Expense(company_id=COMPANY_ID, amount=Decimal("3800"),  category=ExpenseCategory.OPEX,     description="Vehicle fleet lease",        period=mo_date, vendor="Enterprise Fleet",     is_recurring=True),
            Expense(company_id=COMPANY_ID, amount=Decimal("2100"),  category=ExpenseCategory.OPEX,     description="Software licenses",          period=mo_date, vendor="Various",              is_recurring=True),
            Expense(company_id=COMPANY_ID, amount=Decimal("1400"),  category=ExpenseCategory.OPEX,     description="Liability insurance",        period=mo_date, vendor="Travelers",            is_recurring=True),
            Expense(company_id=COMPANY_ID, amount=Decimal("26667"), category=ExpenseCategory.OWNER,    description="Owner compensation - Marcus Chen", period=mo_date, vendor=None, is_recurring=True),
            Expense(company_id=COMPANY_ID, amount=Decimal("1800"),  category=ExpenseCategory.PERSONAL, description="Owner personal vehicle",     period=mo_date, vendor=None, is_recurring=True),
            Expense(company_id=COMPANY_ID, amount=Decimal("650"),   category=ExpenseCategory.PERSONAL, description="Owner cell phone & meals",   period=mo_date, vendor=None, is_recurring=True),
        ]
    # One-time expenses
    ttm_expenses += [
        Expense(company_id=COMPANY_ID, amount=Decimal("28000"),  category=ExpenseCategory.ONE_TIME,     description="Truck replacement (collision)",   period=date(2024, 3, 15), vendor="Ford Commercial",    is_recurring=False),
        Expense(company_id=COMPANY_ID, amount=Decimal("14500"),  category=ExpenseCategory.ONE_TIME,     description="Software migration to new platform", period=date(2024, 7, 10), vendor="Cityworks",        is_recurring=False),
        Expense(company_id=COMPANY_ID, amount=Decimal("22000"),  category=ExpenseCategory.RELATED_PARTY,description="Legal / consulting - Chen Family LLC", period=date(2024, 6, 30), vendor="Chen Family LLC", is_recurring=False),
    ]
    db.add_all(ttm_expenses)
    db.flush()

    # ── Contracts ──────────────────────────────────────────────────────────
    # Map customer names to IDs for contracts
    customer_map = {c.name: c.id for c in customers}
    contracts = [
        Contract(company_id=COMPANY_ID, customer_id=customer_map["City of Hargrove"],
                 start_date=date(2022, 1, 1), end_date=date(2026, 12, 31),
                 annual_value=Decimal("660000"), contract_type="MSA", is_active=True, renewal_confirmed=True),
        Contract(company_id=COMPANY_ID, customer_id=customer_map["Metro Transit Authority"],
                 start_date=date(2023, 4, 1), end_date=date(2026, 3, 31),
                 annual_value=Decimal("444000"), contract_type="MSA", is_active=True, renewal_confirmed=False),
        Contract(company_id=COMPANY_ID, customer_id=customer_map["Hargrove City Parks"],
                 start_date=date(2023, 9, 1), end_date=date(2025, 8, 31),
                 annual_value=Decimal("156000"), contract_type="Annual", is_active=True, renewal_confirmed=False),
        Contract(company_id=COMPANY_ID, customer_id=customer_map["Premier Logistics LLC"],
                 start_date=date(2021, 4, 1), end_date=date(2025, 3, 31),
                 annual_value=Decimal("144000"), contract_type="Annual", is_active=True, renewal_confirmed=False),
        Contract(company_id=COMPANY_ID, customer_id=customer_map["Oakdale Unified School District"],
                 start_date=date(2024, 8, 1), end_date=date(2027, 7, 31),
                 annual_value=Decimal("108000"), contract_type="Multi-year", is_active=True, renewal_confirmed=True),
        Contract(company_id=COMPANY_ID, customer_id=customer_map["SunTech Industrial Park"],
                 start_date=date(2022, 5, 1), end_date=date(2025, 4, 30),
                 annual_value=Decimal("100800"), contract_type="Annual", is_active=True, renewal_confirmed=False),
    ]
    db.add_all(contracts)
    db.flush()

    print(f"  Seeded: {len(customers)} customers, {len(employees)} employees,")
    print(f"          {len(ttm_expenses)} expense records, {len(contracts)} contracts")


def main():
    # ── 0. Setup DB ────────────────────────────────────────────────────────
    if DB_PATH.exists():
        DB_PATH.unlink()
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        banner("STEP 0 — DATABASE SETUP")
        db.add(Company(id=COMPANY_ID, name="Hargrove Traffic Management LLC", industry="Traffic Engineering", founded=2011, state="CA", entity_type="LLC"))
        db.flush()
        print(f"  Company created: company_id={COMPANY_ID} — Hargrove Traffic Management LLC")

        # ── 1. Ingest CSV through full P2-P11 pipeline ──────────────────────
        banner("STEP 1 — P2-P11 INGESTION PIPELINE")
        if not CSV_PATH.exists():
            print(f"  ERROR: CSV not found at {CSV_PATH}")
            sys.exit(1)

        csv_data = CSV_PATH.read_bytes()
        print(f"  CSV: {CSV_PATH.name}  ({len(csv_data):,} bytes)")

        job = run_pipeline(
            company_id=COMPANY_ID,
            filename=CSV_PATH.name,
            file_data=csv_data,
            source_type="revenue_csv",
            db=db,
        )
        db.commit()

        print(f"\n  Pipeline result:")
        print(f"    phase    : {job.current_phase}")
        print(f"    status   : {job.current_status}")
        print(f"    rows     : {job.row_count}")
        print(f"    mapped   : {job.mapped_count}")
        print(f"    errors   : {job.error_count}")
        if job.validation_report:
            vr = job.validation_report
            print(f"    validation overall  : {vr.get('overall')}")
            print(f"    source hint         : {vr.get('source_system_hint')}")
        if job.column_mappings:
            mappings = job.column_mappings
            items = mappings if isinstance(mappings, list) else mappings.get("mappings", [])
            print(f"    columns mapped      : {len(items)}")
            for item in (items[:6] if isinstance(items, list) else []):
                col = item.get("source_column", "?")
                ont = item.get("ontology_field", "?")
                conf = item.get("confidence", 0)
                print(f"      {col:20s} -> {ont:30s} (conf={conf})")

        # ── 2. Seed supplemental entities ───────────────────────────────────
        banner("STEP 2 — ENTITY SEEDING (customers / employees / expenses / contracts)")
        seed_entities(db)
        db.commit()

        # Count ontology rows
        from sqlalchemy import func
        for model, label in [(RevenueStream, "revenue_streams"), (Customer, "customers"),
                              (Employee, "employees"), (Expense, "expenses"), (Contract, "contracts")]:
            n = db.query(func.count(model.id)).filter(model.company_id == COMPANY_ID).scalar()
            print(f"  {label:25s}: {n:,}")

        # ── 3. A1 Metrics ───────────────────────────────────────────────────
        banner("STEP 3 — A1: METRIC REGISTRY")
        m = compute_metrics(COMPANY_ID, db)

        print(f"  total_revenue_ttm         : {fmt_m(m.total_revenue_ttm)}")
        print(f"  avg_monthly_revenue_ttm   : {fmt_m(m.avg_monthly_revenue_ttm)}")
        print(f"  recurring_revenue_ttm     : {fmt_m(m.recurring_revenue_ttm)}")
        print(f"  recurring_revenue_pct     : {fmt_pct(m.recurring_revenue_pct)}")
        print(f"  project_revenue_pct       : {fmt_pct(m.project_revenue_pct)}")
        print(f"  top_customer_pct          : {fmt_pct(m.top_customer_revenue_pct)}")
        print(f"  top5_customer_pct         : {fmt_pct(m.top5_customer_revenue_pct)}")
        print(f"  hhi                       : {m.hhi:.1f}")
        print(f"  active_customer_count_ttm : {m.active_customer_count_ttm}")
        print(f"  total_customer_count      : {m.total_customer_count}")
        print(f"  pct_with_active_contracts : {fmt_pct(m.pct_customers_with_active_contracts)}")
        print(f"  pct_multiyear_contracts   : {fmt_pct(m.pct_customers_with_multiyear_contracts)}")
        print(f"  avg_customer_tenure_yrs   : {m.avg_customer_tenure_years:.1f}")
        print(f"  revenue_at_risk_6mo       : {fmt_m(m.revenue_at_risk_6mo)}")
        print(f"  gross_profit              : {fmt_m(m.gross_profit)}")
        print(f"  gross_margin_pct          : {fmt_pct(m.gross_margin_pct)}")
        print(f"  total_opex_ttm            : {fmt_m(m.total_opex_ttm)}")
        print(f"  ebitda_ttm                : {fmt_m(m.ebitda_ttm)}")
        print(f"  owner_compensation_total  : {fmt_m(m.owner_compensation_total)}")
        print(f"  total_headcount           : {m.total_headcount}")
        print(f"  revenue_per_employee      : {fmt_m(m.revenue_per_employee)}")
        print(f"  avg_employee_tenure_yrs   : {m.avg_employee_tenure_years:.1f}")
        print(f"  management_layer_count    : {m.management_layer_count}")
        print(f"  cagr_3yr                  : {m.cagr_3yr:.1f}%" if m.cagr_3yr else "  cagr_3yr                  : N/A")
        print(f"  revenue_consistency_score : {m.revenue_consistency_score:.4f}")
        print(f"\n  Revenue by year:")
        for yr, rev in sorted(m.total_revenue_by_year.items()):
            print(f"    {yr}: {fmt_m(rev)}")

        # ── 4. A2 EBITDA Recast ─────────────────────────────────────────────
        banner("STEP 4 — A2: EBITDA RECAST")
        from app.ontology.models import Expense as ExpModel
        expenses_all = db.query(ExpModel).filter(ExpModel.company_id == COMPANY_ID).all()
        market_rate = Decimal("150000")
        addback_items = []
        one_time = sum(float(e.amount or 0) for e in expenses_all if e.category == ExpenseCategory.ONE_TIME)
        if one_time > 0:
            addback_items.append({"description": "One-Time Non-Recurring Expenses", "amount": one_time, "challenge": ChallengeLikelihood.MEDIUM.value, "category": "non_recurring", "documented": False, "notes": f"{sum(1 for e in expenses_all if e.category == ExpenseCategory.ONE_TIME)} records"})
        rp = sum(float(e.amount or 0) for e in expenses_all if e.category == ExpenseCategory.RELATED_PARTY)
        if rp > 0:
            addback_items.append({"description": "Related-Party Transaction Normalization", "amount": rp, "challenge": ChallengeLikelihood.HIGH.value, "category": "related_party", "documented": False, "notes": "Chen Family LLC consulting"})
        personal = sum(float(e.amount or 0) for e in expenses_all if e.category == ExpenseCategory.PERSONAL)
        if personal > 0:
            addback_items.append({"description": "Personal Expenses Through Business P&L", "amount": personal, "challenge": ChallengeLikelihood.MEDIUM.value, "category": "personal", "documented": False, "notes": "Vehicle + meals/phone"})

        raw_inputs = {
            "net_income": float(m.ebitda_ttm),
            "da": 0, "interest": 0, "taxes": 0,
            "market_rate_replacement_cost": float(market_rate),
            "addback_items": addback_items,
        }
        recast = compute_ebitda_recast(m, raw_inputs)

        print(f"  reported_ebitda           : {fmt_m(recast.reported_ebitda)}")
        print(f"  total_addbacks            : {fmt_m(recast.total_addbacks)}")
        print(f"  conservative_ebitda       : {fmt_m(recast.conservative_ebitda)}")
        print(f"  base_ebitda               : {fmt_m(recast.base_ebitda)}")
        print(f"  aggressive_ebitda         : {fmt_m(recast.aggressive_ebitda)}")
        print(f"  defensible_ebitda         : {fmt_m(recast.defensible_ebitda)}")
        print(f"\n  Addback schedule:")
        for ab in recast.addbacks:
            print(f"    {ab.description[:40]:40s}  {fmt_m(ab.amount):>10s}  challenge={ab.challenge.value}")

        # ── 5. A3–A8 Category Scores ────────────────────────────────────────
        banner("STEP 5 — A3-A8: CATEGORY SCORES")
        rev    = compute_revenue_quality(COMPANY_ID, db)
        ops    = compute_operational_independence(COMPANY_ID, db)
        cust   = compute_customer_risk(COMPANY_ID, db)
        mgmt   = compute_management_team(COMPANY_ID, db)
        growth = compute_growth_drivers(COMPANY_ID, db)
        fin    = compute_financial_integrity(COMPANY_ID, db)

        scores = {
            "Revenue Quality":          (rev.composite,    rev.data_confidence),
            "Financial Integrity":      (fin.composite,    fin.data_confidence),
            "Operational Independence": (ops.composite,    ops.data_confidence),
            "Customer Risk":            (cust.composite,   cust.data_confidence),
            "Management & Team":        (mgmt.composite,   mgmt.data_confidence),
            "Growth Drivers":           (growth.composite, growth.data_confidence),
        }
        print(f"  {'Category':35s} {'Score':>7s}  Confidence")
        print(f"  {'─'*35} {'─'*7}  {'─'*10}")
        for label, (score, conf) in scores.items():
            print(f"  {label:35s} {score:>7.1f}  {conf}")

        print(f"\n  Sub-score detail:")
        for label, result in [("Revenue Quality", rev), ("Financial Integrity", fin), ("Operational Independence", ops), ("Customer Risk", cust), ("Management & Team", mgmt), ("Growth Drivers", growth)]:
            d = result.to_dict()
            subs = {k: v for k, v in d.items() if isinstance(v, (int, float)) and k not in ("composite",) and "score" in k.lower()}
            if subs:
                print(f"\n    [{label}]")
                for k, v in subs.items():
                    print(f"      {k:40s}: {v:.1f}")

        # ── 6. A9 DRS Composite ─────────────────────────────────────────────
        banner("STEP 6 — A9: DRS COMPOSITE")
        cat = CategoryScores(
            revenue_quality=rev.composite,
            financial_integrity=fin.composite,
            operational_independence=ops.composite,
            customer_risk=cust.composite,
            management_team=mgmt.composite,
            growth_drivers=growth.composite,
            revenue_quality_conservative=rev.composite * (0.9 if rev.data_confidence == "LOW" else 1.0),
            financial_integrity_conservative=fin.composite * (0.9 if fin.data_confidence == "LOW" else 1.0),
            operational_independence_conservative=ops.composite * (0.9 if ops.data_confidence == "LOW" else 1.0),
            customer_risk_conservative=cust.composite * (0.9 if cust.data_confidence == "LOW" else 1.0),
            management_team_conservative=mgmt.composite * (0.9 if mgmt.data_confidence == "LOW" else 1.0),
            growth_drivers_conservative=growth.composite * (0.9 if growth.data_confidence == "LOW" else 1.0),
            revenue_quality_optimistic=min(100, rev.composite * (1.05 if rev.data_confidence == "LOW" else 1.0)),
            financial_integrity_optimistic=min(100, fin.composite * (1.05 if fin.data_confidence == "LOW" else 1.0)),
            operational_independence_optimistic=min(100, ops.composite * (1.05 if ops.data_confidence == "LOW" else 1.0)),
            customer_risk_optimistic=min(100, cust.composite * (1.05 if cust.data_confidence == "LOW" else 1.0)),
            management_team_optimistic=min(100, mgmt.composite * (1.05 if mgmt.data_confidence == "LOW" else 1.0)),
            growth_drivers_optimistic=min(100, growth.composite * (1.05 if growth.data_confidence == "LOW" else 1.0)),
        )
        drs = compute_drs(cat)

        print(f"  base_drs                  : {drs.base_drs:.1f}")
        print(f"  conservative_drs          : {drs.conservative_drs:.1f}")
        print(f"  optimistic_drs            : {drs.optimistic_drs:.1f}")
        print(f"  tier                      : {drs.tier.value}")
        print(f"\n  Category contributions to DRS:")
        for cat_key, contrib in drs.category_contributions.items():
            print(f"    {cat_key:35s}: {contrib:.2f} pts")

        # ── 7. A10 Enterprise Value ──────────────────────────────────────────
        banner("STEP 7 — A10: ENTERPRISE VALUE")
        ebitda_base = Decimal(str(round(float(m.ebitda_ttm), 2)))
        ev = compute_enterprise_value(ebitda_base, drs.tier)

        print(f"  ebitda_base               : {fmt_m(ebitda_base)}")
        print(f"  drs_tier                  : {drs.tier.value}")
        print(f"  multiple_range            : {ev.multiple_floor}×–{ev.multiple_ceiling}×")
        print(f"  ev_floor                  : {fmt_m(ev.ev_floor)}")
        print(f"  ev_midpoint               : {fmt_m(ev.ev_midpoint)}")
        print(f"  ev_ceiling                : {fmt_m(ev.ev_ceiling)}")

        # ── 8. A11 Value Gap ────────────────────────────────────────────────
        banner("STEP 8 — A11: VALUE GAP")
        cat_scores_dict = {
            "revenue_quality":          rev.composite,
            "financial_integrity":      fin.composite,
            "operational_independence": ops.composite,
            "customer_risk":            cust.composite,
            "management_team":          mgmt.composite,
            "growth_drivers":           growth.composite,
        }
        gap_result = compute_value_gap(COMPANY_ID, cat_scores_dict, float(m.ebitda_ttm))
        d = gap_result.to_dict()

        print(f"  current_ev                : {fmt_m(d.get('current_ev', 0))}")
        print(f"  potential_ev              : {fmt_m(d.get('potential_ev', 0))}")
        print(f"  total_value_gap           : {fmt_m(d.get('total_value_gap', 0))}")
        if d.get("gaps"):
            print(f"\n  Value gap drivers:")
            for g in d["gaps"]:
                print(f"    [{g.get('priority', '?')}] {g.get('label', '')[:45]:45s}  uplift={fmt_m(g.get('ev_uplift', 0))}")

        # ── 9. A13 Buyer Questions ───────────────────────────────────────────
        banner("STEP 9 — A13: BUYER QUESTION SIMULATION")
        questions = generate_buyer_questions(cat_scores_dict)

        print(f"  Total questions generated : {len(questions)}")
        crit = [q for q in questions if q.severity == "CRITICAL"]
        high = [q for q in questions if q.severity == "HIGH"]
        med  = [q for q in questions if q.severity == "MEDIUM"]
        print(f"  Critical                  : {len(crit)}")
        print(f"  High                      : {len(high)}")
        print(f"  Medium                    : {len(med)}")
        print(f"\n  Full question list:")
        for q in questions:
            badge = {"CRITICAL": "[CRIT]", "HIGH": "[HIGH]", "MEDIUM": "[ MED]"}.get(q.severity, "[    ]")
            print(f"    {badge} [{q.buyer_type:10s}] {q.category:30s}  {q.question[:70]}")

        # ── 10. Final summary ────────────────────────────────────────────────
        banner("STEP 10 — PIPELINE SUMMARY")
        print(f"  Company     : Hargrove Traffic Management LLC")
        print(f"  Revenue TTM : {fmt_m(m.total_revenue_ttm)}")
        print(f"  EBITDA TTM  : {fmt_m(m.ebitda_ttm)}  ({fmt_pct(float(m.ebitda_ttm / m.total_revenue_ttm) * 100 if m.total_revenue_ttm else 0)} margin)")
        print(f"  DRS Score   : {drs.base_drs:.1f} ({drs.tier.value})")
        print(f"  EV Range    : {fmt_m(ev.ev_floor)} – {fmt_m(ev.ev_midpoint)} – {fmt_m(ev.ev_ceiling)}")
        print(f"  Value Gap   : {fmt_m(d.get('total_value_gap', 0))}")
        print(f"  Buyer Qs    : {len(crit)} critical / {len(high)} high / {len(med)} medium")
        print(f"\n  Pipeline chain status: RAW CSV -> P2-P11 -> Entities -> A1-A13  OK")
        print()

    except Exception as e:
        db.rollback()
        import traceback
        print(f"\nFATAL ERROR: {e}")
        traceback.print_exc()
    finally:
        db.close()
        engine.dispose()
        # Clean up test database
        import time
        time.sleep(0.3)
        try:
            if DB_PATH.exists():
                DB_PATH.unlink()
                print(f"  Cleaned up: {DB_PATH.name}")
        except Exception:
            pass


if __name__ == "__main__":
    main()
