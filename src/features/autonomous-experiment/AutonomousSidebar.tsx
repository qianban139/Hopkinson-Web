// src/features/autonomous-experiment/AutonomousSidebar.tsx
// 自主实验侧边栏主容器 — 根据状态切换展��不同面板
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Loader2, AlertCircle,
  PanelRightClose, PanelRightOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAutonomousExperimentStore } from '@/store/useAutonomousExperimentStore';
import { startAutonomousExecution } from '@/features/ai-assistant/services/autonomousExperimentService';
import PlanReviewPanel from './PlanReviewPanel';
import ExperimentTimeline from './ExperimentTimeline';
import AutoExperimentReport from './AutoExperimentReport';

export default function AutonomousSidebar() {
  const status = useAutonomousExperimentStore(s => s.status);
  const sidebarOpen = useAutonomousExperimentStore(s => s.sidebarOpen);
  const setSidebarOpen = useAutonomousExperimentStore(s => s.setSidebarOpen);
  const lastError = useAutonomousExperimentStore(s => s.lastError);
  const reset = useAutonomousExperimentStore(s => s.reset);

  // 监听计划批准事件，自动开始执行
  const planStatus = useAutonomousExperimentStore(s => s.status);
  useEffect(() => {
    if (planStatus === 'running') {
      // 检查是否是刚从 ready 转为 running（即刚被批准）
      const plan = useAutonomousExperimentStore.getState().plan;
      const currentIdx = useAutonomousExperimentStore.getState().currentExperimentIndex;
      if (plan && currentIdx === -1) {
        startAutonomousExecution();
      }
    }
  }, [planStatus]);

  if (!sidebarOpen && status === 'idle') return null;

  // 侧边栏折叠按钮（仅在非 idle 时显示，贴右边缘垂直居中）
  if (!sidebarOpen && status !== 'idle') {
    return (
      <motion.div
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40"
      >
        <Button
          size="sm"
          variant="outline"
          className="h-20 w-8 rounded-l-lg rounded-r-none border-r-0 bg-slate-800/90 backdrop-blur border-slate-600 hover:bg-slate-700"
          onClick={() => setSidebarOpen(true)}
        >
          <PanelRightOpen className="w-4 h-4" />
        </Button>
      </motion.div>
    );
  }

  if (!sidebarOpen) return null;

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 320, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="h-full border-l border-slate-700/50 bg-slate-900/95 backdrop-blur-sm flex flex-col overflow-hidden"
    >
      {/* 头部 */}
      <div className="flex items-center gap-2 p-3 border-b border-slate-700/50 shrink-0">
        <Bot className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-medium text-white flex-1">AI 自主实验</span>
        <StatusBadge status={status} />
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={() => setSidebarOpen(false)}
        >
          <PanelRightClose className="w-4 h-4 text-slate-400" />
        </Button>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-hidden p-3">
        <AnimatePresence mode="wait">
          {/* 计划中 */}
          {status === 'planning' && (
            <motion.div
              key="planning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full gap-3"
            >
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              <span className="text-sm text-slate-300">AI 正在规划实验方案...</span>
            </motion.div>
          )}

          {/* 等待审批 */}
          {status === 'ready' && (
            <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <PlanReviewPanel />
            </motion.div>
          )}

          {/* 执行中 / 暂停 / 分析中 */}
          {(status === 'running' || status === 'paused' || status === 'analyzing' || status === 'adjusting') && (
            <motion.div key="running" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <ExperimentTimeline />
            </motion.div>
          )}

          {/* 生成报告中 */}
          {status === 'generating_report' && (
            <motion.div
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full gap-3"
            >
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
              <span className="text-sm text-slate-300">正在生成实验报告...</span>
            </motion.div>
          )}

          {/* 完成 / 终止 */}
          {(status === 'complete' || status === 'aborted') && (
            <motion.div key="complete" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <AutoExperimentReport />
            </motion.div>
          )}

          {/* 错误 */}
          {status === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full gap-3"
            >
              <AlertCircle className="w-8 h-8 text-red-400" />
              <p className="text-sm text-red-300 text-center whitespace-pre-line">{lastError}</p>
              <Button size="sm" variant="outline" onClick={reset}>
                返回
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/** 状态徽章 */
function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; color: string }> = {
    idle: { label: '空闲', color: 'text-slate-400 border-slate-600' },
    planning: { label: '规划中', color: 'text-blue-400 border-blue-500/30' },
    ready: { label: '待审批', color: 'text-yellow-400 border-yellow-500/30' },
    running: { label: '执行中', color: 'text-green-400 border-green-500/30' },
    paused: { label: '已暂停', color: 'text-yellow-400 border-yellow-500/30' },
    analyzing: { label: '分析中', color: 'text-purple-400 border-purple-500/30' },
    adjusting: { label: '调整中', color: 'text-purple-400 border-purple-500/30' },
    generating_report: { label: '生成报告', color: 'text-blue-400 border-blue-500/30' },
    complete: { label: '已完成', color: 'text-green-400 border-green-500/30' },
    error: { label: '错误', color: 'text-red-400 border-red-500/30' },
    aborted: { label: '已终止', color: 'text-red-400 border-red-500/30' },
  };
  const config = configs[status] || configs.idle;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${config.color}`}>
      {config.label}
    </span>
  );
}
