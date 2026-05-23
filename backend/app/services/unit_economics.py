"""
Unit economics computation service.

Computes ARR, MRR, churn, and per-tier breakdowns from the UserSubscription table.
Used by the admin metrics endpoint for investor data room reporting.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy.orm import Session

from app.ontology.models import UserSubscription


# ---------------------------------------------------------------------------
# Tier display price constants — informational only.
# These are the display prices used for MRR estimation when Stripe is not queried.
# Actual billing amounts come from Stripe price objects.
# ---------------------------------------------------------------------------
_TIER_MONTHLY_DISPLAY = {
    "founding": 179,
    "pro":      299,
    "team":     799,
}

_TIER_ANNUAL_MONTHLY_EQUIV = {
    "founding": 149,
    "pro":      249,
    "team":     665,
}


def _monthly_value(tier: Optional[str], billing_interval: str) -> int:
    """Return estimated monthly revenue in dollars for a subscription record."""
    tier_key = (tier or "pro").lower()
    if billing_interval == "annual":
        return _TIER_ANNUAL_MONTHLY_EQUIV.get(tier_key, _TIER_ANNUAL_MONTHLY_EQUIV["pro"])
    return _TIER_MONTHLY_DISPLAY.get(tier_key, _TIER_MONTHLY_DISPLAY["pro"])


def compute_unit_economics(db: Session) -> dict:
    """
    Return a full unit economics snapshot from the UserSubscription table.
    All $ values are in USD (integer dollars).
    """
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    all_subs = db.query(UserSubscription).all()

    active = [s for s in all_subs if s.status == "active"]
    cancelled_recent = [
        s for s in all_subs
        if s.status == "cancelled" and s.updated_at and s.updated_at >= thirty_days_ago
    ]
    new_recent = [
        s for s in active
        if s.created_at and s.created_at >= thirty_days_ago
    ]
    past_due = [s for s in all_subs if s.status == "past_due"]

    # MRR breakdown by tier
    mrr_by_tier: dict[str, int] = {}
    for sub in active:
        tier = (sub.tier or "pro").lower()
        mrr_by_tier[tier] = mrr_by_tier.get(tier, 0) + _monthly_value(sub.tier, sub.billing_interval)

    total_mrr = sum(mrr_by_tier.values())
    total_arr = total_mrr * 12

    # Annual vs monthly split
    annual_subs = [s for s in active if s.billing_interval == "annual"]
    monthly_subs = [s for s in active if s.billing_interval != "annual"]
    contracted_arr = sum(_monthly_value(s.tier, "annual") * 12 for s in annual_subs)

    # New MRR (added in last 30 days)
    new_mrr = sum(_monthly_value(s.tier, s.billing_interval) for s in new_recent)

    # Churned MRR (cancelled in last 30 days)
    churned_mrr = sum(_monthly_value(s.tier, s.billing_interval) for s in cancelled_recent)

    # Net MRR movement
    net_mrr = new_mrr - churned_mrr

    # Seat counts
    tier_counts: dict[str, int] = {}
    for sub in active:
        tier = (sub.tier or "pro").lower()
        tier_counts[tier] = tier_counts.get(tier, 0) + 1

    # Churn rate (cancelled in 30d / active at start of period)
    active_at_period_start = len(active) + len(cancelled_recent)
    churn_rate_pct = (
        round(len(cancelled_recent) / active_at_period_start * 100, 2)
        if active_at_period_start > 0 else 0.0
    )

    return {
        "as_of": now.isoformat(),
        "active_subscribers": len(active),
        "total_mrr_usd": total_mrr,
        "total_arr_usd": total_arr,
        "contracted_arr_usd": contracted_arr,   # from annual subscriptions only
        "mrr_by_tier": mrr_by_tier,
        "subscriber_count_by_tier": tier_counts,
        "annual_subscribers": len(annual_subs),
        "monthly_subscribers": len(monthly_subs),
        "new_mrr_last_30d_usd": new_mrr,
        "churned_mrr_last_30d_usd": churned_mrr,
        "net_mrr_movement_last_30d_usd": net_mrr,
        "new_subscribers_last_30d": len(new_recent),
        "churned_subscribers_last_30d": len(cancelled_recent),
        "past_due_subscribers": len(past_due),
        "monthly_churn_rate_pct": churn_rate_pct,
    }
