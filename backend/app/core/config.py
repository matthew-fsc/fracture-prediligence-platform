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

    RAW_DATA_DIR: str = "data/raw"
    REPORTS_DIR: str = "data/reports"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
