# Re-export shim — logic moved to operational_analytics.py
from app.analytics.operational_analytics import compute_operational_independence, OperationalIndependenceScore
__all__ = ["compute_operational_independence", "OperationalIndependenceScore"]
