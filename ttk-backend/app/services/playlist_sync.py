"""
Синхронизирует медиафайлы в /media/playlist.m3u чтобы Liquidsoap
автоматически их подхватил. Вызывается после изменений плейлиста.
"""
import asyncio
import logging
from pathlib import Path
from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

# Форматы которые Liquidsoap умеет декодировать без ffmpeg
LIQUIDSOAP_SUPPORTED = {".mp3", ".ogg", ".wav", ".flac", ".opus", ".aac"}


def ensure_playlist_file() -> None:
    """Создаём пустой playlist.m3u при старте если его нет — иначе Liquidsoap падает."""
    media_dir = Path(settings.MEDIA_DIR)
    media_dir.mkdir(parents=True, exist_ok=True)
    playlist_path = media_dir / "playlist.m3u"
    if not playlist_path.exists():
        playlist_path.write_text("#EXTM3U\n", encoding="utf-8")
        logger.info(f"Created empty playlist: {playlist_path}")


async def sync_playlist(file_paths: list[str]) -> None:
    """
    Записывает M3U плейлист из списка относительных путей.
    Liquidsoap следит за файлом (reload_mode=watch) и перезагружает автоматически.
    """
    media_dir = Path(settings.MEDIA_DIR)
    playlist_path = media_dir / "playlist.m3u"

    lines = ["#EXTM3U"]
    skipped = 0
    included = 0
    for rel_path in file_paths:
        abs_path = media_dir / rel_path
        if not abs_path.exists():
            logger.warning(f"File not found, skipping: {abs_path}")
            continue
        if abs_path.suffix.lower() not in LIQUIDSOAP_SUPPORTED:
            logger.info(f"Skipping unsupported format: {abs_path.name}")
            skipped += 1
            continue
        lines.append(f"#EXTINF:-1,{abs_path.stem}")
        lines.append(str(abs_path))
        included += 1

    try:
        playlist_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        logger.info(
            f"Playlist synced: {included} tracks → {playlist_path}"
            + (f" ({skipped} skipped: unsupported format)" if skipped else "")
        )
        # Говорим Liquidsoap пропустить текущий трек — он подхватит обновлённый плейлист
        await _liquidsoap_skip()
    except Exception as e:
        logger.error(f"Failed to write playlist: {e}")


async def _liquidsoap_skip() -> None:
    """Отправляем 'skip' через telnet-интерфейс Liquidsoap."""
    host = "liquidsoap"
    port = 1234
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port), timeout=3.0
        )
        # Читаем приветственный баннер
        await asyncio.wait_for(reader.read(512), timeout=2.0)

        # playlist.skip — пропускает текущий трек, Liquidsoap читает новый playlist.m3u
        writer.write(b"playlist.skip\n")
        await writer.drain()
        await asyncio.wait_for(reader.read(256), timeout=2.0)

        writer.write(b"quit\n")
        await writer.drain()
        writer.close()
        await writer.wait_closed()
        logger.info("Liquidsoap: playlist.skip sent successfully")
    except asyncio.TimeoutError:
        logger.debug("Liquidsoap telnet timeout — playlist will reload on next track change")
    except ConnectionRefusedError:
        logger.debug("Liquidsoap telnet not available yet — playlist file updated, will pick up automatically")
    except Exception as e:
        logger.debug(f"Liquidsoap skip: {e}")


async def rebuild_playlist_from_db(db) -> None:
    """Восстанавливает playlist.m3u из БД при старте бэкенда."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.models.media import Playlist, PlaylistItem

    # Убеждаемся что файл существует
    ensure_playlist_file()

    result = await db.execute(
        select(Playlist)
        .options(selectinload(Playlist.items).selectinload(PlaylistItem.media_file))
        .order_by(Playlist.created_at)
        .limit(1)
    )
    pl = result.scalar_one_or_none()
    if pl is None or not pl.items:
        logger.info("No active playlist in DB — keeping empty playlist.m3u")
        await sync_playlist([])
        return

    ordered_paths = [
        item.media_file.file_path
        for item in sorted(pl.items, key=lambda x: x.position)
        if item.media_file and item.media_file.media_type == "audio"
    ]
    logger.info(f"Rebuilding playlist from DB: {len(ordered_paths)} tracks")
    await sync_playlist(ordered_paths)
