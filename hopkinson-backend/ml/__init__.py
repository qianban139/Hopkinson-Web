"""
机器学习模块 — 真实 PyTorch 网络

子模块:
  - reward          奖励函数(基于 SHPB 物理仿真)
  - lstm_predictor  LSTM 序列预测器(候选生成)
  - ppo_agent       PPO Actor-Critic 策略网络
  - training        离线训练脚本
  - inference       在线推理(加载 checkpoint)

设计原则:
  - 所有网络都是真实 nn.Module 子类,可保存权重 .pt 文件
  - 训练数据来自 reward.py 内的 SHPB 物理仿真,不用随机数
"""

from .reward import (
    JOHNSON_COOK_PARAMS,
    PARAM_BOUNDS,
    johnson_cook_stress,
    simulate_shpb,
    compute_reward,
)

# 注意:lstm_predictor / ppo_agent / inference 依赖 torch,
# 故不在包级 eager import — 调用方按需 from ml.inference import ...
# 这样未装 torch 的环境(纯前端开发者本地)也能 import ml.reward。

__all__ = [
    "JOHNSON_COOK_PARAMS",
    "PARAM_BOUNDS",
    "johnson_cook_stress",
    "simulate_shpb",
    "compute_reward",
]
