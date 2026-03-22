from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status

from app.models.user import User, UserRole
from app.schemas.user import RegisterRequest, LoginRequest, UserOut, TokenResponse
from app.core.security import hash_password, verify_password, create_access_token


def _user_to_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        login=user.login,
        fullName=user.full_name,
        roles=user.role_names,
        createdAt=user.created_at.date().isoformat(),
    )


def _make_token(user: User) -> str:
    return create_access_token({"sub": user.id, "login": user.login, "roles": user.role_names})


async def register(db: AsyncSession, data: RegisterRequest) -> TokenResponse:
    # Resolve full name from either field
    full_name = data.resolved_full_name
    if not full_name:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Введите имя и фамилию")
    if len(full_name.split()) < 2:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Введите имя и фамилию (имя и фамилия)")

    # Check login uniqueness (including soft-deleted — login must stay unique)
    existing = await db.execute(select(User).where(User.login == data.login))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Логин уже занят")

    user = User(
        login=data.login,
        full_name=full_name,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    await db.flush()  # get user.id

    # Default role: user
    db.add(UserRole(user_id=user.id, role="user"))
    await db.flush()
    await db.refresh(user)

    return TokenResponse(user=_user_to_out(user), token=_make_token(user))


async def login(db: AsyncSession, data: LoginRequest) -> TokenResponse:
    result = await db.execute(
        select(User).where(User.login == data.login, User.is_deleted == False)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль",
        )

    return TokenResponse(user=_user_to_out(user), token=_make_token(user))
