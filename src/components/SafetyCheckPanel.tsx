// src/components/SafetyCheckPanel.tsx
// 安全检查动画面板 - 嵌入AI对话中，逐项显示检查结果
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { useExperimentWorkflow, type SafetyCheckItem } from '@/store/experimentWorkflow';
import { performSafetyCheck, formatValue, getSafetyCheckSummary } from '@/services/safetyCheck';

interface SafetyCheckPanelProps {
  onComplete: (passed: boolean) => void;
}

const STATUS_CONFIG = {
  pending: { icon: Loader2, color: 'text-white/40', bg: 'bg-white/5', label: '检测中' },
  pass:    { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-400/10', label: '通过' },
  warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-400/10', label: '警告' },
  danger:  { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10', label: '危险' },
};

export default function SafetyCheckPanel({ onComplete }: SafetyCheckPanelProps) {
  const { requirements, setSafetyItems } = useExperimentWorkflow();
  const [displayItems, setDisplayItems] = useState<SafetyCheckItem[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  // 执行安全检查并逐项展示
  useEffect(() => {
    const checkedItems = performSafetyCheck(requirements);
    // 初始全部pending
    setDisplayItems(checkedItems.map(item => ({ ...item, status: 'pending' as const })));

    // 逐项揭示结果 (500ms间隔)
    checkedItems.forEach((item, index) => {
      setTimeout(() => {
        setDisplayItems(prev => prev.map((p, i) =>
          i === index ? { ...p, status: item.status } : p
        ));
        setRevealedCount(index + 1);

        // 最后一项完成
        if (index === checkedItems.length - 1) {
          setTimeout(() => {
            setSafetyItems(checkedItems);
            setIsComplete(true);
            const summary = getSafetyCheckSummary(checkedItems);
            onComplete(summary.overallStatus !== 'danger');
          }, 600);
        }
      }, 800 + index * 500);
    });
  }, []);

  const summary = isComplete ? getSafetyCheckSummary(displayItems) : null;

  return (
    <div className="w-full rounded-xl bg-[#051020] border border-[#00F5FF]/20 overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-[#00F5FF]/10 to-transparent border-b border-[#00F5FF]/10">
        <Shield className="w-4 h-4 text-[#00F5FF]" />
        <span className="text-sm font-semibold text-white">预实验安全检查</span>
        {!isComplete && (
          <Loader2 className="w-3.5 h-3.5 text-[#00F5FF] animate-spin ml-auto" />
        )}
      </div>

      {/* 检查项列表 */}
      <div className="p-3 space-y-1.5">
        <AnimatePresence>
          {displayItems.map((item, index) => {
            const config = STATUS_CONFIG[item.status];
            const Icon = config.icon;
            const isRevealed = index < revealedCount;

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg ${config.bg} transition-colors duration-300`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${config.color} ${item.status === 'pending' ? 'animate-spin' : ''}`} />
                <span className="text-sm text-white/80 flex-1">{item.name}</span>
                <span className={`text-sm font-mono ${isRevealed ? config.color : 'text-white/30'}`}>
                  {formatValue(item.currentValue, item.unit)}
                </span>
                <span className="text-xs text-white/30">
                  / {formatValue(item.dangerThreshold, item.unit)}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${config.bg} ${config.color}`}>
                  {config.label}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* 总结 */}
      <AnimatePresence>
        {isComplete && summary && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="border-t border-[#00F5FF]/10"
          >
            <div className={`px-4 py-3 flex items-start gap-2 ${
              summary.overallStatus === 'pass' ? 'bg-emerald-400/5' :
              summary.overallStatus === 'warning' ? 'bg-amber-400/5' :
              'bg-red-400/5'
            }`}>
              {summary.overallStatus === 'pass' ? (
                <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              ) : summary.overallStatus === 'warning' ? (
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              )}
              <p className={`text-sm ${
                summary.overallStatus === 'pass' ? 'text-emerald-400' :
                summary.overallStatus === 'warning' ? 'text-amber-400' :
                'text-red-400'
              }`}>
                {summary.message}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
