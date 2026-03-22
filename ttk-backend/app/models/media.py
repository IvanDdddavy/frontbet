import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class MediaFile(Base):
    __tablename__ = "media_files"

    id:          Mapped[str]      = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id:    Mapped[str]      = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    filename:    Mapped[str]      = mapped_column(String(255), nullable=False)
    file_path:   Mapped[str]      = mapped_column(String(500), nullable=False)
    mime_type:   Mapped[str]      = mapped_column(String(100), nullable=False)
    size_bytes:  Mapped[int]      = mapped_column(Integer, nullable=False)
    media_type:  Mapped[str]      = mapped_column(String(10), nullable=False)  # 'audio' | 'video'
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    owner:          Mapped["User"]             = relationship("User", back_populates="media_files")
    playlist_items: Mapped[list["PlaylistItem"]] = relationship("PlaylistItem", back_populates="media_file", lazy="noload")



class Playlist(Base):
    __tablename__ = "playlists"

    id:           Mapped[str]  = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id:     Mapped[str]  = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    title:        Mapped[str]  = mapped_column(String(255), nullable=False, default="Плейлист")
    loop_mode:    Mapped[bool] = mapped_column(Boolean, default=False)
    shuffle_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at:   Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    items: Mapped[list["PlaylistItem"]] = relationship(
        "PlaylistItem", back_populates="playlist",
        order_by="PlaylistItem.position", lazy="selectin",
        cascade="all, delete-orphan",
    )


class PlaylistItem(Base):
    __tablename__ = "playlist_items"

    id:            Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    playlist_id:   Mapped[str] = mapped_column(String(36), ForeignKey("playlists.id", ondelete="CASCADE"))
    media_file_id: Mapped[str] = mapped_column(String(36), ForeignKey("media_files.id", ondelete="CASCADE"))
    position:      Mapped[int] = mapped_column(Integer, default=0)

    playlist:   Mapped["Playlist"]   = relationship("Playlist", back_populates="items")
    media_file: Mapped["MediaFile"]  = relationship("MediaFile", back_populates="playlist_items", lazy="selectin")
