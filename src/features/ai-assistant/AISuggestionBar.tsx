// src/features/ai-assistant/AISuggestionBar.tsx
// 跨页面 AI 建议条 — Phase 2 智能助手 2.0
//
// 在每个页面右上角浮动展示一条上下文相关建议
// 用户点击「执行」会触发对应的 AI 指令
// 用户点击「忽略」后该建议在 5 分钟内不再出现

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, X, Zap, AlertTriangle, Info } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { getProactiveSuggestions, type ProactiveSuggestion } from './services/proactiveAssistant';

const DISMISS_TTL_MS = 5 * 60 * 1000; // 5 分钟内不再显示已忽略建议
const POLL_INTERVAL_MS = 4000;        // 每 4 秒重新评估上下文

interface DismissedRecord {
  id: string;
  expiresAt: number;
}

export default function AISuggestionBar() {
  const currentPage = useAppStore((s) => s.currentPage);
  const monitorData = useAppStore((s) => s.monitorData);
  const experimentParams = useAppStore((s) => s.experimentParams);
  const selectedMaterial = useAppStore((s) => s.selectedMaterial);

  const [activeSuggestion, setActiveSuggestion] = useState<ProactiveSuggestion | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const dismissedRef = useRef<DismissedRecord[]>([]);

  // 重新评估建议
  useEffect(() => {
    function evaluate() {
      // 清理过期的 dismissed 记录
      const now = Date.now();
      dismissedRef.current = dismissedRef.current.filter((r) => r.expiresAt > now);
      const dismissedIds = new Set(dismissedRef.current.map((r) => r.id));

      const all = getProactiveSuggestions().filter((s) => !dismissedIds.has(s.id));
      // 优先级排序：high > medium > low
      const order = { high: 0, medium: 1, low: 2 };
      all.sort((a, b) => order[a.priority] - order[b.priority]);

      const top = all[0] || null;
      if (top?.id !== activeSuggestion?.id) {
        setActiveSuggestion(top);
        setIsVisible(!!top);
      }
    }

    evaluate();
    const timer = setInterval(evaluate, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [currentPage, monitorData.temperature, monitorData.emi, experimentParams.voltage, selectedMaterial?.id, activeSuggestion?.id]);

  const handleDismiss = () => {
    if (activeSuggestion) {
      dismissedRef.current.push({
        id: activeSuggestion.id,
        expiresAt: Date.now() + DISMISS_TTL_MS,
      });
      setIsVisible(false);
      setTimeout(() => setActiveSuggestion(null), 300);
    }
  };

  const handleAction = () => {
    if (activeSuggestion?.action) {
      // 触发自定义事件，由 AICommandCenter 监听并执行命令
      window.dispatchEvent(new CustomEvent('ai-suggestion-trigger', {
        detail: { command: activeSuggestion.action },
      }));
      handleDismiss();
    }
  };

  if (!activeSuggestion) return null;

  // 根据优先级选择样式
  const styles = {
    high: {
      bg: 'from-red-500/20 to-orange-500/15',
      border: 'border-red-400/40',
      glow: 'shadow-[0_0_20px_rgba(239,68,68,0.25)]',
      icon: <AlertTriangle className="w-4 h-4 text-red-300" />,
      iconBg: 'bg-red-500/20',
    },
    medium: {
      bg: 'from-cyan-500/20 to-blue-500/15',
      border: 'border-cyan-400/40',
      glow: 'shadow-[0_0_20px_rgba(0,245,255,0.20)]',
      icon: <Lightbulb className="w-4 h-4 text-cyan-300" />,
      iconBg: 'bg-cyan-500/20',
    },
    low: {
      bg: 'from-purple-500/15 to-pink-500/10',
      border: 'border-purple-400/30',
      glow: 'shadow-[0_0_15px_rgba(168,85,247,0.18)]',
      icon: <Info className="w-4 h-4 text-purple-300" />,
      iconBg: 'bg-purple-500/20',
    },
  }[activeSuggestion.priority];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="fixed top-20 right-4 z-40 max-w-sm pointer-events-auto"
        >
          <div
            className={`bg-gradient-to-br ${styles.bg} backdrop-blur-xl border ${styles.border} ${styles.glow} rounded-2xl p-3 pr-2 flex items-start gap-2.5`}
          >
            <div className={`flex-shrink-0 w-8 h-8 rounded-full ${styles.iconBg} flex items-center justify-center mt-0.5`}>
              {styles.icon}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/60">
                  AI 建议
                </span>
                {activeSuggestion.priority === 'high' && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/30 text-red-200 font-medium">
                    紧急
                  </span>
                )}
              </div>
              <p className="text-[13px] text-white/90 leading-snug">
                {activeSuggestion.text}
              </p>

              {activeSuggestion.action && (
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleAction}
                    className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white font-medium transition-colors"
                  >
                    <Zap className="w-3 h-3" />
                    立即执行
                  </button>
                  {activeSuggestion.dismissable && (
                    <button
                      onClick={handleDismiss}
                      className="text-[11px] px-2 py-1 rounded-lg text-white/60 hover:text-white/90 hover:bg-white/10 transition-colors"
                    >
                      稍后
                    </button>
                  )}
                </div>
              )}
            </div>

            {activeSuggestion.dismissable && !activeSuggestion.action && (
              <button
                onClick={handleDismiss}
                className="flex-shrink-0 w-6 h-6 rounded-md text-white/40 hover:text-white/80 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
