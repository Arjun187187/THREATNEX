"""Pytest configuration and fixtures."""
import asyncio
import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.core.config import settings
from app.core.database import Base, get_db
from app.main import app
from app.core import redis as app_redis

# Use in-memory SQLite for high-speed isolated test execution
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

TestSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


@pytest_asyncio.fixture(autouse=True)
async def clean_redis_and_loop():
    """Ensure Redis connection pool resets per test and test rate limits are clean."""
    app_redis._redis_pool = None
    r = await app_redis.get_redis_client()
    if r:
        try:
            await r.flushdb()
        except Exception:
            pass
    yield
    if app_redis._redis_pool is not None:
        try:
            await app_redis._redis_pool.close()
        except Exception:
            pass
        app_redis._redis_pool = None


@pytest_asyncio.fixture(scope="function")
async def db_session():
    """Sets up fresh clean schema for every test."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as session:
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def client(db_session):
    """Provides test HTTP client with overridden database session."""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
