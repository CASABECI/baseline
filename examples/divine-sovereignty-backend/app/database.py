from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import Settings


class MongoClientManager:
    def __init__(self) -> None:
        self._client: AsyncIOMotorClient | None = None

    def get_database(self, settings: Settings) -> AsyncIOMotorDatabase:
        if self._client is None:
            self._client = AsyncIOMotorClient(settings.mongo_uri)
        return self._client[settings.mongo_db_name]

    async def close(self) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None


mongo_manager = MongoClientManager()
