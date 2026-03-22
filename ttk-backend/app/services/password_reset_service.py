import logging
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from fastapi import HTTPException, status

from app.models.user import User
from app.models.password_reset import PasswordResetToken
from app.core.security import hash_password
from app.services.email_service import send_reset_email

logger = logging.getLogger(__name__)


async def request_password_reset(db: AsyncSession, login: str) -> dict:
    """
    Find user by login, create reset token, send email.
    Always returns success to prevent login enumeration attacks.
    """
    result = await db.execute(
        select(User).where(User.login == login, User.is_deleted == False)
    )
    user = result.scalar_one_or_none()

    if not user:
        # Return success anyway — don't reveal whether login exists
        logger.info(f"Password reset requested for unknown login: {login}")
        return {"message": "Если аккаунт существует, письмо отправлено"}

    # Invalidate all previous tokens for this user
    await db.execute(
        delete(PasswordResetToken).where(PasswordResetToken.user_id == user.id)
    )

    # Create new token
    token = PasswordResetToken(user_id=user.id)
    db.add(token)
    await db.flush()

    # Get user email — for now we use login as identifier
    # In production you'd store email separately
    to_email = getattr(user, 'email', None) or f"{user.login}@ttk.local"

    await send_reset_email(
        to_email=to_email,
        token=token.token,
        username=user.full_name.split()[0] if user.full_name else user.login,
    )

    return {"message": "Если аккаунт существует, письмо отправлено"}


async def validate_reset_token(db: AsyncSession, token_str: str) -> PasswordResetToken:
    """Validate token and return it, or raise 400."""
    result = await db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token == token_str)
    )
    token = result.scalar_one_or_none()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Недействительная или устаревшая ссылка",
        )
    if token.is_used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ссылка уже была использована",
        )
    if token.is_expired:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Срок действия ссылки истёк. Запросите новую",
        )
    return token


async def reset_password(db: AsyncSession, token_str: str, new_password: str) -> dict:
    """Validate token, set new password, invalidate token."""
    token = await validate_reset_token(db, token_str)

    # Set new password
    token.user.password_hash = hash_password(new_password)
    token.is_used = True

    await db.flush()
    logger.info(f"Password reset completed for user {token.user.login}")
    return {"message": "Пароль успешно изменён"}


async def get_token_info(db: AsyncSession, token_str: str) -> dict:
    """For frontend to check token validity before showing the form."""
    token = await validate_reset_token(db, token_str)
    return {
        "valid": True,
        "login": token.user.login,
        "expiresAt": token.expires_at.isoformat(),
    }
