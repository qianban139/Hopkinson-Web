"""
奖励函数与 SHPB 仿真 — Python 移植自前端 shpbPhysicsEngine.ts

公式参考:
  Johnson-Cook 本构: σ = (A + B·ε^n)·(1 + C·ln(ε̇/ε̇₀))·(1 - T*^m)
  SHPB 一维应力波:  ε_s = -2·c0/Ls · ∫ε_r dt
                    σ_s = (E·As/A_s)·ε_t
                    ε̇_s = -2·c0/Ls · ε_r

仅依赖 numpy,不依赖 torch — 训练脚本与推理服务都能复用。
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Literal

import numpy as np

# ─── 常量 ───

# Johnson-Cook 参数(代表性金属:6061-T6 铝)
# 训练时若需要不同材料,从 db.materials 表读取并替换
JOHNSON_COOK_PARAMS: dict[str, dict[str, float]] = {
    "metal-01": {  # 6061-T6 Al
        "A": 324e6, "B": 114e6, "n": 0.42, "C": 0.002, "m": 1.34,
        "T_ref": 293.15, "T_melt": 925.0, "epsdot_ref": 1.0,
        "rho": 2700.0, "E": 68.9e9, "c0": 5050.0,
    },
    "metal-02": {  # 304 不锈钢
        "A": 310e6, "B": 1000e6, "n": 0.65, "C": 0.07, "m": 1.0,
        "T_ref": 293.15, "T_melt": 1700.0, "epsdot_ref": 1.0,
        "rho": 7900.0, "E": 200e9, "c0": 5000.0,
    },
}

# 实验参数搜索域 — 与前端 safetyCheck.ts 硬上限保持一致
PARAM_BOUNDS = {
    "voltage": (500.0, 4000.0),       # V
    "pulse_width": (100.0, 2000.0),   # μs
}

OBJECTIVE = Literal["balanced", "max_strain_rate", "max_stress", "min_energy"]


# ─── Johnson-Cook 本构 ───

def johnson_cook_stress(
    strain: float,
    strain_rate: float,
    temperature: float,
    material_id: str = "metal-01",
) -> float:
    """
    Johnson-Cook 流动应力(Pa)

    σ = (A + B·ε^n)(1 + C·ln(ε̇/ε̇₀))(1 - T*^m)
    其中 T* = (T - T_ref) / (T_melt - T_ref)
    """
    p = JOHNSON_COOK_PARAMS.get(material_id, JOHNSON_COOK_PARAMS["metal-01"])
    eps = max(strain, 1e-6)
    eps_dot = max(strain_rate, p["epsdot_ref"])
    t_star = max(0.0, min(1.0, (temperature - p["T_ref"]) / (p["T_melt"] - p["T_ref"])))

    sigma = (
        (p["A"] + p["B"] * eps ** p["n"])
        * (1.0 + p["C"] * math.log(eps_dot / p["epsdot_ref"]))
        * (1.0 - t_star ** p["m"])
    )
    return float(sigma)


# ─── SHPB 仿真(简化一维) ───

@dataclass
class ShpbResult:
    peak_stress_mpa: float       # MPa
    max_strain_rate: float       # 1/s
    absorbed_energy_j: float     # J(单位试样)
    equilibrium_ratio: float     # [0,1] 入射+反射 vs 透射 平衡度
    peak_voltage_used: float     # V
    safe: bool                   # 是否触发硬上限


def simulate_shpb(
    voltage: float,
    pulse_width_us: float,
    material_id: str = "metal-01",
    sample_length_mm: float = 5.0,
) -> ShpbResult:
    """
    简化的 SHPB 一维仿真 — 给定电压/脉宽,返回峰值指标

    简化:
      1. 电磁驱动器输出冲击速度 v_in ≈ k·V (k 由设备标定)
      2. 入射应力波幅值 σ_i = ρ·c0·v_in / 2
      3. 试样应变率 ε̇ ≈ 2·v_in / L_s
      4. 用 J-C 本构反推峰值应力(取应变 ε=0.1 作为代表性)
      5. 吸收能量 = σ·ε·V_sample
    """
    p = JOHNSON_COOK_PARAMS.get(material_id, JOHNSON_COOK_PARAMS["metal-01"])

    # 安全检查
    safe = (
        500.0 <= voltage <= 4000.0
        and 100.0 <= pulse_width_us <= 2000.0
    )

    # 1. 冲击速度 (m/s) — 简化线性标定
    v_in = 0.0035 * voltage  # 1000V → 3.5 m/s, 4000V → 14 m/s
    # 脉宽影响积分能量,微调 v_in
    v_in *= (pulse_width_us / 500.0) ** 0.3

    # 2. 入射波幅值
    sigma_i = p["rho"] * p["c0"] * v_in / 2.0  # Pa

    # 3. 应变率
    sample_length_m = sample_length_mm / 1000.0
    eps_dot = 2.0 * v_in / sample_length_m  # 1/s

    # 4. 峰值应力(取代表性应变 0.1)
    peak_strain = 0.1
    sigma_peak = johnson_cook_stress(peak_strain, eps_dot, 298.15, material_id)
    # 入射波传导效率(随冲击强度衰减,经验)
    transmit_eff = min(1.0, sigma_i / max(sigma_peak, 1.0))
    sigma_actual = sigma_peak * transmit_eff

    # 5. 吸收能量(单位试样,假设 V_sample=π·5²·5 mm³)
    v_sample_m3 = math.pi * (0.005 ** 2) * sample_length_m
    energy_j = sigma_actual * peak_strain * v_sample_m3

    # 应力平衡度 — 模拟入射+反射 vs 透射波形匹配度
    # 完美 SHPB 实验在脉宽 500-1500us 之间平衡度最好
    pulse_quality = math.exp(-((pulse_width_us - 1000.0) / 600.0) ** 2)
    equilibrium = 0.85 + 0.13 * pulse_quality

    return ShpbResult(
        peak_stress_mpa=sigma_actual / 1e6,
        max_strain_rate=eps_dot,
        absorbed_energy_j=energy_j,
        equilibrium_ratio=min(0.99, equilibrium),
        peak_voltage_used=voltage,
        safe=safe,
    )


# ─── 奖励函数 ───

def compute_reward(
    voltage: float,
    pulse_width_us: float,
    material_id: str = "metal-01",
    objective: OBJECTIVE = "balanced",
) -> float:
    """
    奖励函数 — 给优化器使用

    输入空间: voltage [500-4000] V, pulse_width [100-2000] μs
    输出: 标量奖励 [0,1+] (越大越好)

    objective:
      - balanced            综合: 平衡度*应变率*应力归一化乘积
      - max_strain_rate     最大应变率
      - max_stress          最大峰值应力
      - min_energy          最小吸收能量(节能)
    """
    res = simulate_shpb(voltage, pulse_width_us, material_id)

    if not res.safe:
        return -1.0  # 越界硬惩罚

    # 归一化(典型 SHPB 实验范围)
    n_strain_rate = min(1.0, res.max_strain_rate / 5000.0)
    n_stress = min(1.0, res.peak_stress_mpa / 1500.0)
    n_energy = min(1.0, res.absorbed_energy_j / 0.5)

    if objective == "max_strain_rate":
        return n_strain_rate * res.equilibrium_ratio
    if objective == "max_stress":
        return n_stress * res.equilibrium_ratio
    if objective == "min_energy":
        return (1.0 - n_energy) * res.equilibrium_ratio
    # balanced
    return float(np.cbrt(n_strain_rate * n_stress * res.equilibrium_ratio))
