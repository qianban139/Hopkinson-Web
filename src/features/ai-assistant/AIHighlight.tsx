// src/features/ai-assistant/AIHighlight.tsx
// AI操作高亮指示器 - 在目标UI元素周围显示青色脉冲边框
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AIHighlightTarget } from './types';

interface AIHighlightProps {
  target: AIHighlightTarget | null;
}

export default function AIHighlight({ target }: AIHighlightProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!target) {
      setVisible(false);
      return;
    }

    // 查找目标元素
    const el = document.querySelector(`[data-ai-target="${target.targetId}"]`);
    if (!el) {
      // 如果找不到精确匹配，尝试模糊匹配
      const fuzzy = document.querySelector(`[data-ai-target*="${target.targetId.split('-')[0]}"]`);
      if (fuzzy) {
        setRect(fuzzy.getBoundingClientRect());
        setVisible(true);
      }
      return;
    }

    setRect(el.getBoundingClientRect());
    setVisible(true);

    // 滚动到可视区域
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const timer = setTimeout(() => setVisible(false), target.duration);
    return () => clearTimeout(timer);
  }, [target]);

  return (
    <AnimatePresence>
      {visible && rect && (
        <motion.div
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed pointer-events-none z-[9999]"
          style={{
            left: rect.left - 6,
            top: rect.top - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        >
          {/* 脉冲边框 */}
          <div className="absolute inset-0 rounded-lg border-2 border-[#00F5FF] animate-pulse" />
          <div className="absolute inset-[-4px] rounded-xl border border-[#00F5FF]/30 animate-ping" style={{ animationDuration: '1.5s' }} />

          {/* 标签 */}
          {target && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1 rounded-full bg-[#00F5FF] text-[#0A2540] text-xs font-semibold shadow-lg shadow-[#00F5FF]/30"
            >
              {target.label}
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
