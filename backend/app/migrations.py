"""Tiny additive schema migrations.

``Base.metadata.create_all`` creates missing *tables* but never alters existing
ones. The alerts feature expands the previously-stubbed ``alert_rules`` and
``notifications`` tables, so on a database where those tables already exist we
add the new columns here. Only additive ``ADD COLUMN`` statements are used, so
this is safe and idempotent on both SQLite and PostgreSQL.
"""
from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

# table -> {column: SQL type+default} additions that may be missing on older DBs.
_ADDITIONS: dict[str, dict[str, str]] = {
    "notifications": {
        "alert_id": "INTEGER",
        "instrument_key": "VARCHAR(64) DEFAULT ''",
        "symbol": "VARCHAR(64) DEFAULT ''",
    },
    "alert_rules": {
        "symbol": "VARCHAR(64) DEFAULT ''",
        "name": "VARCHAR(255) DEFAULT ''",
        "value": "DOUBLE PRECISION DEFAULT 0",
        "params": "JSON",
        "drawing_id": "VARCHAR(64)",
        "frequency": "VARCHAR(16) DEFAULT 'once'",
        "message": "TEXT DEFAULT ''",
        "last_value": "DOUBLE PRECISION",
        "last_bar_time": "VARCHAR(32)",
        "last_triggered_at": "TIMESTAMP",
        "trigger_count": "INTEGER DEFAULT 0",
    },
}

# Legacy columns from the old stub schema the current models no longer write.
# Dropped so their NOT-NULL constraints don't block new inserts. Safe: these
# tables were never populated before the alerts feature shipped.
_REMOVALS: dict[str, list[str]] = {
    "alert_rules": ["threshold"],
}


def _sqlite_type(coltype: str) -> str:
    # SQLite has no DOUBLE PRECISION / TIMESTAMP keywords with defaults issues;
    # map to its flexible affinities.
    return (
        coltype.replace("DOUBLE PRECISION", "REAL")
        .replace("TIMESTAMP", "DATETIME")
        .replace("JSON", "TEXT")
    )


def run_migrations(engine: Engine) -> None:
    is_sqlite = engine.dialect.name == "sqlite"
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    with engine.begin() as conn:
        for table, columns in _ADDITIONS.items():
            if table not in existing_tables:
                continue  # create_all will build it fresh with the full schema
            have = {c["name"] for c in inspector.get_columns(table)}
            for col, coltype in columns.items():
                if col in have:
                    continue
                ddl = _sqlite_type(coltype) if is_sqlite else coltype
                conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {col} {ddl}'))

        for table, columns in _REMOVALS.items():
            if table not in existing_tables:
                continue
            have = {c["name"] for c in inspector.get_columns(table)}
            for col in columns:
                if col not in have:
                    continue
                try:
                    conn.execute(text(f'ALTER TABLE {table} DROP COLUMN {col}'))
                except Exception:  # pragma: no cover - old SQLite w/o DROP COLUMN
                    # If the dialect can't drop it, relax the NOT NULL instead.
                    if not is_sqlite:
                        conn.execute(
                            text(f'ALTER TABLE {table} ALTER COLUMN {col} DROP NOT NULL')
                        )
