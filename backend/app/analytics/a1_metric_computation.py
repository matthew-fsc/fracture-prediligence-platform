"""
A1 — Metric Computation (Blueprint II §A1)

Computes all 40+ foundational metrics from ontology records before any scoring.
This metric registry is the input to every subsequent analytical phase (A2–A14).
"""

from __future__ import annotations
from dataclasses import dataclass, field
import calendar
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional
import statistics

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.ontology.models import Company, RevenueStream, Customer, Employee, Expense, Contract, RevenueType, ExpenseCategory, EmployeeStatus


def _add_months(d: date, months: int) -> date:
    """Calendar month arithmetic; clamps day to last day of target month."""
    m_idx = d.year * 12 + d.month - 1 + months
    y = m_idx // 12
    mo = m_idx % 12 + 1
    last = calendar.monthrange(y, mo)[1]
    return date(y, mo, min(d.day, last))


@dataclass
class MetricRegistry:
    """All computed metrics for a single company. Inputs to A2–A14."""

    # Revenue metrics (A1.1)
    total_revenue_ttm: Decimal = Decimal(0)
    total_revenue_by_year: dict[int, Decimal] = field(default_factory=dict)
    yoy_growth_by_year: dict[int, float] = field(default_factory=dict)
    cagr_3yr: Optional[float] = None
    recurring_revenue_ttm: Decimal = Decimal(0)
    recurring_revenue_pct: float = 0.0
    project_revenue_pct: float = 0.0
    revenue_by_customer: dict[int, Decimal] = field(default_factory=dict)
    top_customer_revenue_pct: float = 0.0
    top5_customer_revenue_pct: float = 0.0
    hhi: float = 0.0
    monthly_revenue_24m: dict[str, Decimal] = field(default_factory=dict)
    revenue_consistency_score: float = 0.0   # coefficient of variation (lower = better)
    avg_monthly_revenue_ttm: Decimal = Decimal(0)

    # Customer metrics (A1.2)
    active_customer_count_ttm: int = 0
    total_customer_count: int = 0
    customer_churn_rate: float = 0.0
    net_revenue_retention: float = 0.0
    avg_customer_revenue_ttm: Decimal = Decimal(0)
    avg_customer_tenure_years: float = 0.0
    pct_customers_with_active_contracts: float = 0.0
    pct_customers_with_multiyear_contracts: float = 0.0
    revenue_at_risk_6mo: Decimal = Decimal(0)

    # Cost & employee metrics (A1.3)
    gross_profit: Decimal = Decimal(0)
    gross_margin_pct: float = 0.0
    total_opex_ttm: Decimal = Decimal(0)
    ebitda_ttm: Decimal = Decimal(0)      # gross_profit - opex (proxy when full P&L not available)
    owner_compensation_total: Decimal = Decimal(0)
    market_rate_replacement_cost: Decimal = Decimal(0)
    owner_comp_delta: Decimal = Decimal(0)
    total_headcount: int = 0
    revenue_per_employee: Decimal = Decimal(0)
    avg_employee_tenure_years: float = 0.0
    management_layer_count: int = 0


def compute_metrics(company_id: int, db: Session) -> MetricRegistry:
    """
    Main entry point for A1. Returns a fully-populated MetricRegistry.
    Called by A2–A14 before any scoring begins.
    """
    m = MetricRegistry()
    today = date.today()

    # Use the latest revenue_period in the database as the reference "today"
    # so that sandbox / historical datasets aren't excluded by a future TTM window.
    latest_rev_date = db.query(func.max(RevenueStream.revenue_period)).filter(
        RevenueStream.company_id == company_id
    ).scalar()
    ref_date = latest_rev_date if latest_rev_date and latest_rev_date < today else today
    ttm_start = ref_date - timedelta(days=365)

    # TTM revenue sums every row with period >= ttm_start. If the DB mixes annual,
    # monthly, and extra connector ingests for the same economics, this double-counts
    # and inflates revenue, gross profit, and EBITDA vs. a single clean P&L path.

    # --- Revenue: TTM ---
    ttm_revenue_rows = (
        db.query(RevenueStream)
        .filter(RevenueStream.company_id == company_id, RevenueStream.revenue_period >= ttm_start)
        .all()
    )
    m.total_revenue_ttm = sum(r.revenue_gross for r in ttm_revenue_rows) or Decimal(0)
    m.avg_monthly_revenue_ttm = m.total_revenue_ttm / 12

    # Recurring
    recurring = [r for r in ttm_revenue_rows if r.recurring_flag or r.revenue_type in (RevenueType.RECURRING, RevenueType.SUBSCRIPTION)]
    m.recurring_revenue_ttm = sum(r.revenue_gross for r in recurring) or Decimal(0)
    if m.total_revenue_ttm:
        m.recurring_revenue_pct = float(m.recurring_revenue_ttm / m.total_revenue_ttm) * 100
        m.project_revenue_pct = 100 - m.recurring_revenue_pct

    # Revenue by customer (TTM)
    for row in ttm_revenue_rows:
        if row.customer_id:
            m.revenue_by_customer[row.customer_id] = m.revenue_by_customer.get(row.customer_id, Decimal(0)) + row.revenue_gross

    if m.revenue_by_customer and m.total_revenue_ttm:
        sorted_customers = sorted(m.revenue_by_customer.values(), reverse=True)
        m.top_customer_revenue_pct = float(sorted_customers[0] / m.total_revenue_ttm) * 100
        top5 = sum(sorted_customers[:5])
        m.top5_customer_revenue_pct = float(top5 / m.total_revenue_ttm) * 100
        # HHI
        m.hhi = sum((float(v / m.total_revenue_ttm) * 100) ** 2 for v in m.revenue_by_customer.values())

    # YoY revenue by year (3yr, including ref year)
    for yr in range(ref_date.year - 2, ref_date.year + 1):
        yr_start = date(yr, 1, 1)
        yr_end = date(yr, 12, 31)
        total = db.query(func.sum(RevenueStream.revenue_gross)).filter(
            RevenueStream.company_id == company_id,
            RevenueStream.revenue_period >= yr_start,
            RevenueStream.revenue_period <= yr_end,
        ).scalar() or Decimal(0)
        m.total_revenue_by_year[yr] = total

    # CAGR: use full-year endpoints, divide by number of periods (years - 1)
    years = sorted(m.total_revenue_by_year.keys())
    if len(years) >= 2 and m.total_revenue_by_year[years[0]]:
        n = len(years) - 1  # periods of growth between first and last full year
        m.cagr_3yr = (float(m.total_revenue_by_year[years[-1]] / m.total_revenue_by_year[years[0]]) ** (1 / n) - 1) * 100

    # Revenue consistency (coefficient of variation on monthly — uses 24m window, not TTM-only)
    revenue_24m_start = ref_date - timedelta(days=730)
    revenue_24m_rows = (
        db.query(RevenueStream)
        .filter(RevenueStream.company_id == company_id, RevenueStream.revenue_period >= revenue_24m_start)
        .all()
    )
    monthly_vals = []
    ref_month_first = ref_date.replace(day=1)
    for i in range(24):
        month_anchor = _add_months(ref_month_first, -i)
        y, mo = month_anchor.year, month_anchor.month
        period_start = date(y, mo, 1)
        period_end = date(y, mo, calendar.monthrange(y, mo)[1])
        mo_rev = sum(
            r.revenue_gross for r in revenue_24m_rows if period_start <= r.revenue_period <= period_end
        )
        key = f"{y:04d}-{mo:02d}"
        m.monthly_revenue_24m[key] = mo_rev
        monthly_vals.append(float(mo_rev))
    if monthly_vals and statistics.mean(monthly_vals):
        m.revenue_consistency_score = statistics.stdev(monthly_vals) / statistics.mean(monthly_vals)

    # --- Customers ---
    active_customer_ids = set(m.revenue_by_customer.keys())
    m.active_customer_count_ttm = len(active_customer_ids)
    m.total_customer_count = db.query(func.count(Customer.id)).filter(Customer.company_id == company_id).scalar() or 0
    if m.active_customer_count_ttm and m.total_revenue_ttm:
        m.avg_customer_revenue_ttm = m.total_revenue_ttm / m.active_customer_count_ttm

    # Customer churn rate: % of all customers who are marked inactive
    inactive_count = db.query(func.count(Customer.id)).filter(
        Customer.company_id == company_id, Customer.is_active == False
    ).scalar() or 0
    if m.total_customer_count > 0:
        m.customer_churn_rate = inactive_count / m.total_customer_count * 100

    # Tenure
    customers = db.query(Customer).filter(Customer.company_id == company_id, Customer.is_active == True).all()
    tenures = [(today - c.tenure_start).days / 365 for c in customers if c.tenure_start]
    if tenures:
        m.avg_customer_tenure_years = statistics.mean(tenures)

    # Contract coverage
    contracts = db.query(Contract).filter(Contract.company_id == company_id, Contract.is_active == True).all()
    active_contracts = [c for c in contracts if c.end_date and c.end_date > today]
    contracted_ids = {c.customer_id for c in active_contracts if c.customer_id}
    if m.active_customer_count_ttm:
        m.pct_customers_with_active_contracts = len(contracted_ids & active_customer_ids) / m.active_customer_count_ttm * 100
        multiyear = {c.customer_id for c in active_contracts if c.end_date and c.end_date > today + timedelta(days=365)}
        m.pct_customers_with_multiyear_contracts = len(multiyear & active_customer_ids) / m.active_customer_count_ttm * 100

    # Revenue at risk (<6mo contract expiry, no renewal confirmed)
    expiring_soon = [c for c in contracts if c.end_date and today < c.end_date <= today + timedelta(days=180) and not c.renewal_confirmed]
    for c in expiring_soon:
        if c.customer_id and c.customer_id in m.revenue_by_customer:
            m.revenue_at_risk_6mo += m.revenue_by_customer[c.customer_id]

    # --- Expenses ---
    expenses = db.query(Expense).filter(Expense.company_id == company_id, Expense.period >= ttm_start).all()
    cogs = sum(e.amount for e in expenses if e.category == ExpenseCategory.COGS)
    opex = sum(e.amount for e in expenses if e.category == ExpenseCategory.OPEX)
    m.gross_profit = m.total_revenue_ttm - cogs
    if m.total_revenue_ttm:
        m.gross_margin_pct = float(m.gross_profit / m.total_revenue_ttm) * 100
    m.total_opex_ttm = opex
    # EBITDA proxy: when no expense data, estimate from employee comp as labor cost
    if opex > 0 or cogs > 0:
        m.ebitda_ttm = m.gross_profit - opex
    else:
        # Fall back to payroll data as labor cost proxy.
        # comp_annual stores the annual compensation figure — use it directly.
        active_emps_all = db.query(Employee).filter(Employee.company_id == company_id, Employee.status == EmployeeStatus.ACTIVE).all()
        labor_est = Decimal(str(sum(float(e.comp_annual or 0) for e in active_emps_all)))
        m.ebitda_ttm = m.total_revenue_ttm - labor_est

    owner_comp = sum(e.amount for e in expenses if e.category in (ExpenseCategory.OWNER, ExpenseCategory.PERSONAL))
    employees_q = db.query(Employee).filter(Employee.company_id == company_id, Employee.is_owner == True, Employee.status == EmployeeStatus.ACTIVE).all()
    # Use OWNER expenses as authoritative when present (avoids double-counting with comp_annual)
    owner_salary = Decimal(0) if owner_comp > 0 else sum(e.comp_annual or 0 for e in employees_q)
    m.owner_compensation_total = owner_comp + Decimal(str(owner_salary))

    # --- Employees ---
    active_emps = db.query(Employee).filter(Employee.company_id == company_id, Employee.status == EmployeeStatus.ACTIVE).all()
    ingested_headcount = len(active_emps)
    company_row = db.query(Company).filter(Company.id == company_id).first()
    manual_headcount = company_row.total_headcount if company_row and company_row.total_headcount else 0
    # Advisor-entered headcount is the authoritative override; fall back to ingested records
    m.total_headcount = manual_headcount if manual_headcount > 0 else ingested_headcount
    if m.total_headcount and m.total_revenue_ttm:
        m.revenue_per_employee = m.total_revenue_ttm / m.total_headcount
    emp_tenures = [(today - e.hire_date).days / 365 for e in active_emps if e.hire_date]
    if emp_tenures:
        m.avg_employee_tenure_years = statistics.mean(emp_tenures)
    mgmt_levels = {e.management_level for e in active_emps if e.management_level is not None and e.management_level > 0}
    m.management_layer_count = len(mgmt_levels)

    return m
