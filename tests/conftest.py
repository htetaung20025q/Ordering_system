import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import Base, get_db
from app.core.security import hash_password, create_access_token
from app.modules.auth.models import User
from app.common.enums import UserRole

# Use SQLite with StaticPool so all test sessions share the exact same in-memory DB schema
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)

TestAsyncSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

@pytest_asyncio.fixture(scope="function")
async def init_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest_asyncio.fixture(scope="function")
async def client(init_db):
    async def override_get_db():
        async with TestAsyncSessionLocal() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()

@pytest_asyncio.fixture
async def admin_token(init_db):
    async with TestAsyncSessionLocal() as session:
        user = User(
            username="admin_test",
            email="admin_test@flowsys.local",
            hashed_password=hash_password("adminpass123"),
            full_name="Admin User",
            role=UserRole.ADMIN.value,
            is_active=True
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(data={"sub": str(user.id), "role": user.role, "username": user.username})
        return token

@pytest_asyncio.fixture
async def cashier_token(init_db):
    async with TestAsyncSessionLocal() as session:
        user = User(
            username="cashier_test",
            email="cashier_test@flowsys.local",
            hashed_password=hash_password("cashierpass123"),
            full_name="Cashier User",
            role=UserRole.CASHIER.value,
            is_active=True
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(data={"sub": str(user.id), "role": user.role, "username": user.username})
        return token

@pytest_asyncio.fixture
async def kitchen_token(init_db):
    async with TestAsyncSessionLocal() as session:
        user = User(
            username="kitchen_test",
            email="kitchen_test@flowsys.local",
            hashed_password=hash_password("kitchenpass123"),
            full_name="Kitchen Chef",
            role=UserRole.KITCHEN.value,
            is_active=True
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(data={"sub": str(user.id), "role": user.role, "username": user.username})
        return token

@pytest_asyncio.fixture
async def manager_token(init_db):
    async with TestAsyncSessionLocal() as session:
        user = User(
            username="manager_test",
            email="manager_test@flowsys.local",
            hashed_password=hash_password("managerpass123"),
            full_name="Manager User",
            role=UserRole.MANAGER.value,
            is_active=True
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(data={"sub": str(user.id), "role": user.role, "username": user.username})
        return token

@pytest_asyncio.fixture
async def customer_token(init_db):
    async with TestAsyncSessionLocal() as session:
        user = User(
            username="customer_test",
            email="customer_test@flowsys.local",
            hashed_password=hash_password("customerpass123"),
            full_name="Customer User",
            role=UserRole.CUSTOMER.value,
            is_active=True
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(data={"sub": str(user.id), "role": user.role, "username": user.username})
        return token
