import uuid
import aiofiles
from pathlib import Path
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import get_settings
from app.models.message import Message
from app.schemas.message import MessageOut, MessageStatusUpdate

settings = get_settings()


def _msg_out(m: Message, sender_login: str = "") -> MessageOut:
    login = m.sender.login if m.sender else sender_login
    return MessageOut(
        id=m.id,
        senderId=m.sender_id,
        senderLogin=login,
        content=m.content,
        voicePath=m.voice_path,
        status=m.status,
        createdAt=m.created_at.isoformat(),
    )


async def create_message(
    db: AsyncSession,
    sender_id: str,
    sender_login: str,
    content: str,
    voice_file: UploadFile | None = None,
) -> MessageOut:
    voice_path = None

    if voice_file:
        data = await voice_file.read()
        fname = f"{uuid.uuid4()}.webm"
        path  = Path(settings.MEDIA_DIR) / "voices" / fname
        path.parent.mkdir(parents=True, exist_ok=True)
        async with aiofiles.open(path, "wb") as f:
            await f.write(data)
        voice_path = f"voices/{fname}"

    msg = Message(sender_id=sender_id, content=content, voice_path=voice_path)
    db.add(msg)
    await db.flush()
    await db.refresh(msg)
    return _msg_out(msg, sender_login)


async def get_messages(db: AsyncSession, include_done: bool = False) -> list[MessageOut]:
    query = select(Message).order_by(Message.created_at.desc())
    if not include_done:
        query = query.where(Message.status != "done")
    result = await db.execute(query)
    return [_msg_out(m) for m in result.scalars().all()]


async def set_message_status(db: AsyncSession, msg_id: str, data: MessageStatusUpdate) -> MessageOut:
    result = await db.execute(select(Message).where(Message.id == msg_id))
    msg = result.scalar_one_or_none()
    if not msg:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Сообщение не найдено")
    msg.status = data.status
    await db.flush()
    await db.refresh(msg)
    return _msg_out(msg)
