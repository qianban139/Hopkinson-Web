"""
硬件抽象基类 — 所有具体设备驱动（mock 或真实）必须继承此基类。
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Any


class DeviceStatus(str, Enum):
    """设备运行状态"""
    OFFLINE = "offline"
    ONLINE = "online"
    BUSY = "busy"
    ERROR = "error"


@dataclass
class DeviceInfo:
    """设备元信息（前端展示用）"""
    id: str
    name: str
    type: str          # 'daq' | 'em-driver' | 'sensor'
    status: DeviceStatus
    last_heartbeat: int  # ms timestamp
    metadata: dict[str, Any]


class HardwareDriver(ABC):
    """硬件驱动抽象基类"""

    @abstractmethod
    def get_info(self) -> DeviceInfo:
        """返回设备元信息"""

    @abstractmethod
    async def health_check(self) -> dict[str, Any]:
        """主动触发健康检查，返回详细指标"""

    @abstractmethod
    async def read_metrics(self) -> dict[str, float]:
        """读取一次设备指标快照（供 WS 推送用）"""

    @abstractmethod
    async def execute_command(self, action: str, params: dict[str, Any]) -> dict[str, Any]:
        """下发控制命令，返回执行结果"""
