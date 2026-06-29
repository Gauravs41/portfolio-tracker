"""Background scheduler that evaluates active alert rules.

Uses APScheduler's ``BackgroundScheduler`` running inside the FastAPI process.
Every ``alert_poll_seconds`` it loads all active rules, evaluates each against
live data, dispatches notifications for triggered rules, and persists the new
runtime state (``last_value``, ``trigger_count``, ``is_active`` …).

Trigger frequency mirrors TradingView:
  * once          — fire once then deactivate the rule.
  * once_per_bar  — fire at most once per (daily) bar.
  * always        — fire on every poll while the condition holds.

Note: this only fires while the backend process is alive. On sleeping
free-tier hosts alerts won't be evaluated until the app is awake.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler

from app.config import get_settings
from app.db import SessionLocal
from app.models import AlertRule
from app.services import alerts, notifications

logger = logging.getLogger("alerts.scheduler")

_scheduler: BackgroundScheduler | None = None
_JOB_ID = "evaluate_alerts"


def evaluate_active_alerts() -> int:
    """Evaluate every active rule once. Returns the number that fired."""
    db = SessionLocal()
    fired = 0
    try:
        rules = db.query(AlertRule).filter(AlertRule.is_active.is_(True)).all()
        for rule in rules:
            try:
                if _process_rule(db, rule):
                    fired += 1
            except Exception:  # pragma: no cover - never let one rule break the loop
                logger.exception("Error evaluating alert %s", rule.id)
        db.commit()
    finally:
        db.close()
    return fired


def _process_rule(db, rule: AlertRule) -> bool:
    result = alerts.evaluate(rule, db)
    if result is None:
        return False  # data unavailable this tick; keep last_value as-is

    prev_value = rule.last_value
    rule.last_value = result.observed

    if not result.triggered:
        return False

    # once_per_bar: skip if we already fired on this bar.
    if rule.frequency == "once_per_bar" and result.bar_time and rule.last_bar_time == result.bar_time:
        return False

    # Edge case: a brand-new rule with no baseline shouldn't insta-fire on a
    # level it was already past at creation. evaluate() guards crosses (prev is
    # None -> no cross); above/below intentionally fire immediately like TV.
    _ = prev_value

    rule.trigger_count = (rule.trigger_count or 0) + 1
    rule.last_triggered_at = datetime.now(timezone.utc)
    rule.last_bar_time = result.bar_time

    title = alerts.describe(rule)
    body = rule.message.strip() if rule.message else result.label
    notifications.dispatch(
        db,
        title=title,
        body=body,
        instrument_key=rule.instrument_key,
        symbol=rule.symbol,
        alert_id=rule.id,
    )

    if rule.frequency == "once":
        rule.is_active = False
    return True


def start() -> None:
    """Start the background scheduler (idempotent)."""
    global _scheduler
    settings = get_settings()
    if not settings.alerts_enabled:
        logger.info("Alerts scheduler disabled via config.")
        return
    if _scheduler is not None:
        return
    interval = max(10, settings.alert_poll_seconds)
    _scheduler = BackgroundScheduler(daemon=True, timezone="UTC")
    _scheduler.add_job(
        evaluate_active_alerts,
        "interval",
        seconds=interval,
        id=_JOB_ID,
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("Alerts scheduler started (every %ss).", interval)


def shutdown() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
