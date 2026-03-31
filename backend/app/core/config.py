from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """APP_ENV=production enables stricter auth (Clerk JWKS required; no HS256 dev fallback)."""
    APP_ENV: str = "development"

    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/prediligence"
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8

    ANTHROPIC_API_KEY: str = ""

    CLERK_SECRET_KEY: str = ""
    CLERK_JWKS_URL: str = ""
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    # Monthly price IDs
    STRIPE_FOUNDING_PRICE_ID: str = ""
    STRIPE_PRO_PRICE_ID: str = ""
    STRIPE_TEAM_PRICE_ID: str = ""
    # Annual price IDs (10 months equivalent — two months free)
    STRIPE_FOUNDING_ANNUAL_PRICE_ID: str = ""
    STRIPE_PRO_ANNUAL_PRICE_ID: str = ""
    STRIPE_TEAM_ANNUAL_PRICE_ID: str = ""
    # Per-engagement overage price ID (charged as Stripe Subscription Item add-on)
    STRIPE_ENGAGEMENT_OVERAGE_PRICE_ID: str = ""
    # Only when True AND APP_ENV=development: allow Stripe webhooks without STRIPE_WEBHOOK_SECRET (local CLI tests).
    # Never enable in staging/production — unsigned webhooks are a security risk.
    ALLOW_UNSIGNED_STRIPE_WEBHOOKS: bool = False
    FRONTEND_URL: str = "http://localhost:5173"
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]
    ADMIN_API_KEY: str = ""

    AUTH_JWKS_TTL_SECONDS: float = 3600.0
    AUTH_JWKS_TIMEOUT_SECONDS: float = 5.0

    RAW_DATA_DIR: str = "data/raw"
    REPORTS_DIR: str = "data/reports"
    # Uploaded report logos (per company id + extension), relative to backend root if not absolute.
    COMPANY_LOGO_DIR: str = "data/company_logos"
    COMPANY_LOGO_MAX_BYTES: int = 2 * 1024 * 1024
    # Max upload size for CSV/Excel ingestion (bytes). Default 25 MiB.
    INGESTION_MAX_UPLOAD_BYTES: int = 25 * 1024 * 1024

    DEMO_TOTAL_SPOTS: int = 20
    DEMO_SLUG_RETRY_COUNT: int = 5
    # When set, generic /demo requires a successful POST /api/demo/verify-access-code first.
    # Empty = generic demo is open (typical local dev). Personalized /demo/:slug is unaffected.
    DEMO_ACCESS_CODE: str = ""
    # When True, POST /api/ingestion/upload/1 and PATCH mappings for company 1 are rejected (ABC demo is read-only).
    DEMO_BLOCK_INGESTION_UPLOAD_FOR_COMPANY_1: bool = True
    # Company id=1: EV uses Investment-grade DRS multiple band blended with market (aligns ~$9.8M at ~$1.74M EBITDA).
    # Set False to use live-computed DRS tier for EV (may be lower tier from financials).
    DEMO_CANONICAL_VALUATION: bool = True

    # Optional: set to your Clerk user id (sub) to assign demo company id=1 on bootstrap (local dev).
    SEED_COMPANY_1_OWNER_USER_ID: str = ""

    DRS_CONFIDENCE_LOW_MULTIPLIER: float = 0.9
    DRS_CONFIDENCE_LOW_OPTIMISTIC_MULTIPLIER: float = 1.05

    REPORT_TOP_CRITICAL_COUNT: int = 3
    REPORT_TOP_HIGH_COUNT: int = 3
    REPORT_IMMEDIATE_ACTION_COUNT: int = 5

    # Market data (optional — PitchBook-style APIs; keys never exposed to frontend)
    PITCHBOOK_API_KEY: str = ""
    PITCHBOOK_API_BASE_URL: str = "https://api.pitchbook.com"

    # AI Copilot monthly token limits per tier (input + output combined).
    # Set to 0 to disable the feature for a tier. Use a large number for effectively unlimited.
    COPILOT_MONTHLY_TOKEN_LIMIT_FOUNDING: int = 500_000
    COPILOT_MONTHLY_TOKEN_LIMIT_PRO: int = 500_000
    COPILOT_MONTHLY_TOKEN_LIMIT_TEAM: int = 1_500_000   # shared across firm

    # Usage analytics (PostHog). POSTHOG_HOST defaults to PostHog Cloud.
    POSTHOG_API_KEY: str = ""
    POSTHOG_HOST: str = "https://app.posthog.com"

    # S3-compatible storage (leave USE_S3_STORAGE=False to keep local filesystem)
    USE_S3_STORAGE: bool = False
    S3_BUCKET: str = ""
    S3_ENDPOINT_URL: str = ""   # empty = AWS default; set for Cloudflare R2 / MinIO
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"

    # Referral program — credit (in cents) applied to referrer on each conversion
    REFERRAL_CREDIT_CENTS: int = 2990   # $29.90 ≈ one month Pro

    # Max companies included per plan tier (can be overridden per subscription record)
    PLAN_MAX_COMPANIES_FOUNDING: int = 10
    PLAN_MAX_COMPANIES_PRO: int = 10
    PLAN_MAX_COMPANIES_TEAM: int = 50

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value):
        if isinstance(value, str):
            return [v.strip() for v in value.split(",") if v.strip()]
        return value

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
