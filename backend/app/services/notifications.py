"""Notification dispatch for triggered alerts.

Two sinks:
  * Telegram  — pushed immediately via the Bot API (if configured).
  * Database  — a ``notifications`` row the frontend polls for browser
                notifications / in-app toasts.

Everything is best-effort: a failing Telegram send never blocks the DB record
(so the browser still gets the alert) and never raises into the scheduler.
"""
from __future__ import annotations

import logging

import httpx
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Notification

logger = logging.getLogger("alerts.notifications")


def telegram_configured() -> bool:
    s = get_settings()
    return bool(s.telegram_bot_token and s.telegram_chat_id)


def is_enabled() -> bool:
    return telegram_configured()


def send_telegram(text: str) -> bool:
    """Send a message via the Telegram Bot API. Returns True on success."""
    s = get_settings()
    if not (s.telegram_bot_token and s.telegram_chat_id):
        return False
    url = f"https://api.telegram.org/bot{s.telegram_bot_token}/sendMessage"
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.post(
                url,
                json={
                    "chat_id": s.telegram_chat_id,
                    "text": text,
                    "parse_mode": "HTML",
                    "disable_web_page_preview": True,
                },
            )
            resp.raise_for_status()
        return True
    except httpx.HTTPError as exc:  # pragma: no cover - network
        logger.warning("Telegram send failed: %s", exc)
        return False


def record(
    db: Session,
    *,
    title: str,
    body: str,
    instrument_key: str = "",
    symbol: str = "",
    alert_id: int | None = None,
) -> Notification:
    note = Notification(
        title=title,
        body=body,
        instrument_key=instrument_key,
        symbol=symbol,
        alert_id=alert_id,
    )
    db.add(note)
    db.flush()  # assign id without committing (caller commits)
    return note


def dispatch(
    db: Session,
    *,
    title: str,
    body: str,
    instrument_key: str = "",
    symbol: str = "",
    alert_id: int | None = None,
) -> Notification:
    """Record the notification and push it to Telegram (best-effort)."""
    note = record(
        db,
        title=title,
        body=body,
        instrument_key=instrument_key,
        symbol=symbol,
        alert_id=alert_id,
    )
    send_telegram(f"<b>{title}</b>\n{body}")
    return note
