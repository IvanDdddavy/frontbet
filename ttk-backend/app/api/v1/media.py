from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_host, get_current_user
from app.models.user import User
from app.schemas.media import MediaFileOut, PlaylistOut, PlaylistCreate, PlaylistUpdate
from app.services import media_service

router = APIRouter(prefix="/media", tags=["media"])


# ── Library ──────────────────────────────────────────────────────

@router.get("/library", response_model=list[MediaFileOut])
async def get_library(
    current_user: User = Depends(require_host),
    db: AsyncSession = Depends(get_db),
):
    return await media_service.get_library(db, current_user.id)


@router.post("/library", response_model=MediaFileOut, status_code=201)
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(require_host),
    db: AsyncSession = Depends(get_db),
):
    return await media_service.upload_file(db, current_user.id, file)


@router.delete("/library/{file_id}", status_code=204)
async def delete_file(
    file_id: str,
    current_user: User = Depends(require_host),
    db: AsyncSession = Depends(get_db),
):
    await media_service.delete_file(db, file_id, current_user.id)


# ── Playlists ─────────────────────────────────────────────────────

@router.get("/playlists", response_model=list[PlaylistOut])
async def get_playlists(
    current_user: User = Depends(require_host),
    db: AsyncSession = Depends(get_db),
):
    return await media_service.get_playlists(db, current_user.id)


@router.post("/playlists", response_model=PlaylistOut, status_code=201)
async def create_playlist(
    data: PlaylistCreate,
    current_user: User = Depends(require_host),
    db: AsyncSession = Depends(get_db),
):
    return await media_service.create_playlist(db, current_user.id, data)


@router.put("/playlists/{playlist_id}", response_model=PlaylistOut)
async def update_playlist(
    playlist_id: str,
    data: PlaylistUpdate,
    current_user: User = Depends(require_host),
    db: AsyncSession = Depends(get_db),
):
    return await media_service.update_playlist(db, playlist_id, current_user.id, data)
