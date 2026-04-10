from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.core.config import settings

if settings.DATABASE_URL.startswith("sqlite"):
    _connect_args = {"check_same_thread": False}
    _pool_kwargs: dict = {}
else:
    _connect_args = {"connect_timeout": 10}
    _pool_kwargs = {
        "pool_size": 20,
        "max_overflow": 40,
        "pool_recycle": 3600,   # recycle connections after 1 hour to avoid stale connections
        "pool_pre_ping": True,  # test each connection before use; handles DB restarts gracefully
    }
engine = create_engine(settings.DATABASE_URL, connect_args=_connect_args, **_pool_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
