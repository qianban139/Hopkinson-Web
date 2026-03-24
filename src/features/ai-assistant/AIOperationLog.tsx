// src/features/ai-assistant/AIOperationLog.tsx
// AI操作日志面板 - 显示AI执行的所有操作及其状态
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Loader2, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { AIOperation } from './types';

interface AIOperationLogProps {
  operations: AIOperation[];
  onClear: () => void;
}

export default function AIOperationLog({ operations, onClear }: AIOperationLogProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (operations.length === 0) return null;

  const statusIcon = (status: AIOperation['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-3.5 h-3.5 text-white/40" />;
      case 'executing':
        return <Loader2 className="w-3.5 h-3.5 text-[#00F5FF] animate-spin" />;
      case 'complete':
        return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
      case 'error':
        return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    }
  };

  return (
    <div className="border border-[#00F5FF]/20 rounded-lg bg-[#051020]/80 backdrop-blur-sm overflow-hidden">
      {/* 头部 */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-[#00F5FF]/5 border-b border-[#00F5FF]/10 cursor-pointer"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#00F5FF] animate-pulse" />
          <span className="text-xs font-semibold text-white/80">AI操作日志</span>
          <span className="text-xs text-white/40">({operations.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            清空
          </button>
          {collapsed ? (
            <ChevronDown className="w-3.5 h-3.5 text-white/40" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-white/40" />
          )}
        </div>
      </div>

      {/* 操作列表 */}
      {!collapsed && (
        <div className="max-h-48 overflow-y-auto p-2 space-y-1">
          <AnimatePresence initial={false}>
            {operations.map((op) => (
              <motion.div
                key={op.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs ${
                  op.status === 'executing'
                    ? 'bg-[#00F5FF]/10 border border-[#00F5FF]/20'
                    : op.status === 'error'
                    ? 'bg-red-400/5'
                    : 'bg-white/[0.02]'
                }`}
              >
                {statusIcon(op.status)}
                <span className="flex-1 text-white/70 truncate">
                  {op.message || op.actionName}
                </span>
                {op.duration && (
                  <span className="text-white/30 font-mono">{op.duration}ms</span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
