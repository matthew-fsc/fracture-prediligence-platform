"""
Sandbox data generator for Meridian Consulting Group (company_id=1).

Produces four CSV files matching the exact export formats of:
  - QuickBooks Online: Transaction List by Date (GL-style)
  - QuickBooks Online: Customer Contact List
  - Gusto: Payroll Summary Report
  - HubSpot: Deals export

Run from backend/ directory:
    python scripts/generate_sandbox_data.py

Output files are written to data/sandbox/ and printed so you can
drag-and-drop them into the Connectors upload UI.
"""

from __future__ import annotations
import csv
import os
import random
from datetime import date, timedelta
from pathlib import Path


OUTPUT_DIR = Path(__file__).parent.parent / "data" / "sandbox"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

random.seed(42)  # reproducible


# ─── Company profile ──────────────────────────────────────────────────────────
# Meridian Consulting Group — B2B strategy/ops consulting firm
# 3-year period: Jan 2022 – Dec 2024 (36 months)
# Revenue grows ~12% YoY; mostly recurring retainers
# EBITDA ~$820K on $2.7M revenue (TTM 2024)
# Owner comp inflated → normalized EBITDA ~$1.05M

START = date(2022, 1, 1)
END   = date(2024, 12, 31)


# ─── Clients ──────────────────────────────────────────────────────────────────
CLIENTS = [
    # (name, monthly_retainer, project_fees_per_year, start_date, is_active)
    ("Pinnacle Manufacturing LLC",    32_000, 45_000, date(2022, 1, 1),  True),
    ("Vertex Capital Partners",       22_000, 20_000, date(2022, 1, 1),  True),
    ("Cascade Health Systems",        18_500, 15_000, date(2022, 3, 1),  True),
    ("Redwood Logistics Inc",         16_000, 10_000, date(2022, 1, 1),  True),
    ("Summit Technology Group",       14_000, 25_000, date(2022, 6, 1),  True),
    ("Harbor Financial Services",     12_500,  8_000, date(2022, 2, 1),  True),
    ("BlueSky Retail Partners",       11_000, 12_000, date(2022, 9, 1),  True),
    ("Irongate Construction",          9_500,  6_000, date(2023, 1, 1),  True),
    ("Meridian Data Solutions",        9_000, 18_000, date(2023, 3, 1),  True),
    ("Northfield Pharma",              8_500,  5_000, date(2023, 6, 1),  True),
    ("Pacific Ventures LLC",           7_500,  0,     date(2022, 1, 1),  True),
    ("Clearwater Energy",              7_000,  8_000, date(2022, 4, 1),  True),
    ("Granite Peak Advisors",          6_500,  0,     date(2022, 7, 1),  True),
    ("Foxwood Media Group",            6_000, 10_000, date(2023, 9, 1),  True),
    ("Thornton Aerospace",             5_500,  0,     date(2022, 1, 1),  False),  # churned mid-2023
    ("Cedar Grove Capital",            5_000,  0,     date(2022, 1, 1),  False),  # churned early 2023
    ("Waverly Biotech",                4_500, 22_000, date(2024, 1, 1),  True),
    ("Blackrock Distribution",         4_000,  0,     date(2024, 6, 1),  True),
]

# When churned clients stopped paying (approximate)
CHURN_DATES = {
    "Thornton Aerospace": date(2023, 7, 1),
    "Cedar Grove Capital": date(2023, 2, 1),
}


# ─── Employees ────────────────────────────────────────────────────────────────
EMPLOYEES = [
    # (id, last, first, role, dept, annual_comp, is_owner, hire_date, status)
    ("E001", "Chen",     "Robert",   "CEO",                    "Executive",  185_000, True,  date(2018, 3, 15), "Active"),
    ("E002", "Mitchell", "Sarah",    "Managing Partner",       "Executive",  170_000, True,  date(2019, 7, 1),  "Active"),
    ("E003", "Park",     "James",    "VP Operations",          "Operations", 148_000, False, date(2020, 1, 15), "Active"),
    ("E004", "Watson",   "Emily",    "VP Client Services",     "Client Svc", 138_000, False, date(2020, 5, 1),  "Active"),
    ("E005", "Torres",   "Michael",  "Senior Consultant",      "Consulting", 118_000, False, date(2021, 3, 10), "Active"),
    ("E006", "Foster",   "Amanda",   "Senior Consultant",      "Consulting", 112_000, False, date(2021, 9, 1),  "Active"),
    ("E007", "Kim",      "David",    "Consultant",             "Consulting",  96_000, False, date(2022, 2, 14), "Active"),
    ("E008", "Green",    "Rachel",   "Consultant",             "Consulting",  92_000, False, date(2022, 6, 1),  "Active"),
    ("E009", "Lee",      "Kevin",    "Senior Analyst",         "Consulting",  78_000, False, date(2023, 1, 9),  "Active"),
    ("E010", "Patel",    "Priya",    "Office Manager",         "Operations",  67_000, False, date(2021, 11, 1), "Active"),
    ("E011", "Nguyen",   "Brian",    "Analyst",                "Consulting",  65_000, False, date(2023, 8, 14), "Active"),
    ("E012", "Rivera",   "Sofia",    "Analyst",                "Consulting",  63_000, False, date(2024, 1, 22), "Active"),
    ("E013", "Thompson", "Mark",     "Senior Consultant",      "Consulting", 115_000, False, date(2020, 8, 3),  "Terminated"),  # left mid-2022
]

TERM_DATES = {
    "E013": date(2022, 8, 31),
}


# ─── Expense categories ────────────────────────────────────────────────────────
# (account_name, category_type, annual_amount, is_owner_related)
EXPENSE_TEMPLATES = [
    # Payroll (generated from employees, not here)
    ("Rent & Occupancy",         "OPEX",         84_000, False),
    ("Software & Subscriptions", "OPEX",         36_000, False),
    ("Professional Development", "OPEX",         18_000, False),
    ("Travel & Entertainment",   "OPEX",         42_000, False),
    ("Marketing & Business Dev", "OPEX",         24_000, False),
    ("Insurance",                "OPEX",         22_000, False),
    ("Legal & Professional Fees","OPEX",         28_000, False),
    ("Office Supplies",          "OPEX",          8_400, False),
    ("Utilities",                "OPEX",         12_000, False),
    ("Depreciation",             "OPEX",         15_000, False),
    # Owner-related add-backs
    ("Owner Auto - R. Chen",     "OWNER",        18_000, True),
    ("Owner Auto - S. Mitchell", "OWNER",        18_000, True),
    ("Owner Life Insurance",     "OWNER",        24_000, True),
    ("Owner Personal Meals",     "PERSONAL",      9_600, True),
    ("Owner Club Memberships",   "PERSONAL",     14_400, True),
    ("Owner Travel - Personal",  "PERSONAL",     12_000, True),
]


# ─── Helpers ──────────────────────────────────────────────────────────────────

def months_between(d1: date, d2: date) -> list[date]:
    """All month-start dates from d1 to d2 inclusive."""
    months = []
    cur = d1.replace(day=1)
    end = d2.replace(day=1)
    while cur <= end:
        months.append(cur)
        if cur.month == 12:
            cur = cur.replace(year=cur.year + 1, month=1)
        else:
            cur = cur.replace(month=cur.month + 1)
    return months

def growth_factor(d: date) -> float:
    """Apply ~12% YoY growth from 2022 baseline."""
    years_since = (d.year - 2022) + (d.month - 1) / 12
    return 1.0 + 0.12 * years_since

def fmt_amount(v: float) -> str:
    return f"{v:,.2f}"

def ssn_mask(emp_id: str) -> str:
    """Fake SSN for sandbox — masked."""
    num = int(emp_id[1:])
    return f"XXX-XX-{1000 + num:04d}"


# ─── Generator 1: QuickBooks Transaction List ─────────────────────────────────

def generate_qb_transactions() -> Path:
    out = OUTPUT_DIR / "quickbooks_transaction_list.csv"
    rows = []

    # Revenue transactions
    for client_name, monthly, annual_proj, start, is_active in CLIENTS:
        churn = CHURN_DATES.get(client_name)
        for mo in months_between(START, END):
            if mo < start:
                continue
            if churn and mo >= churn:
                continue
            if not is_active and not churn and mo > date(2023, 12, 31):
                continue
            g = growth_factor(mo)
            amount = round(monthly * g + random.uniform(-monthly * 0.03, monthly * 0.03), 2)
            invoice_num = f"INV-{mo.year}{mo.month:02d}-{abs(hash(client_name + str(mo))) % 9000 + 1000}"
            rows.append({
                "Date": mo.strftime("%m/%d/%Y"),
                "Transaction Type": "Invoice",
                "Num": invoice_num,
                "Name": client_name,
                "Memo/Description": f"Monthly Retainer - {mo.strftime('%B %Y')}",
                "Account": "Accounts Receivable",
                "Split": "Consulting Revenue",
                "Amount": fmt_amount(amount),
            })
            # Payment received ~15 days later
            pay_date = mo + timedelta(days=15)
            rows.append({
                "Date": pay_date.strftime("%m/%d/%Y"),
                "Transaction Type": "Payment",
                "Num": f"PMT-{invoice_num}",
                "Name": client_name,
                "Memo/Description": f"Payment for {invoice_num}",
                "Account": "Checking - Operating",
                "Split": "Accounts Receivable",
                "Amount": fmt_amount(amount),
            })

        # Project fees (1-2 per year where applicable)
        if annual_proj > 0:
            for yr in [2022, 2023, 2024]:
                proj_date = date(yr, random.choice([3, 6, 9]), 1)
                if proj_date < start:
                    continue
                if churn and proj_date >= churn:
                    continue
                if proj_date > END:
                    continue
                g = growth_factor(proj_date)
                amount = round(annual_proj * g * random.uniform(0.85, 1.15), 2)
                pnum = f"INV-{proj_date.year}{proj_date.month:02d}-P{abs(hash(client_name + str(yr))) % 900 + 100}"
                rows.append({
                    "Date": proj_date.strftime("%m/%d/%Y"),
                    "Transaction Type": "Invoice",
                    "Num": pnum,
                    "Name": client_name,
                    "Memo/Description": f"Project Fee - {yr} Engagement",
                    "Account": "Accounts Receivable",
                    "Split": "Project Revenue",
                    "Amount": fmt_amount(amount),
                })

    # Expense transactions
    for acc_name, category, annual_amt, _ in EXPENSE_TEMPLATES:
        monthly_amt = annual_amt / 12
        for mo in months_between(START, END):
            jitter = random.uniform(0.88, 1.12)
            amount = round(monthly_amt * jitter, 2)
            rows.append({
                "Date": (mo + timedelta(days=random.randint(1, 25))).strftime("%m/%d/%Y"),
                "Transaction Type": "Expense",
                "Num": f"EXP-{abs(hash(acc_name + str(mo))) % 9000 + 1000}",
                "Name": "Various Vendors",
                "Memo/Description": acc_name,
                "Account": acc_name,
                "Split": "Checking - Operating",
                "Amount": fmt_amount(-amount),
            })

    # Payroll expenses (monthly, from employee list)
    for eid, last, first, role, dept, annual_comp, is_owner, hire, status in EMPLOYEES:
        term = TERM_DATES.get(eid)
        for mo in months_between(START, END):
            if mo < hire.replace(day=1):
                continue
            if term and mo > term.replace(day=1):
                continue
            g = 1.0 + 0.04 * ((mo.year - 2022) + (mo.month - 1) / 12)  # 4% annual raises
            monthly_gross = round(annual_comp / 12 * g, 2)
            rows.append({
                "Date": (mo + timedelta(days=15)).strftime("%m/%d/%Y"),
                "Transaction Type": "Payroll",
                "Num": f"PR-{mo.year}{mo.month:02d}-{eid}",
                "Name": f"{first} {last}",
                "Memo/Description": f"Payroll - {role}",
                "Account": "Payroll Expenses",
                "Split": "Payroll Liabilities",
                "Amount": fmt_amount(-monthly_gross),
            })

    rows.sort(key=lambda r: r["Date"])

    fieldnames = ["Date", "Transaction Type", "Num", "Name", "Memo/Description", "Account", "Split", "Amount"]
    with open(out, "w", newline="", encoding="utf-8") as f:
        # QB-style header block
        f.write("Meridian Consulting Group\n")
        f.write("Transaction List by Date\n")
        f.write(f"January 2022 through December 2024\n")
        f.write("\n")
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"  ✓ QuickBooks Transaction List  → {out.name}  ({len(rows)} rows)")
    return out


# ─── Generator 2: QuickBooks Customer List ────────────────────────────────────

def generate_qb_customers() -> Path:
    out = OUTPUT_DIR / "quickbooks_customer_list.csv"
    fieldnames = [
        "Customer", "Company", "Email", "Phone", "Billing Address",
        "Billing City", "Billing State", "Billing ZIP",
        "Balance", "Open Balance", "Active", "Customer Since",
    ]
    emails = {c[0]: c[0].lower().replace(" ", "").replace(",", "")[:12] + "@" + c[0].split()[0].lower() + ".com"
              for c in CLIENTS}
    with open(out, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for name, monthly, _, start, is_active in CLIENTS:
            balance = round(monthly * random.uniform(0.9, 1.1), 2) if is_active else 0.0
            writer.writerow({
                "Customer":        name,
                "Company":         name,
                "Email":           emails[name],
                "Phone":           f"({random.randint(200,999)}) {random.randint(200,999)}-{random.randint(1000,9999)}",
                "Billing Address": f"{random.randint(100,9999)} {random.choice(['Main','Oak','Elm','Park','Lake'])} St",
                "Billing City":    random.choice(["Chicago","Denver","Seattle","Austin","Boston","Atlanta"]),
                "Billing State":   random.choice(["IL","CO","WA","TX","MA","GA"]),
                "Billing ZIP":     f"{random.randint(10000,99999)}",
                "Balance":         fmt_amount(balance),
                "Open Balance":    fmt_amount(balance),
                "Active":          "Yes" if is_active else "No",
                "Customer Since":  start.strftime("%m/%d/%Y"),
            })
    print(f"  ✓ QuickBooks Customer List     → {out.name}  ({len(CLIENTS)} customers)")
    return out


# ─── Generator 3: Gusto Payroll Report ────────────────────────────────────────

def generate_gusto_payroll() -> Path:
    out = OUTPUT_DIR / "gusto_payroll_report.csv"
    fieldnames = [
        "Employee ID", "Last Name", "First Name", "SSN",
        "Pay Period Start", "Pay Period End", "Check Date",
        "Gross Pay", "Federal Income Tax", "State Income Tax",
        "Social Security", "Medicare", "Net Pay",
        "Department", "Flsa Status",
    ]
    rows = []
    for eid, last, first, role, dept, annual_comp, is_owner, hire, status in EMPLOYEES:
        term = TERM_DATES.get(eid)
        for mo in months_between(START, END):
            if mo < hire.replace(day=1):
                continue
            if term and mo > term.replace(day=1):
                continue
            g = 1.0 + 0.04 * ((mo.year - 2022) + (mo.month - 1) / 12)
            gross = round(annual_comp / 12 * g, 2)
            fed   = round(gross * 0.22, 2)
            state = round(gross * 0.05, 2)
            ss    = round(gross * 0.062, 2)
            med   = round(gross * 0.0145, 2)
            net   = round(gross - fed - state - ss - med, 2)
            period_start = mo
            period_end   = (mo.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
            check_date   = period_end + timedelta(days=3)
            rows.append({
                "Employee ID":       eid,
                "Last Name":         last,
                "First Name":        first,
                "SSN":               ssn_mask(eid),
                "Pay Period Start":  period_start.strftime("%Y-%m-%d"),
                "Pay Period End":    period_end.strftime("%Y-%m-%d"),
                "Check Date":        check_date.strftime("%Y-%m-%d"),
                "Gross Pay":         fmt_amount(gross),
                "Federal Income Tax":fmt_amount(fed),
                "State Income Tax":  fmt_amount(state),
                "Social Security":   fmt_amount(ss),
                "Medicare":          fmt_amount(med),
                "Net Pay":           fmt_amount(net),
                "Department":        dept,
                "Flsa Status":       "Exempt",
            })
    with open(out, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"  ✓ Gusto Payroll Report         → {out.name}  ({len(rows)} pay periods)")
    return out


# ─── Generator 4: HubSpot Deals (contracts pipeline) ─────────────────────────

def generate_hubspot_deals() -> Path:
    out = OUTPUT_DIR / "hubspot_deals.csv"
    fieldnames = [
        "Deal ID", "Deal Name", "Associated Company", "Deal Stage",
        "Close Date", "Contract Start Date", "Contract End Date",
        "Amount", "Deal Type", "Deal Owner", "Create Date",
        "Number of Associated Contacts", "HS Deal ID",
    ]
    rows = []
    deal_id = 1001
    for name, monthly, annual_proj, start, is_active in CLIENTS:
        # Retainer contract
        churn = CHURN_DATES.get(name)
        contract_end = churn - timedelta(days=1) if churn else date(2025, 12, 31)
        contract_end = min(contract_end, date(2025, 12, 31))
        years = max(1, (contract_end - start).days // 365)
        annual_value = monthly * 12
        rows.append({
            "Deal ID":                       f"HS-{deal_id}",
            "Deal Name":                     f"{name} - Strategy Retainer",
            "Associated Company":            name,
            "Deal Stage":                    "Closed Won" if is_active else "Closed Lost",
            "Close Date":                    start.strftime("%Y-%m-%d"),
            "Contract Start Date":           start.strftime("%Y-%m-%d"),
            "Contract End Date":             contract_end.strftime("%Y-%m-%d"),
            "Amount":                        fmt_amount(annual_value),
            "Deal Type":                     "Recurring Retainer",
            "Deal Owner":                    "Robert Chen",
            "Create Date":                   (start - timedelta(days=30)).strftime("%Y-%m-%d"),
            "Number of Associated Contacts": random.randint(1, 4),
            "HS Deal ID":                    deal_id,
        })
        deal_id += 1

        # Project deal (if applicable)
        if annual_proj > 0:
            proj_close = start + timedelta(days=90)
            if proj_close <= END:
                rows.append({
                    "Deal ID":                       f"HS-{deal_id}",
                    "Deal Name":                     f"{name} - 2023 Transformation Project",
                    "Associated Company":            name,
                    "Deal Stage":                    "Closed Won",
                    "Close Date":                    proj_close.strftime("%Y-%m-%d"),
                    "Contract Start Date":           proj_close.strftime("%Y-%m-%d"),
                    "Contract End Date":             (proj_close + timedelta(days=180)).strftime("%Y-%m-%d"),
                    "Amount":                        fmt_amount(annual_proj),
                    "Deal Type":                     "Project",
                    "Deal Owner":                    random.choice(["Robert Chen", "Sarah Mitchell"]),
                    "Create Date":                   (proj_close - timedelta(days=45)).strftime("%Y-%m-%d"),
                    "Number of Associated Contacts": random.randint(1, 3),
                    "HS Deal ID":                    deal_id,
                })
                deal_id += 1

    with open(out, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"  ✓ HubSpot Deals Export         → {out.name}  ({len(rows)} deals)")
    return out


# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print(f"\nGenerating Meridian Consulting Group sandbox data → {OUTPUT_DIR}\n")
    f1 = generate_qb_transactions()
    f2 = generate_qb_customers()
    f3 = generate_gusto_payroll()
    f4 = generate_hubspot_deals()
    print(f"\nDone. 4 files in {OUTPUT_DIR}")
    print("\nUpload these via the Connectors page in the UI:")
    for f in [f1, f2, f3, f4]:
        print(f"  {f}")
