import json
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

from .models import Offering


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')

    app_name: str = 'Divine Sovereignty API'
    app_env: str = 'development'
    frontend_url: str = 'http://localhost:5173'
    allowed_origins: str = 'http://localhost:5173'
    mongo_uri: str = 'mongodb://localhost:27017'
    mongo_db_name: str = 'divine_sovereignty'
    stripe_secret_key: str = ''
    stripe_webhook_secret: str = ''
    stripe_currency: str = 'usd'
    resend_api_key: str = ''
    resend_from_email: str = 'noreply@example.com'
    enterprise_contact_email: str = ''

    offering_catalog_json: str = json.dumps(
        [
            {
                'id': 'alignment-ebook',
                'name': 'Divine Alignment eBook',
                'description': 'A practical guide to living in alignment with spiritual sovereignty.',
                'price_cents': 2900,
            },
            {
                'id': 'sovereignty-session',
                'name': 'Sovereignty Session',
                'description': 'A one-time 60-minute private strategy and integration session.',
                'price_cents': 12500,
            },
            {
                'id': 'equilibrium-audio-pack',
                'name': 'Equilibrium Audio Pack',
                'description': 'Guided contemplative tracks tuned for restorative focus.',
                'price_cents': 4900,
            },
        ]
    )

    @property
    def offerings(self) -> list[Offering]:
        payload = json.loads(self.offering_catalog_json)
        if not isinstance(payload, list):
            raise ValueError('OFFERING_CATALOG_JSON must contain a JSON array.')
        return [Offering.model_validate(item) for item in payload]

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(',') if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
