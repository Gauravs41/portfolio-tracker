"""Pydantic request/response schemas."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# ---- Instruments ----
class InstrumentOut(BaseModel):
    instrument_key: str
    symbol: str
    name: str
    exchange: str
    segment: str
    instrument_type: str = ""
    board_type: str = "MAINBOARD"


# ---- Instrument metadata (tags / notes / sector, global per stock) ----
class InstrumentMetaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    instrument_key: str
    symbol: str = ""
    name: str = ""
    tags: list[str] = []
    notes: str = ""
    sector: str | None = None
    board_type: str = "MAINBOARD"
    rev_growth_year: float | None = None
    rev_growth_quarter: float | None = None
    profit_growth_year: float | None = None
    profit_growth_quarter: float | None = None


class InstrumentMetaUpdate(BaseModel):
    symbol: str | None = None
    name: str | None = None
    tags: list[str] | None = None
    notes: str | None = None
    sector: str | None = None
    rev_growth_year: float | None = None
    rev_growth_quarter: float | None = None
    profit_growth_year: float | None = None
    profit_growth_quarter: float | None = None


# ---- Watchlists ----
class WatchlistItemCreate(BaseModel):
    instrument_key: str
    symbol: str
    name: str = ""


class WatchlistItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    instrument_key: str
    symbol: str
    name: str
    sort_order: int


class WatchlistCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class WatchlistOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    created_at: datetime
    items: list[WatchlistItemOut] = []


# ---- Holdings ----
class HoldingCreate(BaseModel):
    instrument_key: str
    symbol: str
    name: str = ""
    quantity: float = Field(gt=0)
    avg_buy_price: float = Field(gt=0)
    sector: str | None = None


class HoldingUpdate(BaseModel):
    quantity: float | None = Field(default=None, gt=0)
    avg_buy_price: float | None = Field(default=None, gt=0)
    sector: str | None = None


class HoldingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    instrument_key: str
    symbol: str
    name: str
    quantity: float
    avg_buy_price: float
    sector: str | None
    created_at: datetime


# ---- Performance ----
class PerformanceRow(BaseModel):
    instrument_key: str
    symbol: str
    name: str = ""
    last_price: float | None = None
    prev_close: float | None = None
    change_1d: float | None = None
    change_3d: float | None = None
    change_1w: float | None = None
    change_2w: float | None = None
    change_1m: float | None = None
    rsi_14: float | None = None
    rsi_interval: str = "day"  # day | week | month
    sma_20: float | None = None
    sma_50: float | None = None
    pe_ratio: float | None = None
    trend: str = "neutral"  # above_sma50 | below_sma50 | neutral
    sentiment: str = "neutral"  # bullish | bearish | neutral
    tags: list[str] = []
    notes: str = ""
    # Manually-entered forward growth estimates (percent).
    rev_growth_year: float | None = None
    rev_growth_quarter: float | None = None
    profit_growth_year: float | None = None
    profit_growth_quarter: float | None = None


class HoldingPerformanceRow(PerformanceRow):
    id: int = 0
    quantity: float = 0
    avg_buy_price: float = 0
    market_value: float | None = None
    invested: float | None = None
    pnl: float | None = None
    pnl_pct: float | None = None
    allocation_pct: float | None = None
    sector: str | None = None
    board_type: str = "MAINBOARD"


class HoldingsPerformanceResponse(BaseModel):
    total_market_value: float = 0
    total_invested: float = 0
    total_pnl: float = 0
    total_pnl_pct: float = 0
    rows: list[HoldingPerformanceRow] = []


# ---- Candles (OHLCV for charts) ----
class Candle(BaseModel):
    time: str  # ISO date "YYYY-MM-DD" (lightweight-charts business-day format)
    open: float
    high: float
    low: float
    close: float
    volume: float = 0


class CandlesResponse(BaseModel):
    instrument_key: str
    interval: str  # day | week | month
    candles: list[Candle] = []


# ---- Diversification ----
class DiversificationSlice(BaseModel):
    label: str
    value: float
    pct: float
    count: int


class DiversificationResponse(BaseModel):
    total_market_value: float = 0
    by_sector: list[DiversificationSlice] = []
    by_board: list[DiversificationSlice] = []
