"""
实时监控 WebSocket 通道 — /ws/monitor

每 100ms 推送一次设备监控指标（电压/电流/电容/温度/EMI）。
客户端可发 subscribe 消息选择感兴趣的指标子集。
"""
import asyncio
import json
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

import state

router = APIRouter()

PUSH_INTERVAL_MS = 100  # 100ms


@router.websocket("/ws/monitor")
async def monitor_ws(ws: WebSocket):
    """监控数据推送通道"""
    await ws.accept()

    subscribed_metrics: set[str] | None = None  # None = 全部推送

    async def _reader():
        """读取客户端订阅指令"""
        nonlocal subscribed_metrics
        try:
            while True:
                raw = await ws.receive_text()
                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                if msg.get("type") == "subscribe":
                    metrics = msg.get("metrics")
                    if isinstance(metrics, list) and metrics:
                        subscribed_metrics = set(metrics)
                    else:
                        subscribed_metrics = None
        except WebSocketDisconnect:
            pass

    reader_task = asyncio.create_task(_reader())

    try:
        while True:
            metrics = await state.daq.read_metrics()

            # 安全评估
            verdict = state.safety.evaluate_metrics(metrics)

            # 按订阅过滤
            if subscribed_metrics:
                metrics = {k: v for k, v in metrics.items() if k in subscribed_metrics}

            payload = {
                "type": "monitor",
                "timestamp": int(time.time() * 1000),
                "data": metrics,
                "safe": verdict.safe,
            }
            if not verdict.safe:
                payload["warning"] = verdict.reason

            await ws.send_json(payload)
            await asyncio.sleep(PUSH_INTERVAL_MS / 1000.0)
    except WebSocketDisconnect:
        pass
    finally:
        reader_task.cancel()
