"""Alert rule evaluation.

Given an :class:`~app.models.AlertRule`, observe the current market input it
cares about (price, % change, RSI, SMA gap, or distance from a drawn line) and
decide whether it has *triggered*. "Cross" conditions compare against the
rule's previously-observed value (``last_value``) so they fire only on the
transition through the level — exactly like TradingView.

The scheduler owns persistence of ``last_value``/``trigger_count`` etc.; this
module is pure evaluation so it stays easy to test.
"""
from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models import AlertRule, ChartDrawing
from app.services import upstox
from app.services.performance import compute_metrics
from app.services.upstox import UpstoxError

CLOSE = 4


@dataclass
class Observation:
    observed: float       # the scalar being compared
    threshold: float      # the level it's compared against
    kind: str             # above | below | cross_up | cross_down | cross
    bar_time: str | None  # latest bar date, for once_per_bar dedupe
    label: str            # human description of the observed quantity


def _ltp(instrument_key: str) -> float | None:
    try:
        rec = upstox.get_ltp([instrument_key]).get(instrument_key) or {}
    except UpstoxError:
        return None
    price = rec.get("last_price")
    return float(price) if price is not None else None


def _latest_bar_time(instrument_key: str) -> str | None:
    try:
        candles = upstox.get_period_candles(instrument_key, "day")
    except UpstoxError:
        return None
    if not candles:
        return None
    ts = candles[-1][0]
    return str(ts)[:10] if ts is not None else None


def _drawing_line_price(db: Session, rule: AlertRule) -> float | None:
    """Price of the rule's referenced drawing at the latest bar.

    Trend/ray lines are extrapolated to the current bar's logical index;
    horizontal lines are constant. Returns None if the drawing or its anchors
    can't be resolved (e.g. legacy time-only points)."""
    if not rule.drawing_id:
        return None
    row = db.get(ChartDrawing, rule.instrument_key)
    if not row or not row.drawings:
        return None
    drawing = next((d for d in row.drawings if d.get("id") == rule.drawing_id), None)
    if not drawing:
        return None
    pts = drawing.get("points") or []
    if not pts:
        return None
    # Horizontal line: single price level.
    if drawing.get("type") == "hline" or len(pts) == 1:
        return _num(pts[0].get("price"))

    p0, p1 = pts[0], pts[1]
    l0, l1 = _num(p0.get("logical")), _num(p1.get("logical"))
    pr0, pr1 = _num(p0.get("price")), _num(p1.get("price"))
    if None in (l0, l1, pr0, pr1):
        return None
    try:
        candles = upstox.get_period_candles(rule.instrument_key, "day")
    except UpstoxError:
        return None
    if not candles:
        return None
    latest_logical = len(candles) - 1
    if l1 == l0:
        return pr1
    slope = (pr1 - pr0) / (l1 - l0)
    return pr0 + slope * (latest_logical - l0)


def _num(v) -> float | None:
    try:
        return None if v is None else float(v)
    except (TypeError, ValueError):
        return None


def observe(rule: AlertRule, db: Session) -> Observation | None:
    """Compute the current observed value + comparison for a rule.

    Returns None when the required market data is unavailable, so the scheduler
    simply skips this tick without changing state."""
    cond = rule.condition
    bar_time = _latest_bar_time(rule.instrument_key)

    if cond in ("price_cross_up", "price_cross_down", "price_above", "price_below"):
        price = _ltp(rule.instrument_key)
        if price is None:
            return None
        kind = {
            "price_cross_up": "cross_up",
            "price_cross_down": "cross_down",
            "price_above": "above",
            "price_below": "below",
        }[cond]
        return Observation(price, rule.value, kind, bar_time, f"price {price:.2f}")

    if cond in ("pct_change_above", "pct_change_below"):
        m = compute_metrics(rule.instrument_key, _ltp(rule.instrument_key))
        pct = _num(m.get("change_1d"))
        if pct is None:
            return None
        kind = "above" if cond == "pct_change_above" else "below"
        return Observation(pct, rule.value, kind, bar_time, f"1D change {pct:.2f}%")

    if cond in ("rsi_above", "rsi_below"):
        interval = (rule.params or {}).get("interval", "day")
        m = compute_metrics(rule.instrument_key, _ltp(rule.instrument_key), interval)
        rsi = _num(m.get("rsi_14"))
        if rsi is None:
            return None
        kind = "above" if cond == "rsi_above" else "below"
        return Observation(rsi, rule.value, kind, bar_time, f"RSI {rsi:.1f}")

    if cond == "price_cross_sma":
        price = _ltp(rule.instrument_key)
        if price is None:
            return None
        period = int((rule.params or {}).get("period", 50))
        m = compute_metrics(rule.instrument_key, price)
        sma = _num(m.get(f"sma_{period}")) or _num(m.get("sma_50"))
        if sma is None:
            return None
        # Observe the signed gap; a sign change == a cross of the SMA.
        return Observation(price - sma, 0.0, "cross", bar_time,
                           f"price {price:.2f} vs SMA{period} {sma:.2f}")

    if cond == "drawing_cross":
        price = _ltp(rule.instrument_key)
        line = _drawing_line_price(db, rule)
        if price is None or line is None:
            return None
        return Observation(price - line, 0.0, "cross", bar_time,
                           f"price {price:.2f} vs line {line:.2f}")

    return None


def _crossed(kind: str, observed: float, threshold: float, prev: float | None) -> bool:
    if kind == "above":
        return observed >= threshold
    if kind == "below":
        return observed <= threshold
    if prev is None:
        return False  # need a baseline before a cross can be detected
    if kind == "cross_up":
        return prev < threshold <= observed
    if kind == "cross_down":
        return prev > threshold >= observed
    if kind == "cross":  # either direction through the threshold
        return (prev - threshold) * (observed - threshold) < 0
    return False


@dataclass
class EvalResult:
    triggered: bool
    observed: float
    bar_time: str | None
    label: str


def evaluate(rule: AlertRule, db: Session) -> EvalResult | None:
    obs = observe(rule, db)
    if obs is None:
        return None
    triggered = _crossed(obs.kind, obs.observed, obs.threshold, rule.last_value)
    return EvalResult(triggered, obs.observed, obs.bar_time, obs.label)


# Human-readable condition summaries for notification text.
CONDITION_LABELS = {
    "price_cross_up": "crossing up",
    "price_cross_down": "crossing down",
    "price_above": "above",
    "price_below": "below",
    "pct_change_above": "1D change above",
    "pct_change_below": "1D change below",
    "rsi_above": "RSI above",
    "rsi_below": "RSI below",
    "price_cross_sma": "crossing SMA",
    "drawing_cross": "crossing line",
}


def describe(rule: AlertRule) -> str:
    sym = rule.symbol or rule.instrument_key
    label = CONDITION_LABELS.get(rule.condition, rule.condition)
    if rule.condition in ("price_cross_sma", "drawing_cross"):
        return f"{sym} {label}"
    return f"{sym} {label} {rule.value:g}"
