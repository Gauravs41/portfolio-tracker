"""OHLCV candle data for charts (TradingView Lightweight Charts)."""
from fastapi import APIRouter, HTTPException, Query

from app.schemas import Candle, CandlesResponse
from app.services import upstox
from app.services.upstox import UpstoxError

router = APIRouter(prefix="/candles", tags=["candles"])

# Upstox candle layout: [ts, open, high, low, close, volume, oi].
_TS, _O, _H, _L, _C, _V = 0, 1, 2, 3, 4, 5


@router.get("/{instrument_key:path}", response_model=CandlesResponse)
def get_candles(
    instrument_key: str,
    interval: str = Query("day", pattern="^(day|week|month)$"),
):
    """Return OHLCV candles (oldest -> newest) for a chart."""
    try:
        raw = upstox.get_period_candles(instrument_key, interval)
    except UpstoxError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    candles: list[Candle] = []
    for c in raw:
        if len(c) <= _C or c[_C] is None:
            continue
        candles.append(
            Candle(
                time=str(c[_TS])[:10],  # "2024-01-15T00:00:00+05:30" -> "2024-01-15"
                open=c[_O],
                high=c[_H],
                low=c[_L],
                close=c[_C],
                volume=c[_V] if len(c) > _V and c[_V] is not None else 0,
            )
        )
    return CandlesResponse(instrument_key=instrument_key, interval=interval, candles=candles)
