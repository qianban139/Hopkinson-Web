"""
状态管理 — 内存缓存 + 数据库 write-through

设计：
  - 活跃实验保留在内存（WebSocket 每 200ms 读取，不宜频繁查库）
  - 写入时同时更新内存 + 写入数据库
  - 历史查询走数据库
  - 保留原有函数签名，api/ 层零改动
"""
import asyncio
import time
from enum import Enum
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from hardware import MockDAQ, MockEMDriver, SafetyController


# =============================================
# 设备注册表（保持不变）
# =============================================

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


# =============================================
# 实验管理
# =============================================

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
    user_id: str | None = None  # 实验归属用户;None 表示旧实验/匿名(兼容过渡期)
    phase: ExperimentPhase = ExperimentPhase.CREATED
    progress: int = 0
    created_at: int = field(default_factory=lambda: int(time.time() * 1000))
    started_at: int | None = None
    completed_at: int | None = None
    result: dict[str, Any] | None = None


# 内存缓存（活跃实验）
_experiments: dict[str, Experiment] = {}
_exp_counter = 0


def create_experiment(
    material_id: str,
    params: dict[str, Any],
    mode: str = "simulation",
    user_id: str | None = None,
) -> Experiment:
    """创建新实验 — 内存 + 异步写库"""
    global _exp_counter
    _exp_counter += 1
    exp_id = f"exp-{time.strftime('%Y%m%d')}-{_exp_counter:03d}"
    exp = Experiment(id=exp_id, material_id=material_id, params=params, mode=mode, user_id=user_id)
    _experiments[exp_id] = exp

    # 异步写入数据库（不阻塞请求）
    asyncio.create_task(_db_save_experiment(exp))

    return exp


def get_experiment(exp_id: str) -> Experiment | None:
    return _experiments.get(exp_id)


def list_experiments() -> list[Experiment]:
    return list(_experiments.values())


# =============================================
# 数据库 write-through 层
# =============================================

async def _db_save_experiment(exp: Experiment) -> None:
    """将实验写入数据库"""
    try:
        from db.engine import get_session
        from db.models import Experiment as DBExperiment

        async for session in get_session():
            db_exp = DBExperiment(
                id=exp.id,
                user_id=exp.user_id,
                material_id=exp.material_id,
                mode=exp.mode,
                params=exp.params,
                phase=exp.phase.value,
                progress=exp.progress,
                created_at=datetime.fromtimestamp(exp.created_at / 1000, tz=timezone.utc),
            )
            session.add(db_exp)
            break
    except Exception as e:
        print(f"[DB] 写入实验失败: {e}")


async def db_update_experiment(exp: Experiment) -> None:
    """更新实验状态到数据库"""
    try:
        from db.engine import get_session
        from db.models import Experiment as DBExperiment
        from sqlalchemy import update

        async for session in get_session():
            values: dict[str, Any] = {
                "phase": exp.phase.value,
                "progress": exp.progress,
            }
            if exp.started_at:
                values["started_at"] = datetime.fromtimestamp(exp.started_at / 1000, tz=timezone.utc)
            if exp.completed_at:
                values["completed_at"] = datetime.fromtimestamp(exp.completed_at / 1000, tz=timezone.utc)
            if exp.result:
                values["result"] = exp.result

            await session.execute(
                update(DBExperiment).where(DBExperiment.id == exp.id).values(**values)
            )
            break
    except Exception as e:
        print(f"[DB] 更新实验失败: {e}")


async def save_monitor_snapshot(
    metrics: dict[str, float],
    safe: bool,
    warning: str | None = None,
    experiment_id: str | None = None,
) -> None:
    """保存监控快照到数据库（由 ws/monitor.py 批量调用）"""
    try:
        from db.engine import get_session
        from db.models import MonitorSnapshot

        async for session in get_session():
            snapshot = MonitorSnapshot(
                experiment_id=experiment_id,
                voltage=metrics.get("voltage"),
                current=metrics.get("current"),
                capacitance=metrics.get("capacitance"),
                temperature=metrics.get("temperature"),
                emi=metrics.get("emi"),
                safe=safe,
                warning=warning,
            )
            session.add(snapshot)
            break
    except Exception as e:
        print(f"[DB] 保存监控快照失败: {e}")


async def save_waveform_chunk(
    experiment_id: str,
    channel: str,
    samples: list[float],
    sample_rate_hz: int,
) -> None:
    """保存波形数据到数据库（由 ws/experiment.py 调用）"""
    try:
        from db.engine import get_session
        from db.models import WaveformData

        async for session in get_session():
            waveform = WaveformData(
                experiment_id=experiment_id,
                channel=channel,
                sample_rate_hz=sample_rate_hz,
                samples=samples,  # JSON 序列化浮点数组
            )
            session.add(waveform)
            break
    except Exception as e:
        print(f"[DB] 保存波形数据失败: {e}")


async def save_audit_log(
    action: str,
    target_type: str | None = None,
    target_id: str | None = None,
    details: dict | None = None,
    user_id: str | None = None,
    ip_address: str | None = None,
) -> None:
    """保存审计日志"""
    try:
        from db.engine import get_session
        from db.models import AuditLog

        async for session in get_session():
            log = AuditLog(
                user_id=user_id,
                action=action,
                target_type=target_type,
                target_id=target_id,
                details=details,
                ip_address=ip_address,
            )
            session.add(log)
            break
    except Exception as e:
        print(f"[DB] 保存审计日志失败: {e}")
