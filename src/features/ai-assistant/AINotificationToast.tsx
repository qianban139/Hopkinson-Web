// src/features/ai-assistant/AINotificationToast.tsx
// 全局AI操作通知Toast - 顶部滑入显示AI正在执行的操作
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

const iconMap = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
};

const colorMap = {
  info: { bg: 'rgba(0,245,255,0.1)', border: 'rgba(0,245,255,0.3)', text: '#00F5FF' },
  success: { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', text: '#10B981' },
  warning: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', text: '#F59E0B' },
  error: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#EF4444' },
};

export default function AINotificationToast() {
  const notification = useAppStore((s) => s.aiNotification);
  const clearNotification = useAppStore((s) => s.clearAINotification);

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          key={notification.id}
          initial={{ opacity: 0, y: -50, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -30, x: '-50%' }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed top-20 left-1/2 z-[9998] cursor-pointer"
          onClick={clearNotification}
        >
          <div
            className="flex items-center gap-3 px-5 py-3 rounded-xl backdrop-blur-md shadow-2xl"
            style={{
              backgroundColor: colorMap[notification.type].bg,
              border: `1px solid ${colorMap[notification.type].border}`,
              boxShadow: `0 10px 40px rgba(0,0,0,0.3), 0 0 20px ${colorMap[notification.type].border}`,
            }}
          >
            <Brain className="w-4 h-4 text-[#00F5FF] flex-shrink-0" />
            <div className="flex items-center gap-2">
              {(() => {
                const Icon = iconMap[notification.type];
                return <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: colorMap[notification.type].text }} />;
              })()}
              <span className="text-sm text-white/90 font-medium whitespace-nowrap">
                {notification.message}
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
