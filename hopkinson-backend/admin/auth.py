"""
SQLAdmin 认证后端 — 基于 session 的管理后台登录

管理员通过 /admin/login 页面登录，使用数据库中 is_admin=True 的用户验证。
"""
from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request
from starlette.responses import RedirectResponse
from jose import jwt, JWTError

from core.settings import get_jwt_secret, JWT_ALGORITHM


class AdminAuth(AuthenticationBackend):
    """SQLAdmin 认证后端"""

    async def login(self, request: Request) -> bool:
        """处理管理员登录"""
        form = await request.form()
        username = form.get("username", "")
        password = form.get("password", "")

        # 从数据库验证
        from sqlalchemy import select
        from db.engine import get_session
        from db.models import User
        from passlib.hash import bcrypt as pwd_hash

        async for session in get_session():
            result = await session.execute(
                select(User).where(User.username == username, User.is_admin == True)
            )
            user = result.scalar_one_or_none()
            if not user or not pwd_hash.verify(password, user.password_hash):
                return False

            # 生成 admin token 存入 session
            token = jwt.encode(
                {"sub": user.id, "username": user.username, "is_admin": True},
                get_jwt_secret(),
                algorithm=JWT_ALGORITHM,
            )
            request.session.update({"admin_token": token})
            return True

        return False

    async def logout(self, request: Request) -> bool:
        """管理员登出"""
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> RedirectResponse | bool:
        """验证当前请求是否已认证"""
        token = request.session.get("admin_token")
        if not token:
            return RedirectResponse(request.url_for("admin:login"), status_code=302)

        try:
            payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
            if not payload.get("is_admin"):
                return RedirectResponse(request.url_for("admin:login"), status_code=302)
            return True
        except JWTError:
            return RedirectResponse(request.url_for("admin:login"), status_code=302)
