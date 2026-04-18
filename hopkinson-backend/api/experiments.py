"""
实验管理 REST API — CRUD + 启动/暂停/紧急停止

所有写操作与查看操作都要求登录;归属权由 _assert_owner 统一校验:
  - 非 admin 用户只能访问自己创建的实验
  - admin 可以访问任何实验
  - 旧实验(user_id=None,兼容过渡期)只有 admin 能访问
"""
import asyncio
import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import state
from api.auth import require_current_user
from db.models import User
from state import ExperimentPhase

router = APIRouter(prefix="/api/experiments", tags=["experiments"])


# ─── 请求体模型 ───

class CreateExperimentBody(BaseModel):
    materialId: str
    params: dict = {}
    mode: str = "simulation"  # 'real' | 'simulation'


# ─── 辅助 ───

def _exp_to_dict(exp: state.Experiment) -> dict:
    return {
        "experimentId": exp.id,
        "materialId": exp.material_id,
        "params": exp.params,
        "mode": exp.mode,
        "phase": exp.phase.value,
        "progress": exp.progress,
        "createdAt": exp.created_at,
        "startedAt": exp.started_at,
        "completedAt": exp.completed_at,
        "result": exp.result,
    }


def _get_or_404(exp_id: str) -> state.Experiment:
    exp = state.get_experiment(exp_id)
    if not exp:
        raise HTTPException(404, f"实验 {exp_id} 不存在")
    return exp


def _assert_owner(exp: state.Experiment, user: User) -> None:
    """归属权校验;非 admin 只能访问自己的实验。"""
    if user.is_admin:
        return
    if exp.user_id is None or exp.user_id != user.id:
        raise HTTPException(403, "无权访问此实验")


# ─── 接口 ───

@router.post("")
async def create_experiment(
    body: CreateExperimentBody,
    user: User = Depends(require_current_user),
):
    """创建新实验"""
    # 安全检查
    verdict = state.safety.evaluate_params(body.params)
    if not verdict.safe:
        raise HTTPException(400, verdict.reason)
    exp = state.create_experiment(body.materialId, body.params, body.mode, user_id=user.id)
    return {"experimentId": exp.id, "status": "created"}


@router.get("/{exp_id}")
async def get_experiment(exp_id: str, user: User = Depends(require_current_user)):
    """获取实验详情"""
    exp = _get_or_404(exp_id)
    _assert_owner(exp, user)
    return _exp_to_dict(exp)


@router.post("/{exp_id}/start")
async def start_experiment(exp_id: str, user: User = Depends(require_current_user)):
    """启动实验"""
    exp = _get_or_404(exp_id)
    _assert_owner(exp, user)
    if exp.phase not in (ExperimentPhase.CREATED, ExperimentPhase.PAUSED):
        raise HTTPException(400, f"当前阶段 {exp.phase.value} 不允许启动")

    # 安全二次确认
    verdict = state.safety.evaluate_params(exp.params)
    if not verdict.safe:
        raise HTTPException(400, f"安全检查未通过: {verdict.reason}")

    # 通知 DAQ 开始采集
    await state.daq.execute_command("start_experiment", exp.params)
    # 通知电磁驱动器充电 + 触发
    await state.em_driver.execute_command("set_voltage", {"voltage": exp.params.get("voltage", 2500)})
    await state.em_driver.execute_command("charge", {})

    exp.phase = ExperimentPhase.EXECUTION
    exp.progress = 0
    exp.started_at = int(time.time() * 1000)

    # 同步到数据库 + 审计日志
    asyncio.create_task(state.db_update_experiment(exp))
    asyncio.create_task(state.save_audit_log(
        action="experiment.start", target_type="experiment", target_id=exp.id,
        details={"mode": exp.mode, "material": exp.material_id},
        user_id=user.id,
    ))

    # 后台模拟进度推进（仅模拟模式下使用简化流程）
    if exp.mode == "simulation":
        asyncio.create_task(_simulate_progress(exp))

    return {"experimentId": exp.id, "status": "started"}


@router.post("/{exp_id}/pause")
async def pause_experiment(exp_id: str, user: User = Depends(require_current_user)):
    """暂停实验"""
    exp = _get_or_404(exp_id)
    _assert_owner(exp, user)
    if exp.phase != ExperimentPhase.EXECUTION:
        raise HTTPException(400, "只能在执行阶段暂停")
    exp.phase = ExperimentPhase.PAUSED
    await state.daq.execute_command("stop_experiment", {})
    return {"experimentId": exp.id, "status": "paused"}


@router.post("/{exp_id}/emergency-stop")
async def emergency_stop(exp_id: str, user: User = Depends(require_current_user)):
    """紧急停机 — 立即停止所有设备"""
    exp = _get_or_404(exp_id)
    _assert_owner(exp, user)
    exp.phase = ExperimentPhase.ABORTED
    exp.completed_at = int(time.time() * 1000)

    # 紧急放电 + 停采
    await state.em_driver.execute_command("discharge", {})
    await state.daq.execute_command("stop_experiment", {})

    # 同步到数据库 + 审计日志
    asyncio.create_task(state.db_update_experiment(exp))
    asyncio.create_task(state.save_audit_log(
        action="experiment.emergency_stop", target_type="experiment", target_id=exp.id,
        user_id=user.id,
    ))

    return {"experimentId": exp.id, "status": "aborted", "message": "紧急停机已执行"}


@router.get("/{exp_id}/result")
async def get_result(exp_id: str, user: User = Depends(require_current_user)):
    """获取实验结果"""
    exp = _get_or_404(exp_id)
    _assert_owner(exp, user)
    if exp.phase != ExperimentPhase.COMPLETED:
        raise HTTPException(400, f"实验尚未完成（当前: {exp.phase.value}）")
    return {"experimentId": exp.id, "result": exp.result}


# ─── 内部: 模拟进度推进 ───

async def _simulate_progress(exp: state.Experiment):
    """模拟实验 10 秒内完成，按阶段推进"""
    stages = [
        ("launch", 0, 20),
        ("wave_propagation", 20, 50),
        ("data_collection", 50, 80),
        ("post_processing", 80, 100),
    ]
    for step_name, start_pct, end_pct in stages:
        if exp.phase != ExperimentPhase.EXECUTION:
            return  # 被暂停或紧急停止
        for pct in range(start_pct, end_pct + 1, 5):
            if exp.phase != ExperimentPhase.EXECUTION:
                return
            exp.progress = pct
            await asyncio.sleep(0.25)

    # 生成模拟实验结果
    v = float(exp.params.get("voltage", 2500))
    exp.result = {
        "peakStress_mpa": round(v * 0.025 * 1000 + 80, 1),
        "maxStrainRate": round(v * 0.8 + 400, 0),
        "absorbedEnergy_j": round(v * 0.003 * 1000, 1),
        "equilibrium_ratio": round(0.92 + (v % 100) * 0.0001, 4),
        "waveformSamples": 200,
    }
    exp.phase = ExperimentPhase.COMPLETED
    exp.completed_at = int(time.time() * 1000)

    # 同步最终状态到数据库
    asyncio.create_task(state.db_update_experiment(exp))

    # 停止 DAQ 采集
    await state.daq.execute_command("stop_experiment", {})
    await state.em_driver.execute_command("discharge", {})
