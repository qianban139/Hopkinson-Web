import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Mic, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import AIAssistantPanel from './AIAssistantPanel';

// 悬浮球位置存储Key
const POSITION_KEY = 'ai-ball-position';

function getStoredPosition(): { x: number; y: number } {
  try {
    const stored = localStorage.getItem(POSITION_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return { x: 0, y: 0 };
}

// 涟漪动画组件
function RippleRing({ delay }: { delay: number }) {
  return (
    <motion.div
      className="absolute inset-0 rounded-full border-2 border-[#00F5FF]"
      initial={{ scale: 1, opacity: 0.6 }}
      animate={{ scale: 2.5, opacity: 0 }}
      transition={{ duration: 2, repeat: Infinity, delay, ease: 'easeOut' }}
    />
  );
}

// 轨道粒子动画
function OrbitalParticle({ index }: { index: number }) {
  const angle = (index / 3) * Math.PI * 2;
  return (
    <motion.div
      className="absolute w-2 h-2 bg-[#00F5FF] rounded-full"
      style={{ left: '50%', top: '50%', marginLeft: -4, marginTop: -4 }}
      animate={{
        x: [Math.cos(angle) * 28, Math.cos(angle + Math.PI * 2) * 28],
        y: [Math.sin(angle) * 28, Math.sin(angle + Math.PI * 2) * 28],
      }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
    />
  );
}

export default function AIFloatingBall() {
  const {
    isAssistantOpen,
    setAssistantOpen,
    toggleAssistant,
    assistantStatus,
  } = useAppStore();

  const [, setDragPosition] = useState(getStoredPosition);
  const constraintsRef = useRef<HTMLDivElement>(null);
  const ballRef = useRef<HTMLDivElement>(null);

  // 保存拖拽位置
  const handleDragEnd = useCallback((_: unknown, info: { point: { x: number; y: number } }) => {
    const pos = { x: info.point.x, y: info.point.y };
    setDragPosition(pos);
    try {
      localStorage.setItem(POSITION_KEY, JSON.stringify(pos));
    } catch { /* ignore */ }
  }, []);

  // 处理点击 - 区分拖拽和点击
  const isDragging = useRef(false);
  const handleClick = useCallback(() => {
    if (!isDragging.current) {
      toggleAssistant();
    }
    isDragging.current = false;
  }, [toggleAssistant]);

  // 键盘关闭
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAssistantOpen) {
        setAssistantOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isAssistantOpen, setAssistantOpen]);

  return (
    <>
      {/* 拖拽约束容器 */}
      <div ref={constraintsRef} className="fixed inset-0 pointer-events-none z-[59]" />

      {/* 悬浮球 */}
      <AnimatePresence>
        {!isAssistantOpen && (
          <motion.div
            ref={ballRef}
            className="fixed bottom-8 right-8 z-[60] pointer-events-auto cursor-pointer"
            drag
            dragConstraints={constraintsRef}
            dragElastic={0.1}
            dragMomentum={false}
            onDragStart={() => { isDragging.current = true; }}
            onDragEnd={handleDragEnd}
            onClick={handleClick}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            {/* 发光背景 */}
            <div className="relative w-[60px] h-[60px]">
              {/* 空闲状态 - 呼吸脉冲 */}
              {assistantStatus === 'idle' && (
                <motion.div
                  className="absolute inset-0 rounded-full bg-[#00F5FF]/20"
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.3, 0.1, 0.3],
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}

              {/* 聆听状态 - 涟漪 */}
              {assistantStatus === 'listening' && (
                <>
                  <RippleRing delay={0} />
                  <RippleRing delay={0.5} />
                  <RippleRing delay={1} />
                </>
              )}

              {/* 处理状态 - 轨道粒子 */}
              {assistantStatus === 'processing' && (
                <>
                  <OrbitalParticle index={0} />
                  <OrbitalParticle index={1} />
                  <OrbitalParticle index={2} />
                </>
              )}

              {/* 播报状态 - 波形 */}
              {assistantStatus === 'speaking' && (
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-[#00F5FF]"
                  animate={{
                    boxShadow: [
                      '0 0 10px rgba(0,245,255,0.3), inset 0 0 10px rgba(0,245,255,0.1)',
                      '0 0 25px rgba(0,245,255,0.6), inset 0 0 20px rgba(0,245,255,0.3)',
                      '0 0 10px rgba(0,245,255,0.3), inset 0 0 10px rgba(0,245,255,0.1)',
                    ],
                  }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              )}

              {/* 核心球体 */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#00F5FF] to-[#0080FF] shadow-lg shadow-[#00F5FF]/30 flex items-center justify-center">
                {assistantStatus === 'listening' ? (
                  <Mic className="w-6 h-6 text-[#0A2540]" />
                ) : (
                  <Bot className="w-6 h-6 text-[#0A2540]" />
                )}
              </div>

              {/* 状态指示点 */}
              <div className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0A2540] ${
                assistantStatus === 'idle' ? 'bg-[#1DD1A1]' :
                assistantStatus === 'listening' ? 'bg-[#FF2E63] animate-pulse' :
                assistantStatus === 'processing' ? 'bg-[#FFD700] animate-pulse' :
                'bg-[#00F5FF] animate-pulse'
              }`} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 对话面板 */}
      <AnimatePresence>
        {isAssistantOpen && (
          <motion.div
            className="fixed bottom-6 right-6 z-[60]"
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            {/* 关闭按钮 */}
            <button
              onClick={() => setAssistantOpen(false)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-[#0A2540] border border-[#00F5FF]/30 flex items-center justify-center text-white/60 hover:text-white hover:border-[#00F5FF] transition-colors z-10"
            >
              <X className="w-4 h-4" />
            </button>

            <AIAssistantPanel />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
