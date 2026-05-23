"""Production startup validation.

Raises RuntimeError at application start if any required configuration is
missing or misconfigured for production. This module has no imports from the
auth or database layers, so it can be imported and tested in isolation.
"""

from app.core.config import settings


def run_production_startup_checks() -> None:
    """Raise RuntimeError if any configuration would silently break production.

    This is a no-op outside of APP_ENV=production so local development is
    unaffected.
    """
    if settings.APP_ENV.lower() != "production":
        return

    errors: list[str] = []

    if settings.SECRET_KEY == "change-me-in-production":
        errors.append("SECRET_KEY is still the default value — set a strong random key.")

    if settings.ALLOW_UNSIGNED_STRIPE_WEBHOOKS:
        errors.append("ALLOW_UNSIGNED_STRIPE_WEBHOOKS must be false in production.")

    for var in ("ANTHROPIC_API_KEY", "CLERK_SECRET_KEY", "CLERK_JWKS_URL",
                "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"):
        if not getattr(settings, var, ""):
            errors.append(f"{var} is required in production but is empty.")

    if settings.USE_S3_STORAGE:
        for var in ("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "S3_BUCKET"):
            if not getattr(settings, var, ""):
                errors.append(f"{var} is required when USE_S3_STORAGE=true.")

    if errors:
        msg = "Production startup checks failed:\n" + "\n".join(f"  - {e}" for e in errors)
        raise RuntimeError(msg)
