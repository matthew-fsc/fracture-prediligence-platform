# Re-export shim — logic moved to operational_analytics.py
from app.analytics.operational_analytics import compute_growth_drivers, GrowthDriversScore
__all__ = ["compute_growth_drivers", "GrowthDriversScore"]
