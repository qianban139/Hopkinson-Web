// src/pages/Register.tsx
// 注册页 — 开放自助注册,前端做基础校验,服务端兜底
import { useState, useMemo, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserPlus, Loader2, AlertCircle, Check, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/useAuthStore';

const USERNAME_RE = /^[A-Za-z0-9_]{4,20}$/;

function validatePassword(p: string): { ok: boolean; hasLetter: boolean; hasDigit: boolean; longEnough: boolean } {
  const hasLetter = /[A-Za-z]/.test(p);
  const hasDigit = /\d/.test(p);
  const longEnough = p.length >= 8;
  return { ok: hasLetter && hasDigit && longEnough, hasLetter, hasDigit, longEnough };
}

export default function Register() {
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const token = useAuthStore((s) => s.token);
  const hydrating = useAuthStore((s) => s.hydrating);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const usernameValid = useMemo(() => USERNAME_RE.test(username), [username]);
  const passwordCheck = useMemo(() => validatePassword(password), [password]);
  const passwordsMatch = password.length > 0 && password === confirm;
  const formValid = usernameValid && passwordCheck.ok && passwordsMatch;

  if (!hydrating && token) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!formValid) return;
    try {
      await register({
        username: username.trim(),
        password,
        email: email.trim() || undefined,
        display_name: displayName.trim() || undefined,
      });
      navigate('/', { replace: true });
    } catch {
      // error 由 store 显示
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-12 overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(6,182,212,0.15)_0%,_transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(59,130,246,0.1)_0%,_transparent_50%)]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md"
      >
        <div className="bg-slate-900/60 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-8 shadow-2xl shadow-cyan-500/10">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 mb-4 shadow-lg shadow-cyan-500/30">
              <UserPlus className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent">
              创建 Hopkinson 账号
            </h1>
            <p className="mt-2 text-sm text-slate-400">仅需数秒,即可开始虚拟实验</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-300">
                用户名 <span className="text-slate-500 text-xs">(4-20 字符,仅字母/数字/下划线)</span>
              </Label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="例如 alice_shpb"
                className="bg-slate-800/50 border-slate-700 text-slate-100 focus-visible:border-cyan-500"
              />
              {username && !usernameValid && (
                <p className="text-xs text-red-400">用户名必须是 4-20 位字母/数字/下划线</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">
                邮箱 <span className="text-slate-500 text-xs">(可选)</span>
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="bg-slate-800/50 border-slate-700 text-slate-100 focus-visible:border-cyan-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_name" className="text-slate-300">
                显示名 <span className="text-slate-500 text-xs">(可选)</span>
              </Label>
              <Input
                id="display_name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="留空则使用用户名"
                className="bg-slate-800/50 border-slate-700 text-slate-100 focus-visible:border-cyan-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">
                密码
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-800/50 border-slate-700 text-slate-100 focus-visible:border-cyan-500"
              />
              {password && (
                <ul className="text-xs space-y-1 pt-1">
                  <Rule ok={passwordCheck.longEnough}>至少 8 位</Rule>
                  <Rule ok={passwordCheck.hasLetter}>包含字母</Rule>
                  <Rule ok={passwordCheck.hasDigit}>包含数字</Rule>
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm" className="text-slate-300">
                确认密码
              </Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="bg-slate-800/50 border-slate-700 text-slate-100 focus-visible:border-cyan-500"
              />
              {confirm && !passwordsMatch && (
                <p className="text-xs text-red-400">两次密码不一致</p>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-300">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || !formValid}
              className="w-full h-11 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium shadow-lg shadow-cyan-500/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  注册中...
                </>
              ) : (
                '创建账号'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-400">
            已有账号?{' '}
            <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-medium">
              去登录
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Rule({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-2 ${ok ? 'text-emerald-400' : 'text-slate-500'}`}>
      {ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
      {children}
    </li>
  );
}
