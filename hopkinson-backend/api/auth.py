"""
认证 REST API — 注册 / 登录 / Token 刷新

JWT 无状态认证：
  - POST /api/auth/register — 注册新用户(自助开放,前后端双重校验)
  - POST /api/auth/login    — 登录获取 token
  - POST /api/auth/refresh  — 刷新 token
  - GET  /api/auth/me       — 获取当前用户信息

注册策略:
  - 用户名 4-20 字符,仅 [A-Za-z0-9_]
  - 密码 >= 8,必须含字母+数字
  - 邮箱(可选)走 EmailStr 格式校验
  - is_admin 强制 False(防止客户端伪造提权)
"""
import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.hash import bcrypt as pwd_hash
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.settings import get_jwt_secret, JWT_ALGORITHM, JWT_EXPIRE_HOURS
from db.engine import get_session
from db.models import User

USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{4,20}$")

router = APIRouter(prefix="/api/auth", tags=["auth"])

security = HTTPBearer(auto_error=False)


# ─── 请求/响应模型 ───

class RegisterBody(BaseModel):
    username: str = Field(..., min_length=4, max_length=20)
    password: str = Field(..., min_length=8, max_length=128)
    email: EmailStr | None = None
    display_name: str | None = Field(None, max_length=100)

    @field_validator("username")
    @classmethod
    def _username_format(cls, v: str) -> str:
        v = v.strip()
        if not USERNAME_RE.match(v):
            raise ValueError("用户名必须是 4-20 位字母/数字/下划线")
        return v

    @field_validator("password")
    @classmethod
    def _password_strength(cls, v: str) -> str:
        if not any(c.isalpha() for c in v):
            raise ValueError("密码必须包含至少一个字母")
        if not any(c.isdigit() for c in v):
            raise ValueError("密码必须包含至少一个数字")
        return v


class LoginBody(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = JWT_EXPIRE_HOURS * 3600
    user: dict


class UserResponse(BaseModel):
    id: str
    username: str
    email: str | None
    display_name: str | None
    is_admin: bool
    created_at: str


# ─── 工具函数 ───

def _create_token(user_id: str, username: str, is_admin: bool) -> str:
    """生成 JWT token"""
    payload = {
        "sub": user_id,
        "username": username,
        "is_admin": is_admin,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def _user_to_dict(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "display_name": user.display_name,
        "is_admin": user.is_admin,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    session: AsyncSession = Depends(get_session),
) -> User | None:
    """从 JWT token 解析当前用户（可选认证）"""
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            return None
        result = await session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()
    except JWTError:
        return None


async def require_current_user(
    user: User | None = Depends(get_current_user),
) -> User:
    """强制要求登录"""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未登录或 token 已过期",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def require_admin(
    user: User = Depends(require_current_user),
) -> User:
    """要求管理员权限"""
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要管理员权限")
    return user


# ─── 接口 ───

@router.post("/register", response_model=TokenResponse)
async def register(body: RegisterBody, session: AsyncSession = Depends(get_session)):
    """
    注册新用户(自助开放)

    安全要点:
      - 强制 is_admin=False — 提权必须通过管理员后台显式操作
      - 用户名/邮箱唯一性双重检查(Pydantic 校验 + DB unique 约束)
    """
    # 检查用户名是否已存在
    existing = await session.execute(select(User).where(User.username == body.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="用户名已存在")

    # 检查邮箱是否已存在
    email_str = str(body.email) if body.email else None
    if email_str:
        existing_email = await session.execute(select(User).where(User.email == email_str))
        if existing_email.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="邮箱已被注册")

    user = User(
        username=body.username,
        password_hash=pwd_hash.hash(body.password),
        email=email_str,
        display_name=(body.display_name or body.username),
        is_admin=False,  # 注册接口禁止伪造管理员
    )
    session.add(user)
    await session.flush()  # 获取生成的 id

    token = _create_token(user.id, user.username, user.is_admin)
    return TokenResponse(
        access_token=token,
        user=_user_to_dict(user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginBody, session: AsyncSession = Depends(get_session)):
    """用户登录"""
    result = await session.execute(select(User).where(User.username == body.username))
    user = result.scalar_one_or_none()

    if not user or not pwd_hash.verify(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    # 更新最后登录时间
    user.last_login = datetime.now(timezone.utc)

    token = _create_token(user.id, user.username, user.is_admin)
    return TokenResponse(
        access_token=token,
        user=_user_to_dict(user),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(user: User = Depends(require_current_user)):
    """刷新 token"""
    token = _create_token(user.id, user.username, user.is_admin)
    return TokenResponse(
        access_token=token,
        user=_user_to_dict(user),
    )


@router.get("/me")
async def get_me(user: User = Depends(require_current_user)):
    """获取当前用户信息"""
    return _user_to_dict(user)
