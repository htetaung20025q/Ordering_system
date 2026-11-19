from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.modules.auth.models import User
from app.modules.auth.schemas import UserRegisterRequest, UserUpdateRequest
from app.core.security import hash_password, verify_password, create_access_token
from app.core.exceptions import ConflictError, EntityNotFoundError
from fastapi import HTTPException, status

class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register_user(self, data: UserRegisterRequest) -> User:
        # Check existing email or username
        query = select(User).where(or_(User.email == data.email, User.username == data.username))
        result = await self.db.execute(query)
        existing = result.scalar_one_or_none()
        if existing:
            if existing.email == data.email:
                raise ConflictError("A user with this email already exists")
            raise ConflictError("A user with this username already exists")

        new_user = User(
            username=data.username,
            email=data.email,
            hashed_password=hash_password(data.password),
            full_name=data.full_name,
            role=data.role.value if data.role else "customer",
            is_active=True
        )
        self.db.add(new_user)
        await self.db.commit()
        await self.db.refresh(new_user)
        return new_user

    async def authenticate_user(self, username_or_email: str, password: str) -> User:
        query = select(User).where(
            or_(User.username == username_or_email, User.email == username_or_email)
        )
        result = await self.db.execute(query)
        user = result.scalar_one_or_none()
        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username/email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is inactive"
            )
        return user

    async def get_user_by_id(self, user_id: int) -> User:
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise EntityNotFoundError("User", user_id)
        return user

    async def list_users(self, skip: int = 0, limit: int = 100) -> List[User]:
        result = await self.db.execute(select(User).offset(skip).limit(limit))
        return list(result.scalars().all())

    async def update_user(self, user_id: int, data: UserUpdateRequest) -> User:
        user = await self.get_user_by_id(user_id)
        if data.full_name is not None:
            user.full_name = data.full_name
        if data.role is not None:
            user.role = data.role.value
        if data.is_active is not None:
            user.is_active = data.is_active
        if data.password is not None:
            user.hashed_password = hash_password(data.password)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def delete_user(self, user_id: int) -> None:
        user = await self.get_user_by_id(user_id)
        await self.db.delete(user)
        await self.db.commit()

