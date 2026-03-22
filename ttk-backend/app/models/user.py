import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import enum


class RoleEnum(str, enum.Enum):
    user  = "user"
    host  = "host"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id:            Mapped[str]      = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    login:         Mapped[str]      = mapped_column(String(64), unique=True, nullable=False, index=True)
    full_name:     Mapped[str]      = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str]      = mapped_column(String(255), nullable=False)
    email:         Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True, index=True)
    is_deleted:    Mapped[bool]     = mapped_column(Boolean, default=False, nullable=False)
    created_at:    Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    roles:         Mapped[list["UserRole"]]    = relationship("UserRole", back_populates="user", lazy="selectin", cascade="all, delete-orphan")
    media_files:   Mapped[list["MediaFile"]]   = relationship("MediaFile", back_populates="owner", lazy="noload")
    messages:      Mapped[list["Message"]]     = relationship("Message", back_populates="sender", lazy="noload")

    @property
    def role_names(self) -> list[str]:
        return [r.role for r in self.roles]


class UserRole(Base):
    __tablename__ = "user_roles"

    id:      Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role:    Mapped[str] = mapped_column(String(32), nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="roles")


