"""
pytest 通用 fixture — 异步 session / 内存数据库 / 测试用户

设计:
  - 每个测试用独立内存 SQLite,互不污染
  - 自动建表(Base.metadata.create_all),无需 Alembic
  - JWT secret 用固定值,便于断言 token
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

# 把 backend 根目录加入 sys.path,确保 `from db.models import ...` 能解析
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# 强制测试环境变量(必须在 import core/db 之前)
os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-secret-key-for-pytest-32-chars-min!")

from db.models import Base  # noqa: E402


@pytest_asyncio.fixture
async def engine():
    """每个测试一个全新的内存 SQLite 引擎"""
    eng = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        echo=False,
    )
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def session(engine) -> AsyncGenerator[AsyncSession, None]:
    """单独一个 session,测试结束自动回滚"""
    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as s:
        yield s


@pytest.fixture
def jwt_secret() -> str:
    return os.environ["JWT_SECRET"]
