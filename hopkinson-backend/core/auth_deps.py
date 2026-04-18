"""
WebSocket 鉴权工具

WebSocket 无法走 HTTPBearer(无 Authorization header),改用 query string:
    ws://host/ws/monitor?token=eyJhbGci...

close code 约定(RFC 6455 自定义区 4000-4999):
  4001 = 未提供 token
  4002 = token 无效/过期
  4003 = 无此资源访问权(归属权不符)
"""
from fastapi import WebSocket
from jose import JWTError, jwt
from sqlalchemy import select

from core.settings import get_jwt_secret, JWT_ALGORITHM
from db.engine import get_session
from db.models import User


async def verify_ws_token(ws: WebSocket) -> User | None:
    """
    从 WebSocket query_params 校验 token,返回 User 或 None

    调用方需检查返回值;若为 None,连接已关闭不要继续发送数据。
    """
    token = ws.query_params.get("token")
    if not token:
        await ws.close(code=4001, reason="Missing token")
        return None

    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
    except JWTError:
        await ws.close(code=4002, reason="Invalid or expired token")
        return None

    user_id = payload.get("sub")
    if not user_id:
        await ws.close(code=4002, reason="Malformed token")
        return None

    async for session in get_session():
        result = await session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            await ws.close(code=4002, reason="User not found")
            return None
        return user

    return None  # 理论不会到这里


async def close_forbidden(ws: WebSocket, reason: str = "Forbidden") -> None:
    """关闭 WebSocket 并返回 4003(归属权不符)"""
    await ws.close(code=4003, reason=reason)
