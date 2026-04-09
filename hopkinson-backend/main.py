"""
Hopkinson Backend — FastAPI 入口

启动方式：
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.devices import router as devices_router
from api.experiments import router as experiments_router
from ws.monitor import router as ws_monitor_router
from ws.experiment import router as ws_experiment_router

app = FastAPI(
    title="Hopkinson Backend",
    version="0.8.0",
    description="数智化电磁驱动霍普金森杆测试系统 — 后端服务",
)

# ─── CORS（允许前端跨域访问） ───
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 开发阶段允许所有来源；生产应限制为 Vercel 域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── 注册路由 ───
app.include_router(devices_router)
app.include_router(experiments_router)
app.include_router(ws_monitor_router)
app.include_router(ws_experiment_router)


# ─── 健康检查 ───
@app.get("/api/health", tags=["system"])
async def health():
    return {
        "status": "ok",
        "version": "0.8.0",
        "mode": "mock",
    }
