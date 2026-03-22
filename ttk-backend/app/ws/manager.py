import asyncio
import json
import logging
from typing import Any
from fastapi import WebSocket
import redis.asyncio as aioredis
from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

CHANNEL = "ttk:broadcast"


class ConnectionManager:
    """
    Manages WebSocket connections.
    - Listeners connect and receive broadcast messages.
    - Host sends state changes via Redis pub/sub so it works with multiple workers.
    """

    def __init__(self):
        self._connections: dict[str, WebSocket] = {}  # connection_id -> ws
        self._listeners_count = 0
        self._redis: aioredis.Redis | None = None

    async def startup(self):
        self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        asyncio.create_task(self._redis_subscriber())

    async def shutdown(self):
        if self._redis:
            await self._redis.aclose()

    async def connect(self, ws: WebSocket, connection_id: str):
        await ws.accept()
        self._connections[connection_id] = ws
        self._listeners_count = len(self._connections)
        await self._notify_listeners_count()

    async def disconnect(self, connection_id: str):
        self._connections.pop(connection_id, None)
        self._listeners_count = len(self._connections)
        await self._notify_listeners_count()

    async def broadcast(self, message: dict[str, Any]):
        """Broadcast to all connected clients via Redis."""
        if self._redis:
            await self._redis.publish(CHANNEL, json.dumps(message))
        else:
            await self._direct_broadcast(message)

    async def _direct_broadcast(self, message: dict[str, Any]):
        dead = []
        payload = json.dumps(message, ensure_ascii=False)
        for cid, ws in list(self._connections.items()):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(cid)
        for cid in dead:
            self._connections.pop(cid, None)

    async def _redis_subscriber(self):
        try:
            pubsub = self._redis.pubsub()
            await pubsub.subscribe(CHANNEL)
            async for message in pubsub.listen():
                if message["type"] == "message":
                    try:
                        data = json.loads(message["data"])
                        await self._direct_broadcast(data)
                    except Exception as e:
                        logger.warning(f"WS broadcast error: {e}")
        except Exception as e:
            logger.error(f"Redis subscriber error: {e}")

    async def _notify_listeners_count(self):
        await self._direct_broadcast({
            "type": "listeners_update",
            "count": self._listeners_count,
        })

    @property
    def listeners_count(self) -> int:
        return len(self._connections)


manager = ConnectionManager()
