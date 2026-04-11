from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.core.config import settings

if settings.DATABASE_URL.startswith("sqlite"):
    _connect_args = {"check_same_thread": False}
    # SQLite does not support connection pooling options below
    engine = create_engine(settings.DATABASE_URL, connect_args=_connect_args)
else:
    _connect_args = {"connect_timeout": 10}
    # DB-1: Explicit pool settings for production robustness.
    # pool_pre_ping recycles stale connections after DB restarts or cloud sleep.
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args=_connect_args,
        pool_size=10,
        max_overflow=20,
        pool_recycle=1800,   # recycle connections every 30 min
        pool_pre_ping=True,  # validate connection health before use
    )
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
