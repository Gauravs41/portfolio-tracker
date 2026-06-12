"""Upstox API client and instruments master loader.

Docs base: https://api.upstox.com/v2
Auth: Authorization: Bearer <access_token>

This module is intentionally defensive: network/credential issues raise
UpstoxError, which routers translate into clean HTTP responses so the rest of
the app keeps working (empty data) instead of crashing.
"""
from __future__ import annotations

import gzip
import json
import time
from dataclasses import dataclass, field
from datetime import date, timedelta

import httpx

from app.config import get_settings

API_BASE = "https://api.upstox.com/v2"

# Upstox publishes the full instruments master as gzipped JSON.
INSTRUMENTS_NSE_URL = "https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz"
INSTRUMENTS_BSE_URL = "https://assets.upstox.com/market-quote/instruments/exchange/BSE.json.gz"

# Upstox/Cloudflare blocks non-browser User-Agents (HTTP 403, error 1010
# "browser_signature_banned"). Send a normal browser UA on every request.
BROWSER_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

# Equity instrument_type codes per exchange (the master has no `series` field).
# These exclude bonds/SDLs/govt securities that also live in the *_EQ segments.
NSE_EQUITY_TYPES = {"EQ", "BE", "SM", "ST"}
BSE_EQUITY_TYPES = {"A", "B", "T", "X", "XT", "Z", "M", "MT", "MS", "TS"}

# SME-board instrument_type codes (NSE: SM/ST, BSE: M/MT/MS/TS).
SME_TYPES = {"SM", "ST", "M", "MT", "MS", "TS"}


class UpstoxError(RuntimeError):
    pass


@dataclass
class _Cache:
    ttl: int
    quotes: dict[str, tuple[float, dict]] = field(default_factory=dict)
    instruments: list[dict] | None = None
    instruments_loaded_at: float = 0.0


_cache = _Cache(ttl=get_settings().quote_cache_ttl)


def _headers() -> dict[str, str]:
    token = get_settings().upstox_token
    if not token:
        raise UpstoxError("UPSTOX_TOKEN is not configured")
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "User-Agent": BROWSER_UA,
    }


def _classify_board(instrument_type: str) -> str:
    if (instrument_type or "").upper() in SME_TYPES:
        return "SME"
    return "MAINBOARD"


# ---------------------------------------------------------------------------
# Instruments master
# ---------------------------------------------------------------------------

def load_instruments(force: bool = False) -> list[dict]:
    """Download + cache the instruments master (once per ~24h)."""
    day = 24 * 3600
    if not force and _cache.instruments is not None and (time.time() - _cache.instruments_loaded_at) < day:
        return _cache.instruments

    instruments: list[dict] = []
    try:
        with httpx.Client(timeout=60, headers={"User-Agent": BROWSER_UA}) as client:
            for url in (INSTRUMENTS_NSE_URL, INSTRUMENTS_BSE_URL):
                resp = client.get(url)
                resp.raise_for_status()
                raw = gzip.decompress(resp.content)
                data = json.loads(raw)
                for row in data:
                    segment = row.get("segment", "")
                    itype = (row.get("instrument_type") or "").upper()
                    # Keep only tradeable equities; *_EQ segments also hold
                    # bonds/SDLs/govt secs which we exclude via instrument_type.
                    if segment == "NSE_EQ":
                        if itype not in NSE_EQUITY_TYPES:
                            continue
                    elif segment == "BSE_EQ":
                        if itype not in BSE_EQUITY_TYPES:
                            continue
                    else:
                        continue
                    instruments.append(
                        {
                            "instrument_key": row.get("instrument_key", ""),
                            "symbol": row.get("trading_symbol") or row.get("tradingsymbol") or "",
                            "name": row.get("name", ""),
                            "exchange": row.get("exchange", ""),
                            "segment": segment,
                            "instrument_type": itype,
                            "board_type": _classify_board(itype),
                        }
                    )
    except (httpx.HTTPError, OSError, ValueError) as exc:  # pragma: no cover - network
        raise UpstoxError(f"Failed to load instruments master: {exc}") from exc

    _cache.instruments = instruments
    _cache.instruments_loaded_at = time.time()
    return instruments


def search_instruments(query: str, limit: int = 20) -> list[dict]:
    q = query.strip().upper()
    if not q:
        return []
    results = []
    for ins in load_instruments():
        if q in ins["symbol"].upper() or q in ins["name"].upper():
            results.append(ins)
            if len(results) >= limit:
                break
    return results


def get_instrument(instrument_key: str) -> dict | None:
    for ins in load_instruments():
        if ins["instrument_key"] == instrument_key:
            return ins
    return None


# ---------------------------------------------------------------------------
# Quotes
# ---------------------------------------------------------------------------

def get_ltp(instrument_keys: list[str]) -> dict[str, dict]:
    """Return {instrument_key: {last_price, ...}} using a short-lived cache."""
    if not instrument_keys:
        return {}

    out: dict[str, dict] = {}
    now = time.time()
    to_fetch: list[str] = []
    for key in instrument_keys:
        cached = _cache.quotes.get(key)
        if cached and (now - cached[0]) < _cache.ttl:
            out[key] = cached[1]
        else:
            to_fetch.append(key)

    if to_fetch:
        try:
            with httpx.Client(timeout=30) as client:
                # Upstox accepts comma-separated instrument keys.
                resp = client.get(
                    f"{API_BASE}/market-quote/ltp",
                    headers=_headers(),
                    params={"instrument_key": ",".join(to_fetch)},
                )
                resp.raise_for_status()
                payload = resp.json().get("data", {})
                # Response keys come back like "NSE_EQ:RELIANCE"; map by instrument_token.
                by_key: dict[str, dict] = {}
                for _label, val in payload.items():
                    ikey = val.get("instrument_token") or val.get("instrument_key")
                    if ikey:
                        by_key[ikey] = val
                for key in to_fetch:
                    val = by_key.get(key, {})
                    record = {"last_price": val.get("last_price")}
                    _cache.quotes[key] = (now, record)
                    out[key] = record
        except (httpx.HTTPError, ValueError) as exc:  # pragma: no cover - network
            raise UpstoxError(f"Failed to fetch LTP: {exc}") from exc

    return out


# ---------------------------------------------------------------------------
# Historical candles
# ---------------------------------------------------------------------------

def get_daily_candles(instrument_key: str, days: int = 45) -> list[list]:
    """Return daily candles: [ [timestamp, open, high, low, close, volume, oi], ... ]

    Ordered oldest -> newest. Empty list on failure.
    """
    to_date = date.today()
    from_date = to_date - timedelta(days=days)
    url = f"{API_BASE}/historical-candle/{instrument_key}/day/{to_date.isoformat()}/{from_date.isoformat()}"
    try:
        with httpx.Client(timeout=30) as client:
            resp = client.get(url, headers=_headers())
            resp.raise_for_status()
            candles = resp.json().get("data", {}).get("candles", [])
    except (httpx.HTTPError, ValueError) as exc:  # pragma: no cover - network
        raise UpstoxError(f"Failed to fetch candles for {instrument_key}: {exc}") from exc
    # Upstox returns newest-first; normalize to oldest-first.
    return list(reversed(candles))
