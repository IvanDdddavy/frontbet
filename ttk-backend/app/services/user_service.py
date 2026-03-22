from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from fastapi import HTTPException, status

from app.models.user import User, UserRole
from app.schemas.user import UserOut, UserUpdate, PasswordChange, RolesAssign
from app.core.security import hash_password


def _user_to_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        login=user.login,
        fullName=user.full_name,
        roles=user.role_names,
        createdAt=user.created_at.date().isoformat(),
    )


async def get_all_users(db: AsyncSession) -> list[UserOut]:
    result = await db.execute(
        select(User).where(User.is_deleted == False).order_by(User.created_at)
    )
    return [_user_to_out(u) for u in result.scalars().all()]


async def get_user_or_404(db: AsyncSession, user_id: str) -> User:
    result = await db.execute(
        select(User).where(User.id == user_id, User.is_deleted == False)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    return user


async def update_user(db: AsyncSession, user_id: str, data: UserUpdate) -> UserOut:
    user = await get_user_or_404(db, user_id)

    if data.login is not None:
        # Check uniqueness
        existing = await db.execute(
            select(User).where(User.login == data.login, User.id != user_id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Логин уже занят")
        user.login = data.login

    if data.full_name is not None:
        user.full_name = data.full_name

    await db.flush()
    await db.refresh(user)
    return _user_to_out(user)


async def soft_delete_user(db: AsyncSession, user_id: str, current_user_id: str) -> None:
    if user_id == current_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нельзя удалить себя")
    user = await get_user_or_404(db, user_id)
    user.is_deleted = True
    await db.flush()


async def change_password(db: AsyncSession, user_id: str, data: PasswordChange) -> None:
    user = await get_user_or_404(db, user_id)
    user.password_hash = hash_password(data.password)
    await db.flush()


async def assign_roles(
    db: AsyncSession,
    user_id: str,
    data: RolesAssign,
    current_user: User,
) -> UserOut:
    user = await get_user_or_404(db, user_id)
    current_roles = {r.role for r in current_user.roles}

    # Only admin can assign host/admin roles
    restricted = {"host", "admin"}
    for role in data.roles:
        if role in restricted and "admin" not in current_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Только администратор может назначать роль «{role}»",
            )

    # Replace all roles
    await db.execute(delete(UserRole).where(UserRole.user_id == user_id))
    for role in data.roles:
        db.add(UserRole(user_id=user_id, role=role))

    await db.flush()
    await db.refresh(user)
    return _user_to_out(user)
