from app.core.config import Settings


def test_cors_origins_parses_csv():
    settings = Settings(CORS_ORIGINS="http://localhost:5173,https://example.com")
    assert settings.CORS_ORIGINS == ["http://localhost:5173", "https://example.com"]
