# Re-export shim — logic moved to composite_analytics.py
from app.analytics.composite_analytics import (
    GapItem, ValueGapResult, CATEGORY_META, compute_value_gap,
)
__all__ = ["GapItem", "ValueGapResult", "CATEGORY_META", "compute_value_gap"]
