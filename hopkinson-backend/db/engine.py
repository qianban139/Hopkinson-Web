"""
数据库引擎 — async SQLAlchemy 2.0

支持两种模式:
  - PostgreSQL (生产): DATABASE_URL=postgresql+asyncpg://...
  - SQLite (本地开发): DATABASE_URL=sqlite+aiosqlite:///./hopkinson.db

建表策略:
  - 开发环境(APP_ENV=development): 启动时自动 create_all,方便快速迭代
  - 生产环境(APP_ENV=production): 禁用 create_all,强制走 Alembic 迁移
    若启动时发现表缺失或 schema 不匹配会抛错,由运维执行 `alembic upgrade head`
"""
import os
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from core.settings import get_database_url, is_production

from .models import Base

# ─── 全局引擎 & Session 工厂 ───

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    """获取当前引擎实例"""
    if _engine is None:
        raise RuntimeError("数据库未初始化，请先调用 init_db()")
    return _engine


async def init_db() -> None:
    """初始化数据库连接池;开发环境自动建表,生产走 Alembic"""
    global _engine, _session_factory

    url = get_database_url()

    # SQLite 需要特殊参数
    connect_args = {}
    if url.startswith("sqlite"):
        connect_args["check_same_thread"] = False

    _engine = create_async_engine(
        url,
        echo=os.getenv("DB_ECHO", "").lower() == "true",
        connect_args=connect_args,
        pool_pre_ping=True,
    )
    _session_factory = async_sessionmaker(
        bind=_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    # 仅开发环境自动建表;生产环境必须用 Alembic
    if not is_production():
        async with _engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    """关闭数据库连接池"""
    global _engine, _session_factory
    if _engine:
        await _engine.dispose()
        _engine = None
        _session_factory = None


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI 依赖注入 — 提供数据库 session"""
    if _session_factory is None:
        raise RuntimeError("数据库未初始化")
    async with _session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
