"""Performance windows and technical indicators computed from daily candles."""
from __future__ import annotations

from app.services import upstox
from app.services.upstox import UpstoxError

# Candle index constants (Upstox candle: [ts, open, high, low, close, volume, oi]).
CLOSE = 4

# Trading-day offsets for each window.
WINDOWS = {
    "change_1d": 1,
    "change_3d": 3,
    "change_1w": 5,
    "change_2w": 10,
    "change_1m": 21,
}


def _pct(curr: float, prev: float) -> float | None:
    if prev in (0, None) or curr is None:
        return None
    return round((curr - prev) / prev * 100, 2)


def _sma(closes: list[float], period: int) -> float | None:
    if len(closes) < period:
        return None
    return round(sum(closes[-period:]) / period, 2)


def _rsi(closes: list[float], period: int = 14) -> float | None:
    if len(closes) < period + 1:
        return None
    gains, losses = 0.0, 0.0
    for i in range(-period, 0):
        delta = closes[i] - closes[i - 1]
        if delta >= 0:
            gains += delta
        else:
            losses -= delta
    avg_gain = gains / period
    avg_loss = losses / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100 - (100 / (1 + rs)), 2)


def _sentiment(change_1w: float | None, price: float | None, sma50: float | None, rsi: float | None) -> str:
    """Composite bullish/bearish/neutral score."""
    score = 0
    if change_1w is not None:
        score += 1 if change_1w > 0 else -1
    if price is not None and sma50 is not None:
        score += 1 if price >= sma50 else -1
    if rsi is not None:
        if rsi >= 55:
            score += 1
        elif rsi <= 45:
            score -= 1
    if score >= 1:
        return "bullish"
    if score <= -1:
        return "bearish"
    return "neutral"


def compute_metrics(instrument_key: str, last_price: float | None = None) -> dict:
    """Return performance windows + indicators for one instrument.

    Falls back to empty/None values if candles can't be fetched.
    """
    result: dict = {
        "last_price": last_price,
        "prev_close": None,
        "rsi_14": None,
        "sma_20": None,
        "sma_50": None,
        "pe_ratio": None,
        "trend": "neutral",
        "sentiment": "neutral",
    }
    for key in WINDOWS:
        result[key] = None

    try:
        result["pe_ratio"] = upstox.get_key_ratios(instrument_key).get("pe")
    except UpstoxError:
        result["pe_ratio"] = None

    try:
        candles = upstox.get_daily_candles(instrument_key)
    except UpstoxError:
        candles = []

    closes = [c[CLOSE] for c in candles if len(c) > CLOSE and c[CLOSE] is not None]
    if not closes:
        return result

    current = last_price if last_price is not None else closes[-1]
    result["last_price"] = current
    result["prev_close"] = closes[-1] if last_price is None and len(closes) >= 1 else (
        closes[-1] if len(closes) >= 1 else None
    )

    for key, offset in WINDOWS.items():
        if len(closes) > offset:
            result[key] = _pct(current, closes[-1 - offset])

    result["sma_20"] = _sma(closes, 20)
    result["sma_50"] = _sma(closes, 50)
    result["rsi_14"] = _rsi(closes, 14)

    if result["sma_50"] is not None and current is not None:
        result["trend"] = "above_sma50" if current >= result["sma_50"] else "below_sma50"

    result["sentiment"] = _sentiment(
        result["change_1w"], current, result["sma_50"], result["rsi_14"]
    )
    return result
