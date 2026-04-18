// src/store/useAuthStore.ts
// 认证状态 — Zustand 第 4 个 store
//
// 设计:
//   - token 持久化到 localStorage(httpClient 同 key 读取)
//   - 启动时 hydrate: 若有 token 则调用 /api/auth/me 恢复用户
//   - 监听全局 AUTH_UNAUTHORIZED_EVENT,收到即 logout()
//   - hydrating 状态供 ProtectedRoute 避免 flash 到 /login

import { create } from 'zustand';
import {
  AUTH_TOKEN_KEY,
  AUTH_UNAUTHORIZED_EVENT,
  ApiError,
} from '@/services/api/httpClient';
import {
  login as apiLogin,
  register as apiRegister,
  getMe,
  type LoginBody,
  type RegisterBody,
  type UserInfo,
} from '@/services/api/authClient';

interface AuthState {
  user: UserInfo | null;
  token: string | null;
  /** 首次加载中(从 localStorage 恢复 + /me 校验) */
  hydrating: boolean;
  /** 登录/注册/刷新中 */
  loading: boolean;
  error: string | null;

  login: (body: LoginBody) => Promise<void>;
  register: (body: RegisterBody) => Promise<void>;
  logout: () => void;
  hydrate: () => Promise<void>;
  clearError: () => void;
}

function persistToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  hydrating: true,
  loading: false,
  error: null,

  async login(body) {
    set({ loading: true, error: null });
    try {
      const res = await apiLogin(body);
      persistToken(res.access_token);
      set({ user: res.user, token: res.access_token, loading: false });
    } catch (e) {
      const msg = e instanceof ApiError ? e.body || e.message : (e as Error).message;
      set({ loading: false, error: msg });
      throw e;
    }
  },

  async register(body) {
    set({ loading: true, error: null });
    try {
      const res = await apiRegister(body);
      persistToken(res.access_token);
      set({ user: res.user, token: res.access_token, loading: false });
    } catch (e) {
      const msg = e instanceof ApiError ? e.body || e.message : (e as Error).message;
      set({ loading: false, error: msg });
      throw e;
    }
  },

  logout() {
    persistToken(null);
    set({ user: null, token: null, error: null });
  },

  async hydrate() {
    if (typeof window === 'undefined') {
      set({ hydrating: false });
      return;
    }
    const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      set({ hydrating: false });
      return;
    }
    // 有 token 先乐观设上,httpClient 才能在 /me 请求里带上
    set({ token });
    try {
      const user = await getMe();
      set({ user, hydrating: false });
    } catch {
      // token 失效 — 清理
      persistToken(null);
      set({ user: null, token: null, hydrating: false });
    }
  },

  clearError() {
    set({ error: null });
  },
}));

// ─── 初始化: 挂监听 + 执行 hydrate ─────────────────
// 仅在浏览器环境下运行(SSR 安全)
if (typeof window !== 'undefined') {
  window.addEventListener(AUTH_UNAUTHORIZED_EVENT, () => {
    useAuthStore.getState().logout();
  });
  // hydrate 异步进行,ProtectedRoute 读 hydrating 显示 Skeleton
  useAuthStore.getState().hydrate();
}
