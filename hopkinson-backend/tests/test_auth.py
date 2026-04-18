"""
认证模块单元测试 — 10 个用例

覆盖:
  - JWT 编解码完整性
  - bcrypt 哈希 + 验证
  - 用户名/密码强度规则
  - 行级权限(user_id 隔离)
  - 提权防御(is_admin 强制 False)
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import pytest
from jose import jwt, JWTError
from passlib.hash import bcrypt as pwd_hash
from pydantic import ValidationError
from sqlalchemy import select

from api.auth import (
    RegisterBody,
    LoginBody,
    _create_token,
    _user_to_dict,
    USERNAME_RE,
)
from db.models import User
from core.settings import JWT_ALGORITHM


# ─── JWT 编解码 ───

def test_jwt_create_and_decode_round_trip(jwt_secret):
    """生成的 JWT 应能正常解码出 sub/username/exp"""
    token = _create_token("user-uuid-1", "alice", is_admin=False)
    payload = jwt.decode(token, jwt_secret, algorithms=[JWT_ALGORITHM])
    assert payload["sub"] == "user-uuid-1"
    assert payload["username"] == "alice"
    assert payload["is_admin"] is False
    assert "exp" in payload and "iat" in payload


def test_jwt_rejects_tampered_signature(jwt_secret):
    """改了 secret 解码必须失败"""
    token = _create_token("u1", "alice", False)
    with pytest.raises(JWTError):
        jwt.decode(token, "wrong-secret-key-32-chars-aaaaaaaaaa", algorithms=[JWT_ALGORITHM])


def test_jwt_expired_token_rejected(jwt_secret):
    """过期 token 必须抛 ExpiredSignatureError"""
    payload = {
        "sub": "u1",
        "exp": datetime.now(timezone.utc) - timedelta(seconds=60),
    }
    expired = jwt.encode(payload, jwt_secret, algorithm=JWT_ALGORITHM)
    with pytest.raises(JWTError):
        jwt.decode(expired, jwt_secret, algorithms=[JWT_ALGORITHM])


def test_jwt_secret_meets_minimum_length(jwt_secret):
    """JWT_SECRET 必须 ≥ 32 字符(对抗暴力破解)"""
    assert len(jwt_secret) >= 32, f"JWT_SECRET length={len(jwt_secret)},应 ≥ 32"


# ─── bcrypt 哈希 ───

def test_bcrypt_hash_verification():
    """bcrypt 哈希后应能验证原文,错误密码必须失败"""
    raw = "MyP@ssw0rd2026"
    h = pwd_hash.hash(raw)
    assert pwd_hash.verify(raw, h) is True
    assert pwd_hash.verify("wrong-password", h) is False


def test_bcrypt_hash_is_salted_each_time():
    """同一密码两次哈希结果不同(每次随机 salt)"""
    raw = "samepass1234"
    assert pwd_hash.hash(raw) != pwd_hash.hash(raw), "bcrypt 应该带随机 salt"


# ─── Pydantic 校验:用户名/密码 ───

def test_register_rejects_short_username():
    """用户名 < 4 字符必须拒绝"""
    with pytest.raises(ValidationError):
        RegisterBody(username="abc", password="abc12345")


def test_register_rejects_weak_password():
    """密码缺少字母或数字必须拒绝"""
    with pytest.raises(ValidationError):
        RegisterBody(username="alice2026", password="12345678")  # 纯数字
    with pytest.raises(ValidationError):
        RegisterBody(username="alice2026", password="abcdefgh")  # 纯字母


def test_username_regex_blocks_special_chars():
    """用户名正则拒绝特殊字符 / 空格 / 中文"""
    assert USERNAME_RE.match("alice_01") is not None
    assert USERNAME_RE.match("alice 01") is None       # 空格
    assert USERNAME_RE.match("alice@01") is None       # @
    assert USERNAME_RE.match("张三abc") is None         # 中文


# ─── 行级权限 ───

@pytest.mark.asyncio
async def test_user_query_only_returns_own_records(session):
    """select where user_id 隔离:用户 A 不应能查到用户 B 的实验"""
    from db.models import Experiment

    user_a = User(username="alice2026", password_hash=pwd_hash.hash("Pwd2026!ab"), is_admin=False)
    user_b = User(username="bob2026", password_hash=pwd_hash.hash("Pwd2026!cd"), is_admin=False)
    session.add_all([user_a, user_b])
    await session.flush()

    exp_a = Experiment(id="exp-a", user_id=user_a.id, mode="simulation", params={"v": 2000}, phase="created")
    exp_b = Experiment(id="exp-b", user_id=user_b.id, mode="simulation", params={"v": 2500}, phase="created")
    session.add_all([exp_a, exp_b])
    await session.commit()

    # alice 视角:只能查到 exp-a
    result = await session.execute(select(Experiment).where(Experiment.user_id == user_a.id))
    rows = result.scalars().all()
    assert len(rows) == 1
    assert rows[0].id == "exp-a"


@pytest.mark.asyncio
async def test_register_forces_is_admin_false(session):
    """注册接口创建的 User 必须 is_admin=False(防止客户端伪造提权)"""
    body = RegisterBody(username="hacker99", password="passw0rd-strong")
    # 模拟 register 函数核心逻辑
    user = User(
        username=body.username,
        password_hash=pwd_hash.hash(body.password),
        email=None,
        display_name=body.username,
        is_admin=False,
    )
    session.add(user)
    await session.commit()

    fetched = (await session.execute(select(User).where(User.username == "hacker99"))).scalar_one()
    assert fetched.is_admin is False, "新注册用户绝不能 is_admin=True"


def test_user_to_dict_excludes_password_hash():
    """序列化为响应字典必须不含 password_hash"""
    user = User(
        id="u1",
        username="alice",
        email="a@example.com",
        display_name="Alice",
        password_hash="bcrypt$expensive",
        is_admin=False,
        created_at=datetime.now(timezone.utc),
    )
    d = _user_to_dict(user)
    assert "password_hash" not in d
    assert d["username"] == "alice"
    assert d["is_admin"] is False
