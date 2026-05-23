"""
ABC Company Inc sandbox seed — company_id=1.

Used by app startup (`ensure_demo_company_seeded`) when the DB has no revenue
streams for company 1, and by the CLI `scripts/seed_abc_company.py` for
manual resets.

If live analytics do not match verify() targets, company 1 may have extra connector
ingests overlapping this seed — wipe and re-seed so TTM follows one P&L path.

TTM targets (2025 monthly sum): ~$4.20M revenue, ~$1.74M EBITDA proxy (COGS/OPEX
unchanged from QuickBooks-style seed). EV uses DRS tier × blended market multiples.

Populates:
  - 3-year P&L (2023 / 2024 / 2025)
  - 68 customers with correct concentration
  - Monthly 2025 revenue streams (for accurate TTM)
  - Annual 2023/2024 revenue (for YoY)
  - COGS + OPEX + OWNER expenses
  - Owner employee record
"""

from __future__ import annotations
import calendar
import logging
import traceback
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

logger = logging.getLogger(__name__)

import app.ontology.models  # noqa: F401
import app.ontology.ingestion_models  # noqa: F401

from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.core.database import Base, SessionLocal, engine
from app.ontology.models import (
    Customer,
    Employee,
    Expense,
    RevenueStream,
    RevenueType,
    ExpenseCategory,
    EmployeeStatus,
    ConfidenceLevel,
)
from app.ontology.ingestion_models import IngestionJob, PipelinePhase, PhaseStatus

COMPANY_ID = 1

# Pre-loaded demo ingestion (Data Sources UI) — QuickBooks-style P&L for ABC Company Inc.
DEMO_INGESTION_ID = "seed-demo-abc-qb-pl-v1"

# Column mapping payload for Field Mapping demo (read-only in UI; matches P5 shape).
def _demo_column_mappings() -> dict:
    mid = DEMO_INGESTION_ID
    rows = [
        {
            "source_column": "Date",
            "ontology_field": "REVENUE_PERIOD",
            "entity_type": "revenue",
            "confidence": 98,
            "match_method": "exact",
            "match_detail": "Header matched to revenue period",
            "requires_review": False,
            "alternative_fields": [],
        },
        {
            "source_column": "Customer",
            "ontology_field": "CUSTOMER_NAME",
            "entity_type": "customer",
            "confidence": 95,
            "match_method": "exact",
            "match_detail": "Direct match to customer name",
            "requires_review": False,
            "alternative_fields": [],
        },
        {
            "source_column": "Amount",
            "ontology_field": "REVENUE_GROSS",
            "entity_type": "revenue",
            "confidence": 92,
            "match_method": "fuzzy",
            "match_detail": "Numeric column inferred as gross revenue",
            "requires_review": False,
            "alternative_fields": [],
        },
        {
            "source_column": "Account Number",
            "ontology_field": "EXPENSE_CATEGORY",
            "entity_type": "expense",
            "confidence": 88,
            "match_method": "fuzzy",
            "match_detail": "COGS / expense classification from GL account",
            "requires_review": False,
            "alternative_fields": [],
        },
        {
            "source_column": "Memo / Description",
            "ontology_field": "EXPENSE_DESCRIPTION",
            "entity_type": "expense",
            "confidence": 72,
            "match_method": "value_inference",
            "match_detail": "Low-confidence: could map to revenue description",
            "requires_review": True,
            "alternative_fields": [{"field": "REVENUE_DESCRIPTION", "confidence": 55}],
        },
        {
            "source_column": "Split",
            "ontology_field": None,
            "entity_type": None,
            "confidence": 0,
            "match_method": "excluded",
            "match_detail": "Administrative column — excluded from ontology",
            "requires_review": False,
            "alternative_fields": [],
        },
        {
            "source_column": "Class",
            "ontology_field": "EXPENSE_CATEGORY",
            "entity_type": "expense",
            "confidence": 61,
            "match_method": "fuzzy",
            "match_detail": "Class vs department — advisor review suggested",
            "requires_review": True,
            "alternative_fields": [{"field": "EMPLOYEE_DEPARTMENT", "confidence": 58}],
        },
        {
            "source_column": "Name",
            "ontology_field": "EMPLOYEE_NAME",
            "entity_type": "employee",
            "confidence": 90,
            "match_method": "exact",
            "match_detail": "Payroll name column",
            "requires_review": False,
            "alternative_fields": [],
        },
        {
            "source_column": "Hours",
            "ontology_field": None,
            "entity_type": "employee",
            "confidence": 65,
            "match_method": "value_inference",
            "match_detail": "Hours not in base ontology — optional custom metric",
            "requires_review": False,
            "alternative_fields": [],
        },
    ]
    auto = sum(1 for r in rows if r.get("ontology_field") and not r["requires_review"] and r["match_method"] != "excluded")
    rev = sum(1 for r in rows if r["requires_review"])
    exc = sum(1 for r in rows if r["match_method"] == "excluded")
    return {
        "ingestion_id": mid,
        "auto_mapped": auto,
        "review_required": rev,
        "excluded": exc,
        "mappings": rows,
    }


# ── Annual revenue totals ─────────────────────────────────────────────────────
# 2025 scaled so TTM revenue − 2025 COGS − 2025 OpEx ≈ $1.74M EBITDA (matches analytics proxy).
ANNUAL_REVENUE = {2023: Decimal("2793233"), 2024: Decimal("2746003"), 2025: Decimal("4196172")}
# Used to detect stale installs where startup seed never ran again after we changed targets.
EXPECTED_2025_REVENUE = ANNUAL_REVENUE[2025]
TOTAL_3YR = sum(ANNUAL_REVENUE.values())

# 2023/2024 split weight (used when deriving per-year from 2yr remainder)
SPLIT_23 = ANNUAL_REVENUE[2023] / (ANNUAL_REVENUE[2023] + ANNUAL_REVENUE[2024])
SPLIT_24 = ANNUAL_REVENUE[2024] / (ANNUAL_REVENUE[2023] + ANNUAL_REVENUE[2024])

# ── Top-10 customers: 3-year totals + explicit 2025 amounts ───────────────────
# 2025 TOP5 scaled so concentration % are unchanged at the ~$4.20M 2025 column total
# (see ANNUAL_REVENUE[2025]).
#   COMPANY 1 ~49.4% · COMPANY 2 ~19% · COMPANY 3 ~4.9% · COMPANY 4 ~3.3% · COMPANY 5 ~2.4%
# Format: (name, 3yr_total, explicit_2025 or None)
TOP10 = [
    ("COMPANY 1",  Decimal("3241433"), Decimal("2072865")),
    ("COMPANY 2",  Decimal("2737453"), Decimal("796991")),
    ("COMPANY 3",  Decimal("719728"),  Decimal("205694")),
    ("COMPANY 4",  Decimal("428617"),  Decimal("138502")),
    ("COMPANY 5",  Decimal("312796"),  Decimal("100691")),
    ("COMPANY 6",  Decimal("251035"),  None),
    ("COMPANY 7",  Decimal("112504"),  None),
    ("COMPANY 8",  Decimal("88250"),   None),
    ("COMPANY 9",  Decimal("82880"),   None),
    ("COMPANY 10", Decimal("78538"),   None),
]
TOP10_3YR_SUM = sum(t[1] for t in TOP10)          # 8053234
REMAINING_3YR = TOTAL_3YR - TOP10_3YR_SUM          # 745174
REMAINING_COUNT = 58
PER_REMAINING_3YR = REMAINING_3YR / REMAINING_COUNT  # ~12848 each

# 2025 explicitly set for TOP5; compute remainder for COMPANY 6-55
TOP5_2025_SUM = sum(t[2] for t in TOP10 if t[2] is not None)  # 3,314,743
OTHERS_2025_BUDGET = ANNUAL_REVENUE[2025] - TOP5_2025_SUM      # 881,429

# ── P&L expense data (annual) ─────────────────────────────────────────────────
# Format: {year: [(description, amount, category), ...]}
EXPENSES = {
    2025: [
        # COGS items
        ("Officers' Salaries (GL 5001-2-5)",    Decimal("202221"),  ExpenseCategory.COGS),
        ("Salaries & Wages (GL 5001-2-8)",       Decimal("818567"),  ExpenseCategory.COGS),
        ("Overtime Wages (GL 5001-2-6)",          Decimal("196254"),  ExpenseCategory.COGS),
        ("Contract Labor (GL 5001-1)",            Decimal("281406"),  ExpenseCategory.COGS),
        ("Equipment Rental (GL 5002)",            Decimal("325686"),  ExpenseCategory.COGS),
        ("General Liability Insurance (GL 5004-1)",Decimal("233209"), ExpenseCategory.COGS),
        ("Vehicle Gas & Fuel (GL 5010-2)",        Decimal("84051"),   ExpenseCategory.COGS),
        ("Vehicle Insurance (GL 5010-3)",         Decimal("1168"),    ExpenseCategory.COGS),
        ("Other Direct Costs",                    Decimal("191758"),  ExpenseCategory.COGS),
        # OWNER — Officers' Salaries tracked separately for addback
        ("Officers' Salaries — Owner Comp Tracking", Decimal("202221"), ExpenseCategory.OWNER),
        # OPEX items
        ("Hotels & Lodging (GL 6024-2)",          Decimal("11405"),   ExpenseCategory.OPEX),
        ("Ask My Client / Vendor Credits (GL 6001)", Decimal("-33463"), ExpenseCategory.OPEX),
        ("Accounting Fees (GL 6013-1)",           Decimal("12091"),   ExpenseCategory.OPEX),
        ("IT Services (GL 6016-1)",               Decimal("19437"),   ExpenseCategory.OPEX),
        ("Software & Apps (GL 6016-7)",           Decimal("8327"),    ExpenseCategory.OPEX),
        ("Mileage Reimbursement (GL 6015)",       Decimal("8491"),    ExpenseCategory.OPEX),
        ("Facility Rent (GL 6008)",               Decimal("24602"),   ExpenseCategory.OPEX),
        ("TPD Off-Duty (GL 6021-2)",              Decimal("1421"),    ExpenseCategory.OPEX),
        ("Other Operating Expenses",              Decimal("66184"),   ExpenseCategory.OPEX),
    ],
    2024: [
        ("Officers' Salaries (GL 5001-2-5)",    Decimal("183000"),  ExpenseCategory.COGS),
        ("Salaries & Wages (GL 5001-2-8)",       Decimal("973612"),  ExpenseCategory.COGS),
        ("Overtime Wages (GL 5001-2-6)",          Decimal("351796"),  ExpenseCategory.COGS),
        ("Contract Labor (GL 5001-1)",            Decimal("136513"),  ExpenseCategory.COGS),
        ("Equipment Rental (GL 5002)",            Decimal("285947"),  ExpenseCategory.COGS),
        ("General Liability Insurance (GL 5004-1)",Decimal("233494"), ExpenseCategory.COGS),
        ("Vehicle Gas & Fuel (GL 5010-2)",        Decimal("137031"),  ExpenseCategory.COGS),
        ("Vehicle Insurance (GL 5010-3)",         Decimal("88222"),   ExpenseCategory.COGS),
        ("Vehicle Lease (GL 5010-4)",             Decimal("0"),       ExpenseCategory.COGS),
        ("Other Direct Costs",                    Decimal("285763"),  ExpenseCategory.COGS),
        ("Officers' Salaries — Owner Comp Tracking", Decimal("183000"), ExpenseCategory.OWNER),
        ("Hotels & Lodging (GL 6024-2)",          Decimal("29150"),   ExpenseCategory.OPEX),
        ("Ask My Client / Vendor Credits (GL 6001)", Decimal("-20174"), ExpenseCategory.OPEX),
        ("Accounting Fees (GL 6013-1)",           Decimal("12065"),   ExpenseCategory.OPEX),
        ("IT Services (GL 6016-1)",               Decimal("19397"),   ExpenseCategory.OPEX),
        ("Software & Apps (GL 6016-7)",           Decimal("9380"),    ExpenseCategory.OPEX),
        ("Mileage Reimbursement (GL 6015)",       Decimal("8582"),    ExpenseCategory.OPEX),
        ("Facility Rent (GL 6008)",               Decimal("19090"),   ExpenseCategory.OPEX),
        ("TPD Off-Duty (GL 6021-2)",              Decimal("1960"),    ExpenseCategory.OPEX),
        ("Other Operating Expenses",              Decimal("78505"),   ExpenseCategory.OPEX),
    ],
    2023: [
        ("Officers' Salaries (GL 5001-2-5)",    Decimal("86000"),   ExpenseCategory.COGS),
        ("Salaries & Wages (GL 5001-2-8)",       Decimal("758750"),  ExpenseCategory.COGS),
        ("Overtime Wages (GL 5001-2-6)",          Decimal("296041"),  ExpenseCategory.COGS),
        ("Contract Labor (GL 5001-1)",            Decimal("207587"),  ExpenseCategory.COGS),
        ("Equipment Rental (GL 5002)",            Decimal("214500"),  ExpenseCategory.COGS),
        ("General Liability Insurance (GL 5004-1)",Decimal("87623"),  ExpenseCategory.COGS),
        ("Vehicle Gas & Fuel (GL 5010-2)",        Decimal("114987"),  ExpenseCategory.COGS),
        ("Vehicle Insurance (GL 5010-3)",         Decimal("80647"),   ExpenseCategory.COGS),
        ("Vehicle Lease (GL 5010-4)",             Decimal("157774"),  ExpenseCategory.COGS),
        ("Other Direct Costs",                    Decimal("219312"),  ExpenseCategory.COGS),
        ("Officers' Salaries — Owner Comp Tracking", Decimal("86000"), ExpenseCategory.OWNER),
        ("Hotels & Lodging (GL 6024-2)",          Decimal("48949"),   ExpenseCategory.OPEX),
        ("Ask My Client / Vendor Credits (GL 6001)", Decimal("31286"), ExpenseCategory.OPEX),
        ("Accounting Fees (GL 6013-1)",           Decimal("12835"),   ExpenseCategory.OPEX),
        ("IT Services (GL 6016-1)",               Decimal("55"),      ExpenseCategory.OPEX),
        ("Software & Apps (GL 6016-7)",           Decimal("1359"),    ExpenseCategory.OPEX),
        ("Mileage Reimbursement (GL 6015)",       Decimal("15135"),   ExpenseCategory.OPEX),
        ("Facility Rent (GL 6008)",               Decimal("6526"),    ExpenseCategory.OPEX),
        ("TPD Off-Duty (GL 6021-2)",              Decimal("2156"),    ExpenseCategory.OPEX),
        ("Other Operating Expenses",              Decimal("45232"),   ExpenseCategory.OPEX),
    ],
}

# Month-end dates for 2025 monthly records
MONTH_ENDS_2025 = [
    date(2025, m, calendar.monthrange(2025, m)[1]) for m in range(1, 13)
]

# Seasonal revenue weights for a field services / traffic management company.
# Outdoor municipal work peaks in summer construction season; winter months are
# soft; Q4 has a modest year-end government uptick before the holiday lull.
# Each month has a distinct weight (no duplicate months) while preserving the same
# annual total; weights sum exactly to 1.000.
MONTHLY_WEIGHTS_2025 = [
    Decimal("0.054"),  # Jan — winter slow
    Decimal("0.056"),  # Feb — winter slow (slightly up vs Jan)
    Decimal("0.074"),  # Mar — spring ramp
    Decimal("0.089"),  # Apr — season opens
    Decimal("0.101"),  # May — active
    Decimal("0.104"),  # Jun — peak
    Decimal("0.106"),  # Jul — peak (slightly above Jun)
    Decimal("0.099"),  # Aug — high
    Decimal("0.094"),  # Sep — winding down
    Decimal("0.086"),  # Oct — fall close-outs
    Decimal("0.071"),  # Nov — slowing
    Decimal("0.066"),  # Dec — year-end close, holiday lull
]


def month_end(year: int, month: int) -> date:
    return date(year, month, calendar.monthrange(year, month)[1])


def build_customer_revenues() -> dict[int, dict[int, Decimal]]:
    """
    Compute per-year revenues for all 68 customers.
    - 2025: TOP5 use explicit amounts; COMPANY 6-55 proportional from 3yr share of OTHERS_2025_BUDGET; churned (55-67) = 0
    - 2023/2024: derived from (3yr_total - rev_2025), split by SPLIT_23/SPLIT_24; scaled to column targets
    Returns {customer_index: {year: amount}}
    """
    CHURNED = set(range(55, 68))
    result: dict[int, dict[int, Decimal]] = {i: {2023: Decimal(0), 2024: Decimal(0), 2025: Decimal(0)} for i in range(68)}

    # Build list of (index, name, 3yr_total, explicit_2025)
    customers_data = []
    for idx, (name, total_3yr, exp_2025) in enumerate(TOP10):
        customers_data.append((idx, name, total_3yr, exp_2025))
    for j in range(REMAINING_COUNT):
        idx = 10 + j
        customers_data.append((idx, f"COMPANY {idx+1}", PER_REMAINING_3YR, None))

    # ── 2025 allocation ────────────────────────────────────────────────────────
    # TOP5 (indices 0-4): explicit amounts
    for idx, name, total_3yr, exp_2025 in customers_data[:5]:
        result[idx][2025] = exp_2025

    # COMPANY 6-55 (indices 5-54): proportional share of OTHERS_2025_BUDGET from 3yr totals
    others_active = [(idx, total_3yr) for idx, _, total_3yr, _ in customers_data[5:] if idx not in CHURNED]
    others_3yr_sum = sum(t for _, t in others_active)
    scale_others = OTHERS_2025_BUDGET / others_3yr_sum if others_3yr_sum else Decimal(0)
    for idx, total_3yr in others_active:
        result[idx][2025] = (total_3yr * scale_others).quantize(Decimal("0.01"), ROUND_HALF_UP)

    # Fix rounding on first other-active customer (index 5)
    col2025 = sum(result[i][2025] for i in range(68))
    result[5][2025] += ANNUAL_REVENUE[2025] - col2025

    # ── 2023/2024 allocation ───────────────────────────────────────────────────
    for idx, name, total_3yr, exp_2025 in customers_data:
        rev_2025 = result[idx][2025]
        remainder_2yr = total_3yr - rev_2025
        if remainder_2yr < 0:
            remainder_2yr = Decimal(0)
        result[idx][2023] = (remainder_2yr * SPLIT_23).quantize(Decimal("0.01"), ROUND_HALF_UP)
        result[idx][2024] = (remainder_2yr * SPLIT_24).quantize(Decimal("0.01"), ROUND_HALF_UP)

    # Scale 2023 and 2024 to column targets, fix residual on customer 0
    for yr in (2023, 2024):
        col_sum = sum(result[i][yr] for i in range(68))
        if col_sum > 0:
            scale = ANNUAL_REVENUE[yr] / col_sum
            for i in range(68):
                result[i][yr] = (result[i][yr] * scale).quantize(Decimal("0.01"), ROUND_HALF_UP)
        col_sum2 = sum(result[i][yr] for i in range(68))
        result[0][yr] += ANNUAL_REVENUE[yr] - col_sum2

    return result


def wipe_company_data(db, company_id: int):
    """Delete all ontology records for a company."""
    for tbl in ("contracts", "expenses", "employees", "revenue_streams", "customers", "ingestion_jobs"):
        db.execute(text(f"DELETE FROM {tbl} WHERE company_id = :cid"), {"cid": company_id})
    db.execute(text("UPDATE companies SET name=:n, industry=:i, founded=:f, state=:s, entity_type=:e WHERE id=:cid"), {
        "n": "ABC Company Inc",
        "i": "Field Services — Traffic Management & Transportation",
        "f": 2009,
        "s": "CA",
        "e": "S-Corp",
        "cid": company_id,
    })
    db.commit()
    print("  Wiped existing data and updated company record.")


def seed_customers_and_revenue(db) -> list[int]:
    """Create 68 customers and their revenue streams. Returns list of customer IDs."""
    revenues = build_customer_revenues()

    # Churned customers = last 13 (indices 55-67), no 2025 records
    CHURNED_INDICES = set(range(55, 68))

    customer_ids = []
    for i, (name_10, _, _exp) in enumerate(TOP10):
        cname = name_10
        active = i not in CHURNED_INDICES
        c = Customer(
            company_id=COMPANY_ID,
            name=cname,
            tenure_start=date(2016 + (i % 6), (i % 12) + 1, 1),
            industry="Government" if i < 2 else ("Municipal Services" if i < 6 else "Other"),
            is_active=active,
            confidence_level=ConfidenceLevel.HIGH,
        )
        db.add(c)
        db.flush()
        customer_ids.append(c.id)

    for j in range(REMAINING_COUNT):
        i = 10 + j
        cname = f"COMPANY {i + 1}"
        active = i not in CHURNED_INDICES
        c = Customer(
            company_id=COMPANY_ID,
            name=cname,
            tenure_start=date(2018 + (j % 5), (j % 12) + 1, 1),
            industry="Other",
            is_active=active,
            confidence_level=ConfidenceLevel.MEDIUM,
        )
        db.add(c)
        db.flush()
        customer_ids.append(c.id)

    db.flush()

    # Create revenue streams
    rs_count = 0
    for i, cid in enumerate(customer_ids):
        churned = i in CHURNED_INDICES

        # 2023 — single annual record dated 2023-01-01
        amt_2023 = revenues[i][2023]
        if amt_2023 > 0:
            db.add(RevenueStream(
                company_id=COMPANY_ID, customer_id=cid,
                revenue_gross=amt_2023, revenue_type=RevenueType.PROJECT,
                recurring_flag=False, revenue_period=date(2023, 1, 1),
                description="Annual revenue 2023",
                confidence_level=ConfidenceLevel.HIGH,
            ))
            rs_count += 1

        # 2024 — single annual record dated 2024-01-01
        amt_2024 = revenues[i][2024]
        if amt_2024 > 0:
            db.add(RevenueStream(
                company_id=COMPANY_ID, customer_id=cid,
                revenue_gross=amt_2024, revenue_type=RevenueType.PROJECT,
                recurring_flag=False, revenue_period=date(2024, 1, 1),
                description="Annual revenue 2024",
                confidence_level=ConfidenceLevel.HIGH,
            ))
            rs_count += 1

        # 2025 — monthly records with seasonal distribution (only for active customers)
        if not churned:
            annual_2025 = revenues[i][2025]
            running = Decimal(0)
            for mi, mo_end in enumerate(MONTH_ENDS_2025):
                if mi == 11:
                    # Last month absorbs rounding residual so per-customer total is exact
                    monthly_amt = (annual_2025 - running).quantize(Decimal("0.01"), ROUND_HALF_UP)
                else:
                    monthly_amt = (annual_2025 * MONTHLY_WEIGHTS_2025[mi]).quantize(Decimal("0.01"), ROUND_HALF_UP)
                    running += monthly_amt
                db.add(RevenueStream(
                    company_id=COMPANY_ID, customer_id=cid,
                    revenue_gross=monthly_amt,
                    revenue_type=RevenueType.PROJECT,
                    recurring_flag=False, revenue_period=mo_end,
                    description=f"Monthly revenue {mo_end.strftime('%b %Y')}",
                    confidence_level=ConfidenceLevel.HIGH,
                ))
                rs_count += 1

    print(f"  Created {len(customer_ids)} customers, {rs_count} revenue stream records.")
    return customer_ids


def seed_expenses(db):
    """
    Create expense records: 2023/2024 as annual Jan-1 rows; 2025 as monthly rows so rolling
    TTM (ref_date = latest revenue) always includes a full year of COGS/OPEX/OWNER that matches
    monthly 2025 revenue (Jan-1-only rows can fall outside the last-365-days window).
    """
    exp_count = 0
    for year, items in EXPENSES.items():
        if year == 2025:
            for desc, amount, category in items:
                if amount == Decimal("0"):
                    continue
                monthly = (amount / Decimal("12")).quantize(Decimal("0.01"), ROUND_HALF_UP)
                running = Decimal(0)
                for i, mo_end in enumerate(MONTH_ENDS_2025):
                    if i == 11:
                        amt = (amount - running).quantize(Decimal("0.01"), ROUND_HALF_UP)
                    else:
                        amt = monthly
                        running += amt
                    db.add(Expense(
                        company_id=COMPANY_ID,
                        amount=amt,
                        category=category,
                        description=f"{desc} ({mo_end.strftime('%b %Y')})",
                        period=mo_end,
                        is_recurring=(category in (ExpenseCategory.COGS, ExpenseCategory.OPEX)),
                        confidence_level=ConfidenceLevel.HIGH,
                    ))
                    exp_count += 1
            continue
        period = date(year, 1, 1)
        for desc, amount, category in items:
            if amount == Decimal("0"):
                continue
            db.add(Expense(
                company_id=COMPANY_ID,
                amount=amount,
                category=category,
                description=desc,
                period=period,
                is_recurring=(category in (ExpenseCategory.COGS, ExpenseCategory.OPEX)),
                confidence_level=ConfidenceLevel.HIGH,
            ))
            exp_count += 1
    print(f"  Created {exp_count} expense records (2023/2024 annual; 2025 monthly).")


def seed_employee(db):
    """Create owner employee record."""
    db.add(Employee(
        company_id=COMPANY_ID,
        name="Principal Owner / Operations Director",
        role="Owner / CEO",
        department="Operations",
        hire_date=date(2009, 1, 1),
        status=EmployeeStatus.ACTIVE,
        comp_annual=Decimal("202221"),  # annual comp; used by operational independence scorer
        is_owner=True,
        is_key_person=True,
        management_level=0,
        confidence_level=ConfidenceLevel.HIGH,
    ))
    print("  Created owner employee record.")


def verify(db):
    """Print summary verification."""
    from app.ontology.models import RevenueStream as RS

    total_2025 = db.query(func.sum(RS.revenue_gross)).filter(
        RS.company_id == COMPANY_ID,
        RS.revenue_period >= date(2025, 1, 1),
        RS.revenue_period <= date(2025, 12, 31),
    ).scalar() or Decimal(0)

    total_2024 = db.query(func.sum(RS.revenue_gross)).filter(
        RS.company_id == COMPANY_ID,
        RS.revenue_period >= date(2024, 1, 1),
        RS.revenue_period <= date(2024, 12, 31),
    ).scalar() or Decimal(0)

    total_2023 = db.query(func.sum(RS.revenue_gross)).filter(
        RS.company_id == COMPANY_ID,
        RS.revenue_period >= date(2023, 1, 1),
        RS.revenue_period <= date(2023, 12, 31),
    ).scalar() or Decimal(0)

    cogs_25 = db.query(func.sum(Expense.amount)).filter(
        Expense.company_id == COMPANY_ID,
        Expense.category == ExpenseCategory.COGS,
        Expense.period >= date(2025, 1, 1),
        Expense.period <= date(2025, 12, 31),
    ).scalar() or Decimal(0)

    opex_25 = db.query(func.sum(Expense.amount)).filter(
        Expense.company_id == COMPANY_ID,
        Expense.category == ExpenseCategory.OPEX,
        Expense.period >= date(2025, 1, 1),
        Expense.period <= date(2025, 12, 31),
    ).scalar() or Decimal(0)

    owner_25 = db.query(func.sum(Expense.amount)).filter(
        Expense.company_id == COMPANY_ID,
        Expense.category == ExpenseCategory.OWNER,
        Expense.period >= date(2025, 1, 1),
        Expense.period <= date(2025, 12, 31),
    ).scalar() or Decimal(0)

    gross_profit = total_2025 - cogs_25
    ebitda = gross_profit - opex_25

    print("\n  === VERIFICATION ===")
    print(f"  Revenue 2023 : ${total_2023:>12,.0f}  (target: $2,793,233)")
    print(f"  Revenue 2024 : ${total_2024:>12,.0f}  (target: $2,746,003)")
    print(f"  Revenue 2025 : ${total_2025:>12,.0f}  (target: $4,196,172)")
    print(f"  COGS 2025    : ${cogs_25:>12,.0f}  (target: $2,334,320)")
    print(f"  OpEx 2025    : ${opex_25:>12,.0f}  (target:   $118,495)")
    print(f"  Owner Comp   : ${owner_25:>12,.0f}  (target:   $202,221)")
    print(f"  Gross Profit : ${gross_profit:>12,.0f}  (target: $1,861,852)")
    print(f"  EBITDA       : ${ebitda:>12,.0f}  (target: $1,743,357)")


def ensure_demo_ingestion_job_if_missing(db: Session) -> bool:
    """
    Ensure company_id=1 has the demo ingestion job with column_mappings for Field Mapping UI.
    Inserts when no jobs exist; backfills mappings on the demo job if the row exists but mappings are empty.
    Idempotent.
    """
    cmap = _demo_column_mappings()
    job = (
        db.query(IngestionJob)
        .filter(IngestionJob.company_id == COMPANY_ID, IngestionJob.ingestion_id == DEMO_INGESTION_ID)
        .first()
    )
    if job:
        mlist = []
        if job.column_mappings and isinstance(job.column_mappings, dict):
            mlist = job.column_mappings.get("mappings") or []
        if len(mlist) == 0:
            job.column_mappings = cmap
            job.mapped_count = len(cmap["mappings"])
            db.commit()
            logger.info("Backfilled column_mappings for demo ingestion job (company_id=1).")
            return True
        return False

    n = (
        db.query(func.count(IngestionJob.id))
        .filter(IngestionJob.company_id == COMPANY_ID)
        .scalar()
        or 0
    )
    if n > 0:
        return False
    db.add(
        IngestionJob(
            company_id=COMPANY_ID,
            ingestion_id=DEMO_INGESTION_ID,
            filename="ABC_Company_Inc_QuickBooks_PnL_TTM.csv",
            source_type="quickbooks_pl",
            file_path=None,
            current_phase=PipelinePhase.P6_EXTRACTION,
            current_status=PhaseStatus.COMPLETE,
            row_count=1247,
            mapped_count=len(cmap["mappings"]),
            error_count=0,
            column_mappings=cmap,
        )
    )
    db.commit()
    logger.info("Seeded demo ingestion job for company_id=1 (ABC Company Inc. P&L).")
    return True


def _demo_2025_revenue_matches(db: Session) -> bool:
    total_2025 = (
        db.query(func.sum(RevenueStream.revenue_gross))
        .filter(
            RevenueStream.company_id == COMPANY_ID,
            RevenueStream.revenue_period >= date(2025, 1, 1),
            RevenueStream.revenue_period <= date(2025, 12, 31),
        )
        .scalar()
    )
    if total_2025 is None:
        return False
    diff = abs(Decimal(str(total_2025)) - EXPECTED_2025_REVENUE)
    if diff >= Decimal("5000"):
        return False
    # Older seeds used duplicate monthly weights (e.g. Jan == Feb company totals). Re-seed so
    # month-over-month variation matches current MONTHLY_WEIGHTS_2025.
    jan = (
        db.query(func.sum(RevenueStream.revenue_gross))
        .filter(
            RevenueStream.company_id == COMPANY_ID,
            RevenueStream.revenue_period == date(2025, 1, 31),
        )
        .scalar()
    )
    feb = (
        db.query(func.sum(RevenueStream.revenue_gross))
        .filter(
            RevenueStream.company_id == COMPANY_ID,
            RevenueStream.revenue_period == date(2025, 2, 28),
        )
        .scalar()
    )
    jan_d = Decimal(str(jan or 0))
    feb_d = Decimal(str(feb or 0))
    if jan_d == 0 and feb_d == 0:
        return False
    return jan_d != feb_d


def ensure_demo_company_seeded(db: Session) -> bool:
    """
    Seed ABC Company when company_id=1 has no revenue, or when 2025 revenue does not match
    the current ABC targets (stale DB from an older seed). Idempotent.
    Returns True if seeding ran, False if data was already correct.
    """
    n = (
        db.query(func.count(RevenueStream.id))
        .filter(RevenueStream.company_id == COMPANY_ID)
        .scalar()
    )
    if n and n > 0 and _demo_2025_revenue_matches(db):
        return False
    if n and n > 0:
        logger.info(
            "Demo company id=1 has stale or mismatched 2025 revenue — wiping and re-seeding ABC sandbox."
        )
    else:
        logger.info("Seeding demo company (id=1) with ABC sandbox data...")
    wipe_company_data(db, COMPANY_ID)
    seed_customers_and_revenue(db)
    seed_expenses(db)
    seed_employee(db)
    db.commit()
    verify(db)
    ensure_demo_ingestion_job_if_missing(db)
    return True


def run_seed_abc_company():
    """CLI: create tables, wipe company 1, and seed full ABC dataset."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        print("\nSeeding ABC Company Inc (company_id=1)...")
        wipe_company_data(db, COMPANY_ID)
        seed_customers_and_revenue(db)
        seed_expenses(db)
        seed_employee(db)
        db.commit()
        verify(db)
        ensure_demo_ingestion_job_if_missing(db)
        print("\n  Seeding complete.")
    except Exception as e:
        db.rollback()
        print(f"\nERROR: {e}")
        traceback.print_exc()
    finally:
        db.close()
