"""Database engine and session management (Supabase Postgres via SQLAlchemy)."""
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

settings = get_settings()

# Fall back to a local SQLite file when DATABASE_URL is unset, so the app is
# fully runnable for local development before Supabase is configured.
db_url = settings.database_url or "sqlite+pysqlite:///./portfolio.db"
connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}

# pool_pre_ping avoids stale connections on free-tier/pooled Postgres.
engine = create_engine(
    db_url,
    pool_pre_ping=True,
    future=True,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, class_=Session)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
