"""
模拟电磁驱动器 — 控制三级线圈加速器
"""
import time
from typing import Any

from .base import HardwareDriver, DeviceInfo, DeviceStatus


class MockEMDriver(HardwareDriver):
    """模拟电磁驱动器（RLC 链式电路）"""

    def __init__(self, device_id: str = "em-001"):
        self._id = device_id
        self._status = DeviceStatus.ONLINE
        self._target_voltage = 2500.0
        self._charged = False
        self._start_time = time.time()

    def get_info(self) -> DeviceInfo:
        return DeviceInfo(
            id=self._id,
            name="电磁驱动器（模拟）",
            type="em-driver",
            status=self._status,
            last_heartbeat=int(time.time() * 1000),
            metadata={
                "model": "Mock-EM-Coil-v1",
                "max_voltage_v": 4000,
                "max_current_ka": 50,
                "max_energy_kj": 36,
                "stages": 3,
            },
        )

    async def health_check(self) -> dict[str, Any]:
        return {
            "status": self._status.value,
            "uptime_seconds": time.time() - self._start_time,
            "charged": self._charged,
            "target_voltage": self._target_voltage,
            "self_test": "passed",
        }

    async def read_metrics(self) -> dict[str, float]:
        return {
            "target_voltage": self._target_voltage,
            "charge_state": 1.0 if self._charged else 0.0,
        }

    async def execute_command(self, action: str, params: dict[str, Any]) -> dict[str, Any]:
        if action == "set_voltage":
            v = float(params.get("voltage", 0))
            if v < 0 or v > 4000:
                return {"ok": False, "message": f"电压 {v}V 超出安全范围 0-4000V"}
            self._target_voltage = v
            return {"ok": True, "message": f"目标电压设置为 {v}V"}
        if action == "charge":
            self._charged = True
            return {"ok": True, "message": "电容组已充电至目标电压"}
        if action == "discharge":
            self._charged = False
            return {"ok": True, "message": "电容组已放电"}
        if action == "fire":
            if not self._charged:
                return {"ok": False, "message": "未充电，无法触发"}
            self._charged = False
            return {"ok": True, "message": "电磁驱动已触发"}
        return {"ok": False, "message": f"未知命令: {action}"}
