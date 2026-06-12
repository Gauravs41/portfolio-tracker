"""Financials service — Phase 2+ stub.

Future: fetch fundamentals (revenue, PE, EPS, ratios) from a free source and
cache into the `financials` table.
"""
from __future__ import annotations


def is_enabled() -> bool:
    return False


def get_financials(instrument_key: str) -> dict:
    return {"instrument_key": instrument_key, "metrics": {}, "enabled": False}
