from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
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
    FRONTEND_URL: str = "http://localhost:5173"
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]
    ADMIN_API_KEY: str = ""

    AUTH_JWKS_TTL_SECONDS: float = 3600.0
    AUTH_JWKS_TIMEOUT_SECONDS: float = 5.0

    RAW_DATA_DIR: str = "data/raw"
    REPORTS_DIR: str = "data/reports"

    DEMO_TOTAL_SPOTS: int = 20
    DEMO_SLUG_RETRY_COUNT: int = 5

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
