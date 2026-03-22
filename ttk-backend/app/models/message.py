import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Message(Base):
    __tablename__ = "messages"

    id:         Mapped[str]           = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sender_id:  Mapped[str | None]    = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    content:    Mapped[str]           = mapped_column(Text, nullable=False, default="")
    voice_path: Mapped[str | None]    = mapped_column(String(500), nullable=True)
    status:     Mapped[str]           = mapped_column(String(20), nullable=False, default="new")
    created_at: Mapped[datetime]      = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    sender: Mapped["User | None"] = relationship("User", back_populates="messages", lazy="selectin")



class StreamSession(Base):
    __tablename__ = "stream_sessions"

    id:                  Mapped[str]           = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    host_id:             Mapped[str]           = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    is_active:           Mapped[bool]          = mapped_column(default=False)
    is_video:            Mapped[bool]          = mapped_column(default=False)
    current_track:       Mapped[str | None]    = mapped_column(String(255), nullable=True)
    active_playlist_id:  Mapped[str | None]    = mapped_column(String(36), ForeignKey("playlists.id", ondelete="SET NULL"), nullable=True)
    peak_listeners:      Mapped[int]           = mapped_column(default=0)
    started_at:          Mapped[datetime]      = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    ended_at:            Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
