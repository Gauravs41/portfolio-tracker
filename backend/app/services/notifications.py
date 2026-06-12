"""Notifications service — Phase 2+ stub.

Future: evaluate `alert_rules` against live prices and dispatch via email/push,
recording entries in the `notifications` table.
"""
from __future__ import annotations


def is_enabled() -> bool:
    return False


def evaluate_alerts() -> list[dict]:
    """Future: return notifications triggered by alert rules."""
    return []
