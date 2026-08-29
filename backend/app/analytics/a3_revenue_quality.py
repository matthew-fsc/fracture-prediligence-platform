# Re-export shim — logic moved to financial_analytics.py
from app.analytics.financial_analytics import compute_revenue_quality, RevenueQualityScore
__all__ = ["compute_revenue_quality", "RevenueQualityScore"]
