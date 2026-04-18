"""
LSTM 预测器 — 基于历史参数序列预测下一步候选 reward

输入  (batch, seq_len=10, features=4)  历史 10 步的 (voltage_norm, pulse_norm, stress_norm, strain_rate_norm)
输出  (batch, 1)                         预测的下一步标量 reward

设计:
  - 1 层 LSTM(hidden=32) + LayerNorm + FC(32→1)
  - 归一化在外部完成(参考 reward.PARAM_BOUNDS),网络只看 [0,1] 范围
  - 体积小(~15KB checkpoint),CPU 推理 <5ms

用途:
  AI 助手在搜索新参数时,先用 LSTM 对 Top-K 候选打分,过滤明显劣解
  再交给 PPO 做精细调整。
"""
from __future__ import annotations

from pathlib import Path
from typing import Final

import numpy as np
import torch
from torch import nn

# 序列与特征维度 — 改动需同步训练脚本
SEQ_LEN: Final[int] = 10
N_FEATURES: Final[int] = 4
HIDDEN: Final[int] = 32

CHECKPOINT_PATH = Path(__file__).parent / "checkpoints" / "lstm_best.pt"


class LSTMPredictor(nn.Module):
    """1 层 LSTM + LayerNorm + FC(32→1) 的标量回归网络"""

    def __init__(self, n_features: int = N_FEATURES, hidden: int = HIDDEN) -> None:
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=n_features,
            hidden_size=hidden,
            num_layers=1,
            batch_first=True,
        )
        self.norm = nn.LayerNorm(hidden)
        self.head = nn.Linear(hidden, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, T, F)
        out, _ = self.lstm(x)            # (B, T, H)
        last = out[:, -1, :]             # (B, H) 取最后一步
        last = self.norm(last)
        return self.head(last)           # (B, 1)


# ─── 推理辅助 ───

def normalize_history(
    history: np.ndarray,
) -> np.ndarray:
    """
    把原始 (T, 4) 历史 [voltage(V), pulse_us, stress(MPa), strain_rate(1/s)]
    归一化到 [0, 1]。归一化常量与 reward.simulate_shpb 默认范围对齐。

    voltage     : 500-4000  V
    pulse_width : 100-2000  μs
    stress      : 0-1500    MPa
    strain_rate : 0-5000    1/s
    """
    if history.ndim != 2 or history.shape[1] != N_FEATURES:
        raise ValueError(f"history shape must be (T, {N_FEATURES}), got {history.shape}")
    norm = np.empty_like(history, dtype=np.float32)
    norm[:, 0] = (history[:, 0] - 500.0) / 3500.0
    norm[:, 1] = (history[:, 1] - 100.0) / 1900.0
    norm[:, 2] = history[:, 2] / 1500.0
    norm[:, 3] = history[:, 3] / 5000.0
    return np.clip(norm, 0.0, 1.0)


def pad_or_trim(history: np.ndarray, seq_len: int = SEQ_LEN) -> np.ndarray:
    """前置零填充或尾部截断,保证序列长度 == seq_len"""
    t = history.shape[0]
    if t >= seq_len:
        return history[-seq_len:]
    pad = np.zeros((seq_len - t, history.shape[1]), dtype=history.dtype)
    return np.vstack([pad, history])


def load_lstm(path: Path = CHECKPOINT_PATH, map_location: str = "cpu") -> LSTMPredictor:
    """加载训练好的 checkpoint;若文件不存在,返回随机初始化网络(冷启动可用)"""
    model = LSTMPredictor()
    if path.exists():
        state = torch.load(path, map_location=map_location, weights_only=True)
        model.load_state_dict(state)
    model.eval()
    return model


@torch.no_grad()
def predict_reward(
    model: LSTMPredictor,
    history_raw: np.ndarray,
) -> float:
    """
    给定原始历史 (T, 4),返回预测 reward 标量。

    history 不足 SEQ_LEN 时前置零填充;超过则取最近 SEQ_LEN 步。
    """
    norm = normalize_history(history_raw.astype(np.float32))
    norm = pad_or_trim(norm)
    x = torch.from_numpy(norm).unsqueeze(0)   # (1, T, F)
    y = model(x).squeeze().item()
    return float(y)
