"""AI insights service — Phase 2+ stub.

Defines the interface the app will call once an AI provider is wired in.
Returning structured placeholders keeps the API contract stable today.
"""
from __future__ import annotations


def is_enabled() -> bool:
    return False


def generate_insight(instrument_key: str, kind: str = "summary") -> dict:
    """Future: call an LLM with price/financial context and return an insight."""
    return {
        "instrument_key": instrument_key,
        "kind": kind,
        "content": "",
        "enabled": False,
    }
