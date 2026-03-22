import os
import uuid
import aiofiles
from pathlib import Path
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.core.config import get_settings
from app.services.playlist_sync import sync_playlist
from app.models.media import MediaFile, Playlist, PlaylistItem
from app.schemas.media import MediaFileOut, PlaylistOut, PlaylistCreate, PlaylistUpdate

settings = get_settings()

AUDIO_MIME = {"audio/mpeg", "audio/wav", "audio/ogg", "audio/webm", "audio/mp3"}
VIDEO_MIME  = {"video/mp4", "video/webm"}
ALL_MIME    = AUDIO_MIME | VIDEO_MIME


def _file_out(f: MediaFile) -> MediaFileOut:
    return MediaFileOut(
        id=f.id,
        filename=f.filename,
        mediaType=f.media_type,
        mimeType=f.mime_type,
        sizeBytes=f.size_bytes,
        uploadedAt=f.uploaded_at.isoformat(),
        url=f"/media/{f.file_path}",
    )




async def upload_file(db: AsyncSession, owner_id: str, file: UploadFile) -> MediaFileOut:
    mime = file.content_type or ""
    if mime not in ALL_MIME:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Неподдерживаемый формат: {mime}")

    # Read to check size
    contents = await file.read()
    size_mb = len(contents) / 1024 / 1024
    is_audio = mime in AUDIO_MIME

    max_mb = settings.MAX_AUDIO_MB if is_audio else settings.MAX_VIDEO_MB
    if size_mb > max_mb:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Файл превышает {'аудио' if is_audio else 'видео'} лимит {max_mb} МБ",
        )

    # Save to disk
    ext       = Path(file.filename or "file").suffix or (".mp3" if is_audio else ".mp4")
    file_id   = str(uuid.uuid4())
    rel_path  = f"{owner_id}/{file_id}{ext}"
    abs_path  = Path(settings.MEDIA_DIR) / rel_path
    abs_path.parent.mkdir(parents=True, exist_ok=True)

    async with aiofiles.open(abs_path, "wb") as f_out:
        await f_out.write(contents)

    record = MediaFile(
        id=file_id,
        owner_id=owner_id,
        filename=file.filename or f"file{ext}",
        file_path=str(rel_path),
        mime_type=mime,
        size_bytes=len(contents),
        media_type="audio" if is_audio else "video",
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)

    # Do NOT add new file to Liquidsoap automatically —
    # host must explicitly add it to the playlist.
    # This keeps Liquidsoap in sync with the playlist, not the library.

    return _file_out(record)


async def get_library(db: AsyncSession, owner_id: str) -> list[MediaFileOut]:
    result = await db.execute(
        select(MediaFile)
        .where(MediaFile.owner_id == owner_id)
        .order_by(MediaFile.uploaded_at.desc())
    )
    return [_file_out(f) for f in result.scalars().all()]


async def delete_file(db: AsyncSession, file_id: str, owner_id: str) -> None:
    result = await db.execute(
        select(MediaFile).where(MediaFile.id == file_id, MediaFile.owner_id == owner_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Файл не найден")

    # Remove from disk
    path = Path(settings.MEDIA_DIR) / record.file_path
    if path.exists():
        path.unlink()

    await db.execute(delete(PlaylistItem).where(PlaylistItem.media_file_id == file_id))
    await db.delete(record)
    await db.flush()

    # Re-sync Liquidsoap: query playlist within same transaction (sees pending deletes)
    from sqlalchemy.orm import selectinload
    pl_result = await db.execute(
        select(Playlist)
        .where(Playlist.owner_id == owner_id)
        .options(selectinload(Playlist.items).selectinload(PlaylistItem.media_file))
        .order_by(Playlist.created_at)
        .limit(1)
    )
    active_pl = pl_result.scalar_one_or_none()
    if active_pl and active_pl.items:
        ordered_paths = [
            item.media_file.file_path
            for item in sorted(active_pl.items, key=lambda x: x.position)
            if item.media_file and item.media_file.media_type == "audio"
        ]
    else:
        ordered_paths = []
    await sync_playlist(ordered_paths)


# ── Playlist ─────────────────────────────────────────────────────

def _playlist_out(p: Playlist) -> PlaylistOut:
    from app.schemas.media import PlaylistItemOut
    items = []
    for item in p.items:
        if item.media_file:
            items.append(PlaylistItemOut(
                id=item.id,
                position=item.position,
                mediaFile=_file_out(item.media_file),
            ))
    return PlaylistOut(
        id=p.id,
        title=p.title,
        loopMode=p.loop_mode,
        shuffleMode=p.shuffle_mode,
        items=items,
    )


async def get_playlists(db: AsyncSession, owner_id: str) -> list[PlaylistOut]:
    result = await db.execute(
        select(Playlist).where(Playlist.owner_id == owner_id).order_by(Playlist.created_at)
    )
    return [_playlist_out(p) for p in result.scalars().all()]


async def create_playlist(db: AsyncSession, owner_id: str, data: PlaylistCreate) -> PlaylistOut:
    pl = Playlist(owner_id=owner_id, title=data.title, loop_mode=data.loop_mode, shuffle_mode=data.shuffle_mode)
    db.add(pl)
    await db.flush()
    # Re-fetch with all relationships loaded
    from sqlalchemy.orm import selectinload
    result2 = await db.execute(
        select(Playlist)
        .where(Playlist.id == pl.id)
        .options(selectinload(Playlist.items).selectinload(PlaylistItem.media_file))
    )
    pl = result2.scalar_one()
    return _playlist_out(pl)


async def update_playlist(db: AsyncSession, playlist_id: str, owner_id: str, data: PlaylistUpdate) -> PlaylistOut:
    result = await db.execute(
        select(Playlist).where(Playlist.id == playlist_id, Playlist.owner_id == owner_id)
    )
    pl = result.scalar_one_or_none()
    if not pl:
        raise HTTPException(status_code=404, detail="Плейлист не найден")

    if data.title is not None:       pl.title        = data.title
    if data.loop_mode is not None:   pl.loop_mode    = data.loop_mode
    if data.shuffle_mode is not None: pl.shuffle_mode = data.shuffle_mode

    if data.item_ids is not None:
        await db.execute(delete(PlaylistItem).where(PlaylistItem.playlist_id == playlist_id))
        for idx, media_id in enumerate(data.item_ids):
            db.add(PlaylistItem(playlist_id=playlist_id, media_file_id=media_id, position=idx))

    await db.flush()
    await db.refresh(pl)

    # Sync Liquidsoap m3u directly from item_ids (in-memory, no extra DB query)
    if data.item_ids is not None:
        if data.item_ids:
            # Fetch file_path for the given ids within same transaction
            mf_result = await db.execute(
                select(MediaFile.id, MediaFile.file_path, MediaFile.media_type)
                .where(MediaFile.id.in_(data.item_ids))
            )
            rows = {r[0]: (r[1], r[2]) for r in mf_result.fetchall()}
            ordered_paths = [
                rows[mid][0]
                for mid in data.item_ids
                if mid in rows and rows[mid][1] == "audio"
            ]
        else:
            ordered_paths = []
        await sync_playlist(ordered_paths)

    return _playlist_out(pl)
