from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_admin, get_current_user
from app.models.user import User
from app.schemas.user import UserOut, UserUpdate, PasswordChange, RolesAssign
from app.services import user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
async def list_users(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.get_all_users(db)


@router.put("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: str,
    data: UserUpdate,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.update_user(db, user_id, data)


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: str,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    await user_service.soft_delete_user(db, user_id, current_user.id)


@router.post("/{user_id}/password", status_code=204)
async def change_password(
    user_id: str,
    data: PasswordChange,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    await user_service.change_password(db, user_id, data)


@router.post("/{user_id}/roles", response_model=UserOut)
async def assign_roles(
    user_id: str,
    data: RolesAssign,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.assign_roles(db, user_id, data, current_user)
