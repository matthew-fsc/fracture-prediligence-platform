"""
Directly ingest all sandbox CSV files into the SQLite database
by calling the pipeline module without HTTP.

Run from the backend/ directory:
    python scripts/ingest_sandbox_data.py
"""

from __future__ import annotations
import sys
import os
from pathlib import Path

# Make sure app/ is importable
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load .env before importing settings
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from app.core.database import engine, SessionLocal, Base
import app.ontology.models           # noqa — register with Base
import app.ontology.ingestion_models  # noqa

from app.ontology.models import Company
from app.ingestion.pipeline import run_pipeline

SANDBOX_DIR = Path(__file__).parent.parent / "data" / "sandbox"

FILES = [
    ("quickbooks_transaction_list.csv", "quickbooks_pl"),
    ("quickbooks_customer_list.csv",    "quickbooks_customers"),
    ("gusto_payroll_report.csv",        "gusto_payroll"),
    ("hubspot_deals.csv",               "hubspot_deals"),
]


def main():
    # Ensure tables + seed company
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if not db.query(Company).filter(Company.id == 1).first():
            db.add(Company(id=1, name="Demo Company"))
            db.commit()

        print(f"\nIngesting {len(FILES)} sandbox files for company_id=1\n")

        for fname, source_type in FILES:
            fpath = SANDBOX_DIR / fname
            if not fpath.exists():
                print(f"  SKIP  {fname} (not found)")
                continue

            data = fpath.read_bytes()
            print(f"  Processing {fname} ({len(data):,} bytes)...")

            try:
                job = run_pipeline(
                    company_id=1,
                    filename=fname,
                    file_data=data,
                    source_type=source_type,
                    db=db,
                )
                db.commit()
                print(
                    f"  -> phase={job.current_phase}  status={job.current_status}"
                    f"  rows={job.row_count}  mapped={job.mapped_count}"
                    f"  errors={job.error_count}"
                )
                if job.validation_report:
                    vr = job.validation_report
                    print(f"     validation={vr.get('overall')}  source={vr.get('source_system_hint')}")
            except Exception as exc:
                db.rollback()
                print(f"  ERROR: {exc}")
                import traceback
                traceback.print_exc()

        # Quick summary query
        from app.ontology.models import RevenueStream, Customer, Employee, Expense, Contract
        from sqlalchemy import func
        counts = {
            "revenue_streams": db.query(func.count(RevenueStream.id)).filter(RevenueStream.company_id == 1).scalar(),
            "customers":       db.query(func.count(Customer.id)).filter(Customer.company_id == 1).scalar(),
            "employees":       db.query(func.count(Employee.id)).filter(Employee.company_id == 1).scalar(),
            "expenses":        db.query(func.count(Expense.id)).filter(Expense.company_id == 1).scalar(),
            "contracts":       db.query(func.count(Contract.id)).filter(Contract.company_id == 1).scalar(),
        }
        print("\nOntology record counts after ingestion:")
        for k, v in counts.items():
            print(f"  {k:25s}: {v:,}")

    finally:
        db.close()


if __name__ == "__main__":
    main()
