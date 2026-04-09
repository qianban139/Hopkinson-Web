// src/services/api/deviceClient.ts
// 设备管理 REST API 客户端

import { getBaseUrl } from './config';
import type { DeviceInfo } from './types';

const API_PREFIX = '/api/devices';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

/** 获取所有设备列表 */
export async function listDevices(): Promise<DeviceInfo[]> {
  const data = await request<{ devices: DeviceInfo[] }>(API_PREFIX);
  return data.devices;
}

/** 获取单个设备详情 */
export async function getDevice(deviceId: string): Promise<DeviceInfo> {
  return request<DeviceInfo>(`${API_PREFIX}/${deviceId}`);
}

/** 触发设备健康检查 */
export async function healthCheckDevice(deviceId: string): Promise<Record<string, unknown>> {
  const data = await request<{ deviceId: string; healthCheck: Record<string, unknown> }>(
    `${API_PREFIX}/${deviceId}/health-check`,
    { method: 'POST' },
  );
  return data.healthCheck;
}
