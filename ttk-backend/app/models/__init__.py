# Register all models with SQLAlchemy Base metadata
# Import order matters to avoid circular refs
from app.models.user import User, UserRole                       # noqa: F401
from app.models.media import MediaFile, Playlist, PlaylistItem   # noqa: F401
from app.models.message import Message, StreamSession            # noqa: F401
from app.models.password_reset import PasswordResetToken  # noqa: F401
