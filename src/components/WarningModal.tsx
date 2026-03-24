import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { WarningLevel } from '@/types';

interface WarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  level: WarningLevel;
  message: string;
  parameter: string;
  value: number;
  threshold: number;
  onEmergencyStop: () => void;
}

const levelConfig = {
  normal: {
    title: '系统正常',
    color: '#00F5FF',
    bgColor: 'bg-[#00F5FF]/10',
    borderColor: 'border-[#00F5FF]/30',
    icon: AlertTriangle,
  },
  warning: {
    title: '系统警告',
    color: '#FFD700',
    bgColor: 'bg-[#FFD700]/10',
    borderColor: 'border-[#FFD700]/30',
    icon: AlertTriangle,
  },
  danger: {
    title: '危险预警',
    color: '#FF2E63',
    bgColor: 'bg-[#FF2E63]/10',
    borderColor: 'border-[#FF2E63]/50',
    icon: AlertTriangle,
  },
};

export default function WarningModal({
  isOpen,
  onClose,
  level,
  message,
  parameter,
  value,
  threshold,
  onEmergencyStop,
}: WarningModalProps) {
  const config = levelConfig[level];
  const Icon = config.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`absolute inset-0 ${
              level === 'danger' ? 'bg-[#FF2E63]/20' : 'bg-black/60'
            } backdrop-blur-sm`}
            onClick={level === 'warning' ? onClose : undefined}
          />

          {/* 弹窗内容 */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className={`relative w-full max-w-md ${config.bgColor} ${config.borderColor} border-2 rounded-2xl p-6 ${
              level === 'danger' ? 'red-pulse' : ''
            }`}
          >
            {/* 关闭按钮 */}
            {level !== 'danger' && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            {/* 图标 */}
            <div className="flex justify-center mb-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${config.color}30` }}
              >
                <Icon
                  className="w-8 h-8"
                  style={{ color: config.color }}
                />
              </div>
            </div>

            {/* 标题 */}
            <h2
              className="text-2xl font-bold text-center mb-2"
              style={{ color: config.color }}
            >
              {config.title}
            </h2>

            {/* 消息 */}
            <p className="text-white/80 text-center mb-6">{message}</p>

            {/* 参数详情 */}
            <div className="bg-[#0A2540] rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-white/60">参数</span>
                <span className="text-white font-medium">{parameter}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-white/60">当前值</span>
                <span
                  className="font-bold"
                  style={{ color: config.color }}
                >
                  {value.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/60">阈值</span>
                <span className="text-white/80">{threshold}</span>
              </div>
              
              {/* 进度条 */}
              <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min((value / threshold) * 100, 100)}%`,
                    backgroundColor: config.color,
                  }}
                />
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3">
              {level === 'danger' ? (
                <Button
                  onClick={onEmergencyStop}
                  className="flex-1 btn-danger h-12 text-lg font-bold"
                >
                  <Power className="w-5 h-5 mr-2" />
                  紧急停止
                </Button>
              ) : (
                <>
                  <Button
                    onClick={onClose}
                    variant="outline"
                    className="flex-1 border-[#00F5FF]/30 text-[#00F5FF] hover:bg-[#00F5FF]/10"
                  >
                    忽略警告
                  </Button>
                  <Button
                    onClick={onEmergencyStop}
                    className="flex-1 btn-danger"
                  >
                    <Power className="w-4 h-4 mr-2" />
                    停止实验
                  </Button>
                </>
              )}
            </div>

            {/* 危险提示 */}
            {level === 'danger' && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-4 text-center text-sm text-[#FF2E63]"
              >
                系统已自动切断放电回路，请检查设备状态
              </motion.p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
