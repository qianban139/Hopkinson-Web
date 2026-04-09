"""
安全控制器 — 实施 CLAUDE.md 中规定的硬上限阈值

电压 ≤ 4000V
电流 ≤ 50kA
储能 ≤ 36kJ
温度 ≤ 80°C
EMI  ≤ 95dB
"""
from dataclasses import dataclass


SAFETY_LIMITS = {
    "voltage_v": 4000,
    "current_a": 50_000,
    "energy_kj": 36,
    "temperature_c": 80,
    "emi_db": 95,
}


@dataclass
class SafetyVerdict:
    safe: bool
    reason: str = ""
    breached_metric: str = ""


class SafetyController:
    """无状态校验器 — 任何即将下发的实验参数都需先经过 evaluate_params"""

    @staticmethod
    def evaluate_params(params: dict) -> SafetyVerdict:
        """检查实验参数是否在安全范围内"""
        v = float(params.get("voltage", 0))
        if v > SAFETY_LIMITS["voltage_v"]:
            return SafetyVerdict(False, f"电压 {v}V 超过硬上限 {SAFETY_LIMITS['voltage_v']}V", "voltage")

        i = float(params.get("current", 0))
        if i > SAFETY_LIMITS["current_a"]:
            return SafetyVerdict(False, f"电流 {i}A 超过硬上限 {SAFETY_LIMITS['current_a']}A", "current")

        # 估算储能 W = 0.5 * C * V² (kJ)，C 默认 84 μF
        c_uf = float(params.get("capacitance", 84))
        w_kj = 0.5 * (c_uf * 1e-6) * v * v / 1000.0
        if w_kj > SAFETY_LIMITS["energy_kj"]:
            return SafetyVerdict(False, f"估算储能 {w_kj:.1f}kJ 超过硬上限 {SAFETY_LIMITS['energy_kj']}kJ", "energy")

        return SafetyVerdict(True)

    @staticmethod
    def evaluate_metrics(metrics: dict) -> SafetyVerdict:
        """检查实时监控指标是否触发告警"""
        t = float(metrics.get("temperature", 0))
        if t > SAFETY_LIMITS["temperature_c"]:
            return SafetyVerdict(False, f"温度 {t}°C 超过硬上限 {SAFETY_LIMITS['temperature_c']}°C", "temperature")

        e = float(metrics.get("emi", 0))
        if e > SAFETY_LIMITS["emi_db"]:
            return SafetyVerdict(False, f"EMI {e}dB 超过硬上限 {SAFETY_LIMITS['emi_db']}dB", "emi")

        return SafetyVerdict(True)
