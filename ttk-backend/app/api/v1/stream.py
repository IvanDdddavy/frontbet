from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.dependencies import require_host, require_user
from app.models.user import User
from app.schemas.message import StreamStateOut
from app.ws.manager import manager
from app.ws.stream_state import get_stream_state, set_stream_state
from app.core.config import get_settings as _get_settings
settings = _get_settings()

router = APIRouter(prefix="/stream", tags=["stream"])


class StreamStateUpdate(BaseModel):
    isLive:       bool | None = None
    isVideo:      bool | None = None
    currentTrack: str | None = None


@router.get("", response_model=StreamStateOut)
async def get_state(_: User = Depends(require_user)):
    state = await get_stream_state()
    return StreamStateOut(
        isLive=state["isLive"],
        isVideo=state["isVideo"],
        currentTrack=state.get("currentTrack"),
        listeners=manager.listeners_count,
    )


@router.post("", response_model=StreamStateOut)
async def update_state(
    data: StreamStateUpdate,
    _: User = Depends(require_host),
):
    # Only include fields that were explicitly provided (exclude_unset)
    # This preserves False values (turning off stream) and excludes truly missing fields
    patch = data.model_dump(exclude_unset=True)
    state = await set_stream_state(patch)
    state["listeners"] = manager.listeners_count

    # Broadcast new state to all connected WS clients
    await manager.broadcast({
        "type": "stream_state",
        "isLive":       state["isLive"],
        "isVideo":      state["isVideo"],
        "track":        state.get("currentTrack"),
        "listeners":    state["listeners"],
    })

    return StreamStateOut(
        isLive=state["isLive"],
        isVideo=state["isVideo"],
        currentTrack=state.get("currentTrack"),
        listeners=state["listeners"],
    )


@router.get("/url")
async def get_stream_url():
    """Returns the public stream URL for the audio player."""
    # Return the public URL (browser-accessible), not the internal Icecast URL
    public_url = getattr(settings, "PUBLIC_STREAM_URL", settings.STREAM_URL)
    return {"url": public_url}


@router.get("/health")
async def stream_health():
    """Check if Icecast stream has an active source (Liquidsoap connected).
    Uses Icecast status JSON — responds instantly without opening audio stream.
    """
    import httpx
    # Icecast status page: same host/port as stream but different path
    icecast_base = f"http://{settings.ICECAST_HOST}:{settings.ICECAST_PORT}"
    status_url = f"{icecast_base}/status-json.xsl"
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            r = await client.get(status_url)
            if r.status_code != 200:
                return {"alive": False, "status": r.status_code}
            data = r.json()
            # Icecast JSON: icestats.source can be a dict (1 source) or list (many)
            sources = data.get("icestats", {}).get("source", None)
            if sources is None:
                return {"alive": False, "source": None}
            if isinstance(sources, dict):
                sources = [sources]
            # Check if /stream mount has listeners (i.e. source is active)
            alive = any(
                str(s.get("listenurl", "")).endswith("/stream") or
                str(s.get("mount", "")) == "/stream"
                for s in sources
            )
            return {"alive": alive, "sources": len(sources)}
    except Exception as e:
        return {"alive": False, "error": str(e)}
