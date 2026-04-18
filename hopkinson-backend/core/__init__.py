"""
核心基础设施 — 不做跨层导入以避免循环。

- 配置: `from core.settings import ...`
- WebSocket 鉴权: `from core.auth_deps import ...`

不在 core/__init__.py 里 re-export auth_deps,因为 auth_deps 依赖 db.engine,
而 db.engine 又依赖 core.settings,在包级 eager import 下会形成循环。
"""
from .settings import (
    get_jwt_secret,
    get_session_secret,
    get_database_url,
    get_cors_origins,
    get_admin_password,
    JWT_ALGORITHM,
    JWT_EXPIRE_HOURS,
    is_production,
)

__all__ = [
    "get_jwt_secret",
    "get_session_secret",
    "get_database_url",
    "get_cors_origins",
    "get_admin_password",
    "JWT_ALGORITHM",
    "JWT_EXPIRE_HOURS",
    "is_production",
]
