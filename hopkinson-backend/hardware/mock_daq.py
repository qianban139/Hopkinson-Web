"""
模拟数据采集卡 (DAQ) — 基于物理的伪数据生成器

输出：
- 实时电压/电流/电容/温度/EMI 监控指标
- 实验时输出三波（入射 / 反射 / 透射）波形

使用了简化的 SHPB 一维应力波模型，参数贴近真实工况但无须真硬件。
"""
import math
import time
import random
from typing import Any

from .base import HardwareDriver, DeviceInfo, DeviceStatus


class MockDAQ(HardwareDriver):
    """模拟数据采集卡 — 输出连续的监控指标和实验波形"""

    def __init__(self, device_id: str = "daq-001"):
        self._id = device_id
        self._status = DeviceStatus.ONLINE
        self._start_time = time.time()
        # 实验上下文（实验运行时使用）
        self._experiment_active = False
        self._experiment_voltage = 2500.0
        self._experiment_pulse_width = 200.0  # μs

    # ───────────────────────────────────────────
    # HardwareDriver 接口实现
    # ───────────────────────────────────────────

    def get_info(self) -> DeviceInfo:
        return DeviceInfo(
            id=self._id,
            name="DAQ 数据采集卡（模拟）",
            type="daq",
            status=self._status,
            last_heartbeat=int(time.time() * 1000),
            metadata={
                "model": "Mock-DAQ-v1",
                "channels": 8,
                "sample_rate_hz": 1_000_000,
                "vendor": "Hopkinson Mock",
            },
        )

    async def health_check(self) -> dict[str, Any]:
        return {
            "status": self._status.value,
            "uptime_seconds": time.time() - self._start_time,
            "channels_ok": 8,
            "self_test": "passed",
        }

    async def read_metrics(self) -> dict[str, float]:
        """生成一次基于时间的物理化模拟指标"""
        t = time.time() - self._start_time

        # 基线 + 慢漂移 + 噪声 — 模拟真实仪表读数
        voltage = 2500.0 + 80.0 * math.sin(t / 5.0) + random.gauss(0, 8.0)
        current = 24500.0 + 600.0 * math.sin(t / 4.5 + 1.2) + random.gauss(0, 60.0)
        capacitance = 84.0 + 0.4 * math.sin(t / 30.0) + random.gauss(0, 0.05)
        temperature = 38.0 + 4.0 * math.sin(t / 60.0) + random.gauss(0, 0.3)
        emi = 65.0 + 6.0 * math.sin(t / 8.0) + random.gauss(0, 1.5)

        # 实验启动期间指标会跳升
        if self._experiment_active:
            voltage = self._experiment_voltage + random.gauss(0, 12.0)
            current += 8000.0
            temperature += 6.0
            emi += 12.0

        return {
            "voltage": round(voltage, 2),
            "current": round(current, 1),
            "capacitance": round(capacitance, 3),
            "temperature": round(temperature, 2),
            "emi": round(emi, 2),
        }

    async def execute_command(self, action: str, params: dict[str, Any]) -> dict[str, Any]:
        if action == "start_experiment":
            self._experiment_active = True
            self._experiment_voltage = float(params.get("voltage", 2500))
            self._experiment_pulse_width = float(params.get("pulseWidth", 200))
            return {"ok": True, "message": "DAQ 已进入采集状态"}
        if action == "stop_experiment":
            self._experiment_active = False
            return {"ok": True, "message": "DAQ 已停止采集"}
        return {"ok": False, "message": f"未知命令: {action}"}

    # ───────────────────────────────────────────
    # 实验波形生成（供 /ws/experiment 使用）
    # ───────────────────────────────────────────

    def generate_waveform_chunk(
        self,
        channel: str,
        sample_count: int = 200,
        sample_rate_hz: int = 1_000_000,
    ) -> list[float]:
        """
        生成一段三波波形数据。
        channel ∈ {'incident', 'reflected', 'transmitted'}

        简化模型：
        - incident: 半正弦脉冲 + 噪声
        - reflected: incident 的衰减镜像
        - transmitted: incident 的衰减延时
        """
        v = self._experiment_voltage
        amp = v / 1000.0  # 电压 → 应力幅值（简化）
        pulse_us = self._experiment_pulse_width
        period_us = pulse_us * 2.0
        t0 = time.time()

        samples: list[float] = []
        for i in range(sample_count):
            us = (t0 * 1e6 + i * (1e6 / sample_rate_hz)) % (period_us * 4)
            phase = us / period_us
            base = math.sin(phase * math.pi) if 0 < phase < 1 else 0.0

            if channel == "incident":
                value = amp * base + random.gauss(0, amp * 0.02)
            elif channel == "reflected":
                value = -amp * 0.6 * base + random.gauss(0, amp * 0.015)
            elif channel == "transmitted":
                # 延迟一个相位
                shifted = math.sin((phase - 0.3) * math.pi) if 0.3 < phase < 1.3 else 0.0
                value = amp * 0.85 * shifted + random.gauss(0, amp * 0.015)
            else:
                value = 0.0

            samples.append(round(value, 5))

        return samples
