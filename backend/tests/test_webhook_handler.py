"""Tests for the Stripe webhook handler (app/api/routes/webhooks.py).

Uses a stub DB and mocked Stripe calls — no live API or database required.
"""

import json
import pytest
from unittest.mock import MagicMock, patch, call

import stripe

from app.api.routes.webhooks import (
    _allow_unsigned_webhook,
    _price_to_tier_and_interval,
    _stripe_subscription_status_to_app,
    _subscription_to_tier_and_interval,
    _handle_referral_conversion,
)
from app.core.config import settings


# ---------------------------------------------------------------------------
# _allow_unsigned_webhook
# ---------------------------------------------------------------------------

class TestAllowUnsignedWebhook:
    def test_false_in_production(self, monkeypatch):
        monkeypatch.setattr(settings, "APP_ENV", "production")
        monkeypatch.setattr(settings, "ALLOW_UNSIGNED_STRIPE_WEBHOOKS", True)
        # The function itself only allows unsigned in development
        assert _allow_unsigned_webhook() is False

    def test_true_only_in_dev_with_flag(self, monkeypatch):
        monkeypatch.setattr(settings, "APP_ENV", "development")
        monkeypatch.setattr(settings, "ALLOW_UNSIGNED_STRIPE_WEBHOOKS", True)
        assert _allow_unsigned_webhook() is True

    def test_false_in_dev_without_flag(self, monkeypatch):
        monkeypatch.setattr(settings, "APP_ENV", "development")
        monkeypatch.setattr(settings, "ALLOW_UNSIGNED_STRIPE_WEBHOOKS", False)
        assert _allow_unsigned_webhook() is False


# ---------------------------------------------------------------------------
# _stripe_subscription_status_to_app
# ---------------------------------------------------------------------------

class TestStripeStatusMapping:
    def test_active(self):
        assert _stripe_subscription_status_to_app("active") == "active"

    def test_trialing(self):
        assert _stripe_subscription_status_to_app("trialing") == "active"

    def test_canceled(self):
        assert _stripe_subscription_status_to_app("canceled") == "cancelled"

    def test_past_due(self):
        assert _stripe_subscription_status_to_app("past_due") == "past_due"

    def test_unpaid(self):
        assert _stripe_subscription_status_to_app("unpaid") == "past_due"

    def test_paused(self):
        assert _stripe_subscription_status_to_app("paused") == "paused"

    def test_incomplete(self):
        assert _stripe_subscription_status_to_app("incomplete") == "inactive"

    def test_unknown_status_returns_inactive(self):
        assert _stripe_subscription_status_to_app("unknown_xyz") == "inactive"


# ---------------------------------------------------------------------------
# _price_to_tier_and_interval
# ---------------------------------------------------------------------------

class TestPriceToTierInterval:
    def test_unknown_price_defaults_to_pro_monthly(self):
        tier, interval = _price_to_tier_and_interval("price_nonexistent")
        assert tier == "pro"
        assert interval == "monthly"

    def test_founding_monthly(self, monkeypatch):
        monkeypatch.setattr(settings, "STRIPE_FOUNDING_PRICE_ID", "price_founding_mo")
        tier, interval = _price_to_tier_and_interval("price_founding_mo")
        assert tier == "founding"
        assert interval == "monthly"

    def test_pro_annual(self, monkeypatch):
        monkeypatch.setattr(settings, "STRIPE_PRO_ANNUAL_PRICE_ID", "price_pro_yr")
        tier, interval = _price_to_tier_and_interval("price_pro_yr")
        assert tier == "pro"
        assert interval == "annual"

    def test_team_monthly(self, monkeypatch):
        monkeypatch.setattr(settings, "STRIPE_TEAM_PRICE_ID", "price_team_mo")
        tier, interval = _price_to_tier_and_interval("price_team_mo")
        assert tier == "team"
        assert interval == "monthly"


# ---------------------------------------------------------------------------
# _subscription_to_tier_and_interval
# ---------------------------------------------------------------------------

class TestSubscriptionToTierInterval:
    def test_empty_items_defaults(self):
        tier, interval = _subscription_to_tier_and_interval({"items": {"data": []}})
        assert tier == "pro"
        assert interval == "monthly"

    def test_reads_price_id_from_items(self, monkeypatch):
        monkeypatch.setattr(settings, "STRIPE_PRO_PRICE_ID", "price_pro_mo")
        sub = {"items": {"data": [{"price": {"id": "price_pro_mo"}}]}}
        tier, interval = _subscription_to_tier_and_interval(sub)
        assert tier == "pro"
        assert interval == "monthly"


# ---------------------------------------------------------------------------
# _handle_referral_conversion
# ---------------------------------------------------------------------------

class TestHandleReferralConversion:
    def _make_db(self, code_row=None, already_converted=None):
        """Return a mock DB that yields appropriate query results."""
        db = MagicMock()
        q = MagicMock()
        q.filter.return_value = q
        q.with_for_update.return_value = q

        call_count = [0]
        def first_side_effect():
            call_count[0] += 1
            if call_count[0] == 1:
                return code_row
            return already_converted
        q.first.side_effect = first_side_effect
        db.query.return_value = q
        return db

    def test_no_op_when_code_is_empty(self):
        db = MagicMock()
        _handle_referral_conversion(db, "", "user_1")
        db.query.assert_not_called()

    def test_no_op_when_code_not_found(self):
        db = self._make_db(code_row=None)
        _handle_referral_conversion(db, "BADCODE", "user_1")
        db.add.assert_not_called()

    def test_no_op_when_already_converted(self):
        code_row = MagicMock()
        code_row.owner_user_id = "advisor_1"
        already = MagicMock()  # already converted
        db = self._make_db(code_row=code_row, already_converted=already)
        _handle_referral_conversion(db, "REF123", "user_1")
        db.add.assert_not_called()

    def test_adds_conversion_record_on_success(self, monkeypatch):
        code_row = MagicMock()
        code_row.owner_user_id = "advisor_1"
        code_row.total_conversions = 0
        code_row.credit_balance_cents = 0

        db = self._make_db(code_row=code_row, already_converted=None)

        sub = MagicMock()
        sub.stripe_customer_id = "cus_123"

        # Make the second query (UserSubscription) return the sub mock
        q2 = MagicMock()
        q2.filter.return_value = q2
        q2.first.return_value = sub

        call_count = [0]
        def query_side(model):
            call_count[0] += 1
            if call_count[0] <= 2:
                return db.query.return_value
            return q2
        db.query.side_effect = query_side

        with patch("stripe.Customer.create_balance_transaction") as mock_stripe:
            monkeypatch.setattr(settings, "REFERRAL_CREDIT_CENTS", 2990)
            _handle_referral_conversion(db, "REF123", "user_1")

        db.add.assert_called_once()
        db.commit.assert_called_once()


# ---------------------------------------------------------------------------
# Production startup guard for ALLOW_UNSIGNED_STRIPE_WEBHOOKS
# ---------------------------------------------------------------------------

class TestProductionStartupChecks:
    def test_unsigned_webhook_blocked_in_production(self, monkeypatch):
        """_production_startup_checks should raise RuntimeError when
        ALLOW_UNSIGNED_STRIPE_WEBHOOKS is True in production."""
        from app.core.startup_checks import run_production_startup_checks as _production_startup_checks

        monkeypatch.setattr(settings, "APP_ENV", "production")
        monkeypatch.setattr(settings, "ALLOW_UNSIGNED_STRIPE_WEBHOOKS", True)
        monkeypatch.setattr(settings, "SECRET_KEY", "strongkey123456789012345678901234")
        monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "sk-ant-test")
        monkeypatch.setattr(settings, "CLERK_SECRET_KEY", "sk_live_test")
        monkeypatch.setattr(settings, "CLERK_JWKS_URL", "https://example.clerk.dev/.well-known/jwks.json")
        monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_live_test")
        monkeypatch.setattr(settings, "STRIPE_WEBHOOK_SECRET", "whsec_test")
        monkeypatch.setattr(settings, "USE_S3_STORAGE", False)

        with pytest.raises(RuntimeError, match="ALLOW_UNSIGNED_STRIPE_WEBHOOKS"):
            _production_startup_checks()

    def test_default_secret_key_blocked_in_production(self, monkeypatch):
        from app.core.startup_checks import run_production_startup_checks as _production_startup_checks

        monkeypatch.setattr(settings, "APP_ENV", "production")
        monkeypatch.setattr(settings, "ALLOW_UNSIGNED_STRIPE_WEBHOOKS", False)
        monkeypatch.setattr(settings, "SECRET_KEY", "change-me-in-production")
        monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "sk-ant-test")
        monkeypatch.setattr(settings, "CLERK_SECRET_KEY", "sk_live_test")
        monkeypatch.setattr(settings, "CLERK_JWKS_URL", "https://example.clerk.dev/.well-known/jwks.json")
        monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_live_test")
        monkeypatch.setattr(settings, "STRIPE_WEBHOOK_SECRET", "whsec_test")
        monkeypatch.setattr(settings, "USE_S3_STORAGE", False)

        with pytest.raises(RuntimeError, match="SECRET_KEY"):
            _production_startup_checks()

    def test_missing_anthropic_key_blocked_in_production(self, monkeypatch):
        from app.core.startup_checks import run_production_startup_checks as _production_startup_checks

        monkeypatch.setattr(settings, "APP_ENV", "production")
        monkeypatch.setattr(settings, "ALLOW_UNSIGNED_STRIPE_WEBHOOKS", False)
        monkeypatch.setattr(settings, "SECRET_KEY", "strongkey123456789012345678901234")
        monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "")
        monkeypatch.setattr(settings, "CLERK_SECRET_KEY", "sk_live_test")
        monkeypatch.setattr(settings, "CLERK_JWKS_URL", "https://example.clerk.dev/.well-known/jwks.json")
        monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_live_test")
        monkeypatch.setattr(settings, "STRIPE_WEBHOOK_SECRET", "whsec_test")
        monkeypatch.setattr(settings, "USE_S3_STORAGE", False)

        with pytest.raises(RuntimeError, match="ANTHROPIC_API_KEY"):
            _production_startup_checks()

    def test_passes_when_all_required_vars_set(self, monkeypatch):
        from app.core.startup_checks import run_production_startup_checks as _production_startup_checks

        monkeypatch.setattr(settings, "APP_ENV", "production")
        monkeypatch.setattr(settings, "ALLOW_UNSIGNED_STRIPE_WEBHOOKS", False)
        monkeypatch.setattr(settings, "SECRET_KEY", "strongkey123456789012345678901234")
        monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "sk-ant-test")
        monkeypatch.setattr(settings, "CLERK_SECRET_KEY", "sk_live_test")
        monkeypatch.setattr(settings, "CLERK_JWKS_URL", "https://example.clerk.dev/.well-known/jwks.json")
        monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_live_test")
        monkeypatch.setattr(settings, "STRIPE_WEBHOOK_SECRET", "whsec_test")
        monkeypatch.setattr(settings, "USE_S3_STORAGE", False)

        # Should not raise
        _production_startup_checks()

    def test_no_checks_in_development(self, monkeypatch):
        """Startup checks should be a no-op outside of production."""
        from app.core.startup_checks import run_production_startup_checks as _production_startup_checks

        monkeypatch.setattr(settings, "APP_ENV", "development")
        monkeypatch.setattr(settings, "SECRET_KEY", "change-me-in-production")
        monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "")
        monkeypatch.setattr(settings, "ALLOW_UNSIGNED_STRIPE_WEBHOOKS", True)

        # Should not raise
        _production_startup_checks()

    def test_s3_vars_required_when_s3_enabled(self, monkeypatch):
        from app.core.startup_checks import run_production_startup_checks as _production_startup_checks

        monkeypatch.setattr(settings, "APP_ENV", "production")
        monkeypatch.setattr(settings, "ALLOW_UNSIGNED_STRIPE_WEBHOOKS", False)
        monkeypatch.setattr(settings, "SECRET_KEY", "strongkey123456789012345678901234")
        monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "sk-ant-test")
        monkeypatch.setattr(settings, "CLERK_SECRET_KEY", "sk_live_test")
        monkeypatch.setattr(settings, "CLERK_JWKS_URL", "https://example.clerk.dev/.well-known/jwks.json")
        monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_live_test")
        monkeypatch.setattr(settings, "STRIPE_WEBHOOK_SECRET", "whsec_test")
        monkeypatch.setattr(settings, "USE_S3_STORAGE", True)
        monkeypatch.setattr(settings, "AWS_ACCESS_KEY_ID", "")
        monkeypatch.setattr(settings, "AWS_SECRET_ACCESS_KEY", "secret")
        monkeypatch.setattr(settings, "S3_BUCKET", "my-bucket")

        with pytest.raises(RuntimeError, match="AWS_ACCESS_KEY_ID"):
            _production_startup_checks()
