"""
Hopkinson Backend — FastAPI 入口

启动方式：
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from core.settings import (
    get_jwt_secret,
    get_session_secret,
    get_cors_origins,
    is_production,
)
from api.devices import router as devices_router
from api.experiments import router as experiments_router
from api.auth import router as auth_router
from api.optimization import router as optimization_router
from ws.monitor import router as ws_monitor_router
from ws.experiment import router as ws_experiment_router
from db import init_db, close_db


# ─── 启动前校验关键配置 ───
# 提前触发配置校验,启动失败比运行时报错更明确
get_jwt_secret()
get_session_secret()


# ─── 生命周期管理 ───

@asynccontextmanager
async def lifespan(app: FastAPI):
    """启动时初始化数据库 + 管理面板，关闭时释放连接池"""
    await init_db()
    print(f"[DB] 数据库连接已建立 ({'生产' if is_production() else '开发'}模式)")

    # 初始化 SQLAdmin（engine 就绪后才能挂载）
    from admin import setup_admin
    setup_admin(app)
    print("[Admin] 管理面板已挂载到 /admin")

    yield

    await close_db()
    print("[DB] 数据库连接已关闭")


app = FastAPI(
    title="Hopkinson Backend",
    version="0.9.0",
    description="数智化电磁驱动霍普金森杆测试系统 — 后端服务",
    lifespan=lifespan,
)

# ─── Session 中间件（SQLAdmin 登录需要，必须在启动前添加）───
# 与 JWT 密钥分开,避免一处泄漏两处破防
app.add_middleware(SessionMiddleware, secret_key=get_session_secret())

# ─── CORS ───
# 来源从环境变量 CORS_ORIGINS 读取,生产环境禁止 *
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# ─── 注册路由 ───
app.include_router(auth_router)
app.include_router(devices_router)
app.include_router(experiments_router)
app.include_router(optimization_router)
app.include_router(ws_monitor_router)
app.include_router(ws_experiment_router)


# ─── 健康检查 ───
@app.get("/api/health", tags=["system"])
async def health():
    return {
        "status": "ok",
        "version": "0.9.0",
        "mode": "mock",
    }
