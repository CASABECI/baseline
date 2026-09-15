from __future__ import annotations

import json
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

from .models import Offering


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Divine Sovereignty API"
    app_env: str = "development"
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "divine_sovereignty"
    cors_origins_raw: str = "http://localhost:5173,http://127.0.0.1:5173"
    frontend_success_url: str = "http://localhost:5173/?checkout=success"
    frontend_cancel_url: str = "http://localhost:5173/?checkout=cancel"
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_currency: str = "usd"
    offering_catalog_json: str = (
        '[{"id":"alignment-ebook","name":"Divine Alignment eBook",'
        '"description":"A practical guide to living in alignment with spiritual sovereignty.",'
        '"price_cents":2900},'
        '{"id":"sovereignty-session","name":"Sovereignty Session",'
        '"description":"A one-time 60-minute private strategy and integration session.",'
        '"price_cents":12500},'
        '{"id":"equilibrium-audio-pack","name":"Equilibrium Audio Pack",'
        '"description":"Guided contemplative tracks tuned for restorative focus.",'
        '"price_cents":4900}]'
    )
    resend_api_key: str = ""
    resend_from_email: str = "noreply@example.com"
    enterprise_contact_email: str = "enterprise@example.com"
    rate_limit_window_seconds: int = 60
    rate_limit_max_requests: int = 30

    @property
    def cors_origins(self) -> list[str]:
        return [item.strip() for item in self.cors_origins_raw.split(",") if item.strip()]

    @property
    def offerings(self) -> list[Offering]:
        payload = json.loads(self.offering_catalog_json)
        if not isinstance(payload, list):
            raise ValueError("OFFERING_CATALOG_JSON must contain a JSON array.")
        return [Offering.model_validate(item) for item in payload]

    @property
    def offerings_by_id(self) -> dict[str, Offering]:
        return {item.id: item for item in self.offerings}


@lru_cache
def get_settings() -> Settings:
    return Settings()
