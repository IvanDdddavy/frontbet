"""
Syncs uploaded media files to /media/playlist.m3u so Liquidsoap
picks them up automatically. Called after upload/delete operations.
"""
import asyncio
import logging
from pathlib import Path
from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


# Formats natively supported by Liquidsoap (ffmpeg not included in base image)
LIQUIDSOAP_SUPPORTED = {".mp3", ".ogg", ".wav", ".flac", ".opus", ".aac"}


async def sync_playlist(file_paths: list[str]) -> None:
    """
    Write an M3U playlist from a list of relative file paths.
    Only includes formats Liquidsoap can decode natively.
    Liquidsoap watches this file and reloads automatically.
    """
    media_dir = Path(settings.MEDIA_DIR)
    playlist_path = media_dir / "playlist.m3u"

    lines = ["#EXTM3U"]
    skipped = 0
    for rel_path in file_paths:
        abs_path = media_dir / rel_path
        if not abs_path.exists():
            continue
        if abs_path.suffix.lower() not in LIQUIDSOAP_SUPPORTED:
            logger.info(f"Skipping unsupported format for Liquidsoap: {abs_path.name}")
            skipped += 1
            continue
        lines.append(f"#EXTINF:-1,{abs_path.name}")
        lines.append(str(abs_path))

    try:
        playlist_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        logger.info(f"Playlist synced: {len(file_paths) - skipped} tracks → {playlist_path} ({skipped} skipped)")
        # Tell Liquidsoap to skip the current track so it picks up the updated playlist immediately
        await _liquidsoap_skip()
    except Exception as e:
        logger.error(f"Failed to write playlist: {e}")


async def _liquidsoap_skip() -> None:
    """Send 'skip' command to Liquidsoap via TCP telnet interface."""
    import asyncio
    host = "liquidsoap"
    port = 1234
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port), timeout=2.0
        )
        # Read welcome banner
        await asyncio.wait_for(reader.read(512), timeout=1.0)
        # "playlist.skip" skips current track on the source named "playlist"
        writer.write(b"playlist.skip\n")
        await writer.drain()
        await asyncio.wait_for(reader.read(256), timeout=1.0)
        writer.write(b"quit\n")
        await writer.drain()
        writer.close()
        await writer.wait_closed()
        logger.info("Liquidsoap: playlist.skip sent via telnet")
    except Exception as e:
        logger.debug(f"Liquidsoap skip unavailable: {e}")


async def rebuild_playlist_from_db(db) -> None:
    """Rebuild Liquidsoap m3u from the first playlist found in DB (called on startup).
    Only plays what the host added to their playlist — not the whole library.
    """
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.models.media import Playlist, PlaylistItem

    result = await db.execute(
        select(Playlist)
        .options(selectinload(Playlist.items).selectinload(PlaylistItem.media_file))
        .order_by(Playlist.created_at)
        .limit(1)
    )
    pl = result.scalar_one_or_none()
    if pl is None or not pl.items:
        await sync_playlist([])
        return

    ordered_paths = [
        item.media_file.file_path
        for item in sorted(pl.items, key=lambda x: x.position)
        if item.media_file and item.media_file.media_type == "audio"
    ]
    await sync_playlist(ordered_paths)
