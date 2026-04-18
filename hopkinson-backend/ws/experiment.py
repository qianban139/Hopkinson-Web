"""
实验执行 WebSocket 通道 — /ws/experiment/{experiment_id}?token=xxx

鉴权:
  - 必须携带 JWT token(query string),否则 close 4001/4002
  - 非实验所有者 + 非 admin: close 4003

推送内容:
  1. phase / progress 状态变更
  2. waveform 三波波形数据(实验执行阶段)

数据持久化:
  - 波形数据异步写入 waveform_data 表
  - 实验状态变更异步同步到 experiments 表
"""
import asyncio
import json
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

import state
from core.auth_deps import verify_ws_token, close_forbidden
from state import ExperimentPhase

router = APIRouter()

PUSH_INTERVAL_MS = 200  # 200ms 一帧波形


@router.websocket("/ws/experiment/{experiment_id}")
async def experiment_ws(ws: WebSocket, experiment_id: str):
    """实验实时数据通道"""
    await ws.accept()

    # 1. 鉴权
    user = await verify_ws_token(ws)
    if not user:
        return  # verify_ws_token 已关闭连接

    # 2. 实验存在性
    exp = state.get_experiment(experiment_id)
    if not exp:
        await ws.send_json({"type": "error", "message": f"实验 {experiment_id} 不存在"})
        await ws.close()
        return

    # 3. 归属权: 旧实验(user_id=None)只开放给 admin;否则必须是本人或 admin
    if not user.is_admin and (exp.user_id is None or exp.user_id != user.id):
        await close_forbidden(ws, "Not your experiment")
        return

    last_phase = None
    last_progress = -1

    async def _reader():
        """接收客户端控制命令"""
        try:
            while True:
                raw = await ws.receive_text()
                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                action = msg.get("action")
                if action == "pause":
                    exp.phase = ExperimentPhase.PAUSED
                    asyncio.create_task(state.db_update_experiment(exp))
                elif action == "resume" and exp.phase == ExperimentPhase.PAUSED:
                    exp.phase = ExperimentPhase.EXECUTION
                    asyncio.create_task(state.db_update_experiment(exp))
                elif action == "stop":
                    exp.phase = ExperimentPhase.ABORTED
                    exp.completed_at = int(time.time() * 1000)
                    asyncio.create_task(state.db_update_experiment(exp))
                    asyncio.create_task(state.save_audit_log(
                        action="experiment.abort",
                        target_type="experiment",
                        target_id=exp.id,
                    ))
        except WebSocketDisconnect:
            pass

    reader_task = asyncio.create_task(_reader())

    try:
        while True:
            # 1. 推送阶段/进度变更
            if exp.phase != last_phase or exp.progress != last_progress:
                last_phase = exp.phase
                last_progress = exp.progress
                await ws.send_json({
                    "type": "phase",
                    "phase": exp.phase.value,
                    "progress": exp.progress,
                    "timestamp": int(time.time() * 1000),
                })

            # 2. 实验执行中 -> 推送三波波形并持久化
            if exp.phase == ExperimentPhase.EXECUTION:
                for channel in ("incident", "reflected", "transmitted"):
                    samples = state.daq.generate_waveform_chunk(
                        channel, sample_count=200, sample_rate_hz=1_000_000,
                    )
                    await ws.send_json({
                        "type": "waveform",
                        "channel": channel,
                        "samples": samples,
                        "sampleRate": 1_000_000,
                        "timestamp": int(time.time() * 1000),
                    })

                    # 异步写入波形数据库
                    asyncio.create_task(
                        state.save_waveform_chunk(
                            experiment_id=exp.id,
                            channel=channel,
                            samples=samples,
                            sample_rate_hz=1_000_000,
                        )
                    )

            # 3. 终态 -> 推送最终结果、持久化、关闭
            if exp.phase in (
                ExperimentPhase.COMPLETED,
                ExperimentPhase.ABORTED,
                ExperimentPhase.ERROR,
            ):
                # 同步最终状态到数据库
                asyncio.create_task(state.db_update_experiment(exp))

                await ws.send_json({
                    "type": "finished",
                    "phase": exp.phase.value,
                    "result": exp.result,
                    "timestamp": int(time.time() * 1000),
                })
                break

            await asyncio.sleep(PUSH_INTERVAL_MS / 1000.0)
    except WebSocketDisconnect:
        pass
    finally:
        reader_task.cancel()
