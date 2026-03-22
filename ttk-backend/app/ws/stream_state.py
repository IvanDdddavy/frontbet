import json
import redis.asyncio as aioredis
from app.core.config import get_settings

settings = get_settings()
STATE_KEY = "ttk:stream_state"

_default_state = {
    "isLive":       False,
    "isVideo":      False,
    "currentTrack": None,
    "listeners":    0,
}

# Shared Redis pool — reused across calls instead of new connection per request
_redis: aioredis.Redis | None = None


def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            max_connections=5,
        )
    return _redis


async def get_stream_state() -> dict:
    try:
        r = _get_redis()
        raw = await r.get(STATE_KEY)
        if raw:
            return json.loads(raw)
    except Exception:
        pass
    return dict(_default_state)


async def set_stream_state(patch: dict) -> dict:
    try:
        r = _get_redis()
        raw   = await r.get(STATE_KEY)
        state = json.loads(raw) if raw else dict(_default_state)
        state.update(patch)
        await r.set(STATE_KEY, json.dumps(state))
        return state
    except Exception:
        return {**_default_state, **patch}
