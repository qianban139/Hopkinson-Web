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
  /** 是否为离线游客模式(后端不可达时降级) */
  isGuest: boolean;

  login: (body: LoginBody) => Promise<void>;
  register: (body: RegisterBody) => Promise<void>;
  /** 进入游客演示模式(无后端时使用,数据仅存于 localStorage) */
  loginAsGuest: () => void;
  logout: () => void;
  hydrate: () => Promise<void>;
  clearError: () => void;
}

/** 后端不可达的网络错误判定:fetch 抛 TypeError 或 ApiError(无 status) */
function isBackendUnreachable(err: unknown): boolean {
  if (err instanceof TypeError) return true; // fetch 网络错误
  if (err instanceof ApiError && (err.status === 0 || err.status >= 500)) return true;
  return false;
}

const GUEST_TOKEN_PREFIX = 'guest_demo_';

function persistToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  hydrating: true,
  loading: false,
  error: null,
  isGuest: false,

  async login(body) {
    set({ loading: true, error: null });
    try {
      const res = await apiLogin(body);
      persistToken(res.access_token);
      set({ user: res.user, token: res.access_token, loading: false, isGuest: false });
    } catch (e) {
      const msg = e instanceof ApiError ? e.body || e.message : (e as Error).message;
      // 后端不可达时:若开启 VITE_DEMO_MODE 自动降级为游客,否则抛错
      if (import.meta.env.VITE_DEMO_MODE === 'true' && isBackendUnreachable(e)) {
        get().loginAsGuest();
        return;
      }
      set({ loading: false, error: msg });
      throw e;
    }
  },

  async register(body) {
    set({ loading: true, error: null });
    try {
      const res = await apiRegister(body);
      persistToken(res.access_token);
      set({ user: res.user, token: res.access_token, loading: false, isGuest: false });
    } catch (e) {
      const msg = e instanceof ApiError ? e.body || e.message : (e as Error).message;
      set({ loading: false, error: msg });
      throw e;
    }
  },

  loginAsGuest() {
    // 离线演示模式:不联后端,所有数据仅存于 localStorage
    const guestToken = `${GUEST_TOKEN_PREFIX}${Date.now()}`;
    const guestUser: UserInfo = {
      id: 'guest',
      username: 'visitor',
      email: null,
      display_name: '演示访客',
      is_admin: false,
      created_at: new Date().toISOString(),
    } as UserInfo;
    persistToken(guestToken);
    set({
      user: guestUser,
      token: guestToken,
      loading: false,
      error: null,
      isGuest: true,
    });
  },

  logout() {
    persistToken(null);
    set({ user: null, token: null, error: null, isGuest: false });
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
    // 游客 token 不需要走后端 /me 校验
    if (token.startsWith(GUEST_TOKEN_PREFIX)) {
      get().loginAsGuest();
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
