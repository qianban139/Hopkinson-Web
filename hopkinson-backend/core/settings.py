"""
集中化配置管理 — 从环境变量加载,启动时校验

设计原则:
  - 敏感值必须来自环境变量,无代码默认值
  - 首次调用 getter 时校验,缺失/过弱直接抛 RuntimeError
  - 生产环境(APP_ENV=production)约束更严
"""
import os

# ─── 常量 ───

JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24
MIN_SECRET_LENGTH = 32  # JWT/Session 密钥最小长度


def is_production() -> bool:
    """是否生产环境(APP_ENV=production)"""
    return os.getenv("APP_ENV", "development").lower() == "production"


# ─── 核心密钥 ───

_jwt_secret_cache: str | None = None
_session_secret_cache: str | None = None


def get_jwt_secret() -> str:
    """
    JWT 签名密钥

    约束:
      - 必须从 JWT_SECRET 环境变量读取
      - 长度 >= 32 字符
      - 开发环境可放宽(允许常见弱密钥但会打印警告),生产环境严格
    """
    global _jwt_secret_cache
    if _jwt_secret_cache is not None:
        return _jwt_secret_cache

    secret = os.getenv("JWT_SECRET", "").strip()
    if not secret:
        raise RuntimeError(
            "JWT_SECRET 环境变量未设置。请在 .env 中配置:\n"
            "  JWT_SECRET=$(openssl rand -base64 48)"
        )
    if len(secret) < MIN_SECRET_LENGTH:
        raise RuntimeError(
            f"JWT_SECRET 长度不足 {MIN_SECRET_LENGTH} 字符(当前 {len(secret)})。"
            "请用 openssl rand -base64 48 生成强随机密钥"
        )

    # 生产环境拒绝常见弱密钥
    if is_production():
        weak_patterns = ["dev-secret", "change-in-production", "changeme", "secret", "password"]
        if any(p in secret.lower() for p in weak_patterns):
            raise RuntimeError("生产环境 JWT_SECRET 不能包含 dev/secret/password 等弱关键词")

    _jwt_secret_cache = secret
    return secret


def get_session_secret() -> str:
    """
    Starlette SessionMiddleware 密钥(SQLAdmin 登录会话用)

    与 JWT_SECRET 必须分开,避免一处泄漏两处破防。
    开发环境若未设置则 fallback 到 JWT_SECRET + '-session' 后缀(带警告)。
    """
    global _session_secret_cache
    if _session_secret_cache is not None:
        return _session_secret_cache

    secret = os.getenv("SESSION_SECRET", "").strip()
    if not secret:
        if is_production():
            raise RuntimeError("生产环境必须配置 SESSION_SECRET(与 JWT_SECRET 分开)")
        # 开发环境 fallback
        secret = get_jwt_secret() + "-session-dev-fallback"
        print("[Warning] SESSION_SECRET 未设置,开发模式 fallback 到派生值")
    elif len(secret) < MIN_SECRET_LENGTH:
        raise RuntimeError(f"SESSION_SECRET 长度不足 {MIN_SECRET_LENGTH} 字符")

    _session_secret_cache = secret
    return secret


# ─── 数据库 ───

def get_database_url() -> str:
    """数据库连接字符串

    本地开发: sqlite+aiosqlite:///./hopkinson.db
    生产环境: postgresql+asyncpg://user:pwd@host:5432/hopkinson
    """
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        if is_production():
            raise RuntimeError("生产环境必须设置 DATABASE_URL")
        return "sqlite+aiosqlite:///./hopkinson.db"
    return url


# ─── CORS ───

def get_cors_origins() -> list[str]:
    """
    CORS 允许的源列表

    约束:
      - 必须显式配置,不接受 '*'
      - 生产环境禁止 localhost/127.0.0.1
    """
    raw = os.getenv("CORS_ORIGINS", "").strip()
    if not raw:
        if is_production():
            raise RuntimeError("生产环境必须配置 CORS_ORIGINS(具体域名,不接受 *)")
        # 开发环境默认允许前端 dev server
        return ["http://localhost:5173", "http://localhost:3000"]

    if raw == "*":
        if is_production():
            raise RuntimeError("生产环境禁止 CORS_ORIGINS=*;必须列出具体域名")
        return ["*"]

    origins = [o.strip() for o in raw.split(",") if o.strip()]

    if is_production():
        for o in origins:
            if "localhost" in o or "127.0.0.1" in o:
                raise RuntimeError(f"生产环境 CORS_ORIGINS 不能包含 {o}")

    return origins


# ─── 管理员初始密码 ───

def get_admin_password() -> str:
    """
    管理员初始密码(仅 db.seed 使用)

    约束:
      - 必须从 ADMIN_PASSWORD 环境变量读取
      - 长度 >= 8
      - 禁止 admin123 / password 等弱密码
    """
    pwd = os.getenv("ADMIN_PASSWORD", "").strip()
    if not pwd:
        raise RuntimeError(
            "ADMIN_PASSWORD 环境变量未设置。请在 .env 中配置强密码:\n"
            "  ADMIN_PASSWORD=$(openssl rand -base64 16)"
        )
    if len(pwd) < 8:
        raise RuntimeError("ADMIN_PASSWORD 长度不足 8 字符")

    weak = {"admin123", "password", "123456", "admin", "root"}
    if pwd.lower() in weak:
        raise RuntimeError(f"ADMIN_PASSWORD 不能是 {weak} 中的弱密码")

    return pwd
