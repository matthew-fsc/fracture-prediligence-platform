# Re-export shim — logic moved to operational_analytics.py
from app.analytics.operational_analytics import compute_customer_risk, CustomerRiskScore
__all__ = ["compute_customer_risk", "CustomerRiskScore"]
