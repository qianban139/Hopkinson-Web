// src/services/api/httpClient.ts
// 统一 HTTP 客户端 — 自动携带 Authorization: Bearer，401 触发登出

import { getBaseUrl } from './config';

/** localStorage 中存 JWT 的 key;Auth Store 必须用同一个 key 写入 */
export const AUTH_TOKEN_KEY = 'hop.auth.token';

/**
 * 未授权事件 — Auth Store 应监听此事件并执行 logout()
 * 任何 API 返回 401 时派发,集中在 Store 层处理清理逻辑
 */
export const AUTH_UNAUTHORIZED_EVENT = 'auth:unauthorized';

/** 从 localStorage 读取当前 token */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

/** API 错误带 HTTP 状态码,便于上层区分 401/403/500 */
export class ApiError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string, message?: string) {
    super(message ?? `API ${status}: ${body}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export interface RequestOptions extends RequestInit {
  /** 跳过自动附加 Authorization(用于 /auth/login 等未登录接口) */
  skipAuth?: boolean;
}

/**
 * 统一 fetch 包装
 *
 * 功能:
 *   1. 自动拼接 baseUrl
 *   2. 默认 Content-Type: application/json
 *   3. 自动注入 Authorization: Bearer <token>(除非 skipAuth)
 *   4. 401 派发 AUTH_UNAUTHORIZED_EVENT,抛 ApiError
 *   5. 非 2xx 抛 ApiError 保留 status 与原始 body
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth, headers, ...rest } = options;

  const merged: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string> | undefined),
  };

  if (!skipAuth) {
    const token = getAuthToken();
    if (token) {
      merged['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${getBaseUrl()}${path}`, {
    ...rest,
    headers: merged,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT));
    }
    throw new ApiError(res.status, body);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}
