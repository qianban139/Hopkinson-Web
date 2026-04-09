"""
进程内状态管理 — 设备注册表 + 实验生命周期

说明：
  Phase 3 使用内存存储，无数据库。
  Phase 7 再引入 SQLite / TimescaleDB 持久化。
"""
import time
from enum import Enum
from dataclasses import dataclass, field
from typing import Any

from hardware import MockDAQ, MockEMDriver, SafetyController


# ═══════════════════════════════════════════════
# 设备注册表
# ═══════════════════════════════════════════════

daq = MockDAQ("daq-001")
em_driver = MockEMDriver("em-001")
safety = SafetyController()

DEVICE_REGISTRY: dict[str, Any] = {
    "daq-001": daq,
    "em-001": em_driver,
}


def get_all_devices():
    """列出所有设备及其状态"""
    return [dev.get_info() for dev in DEVICE_REGISTRY.values()]


def get_device(device_id: str):
    """获取单个设备"""
    return DEVICE_REGISTRY.get(device_id)


# ═══════════════════════════════════════════════
# 实验管理
# ═══════════════════════════════════════════════

class ExperimentPhase(str, Enum):
    CREATED = "created"
    SAFETY_CHECK = "safety_check"
    PREPARATION = "preparation"
    EXECUTION = "execution"
    COMPLETED = "completed"
    PAUSED = "paused"
    ABORTED = "aborted"
    ERROR = "error"


@dataclass
class Experiment:
    id: str
    material_id: str
    params: dict[str, Any]
    mode: str  # 'real' | 'simulation'
    phase: ExperimentPhase = ExperimentPhase.CREATED
    progress: int = 0
    created_at: int = field(default_factory=lambda: int(time.time() * 1000))
    started_at: int | None = None
    completed_at: int | None = None
    result: dict[str, Any] | None = None


# 进程内实验存储
_experiments: dict[str, Experiment] = {}
_exp_counter = 0


def create_experiment(material_id: str, params: dict[str, Any], mode: str = "simulation") -> Experiment:
    """创建新实验"""
    global _exp_counter
    _exp_counter += 1
    exp_id = f"exp-{time.strftime('%Y%m%d')}-{_exp_counter:03d}"
    exp = Experiment(id=exp_id, material_id=material_id, params=params, mode=mode)
    _experiments[exp_id] = exp
    return exp


def get_experiment(exp_id: str) -> Experiment | None:
    return _experiments.get(exp_id)


def list_experiments() -> list[Experiment]:
    return list(_experiments.values())
