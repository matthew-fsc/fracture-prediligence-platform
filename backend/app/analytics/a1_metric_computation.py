# Re-export shim — logic moved to financial_analytics.py
from app.analytics.financial_analytics import (
    compute_metrics, MetricRegistry, effective_total_headcount,
)
__all__ = ["compute_metrics", "MetricRegistry", "effective_total_headcount"]
