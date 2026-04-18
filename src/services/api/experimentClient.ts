// src/services/api/experimentClient.ts
// 实验管理 REST API 客户端 — 统一走 httpClient,自动携带 Bearer token

import { request } from './httpClient';
import type { CreateExperimentBody, ExperimentDetail, ExperimentResult } from './types';

const API_PREFIX = '/api/experiments';

/** 创建新实验 */
export async function createExperiment(body: CreateExperimentBody): Promise<{ experimentId: string }> {
  return request<{ experimentId: string }>(`${API_PREFIX}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** 获取实验详情 */
export async function getExperiment(expId: string): Promise<ExperimentDetail> {
  return request<ExperimentDetail>(`${API_PREFIX}/${expId}`);
}

/** 启动实验 */
export async function startExperiment(expId: string): Promise<{ status: string }> {
  return request<{ status: string }>(`${API_PREFIX}/${expId}/start`, { method: 'POST' });
}

/** 暂停实验 */
export async function pauseExperiment(expId: string): Promise<{ status: string }> {
  return request<{ status: string }>(`${API_PREFIX}/${expId}/pause`, { method: 'POST' });
}

/** 紧急停机 */
export async function emergencyStop(expId: string): Promise<{ status: string; message: string }> {
  return request<{ status: string; message: string }>(`${API_PREFIX}/${expId}/emergency-stop`, {
    method: 'POST',
  });
}

/** 获取实验结果 */
export async function getExperimentResult(expId: string): Promise<ExperimentResult> {
  const data = await request<{ result: ExperimentResult }>(`${API_PREFIX}/${expId}/result`);
  return data.result;
}
