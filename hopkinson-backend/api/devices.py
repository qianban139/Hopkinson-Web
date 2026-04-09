"""
设备管理 REST API — GET /api/devices, POST /api/devices/{id}/health-check
"""
from fastapi import APIRouter, HTTPException

import state

router = APIRouter(prefix="/api/devices", tags=["devices"])


@router.get("")
async def list_devices():
    """列出所有已注册设备"""
    devices = state.get_all_devices()
    return {
        "devices": [
            {
                "id": d.id,
                "name": d.name,
                "type": d.type,
                "status": d.status.value,
                "lastHeartbeat": d.last_heartbeat,
                "metadata": d.metadata,
            }
            for d in devices
        ]
    }


@router.get("/{device_id}")
async def get_device(device_id: str):
    """获取单个设备详情"""
    dev = state.get_device(device_id)
    if not dev:
        raise HTTPException(404, f"设备 {device_id} 不存在")
    info = dev.get_info()
    return {
        "id": info.id,
        "name": info.name,
        "type": info.type,
        "status": info.status.value,
        "lastHeartbeat": info.last_heartbeat,
        "metadata": info.metadata,
    }


@router.post("/{device_id}/health-check")
async def health_check(device_id: str):
    """主动触发设备健康检查"""
    dev = state.get_device(device_id)
    if not dev:
        raise HTTPException(404, f"设备 {device_id} 不存在")
    result = await dev.health_check()
    return {"deviceId": device_id, "healthCheck": result}
