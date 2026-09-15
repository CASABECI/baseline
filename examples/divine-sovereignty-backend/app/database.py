from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import Settings

_client: Optional[AsyncIOMotorClient] = None


def get_client(settings: Settings) -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(settings.mongodb_uri)
    return _client


def get_db(settings: Settings) -> AsyncIOMotorDatabase:
    return get_client(settings)[settings.mongodb_db]


async def close_client() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def insert_document(settings: Settings, collection: str, document: dict[str, Any]) -> str:
    payload = {**document, "created_at": utcnow()}
    result = await get_db(settings)[collection].insert_one(payload)
    return str(result.inserted_id)
