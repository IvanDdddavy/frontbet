from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.core.config import get_settings
from app.core.database import engine, Base, AsyncSessionLocal
from app.ws.manager import manager
from app.services.playlist_sync import ensure_playlist_file, rebuild_playlist_from_db
import app.models  # noqa: F401

from app.api.v1 import auth, users, media, messages, stream
from app.api import websocket as ws_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    Path(settings.MEDIA_DIR).mkdir(parents=True, exist_ok=True)
    (Path(settings.MEDIA_DIR) / "voices").mkdir(exist_ok=True)

    # Гарантируем что playlist.m3u существует — иначе Liquidsoap падает
    ensure_playlist_file()

    # Восстанавливаем плейлист из БД (на случай перезапуска бэкенда)
    async with AsyncSessionLocal() as db:
        await rebuild_playlist_from_db(db)

    await manager.startup()
    yield
    await manager.shutdown()


app = FastAPI(
    title="ТТК Эфирная платформа",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,     prefix="/api")
app.include_router(users.router,    prefix="/api")
app.include_router(media.router,    prefix="/api")
app.include_router(messages.router, prefix="/api")
app.include_router(stream.router,   prefix="/api")
app.include_router(ws_router.router)

media_path = Path(settings.MEDIA_DIR)
media_path.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(media_path)), name="media")


# ── Flatten Pydantic validation errors → plain string detail ──────
@app.exception_handler(RequestValidationError)
async def request_validation_handler(request: Request, exc: RequestValidationError):
    msgs = []
    for e in exc.errors():
        loc = " → ".join(str(l) for l in e["loc"] if l != "body")
        msg = e["msg"].replace("Value error, ", "")
        msgs.append(f"{loc}: {msg}" if loc else msg)
    detail = "; ".join(msgs)
    return JSONResponse(status_code=422, content={"detail": detail})


@app.exception_handler(ValidationError)
async def validation_error_handler(request: Request, exc: ValidationError):
    msgs = []
    for e in exc.errors():
        loc = " → ".join(str(l) for l in e["loc"])
        msg = e["msg"].replace("Value error, ", "")
        msgs.append(f"{loc}: {msg}" if loc else msg)
    detail = "; ".join(msgs)
    return JSONResponse(status_code=422, content={"detail": detail})


@app.get("/api/health", tags=["health"])
async def health():
    return {"status": "ok", "version": "1.0.0"}
