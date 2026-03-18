from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/prediligence"
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8

    ANTHROPIC_API_KEY: str = ""

    RAW_DATA_DIR: str = "data/raw"
    REPORTS_DIR: str = "data/reports"

    class Config:
        env_file = ".env"


settings = Settings()
