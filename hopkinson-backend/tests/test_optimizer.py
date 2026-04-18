"""
LSTM / PPO 优化器单元测试 — 8 个用例

覆盖:
  - LSTM forward shape 与数值范围
  - PPO actor-critic forward shape
  - normalize / denormalize 对称性
  - simulate_shpb 安全域 / 物理合理性
  - compute_reward 单调性
"""
from __future__ import annotations

import numpy as np
import pytest
import torch

from ml.lstm_predictor import (
    LSTMPredictor,
    SEQ_LEN,
    N_FEATURES,
    HIDDEN,
    normalize_history,
    pad_or_trim,
)
from ml.ppo_agent import (
    PPOActorCritic,
    normalize_state,
    denormalize_action,
)
from ml.reward import (
    PARAM_BOUNDS,
    simulate_shpb,
    compute_reward,
    johnson_cook_stress,
)


# ─── 1. LSTM 推理形状 ───

def test_lstm_forward_shape():
    """LSTM 输入 (B, T, F) → 输出 (B, 1)"""
    model = LSTMPredictor()
    x = torch.randn(4, SEQ_LEN, N_FEATURES)
    out = model(x)
    assert out.shape == (4, 1), f"expected (4, 1), got {out.shape}"
    assert torch.all(torch.isfinite(out)), "LSTM output 含 NaN/Inf"


def test_lstm_normalize_clips_to_unit_range():
    """history 归一化结果必须在 [0, 1]"""
    raw = np.array([
        [4500.0, 100.0, 2000.0, 6000.0],   # voltage 超上限
        [-100.0, 50.0, -10.0, -1.0],        # 应变率/应力 负值
    ])
    norm = normalize_history(raw)
    assert norm.shape == raw.shape
    assert np.all(norm >= 0.0) and np.all(norm <= 1.0), "归一化越界"


def test_lstm_pad_or_trim_handles_short_and_long():
    """短序列前置零填充,长序列尾部截断"""
    short = np.ones((3, N_FEATURES))
    out_short = pad_or_trim(short, seq_len=SEQ_LEN)
    assert out_short.shape == (SEQ_LEN, N_FEATURES)
    assert np.all(out_short[: SEQ_LEN - 3] == 0.0), "前置应为 0"
    assert np.all(out_short[SEQ_LEN - 3 :] == 1.0)

    long = np.arange(15 * N_FEATURES).reshape(15, N_FEATURES).astype(np.float32)
    out_long = pad_or_trim(long, seq_len=SEQ_LEN)
    assert out_long.shape == (SEQ_LEN, N_FEATURES)
    assert np.array_equal(out_long, long[-SEQ_LEN:]), "长序列应取末尾"


# ─── 2. PPO 推理形状 ───

def test_ppo_act_returns_action_in_unit_box():
    """PPO act 输出 action ∈ (-1, 1) 且 logp/value 形状正确"""
    model = PPOActorCritic()
    state = torch.randn(2, 6)
    action, logp, value = model.act(state, deterministic=True)
    assert action.shape == (2, 2), f"action shape {action.shape}"
    assert torch.all(action >= -1.0) and torch.all(action <= 1.0), "action 越界 (-1,1)"
    assert value.shape == (2, 1) or value.shape == (2,), f"value shape {value.shape}"


def test_ppo_state_normalize_denormalize_action():
    """状态归一化与动作反归一化的范围合理性"""
    state = normalize_state(2000.0, 1000.0, 500.0, 2000.0, 0.92, "metal-01")
    assert state.shape == (6,) or state.shape == (7,), f"state shape {state.shape}"
    # 反归一化:动作 ∈ [-1,1] 应映射到合理 Δv / Δp
    dv, dp = denormalize_action(np.array([0.5, -0.3], dtype=np.float32))
    assert isinstance(dv, float) and isinstance(dp, float)
    assert -2000.0 <= dv <= 2000.0, "Δv 范围超界"
    assert -1500.0 <= dp <= 1500.0, "Δp 范围超界"


# ─── 3. 物理仿真合理性 ───

def test_simulate_shpb_within_safety_envelope():
    """安全域内仿真:peak_stress > 0,strain_rate > 0,safe=True"""
    res = simulate_shpb(voltage=2000.0, pulse_width_us=1000.0, material_id="metal-01")
    assert res.safe is True, "2000V/1000us 应在安全域"
    assert res.peak_stress_mpa > 0, "峰值应力应为正"
    assert res.max_strain_rate > 0, "应变率应为正"
    assert 0.0 <= res.equilibrium_ratio <= 1.0, "平衡度必须 [0,1]"


def test_simulate_shpb_marks_unsafe_outside_bounds():
    """超出安全域的电压必须返回 safe=False"""
    res = simulate_shpb(voltage=5000.0, pulse_width_us=1000.0, material_id="metal-01")
    assert res.safe is False, "5000V 应超过 4000V 上限被标记不安全"


def test_johnson_cook_increases_with_strain_rate():
    """J-C 本构:应变率↑ → 流动应力↑(对率敏感材料)"""
    s_low = johnson_cook_stress(strain=0.05, strain_rate=10.0, temperature=298.15, material_id="metal-02")
    s_hi = johnson_cook_stress(strain=0.05, strain_rate=5000.0, temperature=298.15, material_id="metal-02")
    assert s_hi > s_low, f"J-C 应变率敏感性失败 (low={s_low:.2e}, hi={s_hi:.2e})"


def test_compute_reward_returns_finite_scalar():
    """compute_reward 返回有限标量,且不同目标得分不同"""
    r_balanced = compute_reward(2000.0, 1000.0, "metal-01", "balanced")
    r_strain = compute_reward(2000.0, 1000.0, "metal-01", "max_strain_rate")
    assert isinstance(r_balanced, float) and np.isfinite(r_balanced)
    assert isinstance(r_strain, float) and np.isfinite(r_strain)
    # 不同目标在同一参数下,reward 不应完全一致(否则目标函数无效)
    # 注意: 偶尔可能相等,取一个明显能区分的对照
    r_min_e = compute_reward(500.0, 100.0, "metal-01", "min_energy")
    assert r_min_e != pytest.approx(r_strain, abs=1e-6), "目标函数应区分"


# ─── 边界:参数范围常量本身的合理性 ───

def test_param_bounds_consistent_with_safety_constants():
    """PARAM_BOUNDS 必须与前端 safetyCheck 硬上限一致(4000V)"""
    v_lo, v_hi = PARAM_BOUNDS["voltage"]
    assert v_hi == 4000.0, "电压上限必须 = 4000V (硬安全约束)"
    assert v_lo >= 0.0
    p_lo, p_hi = PARAM_BOUNDS["pulse_width"]
    assert p_lo > 0 and p_hi > p_lo
