# Re-export shim — logic moved to composite_analytics.py
from app.analytics.composite_analytics import ebitda_basis_for_company, DEFAULT_MARKET_RATE
__all__ = ["ebitda_basis_for_company", "DEFAULT_MARKET_RATE"]
