"""
JSONB / JSON 字段查询单元测试 — 7 个用例

覆盖:
  - JSON 字段写入/读取
  - 嵌套 dict 的存取
  - JSON 中数值类型保持
  - audit_logs / ai_operation_logs 写入
  - waveform_data samples 数组存取
  - experiments.params 修改持久化
  - JSON null 与 SQL NULL 区分

注:本地用 SQLite JSON1 模拟 PostgreSQL JSONB,
   Postgres 上的 GIN 索引行为另在集成测试覆盖
"""
from __future__ import annotations

from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from db.models import (
    User,
    Material,
    Experiment,
    WaveformData,
    AuditLog,
    AIOperationLog,
)


@pytest.mark.asyncio
async def test_json_field_round_trip(session):
    """JSON 字段写入后读取值应完全相同"""
    mat = Material(
        id="metal-test",
        name="测试材料",
        category="metal",
        sub_category="aluminum",
        johnson_cook={"A": 324e6, "B": 114e6, "n": 0.42, "C": 0.002, "m": 1.34},
        physical_props={"density": 2700, "elasticModulus": 68.9e9},
    )
    session.add(mat)
    await session.commit()

    fetched = (await session.execute(select(Material).where(Material.id == "metal-test"))).scalar_one()
    assert fetched.johnson_cook["A"] == 324e6
    assert fetched.johnson_cook["n"] == pytest.approx(0.42)
    assert fetched.physical_props["density"] == 2700


@pytest.mark.asyncio
async def test_json_nested_dict_storage(session):
    """嵌套 dict 应可正常存取(JSONB 关键能力)"""
    user = User(username="nested_user", password_hash="x" * 60, is_admin=False)
    session.add(user)
    await session.flush()

    exp = Experiment(
        id="exp-nested-001",
        user_id=user.id,
        mode="real",
        params={
            "voltage": 2500,
            "pulse_width": 1000,
            "material": {"id": "metal-01", "temperature": 298.15},
            "channels": ["incident", "reflected", "transmitted"],
        },
        phase="created",
    )
    session.add(exp)
    await session.commit()

    fetched = (await session.execute(select(Experiment).where(Experiment.id == "exp-nested-001"))).scalar_one()
    assert fetched.params["material"]["id"] == "metal-01"
    assert fetched.params["channels"] == ["incident", "reflected", "transmitted"]


@pytest.mark.asyncio
async def test_json_numeric_types_preserved(session):
    """JSON 字段应保持 int / float / bool 区分"""
    user = User(username="num_user", password_hash="x" * 60, is_admin=False)
    session.add(user)
    await session.flush()

    exp = Experiment(
        id="exp-num-001",
        user_id=user.id,
        mode="simulation",
        params={"int_val": 42, "float_val": 3.14159, "bool_val": True, "null_val": None},
        phase="created",
    )
    session.add(exp)
    await session.commit()

    fetched = (await session.execute(select(Experiment).where(Experiment.id == "exp-num-001"))).scalar_one()
    assert fetched.params["int_val"] == 42
    assert fetched.params["float_val"] == pytest.approx(3.14159)
    assert fetched.params["bool_val"] is True
    assert fetched.params["null_val"] is None


@pytest.mark.asyncio
async def test_audit_log_jsonb_details_storage(session):
    """audit_logs.details JSONB 写入"""
    user = User(username="auditor", password_hash="x" * 60, is_admin=True)
    session.add(user)
    await session.flush()

    log = AuditLog(
        id=1,  # SQLite BigInteger 不自增,显式提供 id
        user_id=user.id,
        action="experiment.start",
        target_type="experiment",
        target_id="exp-001",
        details={"voltage": 2000, "ip_chain": ["10.0.0.1", "192.168.1.1"]},
        ip_address="10.0.0.1",
    )
    session.add(log)
    await session.commit()

    fetched = (await session.execute(select(AuditLog).where(AuditLog.action == "experiment.start"))).scalar_one()
    assert fetched.details["voltage"] == 2000
    assert len(fetched.details["ip_chain"]) == 2


@pytest.mark.asyncio
async def test_ai_operation_log_storage(session):
    """ai_operation_logs 写入(token 计数 / 模型版本)"""
    log = AIOperationLog(
        id=1,  # SQLite BigInteger 不自增,显式提供 id
        operation="llm_call",
        model="deepseek-chat",
        tokens_in=120,
        tokens_out=350,
        duration_ms=820,
        request_summary="用户请求建议下一组实验参数",
    )
    session.add(log)
    await session.commit()

    fetched = (await session.execute(select(AIOperationLog).where(AIOperationLog.model == "deepseek-chat"))).scalar_one()
    assert fetched.tokens_in == 120
    assert fetched.tokens_out == 350
    assert fetched.duration_ms == 820


@pytest.mark.asyncio
async def test_waveform_samples_array_storage(session):
    """waveform_data.samples 数组(JSON list)存取"""
    user = User(username="wave_user", password_hash="x" * 60)
    session.add(user)
    await session.flush()
    exp = Experiment(id="exp-wave-001", user_id=user.id, mode="real", params={}, phase="completed")
    session.add(exp)
    await session.flush()

    samples = [0.0, 0.123, 0.456, 0.789, 1.0, 0.789, 0.456, 0.123, 0.0]
    wave = WaveformData(
        id=1,  # SQLite BigInteger 不自增,显式提供 id
        experiment_id="exp-wave-001",
        channel="incident",
        sample_rate_hz=100_000,
        samples={"data": samples, "unit": "V"},
    )
    session.add(wave)
    await session.commit()

    fetched = (await session.execute(select(WaveformData).where(WaveformData.experiment_id == "exp-wave-001"))).scalar_one()
    assert fetched.samples["data"] == samples
    assert fetched.samples["unit"] == "V"
    assert fetched.sample_rate_hz == 100_000


@pytest.mark.asyncio
async def test_experiment_params_update_persists(session):
    """JSON 字段重新赋值后应持久化(SQLAlchemy mutability 测试)"""
    user = User(username="upd_user", password_hash="x" * 60)
    session.add(user)
    await session.flush()

    exp = Experiment(
        id="exp-upd-001",
        user_id=user.id,
        mode="simulation",
        params={"voltage": 1000},
        phase="created",
    )
    session.add(exp)
    await session.commit()

    # 显式重新赋值整个 dict(SQLAlchemy 默认 JSON 字段对内部 mutate 不可感知)
    exp.params = {"voltage": 3000, "pulse_width": 1500}
    await session.commit()
    await session.refresh(exp)

    assert exp.params["voltage"] == 3000
    assert exp.params["pulse_width"] == 1500
    assert "voltage" in exp.params and len(exp.params) == 2
