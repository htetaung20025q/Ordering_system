from typing import List, Optional
from fastapi import APIRouter, Depends, Header, status, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.core.security import create_access_token, revoke_token
from app.common.enums import UserRole
from app.modules.auth.models import User
from app.modules.auth.schemas import (
    UserRegisterRequest,
    UserLoginRequest,
    TokenResponse,
    UserResponse,
    UserUpdateRequest
)
from app.modules.auth.service import AuthService

router = APIRouter(prefix="/auth", tags=["User Authentication & Authorization"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    data: UserRegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    service = AuthService(db)
    return await service.register_user(data)

@router.post("/login", response_model=TokenResponse)
async def login(
    data: UserLoginRequest,
    db: AsyncSession = Depends(get_db)
):
    service = AuthService(db)
    user = await service.authenticate_user(data.username_or_email, data.password)
    access_token = create_access_token(data={"sub": str(user.id), "role": user.role, "username": user.username})
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        role=user.role,
        user_id=user.id,
        username=user.username
    )

@router.post("/logout")
async def logout(
    authorization: Optional[str] = Header(None),
    current_user: User = Depends(get_current_user)
):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        revoke_token(token)
    return {"message": "Successfully logged out"}

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/users", response_model=List[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER]))
):
    service = AuthService(db)
    return await service.list_users(skip=skip, limit=limit)

@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user_by_id(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER]))
):
    service = AuthService(db)
    return await service.get_user_by_id(user_id)

@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    data: UserUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN]))
):
    service = AuthService(db)
    return await service.update_user(user_id, data)

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN]))
):
    service = AuthService(db)
    await service.delete_user(user_id)
    return None

