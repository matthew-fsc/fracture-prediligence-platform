"""
Tests for Exit Planning Engagement Layer (Task 3).

Covers:
  - GET /plan/{company_id} returns plan dict (creates if missing)
  - PATCH /plan/{company_id} updates target fields
  - GET /initiatives/{company_id} returns phased structure
  - POST /initiatives/{company_id} creates initiative
  - PATCH /initiatives/{company_id}/{id} updates status/phase
  - DELETE /initiatives/{company_id}/{id} removes initiative
  - POST /initiatives/{company_id}/populate creates from value gap (skips existing)
  - POST /initiatives/{company_id}/{id}/complete marks done + returns DRS re-score
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from unittest.mock import MagicMock, call, patch

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_company(company_id=5):
    c = MagicMock()
    c.id = company_id
    return c


def _make_plan(company_id=5, phase=1):
    p = MagicMock()
    p.id = 1
    p.company_id = company_id
    p.target_exit_date = None
    p.target_drs = None
    p.current_phase = phase
    p.created_at = datetime(2025, 1, 1)
    p.updated_at = datetime(2025, 1, 1)
    return p


def _make_initiative(
    initiative_id=10,
    company_id=5,
    title="Improve Revenue Quality",
    status="planned",
    phase=1,
    drs_category_key="revenue_quality",
):
    i = MagicMock()
    i.id = initiative_id
    i.company_id = company_id
    i.title = title
    i.category = None
    i.status = status
    i.phase = phase
    i.phase_label = "Risk Elimination"
    i.estimated_drs_impact = Decimal("3.50")
    i.target_completion_date = None
    i.actual_completion_date = None
    i.drs_category_key = drs_category_key
    i.cost_estimate = None
    i.ev_impact_estimate = Decimal("50000")
    i.advisor_ev_override = None
    i.timeline = None
    i.source = "value_gap"
    i.created_at = datetime(2025, 1, 1)
    return i


# ---------------------------------------------------------------------------
# Plan endpoints
# ---------------------------------------------------------------------------

class TestGetPlan:
    def test_returns_plan_dict(self):
        from app.api.routes.engagement import get_plan

        mock_db = MagicMock()
        plan = _make_plan(5, phase=2)
        mock_db.query.return_value.filter.return_value.first.return_value = plan
        company = _make_company(5)

        result = get_plan(company=company, db=mock_db)
        assert result["company_id"] == 5
        assert result["current_phase"] == 2

    def test_creates_plan_when_missing(self):
        from app.api.routes.engagement import get_plan

        mock_db = MagicMock()
        # first call returns None (no plan), subsequent calls return created plan
        new_plan = _make_plan(5, phase=1)
        mock_db.query.return_value.filter.return_value.first.side_effect = [None, new_plan]
        company = _make_company(5)

        result = get_plan(company=company, db=mock_db)
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called()

    def test_phase_label_included(self):
        from app.api.routes.engagement import get_plan

        mock_db = MagicMock()
        plan = _make_plan(5, phase=3)
        mock_db.query.return_value.filter.return_value.first.return_value = plan
        company = _make_company(5)

        result = get_plan(company=company, db=mock_db)
        assert result["current_phase_label"] == "Value Optimization"


class TestPatchPlan:
    def test_updates_target_fields(self):
        from app.api.routes.engagement import patch_plan, PlanPatch

        mock_db = MagicMock()
        plan = _make_plan(5, phase=1)
        mock_db.query.return_value.filter.return_value.first.return_value = plan
        company = _make_company(5)

        body = PlanPatch(target_drs=80.0, current_phase=2)
        patch_plan(company=company, body=body, db=mock_db)

        assert plan.target_drs == 80.0
        assert plan.current_phase == 2
        mock_db.commit.assert_called()

    def test_partial_update_preserves_unset_fields(self):
        from app.api.routes.engagement import patch_plan, PlanPatch

        mock_db = MagicMock()
        plan = _make_plan(5, phase=1)
        plan.target_drs = 75.0
        mock_db.query.return_value.filter.return_value.first.return_value = plan
        company = _make_company(5)

        # Only updating phase — target_drs should remain 75.0
        body = PlanPatch(current_phase=2)
        patch_plan(company=company, body=body, db=mock_db)

        assert plan.target_drs == 75.0
        assert plan.current_phase == 2


# ---------------------------------------------------------------------------
# Initiative list
# ---------------------------------------------------------------------------

class TestListInitiatives:
    def test_returns_phased_structure(self):
        from app.api.routes.engagement import list_initiatives

        inits = [
            _make_initiative(10, phase=1, drs_category_key="revenue_quality"),
            _make_initiative(11, phase=2, drs_category_key="operational_independence"),
            _make_initiative(12, phase=3, drs_category_key="growth_drivers"),
        ]
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = inits
        company = _make_company(5)

        result = list_initiatives(company=company, db=mock_db)
        assert "phase_1" in result["initiatives"]
        assert "phase_2" in result["initiatives"]
        assert "phase_3" in result["initiatives"]
        assert result["total"] == 3

    def test_unphased_initiative_goes_to_unphased_bucket(self):
        from app.api.routes.engagement import list_initiatives

        init = _make_initiative(10, phase=None)
        init.phase = None
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [init]
        company = _make_company(5)

        result = list_initiatives(company=company, db=mock_db)
        assert len(result["initiatives"]["unphased"]) == 1

    def test_phase_labels_included(self):
        from app.api.routes.engagement import list_initiatives, PHASES

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = []
        company = _make_company(5)

        result = list_initiatives(company=company, db=mock_db)
        assert result["phases"] == PHASES


# ---------------------------------------------------------------------------
# Create initiative
# ---------------------------------------------------------------------------

class TestCreateInitiative:
    def test_creates_initiative_with_phase(self):
        from app.api.routes.engagement import create_initiative, InitiativeCreate

        mock_db = MagicMock()
        company = _make_company(5)
        body = InitiativeCreate(
            title="Formalize customer contracts",
            phase=1,
            drs_category_key="revenue_quality",
            estimated_drs_impact=4.5,
        )

        # Simulate db.refresh populating the new initiative
        captured = {}

        def capture_add(obj):
            captured["obj"] = obj
            obj.id = 99
            obj.created_at = datetime(2025, 1, 1)

        mock_db.add.side_effect = capture_add
        mock_db.refresh.side_effect = lambda obj: None

        create_initiative(company=company, body=body, db=mock_db)
        mock_db.commit.assert_called()
        added = captured["obj"]
        assert added.title == "Formalize customer contracts"
        assert added.phase == 1

    def test_status_defaults_to_planned(self):
        from app.api.routes.engagement import create_initiative, InitiativeCreate

        mock_db = MagicMock()
        company = _make_company(5)
        body = InitiativeCreate(title="Some initiative")

        captured = {}

        def capture_add(obj):
            captured["obj"] = obj
            obj.id = 100
            obj.created_at = datetime(2025, 1, 1)

        mock_db.add.side_effect = capture_add
        mock_db.refresh.side_effect = lambda obj: None

        create_initiative(company=company, body=body, db=mock_db)
        assert captured["obj"].status == "planned"


# ---------------------------------------------------------------------------
# Update initiative
# ---------------------------------------------------------------------------

class TestPatchInitiative:
    def test_updates_status(self):
        from app.api.routes.engagement import patch_initiative, InitiativePatch

        init = _make_initiative(10, status="planned")
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.filter.return_value.first.return_value = init
        company = _make_company(5)

        patch_initiative(company=company, initiative_id=10, body=InitiativePatch(status="in_progress"), db=mock_db)
        assert init.status == "in_progress"

    def test_raises_404_when_not_found(self):
        from app.api.routes.engagement import patch_initiative, InitiativePatch
        from fastapi import HTTPException

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.filter.return_value.first.return_value = None
        company = _make_company(5)

        with pytest.raises(HTTPException) as exc_info:
            patch_initiative(company=company, initiative_id=999, body=InitiativePatch(status="in_progress"), db=mock_db)
        assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# Delete initiative
# ---------------------------------------------------------------------------

class TestDeleteInitiative:
    def test_deletes_existing_initiative(self):
        from app.api.routes.engagement import delete_initiative

        init = _make_initiative(10)
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.filter.return_value.first.return_value = init
        company = _make_company(5)

        result = delete_initiative(company=company, initiative_id=10, db=mock_db)
        mock_db.delete.assert_called_once_with(init)
        assert result["ok"] is True

    def test_raises_404_when_not_found(self):
        from app.api.routes.engagement import delete_initiative
        from fastapi import HTTPException

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.filter.return_value.first.return_value = None
        company = _make_company(5)

        with pytest.raises(HTTPException) as exc_info:
            delete_initiative(company=company, initiative_id=999, db=mock_db)
        assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# Auto-populate from value gap
# ---------------------------------------------------------------------------

class TestPopulateFromValueGap:
    def _minimal_module(self, composite=40.0):
        m = MagicMock()
        m.composite = composite
        return m

    def test_creates_initiatives_for_gap_categories(self):
        from app.api.routes.engagement import populate_from_value_gap

        company = _make_company(5)

        gap1 = MagicMock()
        gap1.category = "revenue_quality"
        gap1.current_score = 30.0   # < 40 → Phase 1
        gap1.drs_uplift = 5.0
        gap1.ev_uplift = 100_000.0

        gap2 = MagicMock()
        gap2.category = "operational_independence"
        gap2.current_score = 55.0   # 40–65 → Phase 2
        gap2.drs_uplift = 3.0
        gap2.ev_uplift = 60_000.0

        gap_result = MagicMock()
        gap_result.gaps = [gap1, gap2]

        modules = {k: self._minimal_module(50.0) for k in [
            "revenue_quality", "operational_independence", "customer_risk",
            "management_team", "growth_drivers", "financial_integrity",
        ]}

        captured = []

        def capture_add(obj):
            captured.append(obj)
            obj.id = len(captured)

        mock_db = MagicMock()
        mock_db.add.side_effect = capture_add
        # No existing value_gap initiatives
        mock_db.query.return_value.filter.return_value.filter.return_value.all.return_value = []

        with (
            patch("app.api.routes.engagement.compute_category_modules", return_value=modules),
            patch("app.api.routes.engagement.compute_value_gap", return_value=gap_result),
            patch("app.api.routes.engagement.ebitda_basis_for_company", return_value={"ebitda_normalized_ttm": 500_000}),
        ):
            result = populate_from_value_gap(company=company, db=mock_db)

        assert result["created"] == 2

    def test_skips_already_existing_gap_categories(self):
        from app.api.routes.engagement import populate_from_value_gap

        company = _make_company(5)

        gap1 = MagicMock()
        gap1.category = "revenue_quality"
        gap1.current_score = 30.0
        gap1.drs_uplift = 5.0
        gap1.ev_uplift = 100_000.0

        gap_result = MagicMock()
        gap_result.gaps = [gap1]

        modules = {k: self._minimal_module(50.0) for k in [
            "revenue_quality", "operational_independence", "customer_risk",
            "management_team", "growth_drivers", "financial_integrity",
        ]}

        existing_init = MagicMock()
        existing_init.drs_category_key = "revenue_quality"

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.filter.return_value.all.return_value = [existing_init]

        with (
            patch("app.api.routes.engagement.compute_category_modules", return_value=modules),
            patch("app.api.routes.engagement.compute_value_gap", return_value=gap_result),
            patch("app.api.routes.engagement.ebitda_basis_for_company", return_value={"ebitda_normalized_ttm": 500_000}),
        ):
            result = populate_from_value_gap(company=company, db=mock_db)

        # Should skip revenue_quality since it already exists
        assert result["created"] == 0

    def test_phase_assignment_low_score_is_phase_1(self):
        from app.api.routes.engagement import populate_from_value_gap

        company = _make_company(5)

        gap = MagicMock()
        gap.category = "customer_risk"
        gap.current_score = 25.0   # < 40 → Phase 1
        gap.drs_uplift = 4.0
        gap.ev_uplift = 80_000.0

        gap_result = MagicMock()
        gap_result.gaps = [gap]

        modules = {k: self._minimal_module(50.0) for k in [
            "revenue_quality", "operational_independence", "customer_risk",
            "management_team", "growth_drivers", "financial_integrity",
        ]}

        captured = []

        def capture_add(obj):
            captured.append(obj)
            obj.id = len(captured)

        mock_db = MagicMock()
        mock_db.add.side_effect = capture_add
        mock_db.query.return_value.filter.return_value.filter.return_value.all.return_value = []

        with (
            patch("app.api.routes.engagement.compute_category_modules", return_value=modules),
            patch("app.api.routes.engagement.compute_value_gap", return_value=gap_result),
            patch("app.api.routes.engagement.ebitda_basis_for_company", return_value={"ebitda_normalized_ttm": 500_000}),
        ):
            result = populate_from_value_gap(company=company, db=mock_db)

        assert captured[0].phase == 1


# ---------------------------------------------------------------------------
# Mark initiative complete + partial re-score
# ---------------------------------------------------------------------------

class TestMarkInitiativeComplete:
    def _minimal_module(self, composite=60.0):
        m = MagicMock()
        m.composite = composite
        return m

    def test_sets_status_complete_and_actual_date(self):
        from app.api.routes.engagement import mark_initiative_complete

        init = _make_initiative(10, status="in_progress")
        init.actual_completion_date = None

        company = _make_company(5)
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.filter.return_value.first.return_value = init

        modules = {k: self._minimal_module(60.0) for k in [
            "revenue_quality", "operational_independence", "customer_risk",
            "management_team", "growth_drivers", "financial_integrity",
        ]}

        mock_drs = MagicMock()
        mock_drs.base = 62
        mock_drs.conservative = 55
        mock_drs.optimistic = 70
        mock_drs.tier = MagicMock()
        mock_drs.tier.value = "ready"

        with (
            patch("app.api.routes.engagement.compute_category_modules", return_value=modules),
            patch("app.api.routes.engagement.compute_drs", return_value=mock_drs),
        ):
            result = mark_initiative_complete(company=company, initiative_id=10, db=mock_db)

        assert init.status == "complete"
        assert init.actual_completion_date == date.today()

    def test_returns_drs_rescore(self):
        from app.api.routes.engagement import mark_initiative_complete

        init = _make_initiative(10, status="in_progress")
        company = _make_company(5)
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.filter.return_value.first.return_value = init

        modules = {k: self._minimal_module(65.0) for k in [
            "revenue_quality", "operational_independence", "customer_risk",
            "management_team", "growth_drivers", "financial_integrity",
        ]}

        mock_drs = MagicMock()
        mock_drs.base = 65
        mock_drs.conservative = 58
        mock_drs.optimistic = 72
        mock_drs.tier = MagicMock()
        mock_drs.tier.value = "accelerating"

        with (
            patch("app.api.routes.engagement.compute_category_modules", return_value=modules),
            patch("app.api.routes.engagement.compute_drs", return_value=mock_drs),
        ):
            result = mark_initiative_complete(company=company, initiative_id=10, db=mock_db)

        assert "drs" in result
        assert result["drs"]["base"] == 65
        assert "category_scores" in result

    def test_raises_404_for_missing_initiative(self):
        from app.api.routes.engagement import mark_initiative_complete
        from fastapi import HTTPException

        company = _make_company(5)
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.filter.return_value.first.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            mark_initiative_complete(company=company, initiative_id=999, db=mock_db)
        assert exc_info.value.status_code == 404
