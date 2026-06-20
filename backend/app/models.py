"""SQLAlchemy ORM models for the portfolio tracker.

Phase 1 tables: watchlists, watchlist_items, holdings, instrument_meta.
Future-ready stubs: ai_insights, financials, notifications, alert_rules.
"""
from datetime import datetime

from sqlalchemy import (
    JSON,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Watchlist(Base):
    __tablename__ = "watchlists"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items: Mapped[list["WatchlistItem"]] = relationship(
        back_populates="watchlist", cascade="all, delete-orphan", order_by="WatchlistItem.sort_order"
    )


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    watchlist_id: Mapped[int] = mapped_column(
        ForeignKey("watchlists.id", ondelete="CASCADE"), nullable=False, index=True
    )
    instrument_key: Mapped[str] = mapped_column(String(64), nullable=False)
    symbol: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    watchlist: Mapped["Watchlist"] = relationship(back_populates="items")


class Holding(Base):
    __tablename__ = "holdings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    instrument_key: Mapped[str] = mapped_column(String(64), nullable=False)
    symbol: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), default="")
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    avg_buy_price: Mapped[float] = mapped_column(Float, nullable=False)
    sector: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class InstrumentMeta(Base):
    """Manually-enrichable metadata per instrument (sector tagging, board type)."""

    __tablename__ = "instrument_meta"

    instrument_key: Mapped[str] = mapped_column(String(64), primary_key=True)
    symbol: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), default="")
    exchange: Mapped[str] = mapped_column(String(16), default="")
    segment: Mapped[str] = mapped_column(String(32), default="")
    instrument_type: Mapped[str] = mapped_column(String(16), default="")
    board_type: Mapped[str] = mapped_column(String(16), default="MAINBOARD")  # SME | MAINBOARD
    sector: Mapped[str | None] = mapped_column(String(120), nullable=True)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    notes: Mapped[str] = mapped_column(Text, default="")
    # Manually-entered forward growth estimates (percent). Null = not set.
    rev_growth_year: Mapped[float | None] = mapped_column(Float, nullable=True)
    rev_growth_quarter: Mapped[float | None] = mapped_column(Float, nullable=True)
    profit_growth_year: Mapped[float | None] = mapped_column(Float, nullable=True)
    profit_growth_quarter: Mapped[float | None] = mapped_column(Float, nullable=True)


class ChartDrawing(Base):
    """User chart annotations (trend lines, rectangles, fib, etc.) per instrument.

    Stored as a single JSON array per instrument so all drawings round-trip in
    one GET/PUT. Anchored by time+price so they apply across day/week/month.
    """

    __tablename__ = "chart_drawings"

    instrument_key: Mapped[str] = mapped_column(String(64), primary_key=True)
    drawings: Mapped[list] = mapped_column(JSON, default=list)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


# ---------------------------------------------------------------------------
# Future-ready stub tables (no Phase 1 logic; present so schema is forward-ready)
# ---------------------------------------------------------------------------


class AiInsight(Base):
    __tablename__ = "ai_insights"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    instrument_key: Mapped[str] = mapped_column(String(64), index=True)
    kind: Mapped[str] = mapped_column(String(64), default="summary")
    content: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Financial(Base):
    __tablename__ = "financials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    instrument_key: Mapped[str] = mapped_column(String(64), index=True)
    period: Mapped[str] = mapped_column(String(32), default="")  # e.g. FY24, Q1FY25
    metric: Mapped[str] = mapped_column(String(64), default="")  # e.g. revenue, pe, eps
    value: Mapped[float | None] = mapped_column(Float, nullable=True)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), default="")
    body: Mapped[str] = mapped_column(Text, default="")
    is_read: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AlertRule(Base):
    __tablename__ = "alert_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    instrument_key: Mapped[str] = mapped_column(String(64), index=True)
    condition: Mapped[str] = mapped_column(String(32), default="price_above")  # price_above|price_below|pct_change
    threshold: Mapped[float] = mapped_column(Float, default=0.0)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
