# Re-export shim — logic moved to composite_analytics.py
from app.analytics.composite_analytics import (
    DRSTier, CategoryScores, DRSResult, WEIGHTS, compute_drs,
)
__all__ = ["DRSTier", "CategoryScores", "DRSResult", "WEIGHTS", "compute_drs"]
