"""
实验执行 WebSocket 通道 — /ws/experiment/{experiment_id}

推送内容：
  1. phase / progress 状态变更
  2. waveform 三波波形数据（实验执行阶段）
"""
import asyncio
import json
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

import state
from state import ExperimentPhase

router = APIRouter()

PUSH_INTERVAL_MS = 200  # 200ms 一帧波形


@router.websocket("/ws/experiment/{experiment_id}")
async def experiment_ws(ws: WebSocket, experiment_id: str):
    """实验实时数据通道"""
    await ws.accept()

    exp = state.get_experiment(experiment_id)
    if not exp:
        await ws.send_json({"type": "error", "message": f"实验 {experiment_id} 不存在"})
        await ws.close()
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
                elif action == "resume" and exp.phase == ExperimentPhase.PAUSED:
                    exp.phase = ExperimentPhase.EXECUTION
                elif action == "stop":
                    exp.phase = ExperimentPhase.ABORTED
                    exp.completed_at = int(time.time() * 1000)
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

            # 2. 实验执行中 → 推送三波波形
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

            # 3. 终态 → 推送最终结果并关闭
            if exp.phase in (
                ExperimentPhase.COMPLETED,
                ExperimentPhase.ABORTED,
                ExperimentPhase.ERROR,
            ):
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
