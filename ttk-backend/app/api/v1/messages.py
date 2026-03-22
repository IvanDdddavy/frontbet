from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_user, require_host, get_current_user
from app.models.user import User
from app.schemas.message import MessageOut, MessageStatusUpdate
from app.services import message_service
from app.ws.manager import manager

router = APIRouter(prefix="/messages", tags=["messages"])


@router.post("", response_model=MessageOut, status_code=201)
async def send_message(
    content: str = Form(default=""),
    voice: UploadFile | None = File(default=None),
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    msg = await message_service.create_message(
        db,
        sender_id=current_user.id,
        sender_login=current_user.login,
        content=content,
        voice_file=voice,
    )
    # Notify hosts via WebSocket
    await manager.broadcast({
        "type": "new_message",
        "id": msg.id,
        "senderLogin": msg.senderLogin,
        "content": msg.content,
    })
    return msg


@router.get("", response_model=list[MessageOut])
async def get_messages(
    include_done: bool = False,
    _: User = Depends(require_host),
    db: AsyncSession = Depends(get_db),
):
    return await message_service.get_messages(db, include_done)


@router.patch("/{msg_id}/status", response_model=MessageOut)
async def update_status(
    msg_id: str,
    data: MessageStatusUpdate,
    _: User = Depends(require_host),
    db: AsyncSession = Depends(get_db),
):
    msg = await message_service.set_message_status(db, msg_id, data)
    # Broadcast status change to all clients
    await manager.broadcast({
        "type": "message_status",
        "id": msg_id,
        "status": data.status,
    })
    return msg
