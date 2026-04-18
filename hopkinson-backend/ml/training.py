"""
离线训练脚本 — 可独立运行,生成 checkpoints/lstm_best.pt 与 checkpoints/ppo_best.pt

用法:
  python -m ml.training lstm     # 训练 LSTM(MSE 回归,5000 样本)
  python -m ml.training ppo      # 训练 PPO(SHPB 仿真环境,~500 episode)
  python -m ml.training all      # 两个都训

数据来源: ml.reward.simulate_shpb 物理仿真,不用任何随机噪声当 reward。
训练结束自动保存 checkpoint;CPU 单训 LSTM ~30s,PPO ~5min。
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import numpy as np
import torch
from torch import nn, optim
from torch.utils.data import DataLoader, TensorDataset

from ml.lstm_predictor import (
    LSTMPredictor,
    SEQ_LEN,
    N_FEATURES,
    CHECKPOINT_PATH as LSTM_CKPT,
    normalize_history,
)
from ml.ppo_agent import (
    PPOActorCritic,
    STATE_DIM,
    ACTION_DIM,
    CHECKPOINT_PATH as PPO_CKPT,
    normalize_state,
    denormalize_action,
)
from ml.reward import (
    PARAM_BOUNDS,
    JOHNSON_COOK_PARAMS,
    compute_reward,
    simulate_shpb,
)


# ─── LSTM 训练 ────────────────────────────────────────────────

def _generate_lstm_dataset(
    n_samples: int = 5000,
    seq_len: int = SEQ_LEN,
    seed: int = 42,
) -> tuple[np.ndarray, np.ndarray]:
    """
    随机轨迹生成器 — 每条样本是一段 seq_len 步的参数序列,
    label 是序列结尾位置的真实 reward(物理仿真计算)。
    """
    rng = np.random.default_rng(seed)
    v_lo, v_hi = PARAM_BOUNDS["voltage"]
    p_lo, p_hi = PARAM_BOUNDS["pulse_width"]
    materials = list(JOHNSON_COOK_PARAMS.keys())

    X = np.zeros((n_samples, seq_len, N_FEATURES), dtype=np.float32)
    y = np.zeros((n_samples,), dtype=np.float32)

    for i in range(n_samples):
        mat = materials[i % len(materials)]
        # 随机起点 + 小扰动构造序列(模拟优化轨迹)
        v0 = rng.uniform(v_lo, v_hi)
        p0 = rng.uniform(p_lo, p_hi)
        for t in range(seq_len):
            v = float(np.clip(v0 + rng.normal(0, 200), v_lo, v_hi))
            p = float(np.clip(p0 + rng.normal(0, 100), p_lo, p_hi))
            res = simulate_shpb(v, p, mat)
            X[i, t, 0] = v
            X[i, t, 1] = p
            X[i, t, 2] = res.peak_stress_mpa
            X[i, t, 3] = res.max_strain_rate
            v0, p0 = v, p
        # label = 序列末端位置的标准 reward
        y[i] = compute_reward(X[i, -1, 0], X[i, -1, 1], mat, "balanced")

    # 特征归一化(复用 lstm_predictor.normalize_history)
    for i in range(n_samples):
        X[i] = normalize_history(X[i])

    return X, y


def train_lstm(
    n_samples: int = 5000,
    epochs: int = 50,
    batch_size: int = 64,
    lr: float = 1e-3,
    val_ratio: float = 0.1,
) -> dict:
    """LSTM MSE 训练;返回 {final_train_loss, final_val_loss}"""
    print(f"[LSTM] 生成 {n_samples} 样本…")
    X, y = _generate_lstm_dataset(n_samples)
    n_val = int(n_samples * val_ratio)
    X_train, X_val = X[:-n_val], X[-n_val:]
    y_train, y_val = y[:-n_val], y[-n_val:]

    train_ds = TensorDataset(torch.from_numpy(X_train), torch.from_numpy(y_train))
    val_ds = TensorDataset(torch.from_numpy(X_val), torch.from_numpy(y_val))
    train_dl = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_dl = DataLoader(val_ds, batch_size=batch_size)

    model = LSTMPredictor()
    opt = optim.Adam(model.parameters(), lr=lr)
    loss_fn = nn.MSELoss()

    best_val = float("inf")
    last_train = float("nan")
    print(f"[LSTM] 训练 {epochs} epochs, batch={batch_size}, lr={lr}")
    t0 = time.time()
    for ep in range(1, epochs + 1):
        model.train()
        train_loss = 0.0
        for xb, yb in train_dl:
            opt.zero_grad()
            pred = model(xb).squeeze(-1)
            loss = loss_fn(pred, yb)
            loss.backward()
            opt.step()
            train_loss += loss.item() * xb.size(0)
        train_loss /= len(train_ds)
        last_train = train_loss

        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for xb, yb in val_dl:
                pred = model(xb).squeeze(-1)
                val_loss += loss_fn(pred, yb).item() * xb.size(0)
        val_loss /= len(val_ds)

        if val_loss < best_val:
            best_val = val_loss
            LSTM_CKPT.parent.mkdir(parents=True, exist_ok=True)
            torch.save(model.state_dict(), LSTM_CKPT)

        if ep % 5 == 0 or ep == 1:
            print(f"  ep{ep:>3d}  train={train_loss:.4f}  val={val_loss:.4f}  best={best_val:.4f}")

    elapsed = time.time() - t0
    print(f"[LSTM] 完成,用时 {elapsed:.1f}s,best_val={best_val:.4f},checkpoint={LSTM_CKPT}")
    return {"final_train_loss": last_train, "final_val_loss": best_val, "elapsed_sec": elapsed}


# ─── PPO 训练 ─────────────────────────────────────────────────

class _ShpbEnv:
    """简化 SHPB 单步环境 — gym-like 接口"""

    def __init__(self, material_id: str = "metal-01", max_steps: int = 30, seed: int = 0):
        self.material_id = material_id
        self.max_steps = max_steps
        self.rng = np.random.default_rng(seed)
        self.v: float = 0.0
        self.p: float = 0.0
        self.t: int = 0

    def reset(self) -> np.ndarray:
        v_lo, v_hi = PARAM_BOUNDS["voltage"]
        p_lo, p_hi = PARAM_BOUNDS["pulse_width"]
        self.v = float(self.rng.uniform(v_lo, v_hi))
        self.p = float(self.rng.uniform(p_lo, p_hi))
        self.t = 0
        return self._obs()

    def _obs(self) -> np.ndarray:
        res = simulate_shpb(self.v, self.p, self.material_id)
        return normalize_state(
            self.v, self.p, res.peak_stress_mpa, res.max_strain_rate,
            res.equilibrium_ratio, self.material_id,
        )

    def step(self, action: np.ndarray) -> tuple[np.ndarray, float, bool]:
        dv, dp = denormalize_action(action)
        v_lo, v_hi = PARAM_BOUNDS["voltage"]
        p_lo, p_hi = PARAM_BOUNDS["pulse_width"]
        self.v = float(np.clip(self.v + dv, v_lo, v_hi))
        self.p = float(np.clip(self.p + dp, p_lo, p_hi))
        self.t += 1
        reward = compute_reward(self.v, self.p, self.material_id, "balanced")
        done = self.t >= self.max_steps
        return self._obs(), reward, done


def _gae(rewards: list[float], values: list[float], gamma: float = 0.99, lam: float = 0.95) -> tuple[np.ndarray, np.ndarray]:
    """Generalized Advantage Estimation"""
    n = len(rewards)
    adv = np.zeros(n, dtype=np.float32)
    last = 0.0
    next_v = 0.0  # episode 末端无 bootstrap
    for t in reversed(range(n)):
        delta = rewards[t] + gamma * next_v - values[t]
        last = delta + gamma * lam * last
        adv[t] = last
        next_v = values[t]
    returns = adv + np.array(values, dtype=np.float32)
    return adv, returns


def train_ppo(
    n_episodes: int = 500,
    steps_per_ep: int = 30,
    update_epochs: int = 10,
    batch_size: int = 64,
    clip: float = 0.2,
    lr: float = 3e-4,
    log_every: int = 50,
) -> dict:
    """PPO 训练 — 单环境 rollout 一个 episode 后做 update"""
    materials = list(JOHNSON_COOK_PARAMS.keys())
    model = PPOActorCritic()
    opt = optim.Adam(model.parameters(), lr=lr)

    print(f"[PPO] 训练 {n_episodes} episode × {steps_per_ep} step,clip={clip},lr={lr}")
    t0 = time.time()
    best_avg = -1e9
    return_window: list[float] = []

    for ep in range(1, n_episodes + 1):
        mat = materials[ep % len(materials)]
        env = _ShpbEnv(mat, max_steps=steps_per_ep, seed=ep)
        obs = env.reset()

        states, actions, log_probs, values, rewards = [], [], [], [], []
        for _ in range(steps_per_ep):
            s = torch.from_numpy(obs).unsqueeze(0)
            with torch.no_grad():
                a, lp, v = model.act(s, deterministic=False)
            a_np = a.squeeze(0).numpy()
            obs2, r, done = env.step(a_np)
            states.append(obs)
            actions.append(a_np)
            log_probs.append(lp.item())
            values.append(v.item())
            rewards.append(r)
            obs = obs2
            if done:
                break

        adv, returns = _gae(rewards, values)
        # 标准化优势
        adv = (adv - adv.mean()) / (adv.std() + 1e-8)

        # PPO update
        s_t = torch.from_numpy(np.array(states, dtype=np.float32))
        a_t = torch.from_numpy(np.array(actions, dtype=np.float32))
        old_lp = torch.from_numpy(np.array(log_probs, dtype=np.float32))
        adv_t = torch.from_numpy(adv)
        ret_t = torch.from_numpy(returns)

        n = s_t.size(0)
        for _ in range(update_epochs):
            idx = np.random.permutation(n)
            for start in range(0, n, batch_size):
                mb = idx[start:start + batch_size]
                lp, ent, v_pred = model.evaluate(s_t[mb], a_t[mb])
                ratio = (lp - old_lp[mb]).exp()
                surr1 = ratio * adv_t[mb]
                surr2 = ratio.clamp(1 - clip, 1 + clip) * adv_t[mb]
                actor_loss = -torch.min(surr1, surr2).mean()
                critic_loss = (v_pred - ret_t[mb]).pow(2).mean()
                ent_bonus = ent.mean()
                loss = actor_loss + 0.5 * critic_loss - 0.01 * ent_bonus

                opt.zero_grad()
                loss.backward()
                nn.utils.clip_grad_norm_(model.parameters(), 0.5)
                opt.step()

        ep_return = float(sum(rewards))
        return_window.append(ep_return)
        if len(return_window) > 50:
            return_window.pop(0)
        avg = float(np.mean(return_window))

        if avg > best_avg:
            best_avg = avg
            PPO_CKPT.parent.mkdir(parents=True, exist_ok=True)
            torch.save(model.state_dict(), PPO_CKPT)

        if ep % log_every == 0 or ep == 1:
            print(f"  ep{ep:>4d}  return={ep_return:+.3f}  avg50={avg:+.3f}  best={best_avg:+.3f}")

    elapsed = time.time() - t0
    print(f"[PPO] 完成,用时 {elapsed:.1f}s,best_avg50={best_avg:.3f},checkpoint={PPO_CKPT}")
    return {"best_avg_return": best_avg, "elapsed_sec": elapsed}


# ─── CLI ─────────────────────────────────────────────────────

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="ML 训练入口")
    parser.add_argument("target", choices=["lstm", "ppo", "all"], help="训练哪个模型")
    parser.add_argument("--lstm-samples", type=int, default=5000)
    parser.add_argument("--lstm-epochs", type=int, default=50)
    parser.add_argument("--ppo-episodes", type=int, default=500)
    args = parser.parse_args(argv)

    torch.manual_seed(42)
    np.random.seed(42)

    if args.target in ("lstm", "all"):
        train_lstm(n_samples=args.lstm_samples, epochs=args.lstm_epochs)
    if args.target in ("ppo", "all"):
        train_ppo(n_episodes=args.ppo_episodes)
    return 0


if __name__ == "__main__":
    sys.exit(main())
