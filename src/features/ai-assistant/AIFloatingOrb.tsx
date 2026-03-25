// src/features/ai-assistant/AIFloatingOrb.tsx
// AI悬浮球 - 增大72px + 旋转光环 + idle呼吸脉冲 + "小智"标签
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Brain, Loader2, Volume2, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { OrbState } from './types';

interface AIFloatingOrbProps {
  orbState: OrbState;
  onTogglePanel: () => void;
  isPanelOpen: boolean;
  onPushToTalkStart?: () => void;
  onPushToTalkEnd?: () => void;
  isPushToTalk?: boolean;
}

export default function AIFloatingOrb({ orbState, onTogglePanel, isPanelOpen, onPushToTalkStart, onPushToTalkEnd, isPushToTalk }: AIFloatingOrbProps) {
  // 使用 left/top 绝对定位，避免 right/bottom 坐标系导致的方向反转
  const [position, setPosition] = useState(() => {
    const defaultPos = { left: typeof window !== 'undefined' ? window.innerWidth - 96 : 800, top: typeof window !== 'undefined' ? window.innerHeight - 104 : 600 };
    const saved = localStorage.getItem('ai-orb-position');
    if (saved) {
      try {
        const p = JSON.parse(saved);
        // 兼容旧格式 { x, y } 和新格式 { left, top }，且验证值合理
        const left = p.left ?? p.x ?? defaultPos.left;
        const top = p.top ?? p.y ?? defaultPos.top;
        if (typeof left === 'number' && typeof top === 'number' && left >= 0 && top >= 0 && left < 4000 && top < 4000) {
          return { left, top };
        }
      } catch { /* fallback */ }
    }
    return defaultPos;
  });
  const [isDragging, setIsDragging] = useState(false);
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const posStartRef = useRef({ left: 0, top: 0 });
  const hasMoved = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const isLongPressRef = useRef(false);

  const assistantStatus = useAppStore((s) => s.assistantStatus);

  useEffect(() => {
    localStorage.setItem('ai-orb-position', JSON.stringify(position));
  }, [position]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    hasMoved.current = false;
    isLongPressRef.current = false;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    posStartRef.current = { left: position.left, top: position.top };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    // 长按500ms激活Push-to-Talk
    longPressTimerRef.current = setTimeout(() => {
      if (!hasMoved.current) {
        isLongPressRef.current = true;
        onPushToTalkStart?.();
      }
    }, 500);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    hasMoved.current = true;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    // clamp to viewport
    const maxLeft = window.innerWidth - 80;
    const maxTop = window.innerHeight - 100;
    setPosition({
      left: Math.max(0, Math.min(maxLeft, posStartRef.current.left + dx)),
      top: Math.max(0, Math.min(maxTop, posStartRef.current.top + dy)),
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    if (isLongPressRef.current) {
      onPushToTalkEnd?.();
      isLongPressRef.current = false;
    } else if (!hasMoved.current) {
      onTogglePanel();
    }
  };

  const stateConfig: Record<OrbState, { icon: typeof Brain; color: string; animate: boolean }> = {
    idle: { icon: Brain, color: '#00F5FF', animate: false },
    listening: { icon: Mic, color: '#8B5CF6', animate: true },
    thinking: { icon: Loader2, color: '#FFD700', animate: true },
    executing: { icon: Brain, color: '#1DD1A1', animate: true },
    speaking: { icon: Volume2, color: '#00F5FF', animate: true },
    error: { icon: X, color: '#EF4444', animate: false },
  };

  const currentState = stateConfig[orbState] || stateConfig.idle;
  const Icon = currentState.icon;

  return (
    <motion.div
      className="fixed z-[9990] select-none touch-none"
      style={{
        left: position.left,
        top: position.top,
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {/* 外层持续旋转光环 */}
      <div
        className="absolute -inset-3 rounded-full"
        style={{
          background: `conic-gradient(from 0deg, transparent, ${currentState.color}30, transparent, ${currentState.color}15, transparent)`,
          animation: 'spin 4s linear infinite',
        }}
      />

      {/* 外层脉冲环 */}
      <AnimatePresence>
        {(orbState !== 'idle' || assistantStatus !== 'idle') && (
          <>
            <motion.div
              className="absolute inset-[-10px] rounded-full border border-[#00F5FF]/20"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ repeat: Infinity, duration: 2 }}
            />
            <motion.div
              className="absolute inset-[-20px] rounded-full border border-[#00F5FF]/10"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0, 0.2] }}
              transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
            />
          </>
        )}
      </AnimatePresence>

      {/* idle状态呼吸脉冲 */}
      {orbState === 'idle' && (
        <motion.div
          className="absolute -inset-2 rounded-full"
          style={{ border: `1px solid ${currentState.color}15` }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.1, 0.3] }}
          transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
        />
      )}

      {/* 主球体 - 增大到72px */}
      <motion.div
        className="relative w-[72px] h-[72px] rounded-full cursor-pointer flex items-center justify-center overflow-hidden"
        style={{
          background: `radial-gradient(circle at 35% 35%, ${currentState.color}40, ${currentState.color}15, #0A254080)`,
          boxShadow: `0 0 40px ${currentState.color}35, inset 0 0 25px ${currentState.color}10`,
          border: `2px solid ${currentState.color}60`,
        }}
        animate={
          orbState === 'idle'
            ? { scale: [1, 1.04, 1] }
            : orbState === 'listening'
            ? { scale: [1, 1.08, 1] }
            : {}
        }
        transition={
          orbState === 'idle'
            ? { repeat: Infinity, duration: 3, ease: 'easeInOut' }
            : orbState === 'listening'
            ? { repeat: Infinity, duration: 1.2, ease: 'easeInOut' }
            : {}
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* 内部旋转光效 */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(from 0deg, transparent, ${currentState.color}20, transparent, ${currentState.color}10, transparent)`,
            animation: currentState.animate ? 'spin 3s linear infinite' : 'none',
          }}
        />

        {/* 图标 */}
        <motion.div
          key={orbState}
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <Icon
            className={`w-7 h-7 relative z-10 ${orbState === 'thinking' ? 'animate-spin' : ''}`}
            style={{ color: currentState.color }}
          />
        </motion.div>
      </motion.div>

      {/* "小智"标签 - 常驻显示 */}
      <div
        className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-medium tracking-wider"
        style={{ color: `${currentState.color}90` }}
      >
        小智
      </div>

      {/* 状态文字标签 */}
      <AnimatePresence>
        {orbState !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-medium"
            style={{
              backgroundColor: `${currentState.color}20`,
              color: currentState.color,
              border: `1px solid ${currentState.color}40`,
            }}
          >
            {orbState === 'listening' && '聆听中...'}
            {orbState === 'thinking' && '思考中...'}
            {orbState === 'executing' && '执行中...'}
            {orbState === 'speaking' && '播报中...'}
            {orbState === 'error' && '出错了'}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 面板打开指示 */}
      {isPanelOpen && (
        <div
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
          style={{ backgroundColor: currentState.color }}
        />
      )}

      {/* Push-to-Talk录音指示 */}
      <AnimatePresence>
        {isPushToTalk && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-1 rounded-full text-[10px] font-medium"
            style={{
              backgroundColor: '#8B5CF620',
              color: '#8B5CF6',
              border: '1px solid #8B5CF640',
            }}
          >
            松开发送
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
