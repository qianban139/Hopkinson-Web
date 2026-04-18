// src/components/ProtectedRoute.tsx
// 路由守卫 — 未登录重定向到 /login;hydrate 中显示 Skeleton 避免 flash
import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

import { useAuthStore } from '@/store/useAuthStore';

interface Props {
  children: ReactNode;
  /** 需要管理员权限 */
  adminOnly?: boolean;
}

export default function ProtectedRoute({ children, adminOnly = false }: Props) {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const hydrating = useAuthStore((s) => s.hydrating);

  // 1. 首次加载仍在校验 token -> 显示 skeleton,不跳转
  if (hydrating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
          <p className="text-slate-400 text-sm">正在验证登录状态...</p>
        </div>
      </div>
    );
  }

  // 2. 没 token -> 跳登录,保留原路径便于登录后回跳
  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // 3. 管理员路由校验
  if (adminOnly && !user.is_admin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
