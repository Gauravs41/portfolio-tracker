"""Application settings loaded from environment variables."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    upstox_token: str = ""
    database_url: str = ""
    cors_origins: str = "http://localhost:5173"
    quote_cache_ttl: int = 60
    # --- Alerts ---
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    # How often the background scheduler evaluates active alert rules (seconds).
    alert_poll_seconds: int = 60
    # Master switch for the in-process alert scheduler.
    alerts_enabled: bool = True
    # Shared secret that authorizes the external cron trigger (POST /alerts/run).
    # Leave blank to disable the endpoint (returns 404). Set on free-tier hosts
    # where the in-process scheduler sleeps and a cron job drives evaluation.
    cron_secret: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
