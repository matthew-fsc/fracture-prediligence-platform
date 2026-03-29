"""
CLI wrapper — ABC Company seed (see app.services.demo_company_seed).

Run from backend/ directory:
    python scripts/seed_abc_company.py
"""

from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

from app.services.demo_company_seed import run_seed_abc_company

if __name__ == "__main__":
    run_seed_abc_company()
