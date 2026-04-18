"""
PPO Actor-Critic 策略网络 — 给定当前实验状态,输出参数调整动作

状态(state, 6 维):
  [voltage_norm, pulse_norm, peak_stress_norm, strain_rate_norm,
   equilibrium_ratio, material_one_hot_id]

动作(action, 2 维,连续):
  [Δvoltage_norm, Δpulse_norm]   (-1, 1) 范围,外部反归一化后施加到参数

网络:
  Actor   MLP(64, 64) → Gaussian(μ, log_σ)  — μ ∈ (-1, 1) 经 tanh
  Critic  MLP(64, 64) → V(s)

训练:
  PPO clip ratio=0.2, GAE λ=0.95, lr=3e-4, batch=64, epochs=10/update
  rollout 环境复用 reward.simulate_shpb,每个 episode 从随机参数起步,
  允许 30 步动作,reward 用 compute_reward(balanced)。

为保持工作量可控,目标只是收敛到合理策略(avg_return > 0.6)。
"""
from __future__ import annotations

from pathlib import Path
from typing import Final

import numpy as np
import torch
from torch import nn
from torch.distributions import Normal

STATE_DIM: Final[int] = 6
ACTION_DIM: Final[int] = 2
HIDDEN: Final[int] = 64
LOG_STD_MIN: Final[float] = -5.0
LOG_STD_MAX: Final[float] = 2.0

CHECKPOINT_PATH = Path(__file__).parent / "checkpoints" / "ppo_best.pt"


def _mlp(in_dim: int, out_dim: int, hidden: int = HIDDEN) -> nn.Sequential:
    return nn.Sequential(
        nn.Linear(in_dim, hidden),
        nn.Tanh(),
        nn.Linear(hidden, hidden),
        nn.Tanh(),
        nn.Linear(hidden, out_dim),
    )


class PPOActorCritic(nn.Module):
    """共享主干非必需 — 用两个独立 MLP 更稳"""

    def __init__(
        self,
        state_dim: int = STATE_DIM,
        action_dim: int = ACTION_DIM,
    ) -> None:
        super().__init__()
        self.actor_mu = _mlp(state_dim, action_dim)
        # log_std 设为可学习参数(状态无关) — PPO 经典实现
        self.actor_log_std = nn.Parameter(torch.full((action_dim,), -0.5))
        self.critic = _mlp(state_dim, 1)

    # ── 推理路径 ───────────────────────────────────────────────
    def actor_forward(self, state: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        """返回 (μ ∈ (-1,1), σ > 0)"""
        mu = torch.tanh(self.actor_mu(state))
        log_std = self.actor_log_std.clamp(LOG_STD_MIN, LOG_STD_MAX)
        std = log_std.exp().expand_as(mu)
        return mu, std

    def value(self, state: torch.Tensor) -> torch.Tensor:
        return self.critic(state).squeeze(-1)

    # ── 采样动作(训练时 stochastic,推理时可选 deterministic) ──
    def act(
        self,
        state: torch.Tensor,
        deterministic: bool = False,
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """返回 (action, log_prob, value);action 已 clip 到 [-1, 1]"""
        mu, std = self.actor_forward(state)
        if deterministic:
            action = mu
            dist = Normal(mu, std)
            log_prob = dist.log_prob(action).sum(-1)
        else:
            dist = Normal(mu, std)
            raw = dist.rsample()
            action = raw.clamp(-1.0, 1.0)
            log_prob = dist.log_prob(raw).sum(-1)
        value = self.value(state)
        return action, log_prob, value

    def evaluate(
        self,
        state: torch.Tensor,
        action: torch.Tensor,
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """给定 (s, a) 返回 (log_prob, entropy, value) — 用于 PPO update"""
        mu, std = self.actor_forward(state)
        dist = Normal(mu, std)
        log_prob = dist.log_prob(action).sum(-1)
        entropy = dist.entropy().sum(-1)
        value = self.value(state)
        return log_prob, entropy, value


# ─── 推理辅助 ───

def normalize_state(
    voltage: float,
    pulse_width_us: float,
    peak_stress_mpa: float,
    strain_rate: float,
    equilibrium_ratio: float,
    material_id: str,
) -> np.ndarray:
    """状态归一化 — 范围与 LSTM 保持一致"""
    # material_id 简化为 hash 余数 ∈ [0, 1) — 真生产应用 embedding 表
    mat_one = (abs(hash(material_id)) % 100) / 100.0
    return np.array([
        np.clip((voltage - 500.0) / 3500.0, 0.0, 1.0),
        np.clip((pulse_width_us - 100.0) / 1900.0, 0.0, 1.0),
        np.clip(peak_stress_mpa / 1500.0, 0.0, 1.0),
        np.clip(strain_rate / 5000.0, 0.0, 1.0),
        np.clip(equilibrium_ratio, 0.0, 1.0),
        mat_one,
    ], dtype=np.float32)


def denormalize_action(action: np.ndarray, scale_v: float = 400.0, scale_p: float = 200.0) -> tuple[float, float]:
    """
    动作 ∈ (-1, 1) 反归一化为参数增量(V, μs)。

    缺省步长 ±400V / ±200μs — 单步保守探索,避免一次跳出安全域。
    """
    dv = float(action[0]) * scale_v
    dp = float(action[1]) * scale_p
    return dv, dp


def load_ppo(path: Path = CHECKPOINT_PATH, map_location: str = "cpu") -> PPOActorCritic:
    """加载 checkpoint;不存在则返回随机初始化网络"""
    model = PPOActorCritic()
    if path.exists():
        state = torch.load(path, map_location=map_location, weights_only=True)
        model.load_state_dict(state)
    model.eval()
    return model
