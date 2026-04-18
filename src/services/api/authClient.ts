// src/services/api/authClient.ts
// 认证 REST API 客户端 — 登录/注册/刷新/me

import { request } from './httpClient';

export interface UserInfo {
  id: string;
  username: string;
  email: string | null;
  display_name: string | null;
  is_admin: boolean;
  created_at: string | null;
}

export interface LoginBody {
  username: string;
  password: string;
}

export interface RegisterBody {
  username: string;
  password: string;
  email?: string;
  display_name?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: UserInfo;
}

/** 登录 — 不带 Authorization(尚未登录) */
export async function login(body: LoginBody): Promise<TokenResponse> {
  return request<TokenResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    skipAuth: true,
  });
}

/** 注册 — 不带 Authorization */
export async function register(body: RegisterBody): Promise<TokenResponse> {
  return request<TokenResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
    skipAuth: true,
  });
}

/** 刷新 token — 需要当前 token */
export async function refreshToken(): Promise<TokenResponse> {
  return request<TokenResponse>('/api/auth/refresh', { method: 'POST' });
}

/** 获取当前用户信息 */
export async function getMe(): Promise<UserInfo> {
  return request<UserInfo>('/api/auth/me');
}
