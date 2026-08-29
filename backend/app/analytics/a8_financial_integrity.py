# Re-export shim — logic moved to operational_analytics.py
from app.analytics.operational_analytics import compute_financial_integrity, FinancialIntegrityScore
__all__ = ["compute_financial_integrity", "FinancialIntegrityScore"]
