"""
SQLAlchemy 2.0 ORM 模型 — 9 张表

对应方案中的数据库设计：
  users, materials, experiments, waveform_data,
  monitor_snapshots, devices, reports, ai_operation_logs, audit_logs
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    BigInteger,
    DateTime,
    Float,
    Integer,
    SmallInteger,
    String,
    Text,
    ForeignKey,
    Index,
    func,
)
from sqlalchemy.dialects.postgresql import INET
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.types import JSON


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    """所有模型的基类"""
    pass


# ═══════════════════════════════════════════════
# 1. users — 用户表
# ═══════════════════════════════════════════════

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String(100), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    display_name: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # 关联
    experiments: Mapped[list["Experiment"]] = relationship(back_populates="user")
    reports: Mapped[list["Report"]] = relationship(back_populates="user")


# ═══════════════════════════════════════════════
# 2. materials — 材料数据库
# ═══════════════════════════════════════════════

class Material(Base):
    __tablename__ = "materials"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # "metal-01" 格式
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    sub_category: Mapped[str | None] = mapped_column(String(20))
    johnson_cook: Mapped[dict] = mapped_column(JSON, nullable=False)   # {A, B, C, n, m, Tm}
    physical_props: Mapped[dict] = mapped_column(JSON, nullable=False)  # {density, elasticModulus, ...}
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSON)   # 描述、应用等
    created_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"))
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=_utcnow)

    # 关联
    experiments: Mapped[list["Experiment"]] = relationship(back_populates="material")


# ═══════════════════════════════════════════════
# 3. experiments — 实验记录
# ═══════════════════════════════════════════════

class Experiment(Base):
    __tablename__ = "experiments"

    id: Mapped[str] = mapped_column(String(30), primary_key=True)  # "exp-20260408-001"
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"))
    material_id: Mapped[str | None] = mapped_column(String(20), ForeignKey("materials.id"))
    mode: Mapped[str] = mapped_column(String(20), nullable=False)  # 'real' | 'simulation'
    params: Mapped[dict] = mapped_column(JSON, nullable=False)
    phase: Mapped[str] = mapped_column(String(20), nullable=False, default="created")
    progress: Mapped[int] = mapped_column(SmallInteger, default=0)
    result: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # 关联
    user: Mapped["User | None"] = relationship(back_populates="experiments")
    material: Mapped["Material | None"] = relationship(back_populates="experiments")
    waveforms: Mapped[list["WaveformData"]] = relationship(back_populates="experiment")
    reports: Mapped[list["Report"]] = relationship(back_populates="experiment")


# ═══════════════════════════════════════════════
# 4. waveform_data — 波形数据
# ═══════════════════════════════════════════════

class WaveformData(Base):
    __tablename__ = "waveform_data"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    experiment_id: Mapped[str] = mapped_column(String(30), ForeignKey("experiments.id"), nullable=False)
    channel: Mapped[str] = mapped_column(String(20), nullable=False)  # incident/reflected/transmitted
    sample_rate_hz: Mapped[int] = mapped_column(Integer, nullable=False)
    samples: Mapped[dict] = mapped_column(JSON, nullable=False)  # 用 JSON 存浮点数组（兼容 SQLite）
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)

    # 关联
    experiment: Mapped["Experiment"] = relationship(back_populates="waveforms")

    __table_args__ = (
        Index("ix_waveform_exp_channel_ts", "experiment_id", "channel", "timestamp"),
    )


# ═══════════════════════════════════════════════
# 5. monitor_snapshots — 监控快照
# ═══════════════════════════════════════════════

class MonitorSnapshot(Base):
    __tablename__ = "monitor_snapshots"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    experiment_id: Mapped[str | None] = mapped_column(String(30), ForeignKey("experiments.id"))
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)
    voltage: Mapped[float | None] = mapped_column(Float)
    current: Mapped[float | None] = mapped_column(Float)
    capacitance: Mapped[float | None] = mapped_column(Float)
    temperature: Mapped[float | None] = mapped_column(Float)
    emi: Mapped[float | None] = mapped_column(Float)
    safe: Mapped[bool | None] = mapped_column(Boolean)
    warning: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        Index("ix_monitor_ts_desc", "timestamp"),
        Index("ix_monitor_exp_ts", "experiment_id", "timestamp"),
    )


# ═══════════════════════════════════════════════
# 6. devices — 设备表
# ═══════════════════════════════════════════════

class Device(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String(30), primary_key=True)
    name: Mapped[str | None] = mapped_column(String(100))
    type: Mapped[str | None] = mapped_column(String(20))  # daq/em-driver/sensor
    status: Mapped[str | None] = mapped_column(String(20))
    last_heartbeat: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSON)
    calibration_due: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


# ═══════════════════════════════════════════════
# 7. reports — 实验报告
# ═══════════════════════════════════════════════

class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    experiment_id: Mapped[str | None] = mapped_column(String(30), ForeignKey("experiments.id"))
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"))
    title: Mapped[str | None] = mapped_column(String(200))
    report_type: Mapped[str | None] = mapped_column(String(20))  # summary/record/research/paper
    content: Mapped[str | None] = mapped_column(Text)  # Markdown
    format: Mapped[str | None] = mapped_column(String(10))  # pdf/docx/latex/md
    file_path: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    # 关联
    experiment: Mapped["Experiment | None"] = relationship(back_populates="reports")
    user: Mapped["User | None"] = relationship(back_populates="reports")


# ═══════════════════════════════════════════════
# 8. ai_operation_logs — AI 操作日志
# ═══════════════════════════════════════════════

class AIOperationLog(Base):
    __tablename__ = "ai_operation_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"))
    experiment_id: Mapped[str | None] = mapped_column(String(30), ForeignKey("experiments.id"))
    operation: Mapped[str] = mapped_column(String(50), nullable=False)  # llm_call/optimization/report_gen
    model: Mapped[str | None] = mapped_column(String(50))
    tokens_in: Mapped[int | None] = mapped_column(Integer)
    tokens_out: Mapped[int | None] = mapped_column(Integer)
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    request_summary: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


# ═══════════════════════════════════════════════
# 9. audit_logs — 审计日志
# ═══════════════════════════════════════════════

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(50), nullable=False)  # experiment.start/emergency_stop/...
    target_type: Mapped[str | None] = mapped_column(String(30))
    target_id: Mapped[str | None] = mapped_column(String(50))
    details: Mapped[dict | None] = mapped_column(JSON)
    ip_address: Mapped[str | None] = mapped_column(String(45))  # 兼容 IPv6，SQLite 不支持 INET
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    __table_args__ = (
        Index("ix_audit_created_desc", "created_at"),
    )
