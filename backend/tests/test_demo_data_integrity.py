"""
Demo data integrity checks — catch silent drift in DEMO_DATA after refactors.

These tests validate the internal consistency of the static DEMO_DATA payload
served by /api/demo/data. They do not require a running database; they operate
purely on the in-process Python dict, so they run fast in CI and catch regressions
immediately when someone edits demo.py, scoring_rules.py, or the tier boundaries.
"""

from app.api.routes.demo import DEMO_DATA, DEMO_ACCESS_TOKEN_EXPIRE_DAYS


def test_monthly_revenue_sums_to_ttm():
    """12 seasonal months must sum to the declared TTM revenue figure."""
    monthly = DEMO_DATA["monthly_revenue"]
    total = sum(m["revenue"] for m in monthly)
    expected = DEMO_DATA["company"]["ttm_revenue"]
    assert total == expected, (
        f"Monthly revenue sum ${total:,} does not match company ttm_revenue ${expected:,}. "
        "Update demo.py monthly_revenue or ttm_revenue so they agree."
    )


def test_monthly_revenue_has_twelve_months():
    """Exactly one entry per calendar month."""
    assert len(DEMO_DATA["monthly_revenue"]) == 12


def test_drs_contributions_sum_to_base():
    """Category contributions must add up to the declared base DRS score."""
    base = DEMO_DATA["drs"]["base"]
    contributions_sum = round(sum(DEMO_DATA["drs"]["contributions"].values()), 6)
    assert contributions_sum == base, (
        f"DRS contributions sum to {contributions_sum}, but drs.base is {base}. "
        "Recalculate contributions or update the base score in demo.py."
    )


def test_drs_band_ordering():
    """Conservative ≤ base ≤ optimistic."""
    drs = DEMO_DATA["drs"]
    assert drs["conservative"] <= drs["base"] <= drs["optimistic"], (
        f"DRS band out of order: conservative={drs['conservative']} base={drs['base']} "
        f"optimistic={drs['optimistic']}"
    )


def test_ev_floor_midpoint_ceiling_ordering():
    """EV floor < midpoint < ceiling."""
    ev = DEMO_DATA["enterprise_value"]
    assert ev["floor"] < ev["midpoint"] < ev["ceiling"], (
        f"EV ordering violated: floor={ev['floor']} midpoint={ev['midpoint']} ceiling={ev['ceiling']}"
    )


def test_ev_ebitda_base_matches_company():
    """EV ebitda_base must equal the company EBITDA so multiples are computable."""
    assert DEMO_DATA["enterprise_value"]["ebitda_base"] == DEMO_DATA["company"]["ebitda"]


def test_category_composites_in_range():
    """All category composite scores must be 0–100."""
    for key, cat in DEMO_DATA["category_scores"].items():
        score = cat["composite"]
        assert 0 <= score <= 100, (
            f"Category '{key}' composite score {score} is outside [0, 100]."
        )


def test_category_sub_scores_in_range():
    """All sub-scores within every category must be 0–100."""
    for cat_key, cat in DEMO_DATA["category_scores"].items():
        for sub_key, sub in cat.get("sub_scores", {}).items():
            score = sub["score"]
            assert 0 <= score <= 100, (
                f"Sub-score {cat_key}.{sub_key} = {score} is outside [0, 100]."
            )


def test_low_confidence_categories_declared():
    """management_team and growth_drivers have qualitative inputs — must stay MEDIUM."""
    assert DEMO_DATA["category_scores"]["management_team"]["data_confidence"] == "MEDIUM"
    assert DEMO_DATA["category_scores"]["growth_drivers"]["data_confidence"] == "MEDIUM"


def test_flagged_issues_have_valid_severities():
    valid = {"HIGH", "MEDIUM", "LOW"}
    for issue in DEMO_DATA["flagged_issues"]:
        assert issue["severity"] in valid, (
            f"Issue id={issue['id']} has invalid severity '{issue['severity']}'. "
            f"Must be one of {valid}."
        )


def test_checklist_pct_matches_items():
    """Checklist 'pct' must match completed/total, within 1-point rounding."""
    cl = DEMO_DATA["checklist"]
    completed = sum(1 for item in cl["items"] if item["status"] == "complete")
    assert completed == cl["completed"], (
        f"checklist.completed={cl['completed']} but {completed} items have status='complete'."
    )
    expected_pct = round(completed / cl["total"] * 100)
    assert abs(expected_pct - cl["pct"]) <= 1, (
        f"checklist.pct={cl['pct']} but computed {expected_pct}% ({completed}/{cl['total']})."
    )


def test_drs_tier_label_is_known():
    """DRS tier string must match a backend DRSTier value."""
    from app.analytics.a9_drs_composite import DRSTier
    known_tiers = {t.value for t in DRSTier}
    tier = DEMO_DATA["drs"]["tier"]
    assert tier in known_tiers, (
        f"DEMO_DATA drs.tier='{tier}' is not a valid DRSTier. "
        f"Known tiers: {known_tiers}"
    )


def test_demo_access_token_expiry_is_positive():
    assert DEMO_ACCESS_TOKEN_EXPIRE_DAYS > 0
