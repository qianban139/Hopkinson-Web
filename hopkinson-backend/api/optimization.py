"""
ML 优化建议 REST API

POST /api/optimization/suggest    PPO 推理一次,给出下一步参数建议
POST /api/optimization/score      LSTM 给一段历史打分(预测下一步 reward)
GET  /api/optimization/info       返回当前模型版本/材料覆盖范围

鉴权: 全部走 require_current_user(已登录用户都能调)
"""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from api.auth import require_current_user
from db.models import User
from ml.inference import (
    Suggestion,
    model_version,
    score_history,
    suggest_next_params,
)
from ml.reward import JOHNSON_COOK_PARAMS, PARAM_BOUNDS

router = APIRouter(prefix="/api/optimization", tags=["optimization"])


# ─── 请求/响应 ───

class SuggestBody(BaseModel):
    material_id: str = Field(..., description="材料 ID,如 metal-01")
    current_voltage: float = Field(..., ge=0.0, le=10000.0, description="当前电压 V")
    current_pulse_width: float = Field(..., ge=0.0, le=5000.0, description="当前脉宽 μs")
    objective: Literal["balanced", "max_strain_rate", "max_stress", "min_energy"] = "balanced"
    deterministic: bool = Field(True, description="True=取均值动作,False=高斯采样")


class SuggestResponse(BaseModel):
    suggested_voltage: float
    suggested_pulse_width: float
    expected_reward: float
    delta_voltage: float
    delta_pulse_width: float
    peak_stress_mpa: float
    max_strain_rate: float
    equilibrium_ratio: float
    model_version: str
    safe: bool


class ScoreBody(BaseModel):
    history: list[list[float]] = Field(
        ...,
        description="(T, 4) 历史矩阵,每行 [voltage, pulse_us, stress_mpa, strain_rate]",
        min_length=1,
        max_length=100,
    )


class ScoreResponse(BaseModel):
    predicted_reward: float
    history_length: int
    model_version: str


class InfoResponse(BaseModel):
    model_version: str
    supported_materials: list[str]
    voltage_range: tuple[float, float]
    pulse_width_range: tuple[float, float]


# ─── 路由 ───

@router.post("/suggest", response_model=SuggestResponse)
async def suggest(
    body: SuggestBody,
    user: User = Depends(require_current_user),
) -> SuggestResponse:
    """PPO 单步推理 — 给定当前参数,返回建议的下一步参数"""
    if body.material_id not in JOHNSON_COOK_PARAMS:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的材料 {body.material_id};支持: {list(JOHNSON_COOK_PARAMS.keys())}",
        )
    s: Suggestion = suggest_next_params(
        material_id=body.material_id,
        current_voltage=body.current_voltage,
        current_pulse_width=body.current_pulse_width,
        objective=body.objective,
        deterministic=body.deterministic,
    )
    return SuggestResponse(**s.__dict__)


@router.post("/score", response_model=ScoreResponse)
async def score(
    body: ScoreBody,
    user: User = Depends(require_current_user),
) -> ScoreResponse:
    """LSTM 给一段历史轨迹打分"""
    import numpy as np

    arr = np.array(body.history, dtype=np.float32)
    if arr.ndim != 2 or arr.shape[1] != 4:
        raise HTTPException(status_code=400, detail="history 形状必须是 (T, 4)")
    pred = score_history(arr)
    return ScoreResponse(
        predicted_reward=pred,
        history_length=int(arr.shape[0]),
        model_version=model_version(),
    )


@router.get("/info", response_model=InfoResponse)
async def info(
    user: User = Depends(require_current_user),
) -> InfoResponse:
    """模型与参数域信息 — 前端用于渲染 UI 提示"""
    return InfoResponse(
        model_version=model_version(),
        supported_materials=list(JOHNSON_COOK_PARAMS.keys()),
        voltage_range=PARAM_BOUNDS["voltage"],
        pulse_width_range=PARAM_BOUNDS["pulse_width"],
    )
