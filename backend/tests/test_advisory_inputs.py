"""
Tests for advisory input form extension (Task 2).

Covers:
  - A6 qualitative scoring helpers (_qual_non_compete_score, _qual_voluntary_turnover_score,
    _qual_comp_vs_market_score)
  - QualitativeRequest accepts the 4 new A6 fields without validation errors
  - /api/analytics/qualitative/{company_id} GET includes new fields in response
  - /api/analytics/qualitative/{company_id} POST saves new A6 fields
  - DRS diff keys are present in /api/analytics/scores/{company_id} response when
    qualitative inputs are set (baseline + advisory_delta)
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch
import pytest


# ---------------------------------------------------------------------------
# A6 scoring helper unit tests — no DB required
# ---------------------------------------------------------------------------

class TestQualNonCompeteScore:
    def _score(self, val):
        from app.api.routes.analytics import _qual_non_compete_score
        return _qual_non_compete_score(val)

    def test_zero_pct_returns_lowest(self):
        assert self._score("0") == 20.0

    def test_full_coverage_returns_highest(self):
        assert self._score("100") == 95.0

    def test_mid_band(self):
        assert self._score("51-75") == 65.0

    def test_unknown_value_returns_neutral_50(self):
        assert self._score("unknown_band") == 50.0


class TestQualVoluntaryTurnoverScore:
    def _score(self, val):
        from app.api.routes.analytics import _qual_voluntary_turnover_score
        return _qual_voluntary_turnover_score(val)

    def test_low_turnover_scores_high(self):
        assert self._score("<10") == 90.0

    def test_high_turnover_scores_low(self):
        assert self._score(">25") == 20.0

    def test_industry_average_band(self):
        assert self._score("10-15") == 70.0

    def test_elevated_band(self):
        assert self._score("15-25") == 45.0

    def test_unknown_returns_50(self):
        assert self._score("badvalue") == 50.0


class TestQualCompVsMarketScore:
    def _score(self, val):
        from app.api.routes.analytics import _qual_comp_vs_market_score
        return _qual_comp_vs_market_score(val)

    def test_below_25_returns_lowest(self):
        assert self._score("below_25") == 25.0

    def test_above_market_returns_highest(self):
        assert self._score("above") == 90.0

    def test_within_15_returns_competitive(self):
        assert self._score("within_15") == 75.0

    def test_unknown_returns_50(self):
        assert self._score("nope") == 50.0


# ---------------------------------------------------------------------------
# Pydantic schema: QualitativeRequest accepts A6 fields
# ---------------------------------------------------------------------------

class TestQualitativeRequestSchema:
    def test_a6_fields_accepted(self):
        from app.api.routes.analytics import QualitativeRequest

        req = QualitativeRequest(
            has_crm_pipeline=True,
            non_compete_pct="76-99",
            voluntary_turnover="<10",
            comp_vs_market="within_15",
        )
        assert req.has_crm_pipeline is True
        assert req.non_compete_pct == "76-99"
        assert req.voluntary_turnover == "<10"
        assert req.comp_vs_market == "within_15"

    def test_a6_fields_default_to_none(self):
        from app.api.routes.analytics import QualitativeRequest

        req = QualitativeRequest()
        assert req.non_compete_pct is None
        assert req.voluntary_turnover is None
        assert req.comp_vs_market is None
        assert req.has_crm_pipeline is None

    def test_existing_a4_a7_fields_still_accepted(self):
        from app.api.routes.analytics import QualitativeRequest

        req = QualitativeRequest(
            owner_hours_per_week=20.0,
            sop_pct=60.0,
            automation_pct=40.0,
            mgmt_qualified=3,
            mgmt_total_functions=4,
        )
        assert req.owner_hours_per_week == 20.0
        assert req.mgmt_qualified == 3


# ---------------------------------------------------------------------------
# GET qualitative endpoint returns A6 fields
# ---------------------------------------------------------------------------

class TestGetQualitativeEndpoint:
    def _mock_qual(self):
        q = MagicMock()
        q.owner_hours_per_week = 25
        q.sop_pct = 60
        q.automation_pct = 40
        q.mgmt_qualified = 3
        q.mgmt_total_functions = 4
        q.pipeline_value = 500000
        q.market_positioning = "defined"
        q.repeatability_pct = 70
        q.contract_pct = 80
        q.customer_contract_type = "retainer"
        q.key_person_revenue_pct = 20
        # A6 fields
        q.has_crm_pipeline = True
        q.non_compete_pct = "76-99"
        q.voluntary_turnover = "<10"
        q.comp_vs_market = "within_15"
        return q

    def _mock_company(self, company_id=10):
        c = MagicMock()
        c.id = company_id
        return c

    def test_response_includes_a6_fields(self):
        from app.api.routes.analytics import get_qualitative

        mock_db = MagicMock()
        qual = self._mock_qual()
        mock_db.query.return_value.filter.return_value.first.return_value = qual
        company = self._mock_company(10)

        result = get_qualitative(company=company, db=mock_db)
        inp = result["inputs"]

        assert "has_crm_pipeline" in inp
        assert "non_compete_pct" in inp
        assert "voluntary_turnover" in inp
        assert "comp_vs_market" in inp

    def test_a6_fields_values_correct(self):
        from app.api.routes.analytics import get_qualitative

        mock_db = MagicMock()
        qual = self._mock_qual()
        mock_db.query.return_value.filter.return_value.first.return_value = qual
        company = self._mock_company(10)

        result = get_qualitative(company=company, db=mock_db)
        inp = result["inputs"]

        assert inp["non_compete_pct"] == "76-99"
        assert inp["voluntary_turnover"] == "<10"
        assert inp["comp_vs_market"] == "within_15"
        assert inp["has_crm_pipeline"] is True

    def test_returns_no_inputs_when_not_set(self):
        from app.api.routes.analytics import get_qualitative

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        company = self._mock_company(10)

        result = get_qualitative(company=company, db=mock_db)
        assert result["inputs"] is None or result["inputs"] == {}


# ---------------------------------------------------------------------------
# POST qualitative endpoint saves A6 fields
# ---------------------------------------------------------------------------

class TestPostQualitativeEndpoint:
    def _mock_company(self, company_id=10):
        c = MagicMock()
        c.id = company_id
        return c

    def test_saves_a6_fields_when_no_existing_row(self):
        from app.api.routes.analytics import save_qualitative, QualitativeRequest

        mock_db = MagicMock()
        # No existing row — will insert new
        mock_db.query.return_value.filter.return_value.first.return_value = None

        company = self._mock_company(10)
        body = QualitativeRequest(
            has_crm_pipeline=False,
            non_compete_pct="51-75",
            voluntary_turnover="10-15",
            comp_vs_market="below_15",
        )

        # Patch snapshot so it doesn't hit stub model attribute descriptors
        with patch("app.api.routes.analytics._qualitative_snapshot", return_value={"ok": True}):
            result = save_qualitative(company=company, body=body, db=mock_db, user=MagicMock())
        assert result["status"] == "saved"

    def test_updates_a6_fields_on_existing_row(self):
        from app.api.routes.analytics import save_qualitative, QualitativeRequest

        mock_db = MagicMock()
        existing_qual = MagicMock()
        existing_qual.non_compete_pct = "0"
        existing_qual.voluntary_turnover = ">25"
        existing_qual.comp_vs_market = "below_25"
        existing_qual.has_crm_pipeline = None
        mock_db.query.return_value.filter.return_value.first.return_value = existing_qual

        company = self._mock_company(10)
        body = QualitativeRequest(
            non_compete_pct="100",
            voluntary_turnover="<10",
            comp_vs_market="above",
        )

        with patch("app.api.routes.analytics._qualitative_snapshot", return_value={"ok": True}):
            result = save_qualitative(company=company, body=body, db=mock_db, user=MagicMock())
        assert result["status"] == "saved"
        # Verify attributes were updated on the existing row
        assert existing_qual.non_compete_pct == "100"
        assert existing_qual.voluntary_turnover == "<10"
        assert existing_qual.comp_vs_market == "above"
        # Verify attributes were set on the existing row
        assert existing_qual.non_compete_pct == "100"
        assert existing_qual.voluntary_turnover == "<10"
        assert existing_qual.comp_vs_market == "above"


# ---------------------------------------------------------------------------
# DRS scores endpoint: baseline and advisory_delta keys
# ---------------------------------------------------------------------------

class TestDrsDiffKeys:
    """Verify the /api/analytics/scores/{company_id} response includes
    the baseline and advisory_delta keys that the frontend uses for the
    DRS diff panel (Task 2)."""

    def _minimal_module(self, composite=50.0):
        m = MagicMock()
        m.composite = composite
        # revenue_quality sub-scores (used in contract/key-person override blend)
        m.recurring_rate_score = 50.0
        m.concentration_score = 50.0
        m.durability_score = 50.0
        m.consistency_score = 50.0
        m.nrr_score = 50.0
        # growth sub-scores
        m.cagr_score = 50.0
        m.diversification_score = 50.0
        m.growth_momentum_score = 50.0
        # confidence band (used in conservative/optimistic computation)
        m.data_confidence = "HIGH"
        # to_dict returns a plain dict so subscript + .update() work correctly
        m.to_dict.return_value = {
            "composite": composite,
            "sub_scores": {},
            "qualitative_complete": False,
        }
        return m

    def test_baseline_key_present_in_scores_response(self):
        """When qualitative inputs are set, the DRS response must include 'baseline' and 'advisory_delta'."""
        from app.api.routes.analytics import get_all_scores

        qual = MagicMock()
        qual.owner_hours_per_week = 20
        qual.sop_pct = 60
        qual.automation_pct = 40
        qual.mgmt_qualified = 3
        qual.mgmt_total_functions = 4
        qual.pipeline_value = 600000
        qual.market_positioning = "defined"
        qual.repeatability_pct = 70
        qual.contract_pct = 80
        qual.customer_contract_type = "retainer"
        qual.key_person_revenue_pct = 15
        qual.non_compete_pct = "76-99"
        qual.voluntary_turnover = "<10"
        qual.comp_vs_market = "within_15"
        qual.has_crm_pipeline = True

        company = MagicMock()
        company.id = 99

        modules = {k: self._minimal_module(55.0) for k in [
            "revenue_quality", "operational_independence", "customer_risk",
            "management_team", "growth_drivers", "financial_integrity",
        ]}

        with (
            patch("app.api.routes.analytics.compute_category_modules", return_value=modules),
            patch("app.api.routes.analytics.compute_metrics") as mock_metrics,
            patch("app.api.routes.analytics.compute_value_gap") as mock_vg,
            patch("app.api.routes.analytics.compute_enterprise_value") as mock_ev,
            patch("app.api.routes.analytics.ebitda_basis_for_company") as mock_basis,
            patch("app.api.routes.analytics.build_confidence_summary",
                  return_value=MagicMock(to_dict=lambda: {})),
            patch("app.api.routes.analytics.get_market_multiple_context", return_value={}),
        ):
            mock_metrics.return_value = MagicMock(total_revenue_ttm=1_000_000)
            mock_vg.return_value = MagicMock(to_dict=lambda: {"gaps": []})
            mock_ev.return_value = MagicMock(
                low=2_000_000, midpoint=3_000_000, high=4_000_000,
                multiple_low=3.0, multiple_midpoint=4.0, multiple_high=5.0,
                to_dict=lambda: {},
            )
            mock_basis.return_value = {"ebitda_normalized_ttm": 500_000}

            mock_db = MagicMock()
            mock_db.query.return_value.filter.return_value.first.return_value = qual

            result = get_all_scores(company=company, db=mock_db)

            assert "drs" in result
            assert "baseline" in result["drs"], "DRS response missing 'baseline' key"
            assert "advisory_delta" in result["drs"], "DRS response missing 'advisory_delta' key"
            # Baseline should have base/conservative/optimistic
            assert "base" in result["drs"]["baseline"]
