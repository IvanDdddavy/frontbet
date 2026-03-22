import uuid
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.core.security import decode_token
from app.ws.manager import manager
from app.ws.stream_state import get_stream_state, set_stream_state

router = APIRouter(tags=["websocket"])

# In-memory set of video subscribers
_video_subscribers: set = set()
_video_lock = __import__('asyncio').Lock()
logger = logging.getLogger(__name__)


@router.websocket("/ws")
async def websocket_endpoint(
    ws: WebSocket,
    token: str | None = Query(default=None),
):
    # Authenticate
    user_id   = None
    user_roles: list[str] = []

    if token:
        try:
            payload    = decode_token(token)
            user_id    = payload.get("sub")
            user_roles = payload.get("roles", [])
        except Exception:
            await ws.close(code=4001, reason="Недействительный токен")
            return

    connection_id = str(uuid.uuid4())
    await manager.connect(ws, connection_id)

    # Send current stream state immediately on connect
    state = await get_stream_state()
    try:
        await ws.send_json({
            "type":     "stream_state",
            "isLive":   state["isLive"],
            "isVideo":  state["isVideo"],
            "track":    state.get("currentTrack"),
            "listeners": manager.listeners_count,
        })
    except Exception:
        pass

    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type")

            # Host → server: update stream state
            if msg_type == "stream_state_change":
                is_host = "host" in user_roles or "admin" in user_roles
                if not is_host:
                    continue
                patch = {}
                if "isLive"  in msg: patch["isLive"]       = bool(msg["isLive"])
                if "isVideo" in msg: patch["isVideo"]      = bool(msg["isVideo"])
                if "track"   in msg: patch["currentTrack"] = msg["track"]

                new_state = await set_stream_state(patch)
                await manager.broadcast({
                    "type":     "stream_state",
                    "isLive":   new_state["isLive"],
                    "isVideo":  new_state["isVideo"],
                    "track":    new_state.get("currentTrack"),
                    "listeners": manager.listeners_count,
                })

            # Volume change from host → broadcast to all listeners
            elif msg_type == "volume_change":
                is_host = "host" in user_roles or "admin" in user_roles
                if is_host:
                    volume = msg.get("volume")
                    if isinstance(volume, (int, float)) and 0 <= volume <= 100:
                        await manager.broadcast({
                            "type": "volume_change",
                            "volume": volume,
                        })

            # Ping → pong (keepalive)
            elif msg_type == "ping":
                try:
                    await ws.send_json({"type": "pong"})
                except Exception:
                    break

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning(f"WS error [{connection_id}]: {e}")
    finally:
        await manager.disconnect(connection_id)

@router.websocket("/ws/video/push")
async def video_push(ws: WebSocket, token: str | None = Query(default=None)):
    """Host pushes binary video chunks here (MediaRecorder output)."""
    if not token:
        await ws.close(code=4001)
        return
    try:
        payload = decode_token(token)
        roles = payload.get("roles", [])
        if "host" not in roles and "admin" not in roles:
            await ws.close(code=4003)
            return
    except Exception:
        await ws.close(code=4001)
        return

    await ws.accept()
    try:
        while True:
            data = await ws.receive_bytes()
            # Fan-out to all subscribers
            dead = set()
            async with _video_lock:
                subs = set(_video_subscribers)
            for sub in subs:
                try:
                    await sub.send_bytes(data)
                except Exception:
                    dead.add(sub)
            if dead:
                async with _video_lock:
                    _video_subscribers.difference_update(dead)
    except Exception:
        pass


@router.websocket("/ws/video/watch")
async def video_watch(ws: WebSocket, token: str | None = Query(default=None)):
    """Listeners connect here to receive live video chunks."""
    await ws.accept()
    async with _video_lock:
        _video_subscribers.add(ws)
    try:
        while True:
            # Keep connection alive, just wait
            await ws.receive_text()
    except Exception:
        pass
    finally:
        async with _video_lock:
            _video_subscribers.discard(ws)
