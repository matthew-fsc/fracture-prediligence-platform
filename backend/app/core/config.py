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
    STRIPE_FOUNDING_PRICE_ID: str = ""
    STRIPE_PRO_PRICE_ID: str = ""
    STRIPE_TEAM_PRICE_ID: str = ""
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
