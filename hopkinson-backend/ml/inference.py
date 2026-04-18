"""
在线推理服务 — 单例加载 LSTM / PPO checkpoint,供 API 路由调用

设计:
  - 进程级单例(模块级缓存),避免每次请求都重新 load .pt
  - load 失败时回退到随机初始化网络,API 仍可用(标注 model_version=fallback)
  - 推理纯 CPU,单次 <10ms
"""
from __future__ import annotations

import threading
from dataclasses import dataclass
from typing import Final

import numpy as np
import torch

from ml.lstm_predictor import (
    LSTMPredictor,
    CHECKPOINT_PATH as LSTM_CKPT,
    load_lstm,
    predict_reward,
)
from ml.ppo_agent import (
    PPOActorCritic,
    CHECKPOINT_PATH as PPO_CKPT,
    load_ppo,
    normalize_state,
    denormalize_action,
)
from ml.reward import (
    PARAM_BOUNDS,
    OBJECTIVE,
    compute_reward,
    simulate_shpb,
)

MODEL_VERSION_FALLBACK: Final[str] = "fallback-random-init"
MODEL_VERSION_TRAINED: Final[str] = "v1.0.0-shpb-physics"


@dataclass
class Suggestion:
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


# ─── 单例缓存 ───

_lstm: LSTMPredictor | None = None
_ppo: PPOActorCritic | None = None
_lock = threading.Lock()
_lstm_loaded_from_ckpt = False
_ppo_loaded_from_ckpt = False


def get_lstm() -> LSTMPredictor:
    global _lstm, _lstm_loaded_from_ckpt
    if _lstm is None:
        with _lock:
            if _lstm is None:
                _lstm_loaded_from_ckpt = LSTM_CKPT.exists()
                _lstm = load_lstm()
    return _lstm


def get_ppo() -> PPOActorCritic:
    global _ppo, _ppo_loaded_from_ckpt
    if _ppo is None:
        with _lock:
            if _ppo is None:
                _ppo_loaded_from_ckpt = PPO_CKPT.exists()
                _ppo = load_ppo()
    return _ppo


def model_version() -> str:
    """暴露给 API 响应,告知前端用的是不是真训练过的权重"""
    return MODEL_VERSION_TRAINED if _ppo_loaded_from_ckpt else MODEL_VERSION_FALLBACK


# ─── 推理入口 ───

@torch.no_grad()
def suggest_next_params(
    material_id: str,
    current_voltage: float,
    current_pulse_width: float,
    objective: OBJECTIVE = "balanced",
    deterministic: bool = True,
) -> Suggestion:
    """
    给定当前参数,用 PPO 预测下一步建议参数。

    流程:
      1. simulate_shpb 计算当前状态(stress / strain_rate / equilibrium)
      2. 归一化 → PPO.act 输出 (Δv, Δp) ∈ (-1, 1)
      3. 反归一化 + clip 到安全域
      4. 用 compute_reward 算建议参数的预期 reward
    """
    # 1. 当前状态
    cur = simulate_shpb(current_voltage, current_pulse_width, material_id)
    state = normalize_state(
        current_voltage, current_pulse_width,
        cur.peak_stress_mpa, cur.max_strain_rate,
        cur.equilibrium_ratio, material_id,
    )

    # 2. PPO 推理
    model = get_ppo()
    s_t = torch.from_numpy(state).unsqueeze(0)
    action, _, _ = model.act(s_t, deterministic=deterministic)
    a_np = action.squeeze(0).numpy()
    dv, dp = denormalize_action(a_np)

    # 3. clip 到安全域
    v_lo, v_hi = PARAM_BOUNDS["voltage"]
    p_lo, p_hi = PARAM_BOUNDS["pulse_width"]
    new_v = float(np.clip(current_voltage + dv, v_lo, v_hi))
    new_p = float(np.clip(current_pulse_width + dp, p_lo, p_hi))

    # 4. 评估建议
    expected = compute_reward(new_v, new_p, material_id, objective)
    nxt = simulate_shpb(new_v, new_p, material_id)

    return Suggestion(
        suggested_voltage=new_v,
        suggested_pulse_width=new_p,
        expected_reward=float(expected),
        delta_voltage=new_v - current_voltage,
        delta_pulse_width=new_p - current_pulse_width,
        peak_stress_mpa=nxt.peak_stress_mpa,
        max_strain_rate=nxt.max_strain_rate,
        equilibrium_ratio=nxt.equilibrium_ratio,
        model_version=model_version(),
        safe=nxt.safe,
    )


@torch.no_grad()
def score_history(history_raw: np.ndarray) -> float:
    """LSTM 给一段参数历史打分(预测下一步 reward)"""
    return predict_reward(get_lstm(), history_raw)
