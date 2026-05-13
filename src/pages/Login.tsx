// src/pages/Login.tsx
// 登录页 — 科技蓝风格,用户名 + 密码,登录成功后回跳原路径
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogIn, Loader2, AlertCircle, UserCog, Eye } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/useAuthStore';

const JUDGE_PASSWORD = 'Judge@2026';
const JUDGE_USERS = ['judge1', 'judge2', 'judge3'] as const;
const DEMO_MODE_ENABLED = import.meta.env.VITE_DEMO_MODE === 'true';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const loginAsGuest = useAuthStore((s) => s.loginAsGuest);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const token = useAuthStore((s) => s.token);
  const hydrating = useAuthStore((s) => s.hydrating);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // 已登录 -> 踢到首页(或原路径)
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  if (!hydrating && token) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await login({ username: username.trim(), password });
      navigate(from, { replace: true });
    } catch {
      // error 已经在 store 里显示
    }
  }

  function fillJudge(user: string) {
    setUsername(user);
    setPassword(JUDGE_PASSWORD);
  }

  function handleGuestLogin() {
    loginAsGuest();
    navigate(from, { replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 overflow-hidden relative">
      {/* 背景光效 */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(6,182,212,0.15)_0%,_transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(59,130,246,0.1)_0%,_transparent_50%)]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md"
      >
        <div className="bg-slate-900/60 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-8 shadow-2xl shadow-cyan-500/10">
          {/* Logo + 标题 */}
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 mb-4 shadow-lg shadow-cyan-500/30">
              <LogIn className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent">
              欢迎回到 Hopkinson
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              数智化电磁驱动霍普金森杆测试系统
            </p>
          </div>

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-300">
                用户名
              </Label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                required
                minLength={4}
                maxLength={20}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="输入用户名"
                className="bg-slate-800/50 border-slate-700 text-slate-100 placeholder:text-slate-500 focus-visible:border-cyan-500 focus-visible:ring-cyan-500/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">
                密码
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 8 位"
                className="bg-slate-800/50 border-slate-700 text-slate-100 placeholder:text-slate-500 focus-visible:border-cyan-500 focus-visible:ring-cyan-500/20"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-300">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium shadow-lg shadow-cyan-500/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  登录中...
                </>
              ) : (
                <>登录</>
              )}
            </Button>
          </form>

          {/* 评委演示账号快捷填充 */}
          <div className="mt-6 pt-5 border-t border-slate-800">
            <div className="flex items-center gap-2 mb-3 text-xs text-slate-500">
              <UserCog className="w-3.5 h-3.5" />
              <span>评委演示账号(点击自动填充)</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {JUDGE_USERS.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => fillJudge(u)}
                  className="px-2 py-1.5 text-xs rounded-md bg-slate-800/60 border border-slate-700 text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300 transition-colors"
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* 游客离线演示模式(仅 VITE_DEMO_MODE=true 时显示) */}
          {DEMO_MODE_ENABLED && (
            <div className="mt-3">
              <button
                type="button"
                onClick={handleGuestLogin}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
              >
                <Eye className="w-3.5 h-3.5" />
                游客离线演示(无需后端)
              </button>
            </div>
          )}

          <div className="mt-6 text-center text-sm text-slate-400">
            还没有账号?{' '}
            <Link to="/register" className="text-cyan-400 hover:text-cyan-300 font-medium">
              立即注册
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
