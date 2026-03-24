// src/components/AIAmbientGlow.tsx
// AI活跃时页面背景微妙色调变化 - 增强版
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store/useAppStore';

export default function AIAmbientGlow() {
  const isAssistantOpen = useAppStore(s => s.isAssistantOpen);
  const aiState = useAppStore(s => s.aiState);

  const isAIActive = isAssistantOpen || aiState.step === 'running';

  return (
    <AnimatePresence>
      {isAIActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="fixed inset-0 pointer-events-none z-0"
        >
          {/* Top-left cyan glow - 增大范围和透明度 */}
          <motion.div
            className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(0,245,255,0.07) 0%, transparent 70%)',
            }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Bottom-right purple glow - 增大范围和透明度 */}
          <motion.div
            className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)',
            }}
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.4, 0.8, 0.4],
            }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Center gold accent - 新增 */}
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(255,215,0,0.02) 0%, transparent 60%)',
            }}
            animate={{
              scale: [0.9, 1.1, 0.9],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
