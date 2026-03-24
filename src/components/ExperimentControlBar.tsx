// src/components/ExperimentControlBar.tsx
// 全局实验控制栏 — 实验激活时显示在页面底部
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pause, Play, OctagonX, Lock, Unlock,
  ChevronUp, ChevronDown, Zap, Thermometer, Activity,
} from 'lucide-react';
import { useExperimentWorkflow } from '@/store/experimentWorkflow';
import { useAppStore } from '@/store/useAppStore';
import type { ExperimentPhase } from '@/store/experimentWorkflow';

const PHASE_LABELS: Record<ExperimentPhase, string> = {
  idle: '空闲',
  inquiry: '需求采集',
  safetyCheck: '安全检查',
  preparation: '参数确认',
  execution: '实验执行',
  dataCollection: '数据采集',
  analysis: '结果分析',
  complete: '已完成',
};

const PHASE_ORDER: ExperimentPhase[] = ['inquiry', 'safetyCheck', 'preparation', 'execution', 'dataCollection', 'analysis', 'complete'];

export default function ExperimentControlBar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  const {
    phase, isPaused, isEmergencyStopped, parameterLocked,
    liveParameters, executionSteps, currentExecutionStepIndex,
    setPaused, emergencyStop, setParameterLocked, setLiveParameters, jumpToPhase, resetWorkflow,
  } = useExperimentWorkflow();

  const monitorData = useAppStore(s => s.monitorData);

  // 只在实验激活时显示
  if (phase === 'idle') return null;

  const isActive = phase !== 'idle' && phase !== 'complete';
  const currentStep = currentExecutionStepIndex >= 0 ? executionSteps[currentExecutionStepIndex] : null;
  const overallProgress = executionSteps.filter(s => s.status === 'complete').length / executionSteps.length * 100;

  return (
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 60, opacity: 0 }}
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[45] max-w-[900px] w-[90vw]"
    >
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(5,16,32,0.95), rgba(10,37,64,0.95))',
          border: '1px solid rgba(0,245,255,0.15)',
          boxShadow: '0 -4px 30px rgba(0,0,0,0.4), 0 0 20px rgba(0,245,255,0.05)',
          backdropFilter: 'blur(16px)',
        }}
      >
        {/* 进度条 */}
        <div className="h-1 bg-white/5">
          <motion.div
            className="h-full bg-gradient-to-r from-[#00F5FF] to-[#1DD1A1]"
            animate={{ width: `${overallProgress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>

        {/* 主控制行 */}
        <div className="px-4 py-2.5 flex items-center gap-3">
          {/* 阶段指示 */}
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
              isEmergencyStopped ? 'bg-red-500' :
              isPaused ? 'bg-yellow-400 animate-pulse' :
              'bg-[#1DD1A1] animate-pulse'
            }`} />
            <span className="text-sm font-medium text-white truncate">
              {isEmergencyStopped ? '紧急停止' : isPaused ? '已暂停' : PHASE_LABELS[phase]}
            </span>
            {currentStep && (
              <span className="text-xs text-white/40 truncate hidden sm:inline">
                — {currentStep.label} ({currentStep.progress}%)
              </span>
            )}
          </div>

          <div className="flex-1" />

          {/* 实时数据 */}
          <div className="hidden md:flex items-center gap-3 text-xs text-white/50">
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-[#00F5FF]" />
              <span>{monitorData.voltage}V</span>
            </div>
            <div className="flex items-center gap-1">
              <Activity className="w-3 h-3 text-[#FFD700]" />
              <span>{(monitorData.current / 1000).toFixed(1)}kA</span>
            </div>
            <div className="flex items-center gap-1">
              <Thermometer className="w-3 h-3 text-[#FF9F43]" />
              <span>{monitorData.temperature}°C</span>
            </div>
          </div>

          {/* 控制按钮 */}
          <div className="flex items-center gap-1.5">
            {/* 暂停/恢复 */}
            {isActive && !isEmergencyStopped && (
              <button
                onClick={() => setPaused(!isPaused)}
                className={`p-2 rounded-lg transition-all ${
                  isPaused
                    ? 'bg-[#1DD1A1]/20 text-[#1DD1A1] hover:bg-[#1DD1A1]/30'
                    : 'bg-yellow-400/20 text-yellow-400 hover:bg-yellow-400/30'
                }`}
                title={isPaused ? '恢复实验' : '暂停实验'}
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
            )}

            {/* 参数锁定 */}
            {isActive && (
              <button
                onClick={() => setParameterLocked(!parameterLocked)}
                className={`p-2 rounded-lg transition-all ${
                  parameterLocked
                    ? 'bg-[#00F5FF]/20 text-[#00F5FF]'
                    : 'bg-white/5 text-white/40 hover:bg-white/10'
                }`}
                title={parameterLocked ? '解锁参数' : '锁定参数'}
              >
                {parameterLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              </button>
            )}

            {/* 紧急停止 */}
            {isActive && !isEmergencyStopped && (
              <button
                onClick={() => setShowStopConfirm(true)}
                className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
                title="紧急停止"
              >
                <OctagonX className="w-4 h-4" />
              </button>
            )}

            {/* 完成后重置 */}
            {(phase === 'complete' || isEmergencyStopped) && (
              <button
                onClick={resetWorkflow}
                className="px-3 py-1.5 rounded-lg bg-[#00F5FF]/10 text-[#00F5FF] text-xs hover:bg-[#00F5FF]/20 transition-all"
              >
                新实验
              </button>
            )}

            {/* 展开/收起 */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 transition-all"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* 展开区域：阶段导航 + 参数调节 */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3 pt-1 border-t border-white/5">
                {/* 阶段导航 */}
                <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1">
                  {PHASE_ORDER.map((p, i) => {
                    const isCurrent = p === phase;
                    const isPast = PHASE_ORDER.indexOf(phase) > i;
                    return (
                      <button
                        key={p}
                        onClick={() => {
                          if (isPast && !isEmergencyStopped) {
                            jumpToPhase(p);
                          }
                        }}
                        disabled={!isPast || isEmergencyStopped}
                        className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] transition-all ${
                          isCurrent
                            ? 'bg-[#00F5FF]/20 text-[#00F5FF] border border-[#00F5FF]/30'
                            : isPast
                              ? 'bg-white/5 text-white/50 hover:bg-white/10 cursor-pointer'
                              : 'bg-white/3 text-white/20'
                        }`}
                      >
                        {PHASE_LABELS[p]}
                      </button>
                    );
                  })}
                </div>

                {/* 参数快调 */}
                {!parameterLocked && isActive && (
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] text-white/40 mb-1 block">电压 (V)</label>
                      <input
                        type="range"
                        min="500"
                        max="5000"
                        step="100"
                        value={liveParameters.voltage}
                        onChange={(e) => setLiveParameters({ voltage: Number(e.target.value) })}
                        className="w-full h-1 accent-[#00F5FF]"
                      />
                      <span className="text-[10px] text-[#00F5FF]">{liveParameters.voltage}V</span>
                    </div>
                    <div>
                      <label className="text-[10px] text-white/40 mb-1 block">电流 (kA)</label>
                      <input
                        type="range"
                        min="5000"
                        max="50000"
                        step="1000"
                        value={liveParameters.current}
                        onChange={(e) => setLiveParameters({ current: Number(e.target.value) })}
                        className="w-full h-1 accent-[#FFD700]"
                      />
                      <span className="text-[10px] text-[#FFD700]">{(liveParameters.current / 1000).toFixed(0)}kA</span>
                    </div>
                    <div>
                      <label className="text-[10px] text-white/40 mb-1 block">脉宽 (μs)</label>
                      <input
                        type="range"
                        min="200"
                        max="1100"
                        step="50"
                        value={liveParameters.pulseWidth}
                        onChange={(e) => setLiveParameters({ pulseWidth: Number(e.target.value) })}
                        className="w-full h-1 accent-[#1DD1A1]"
                      />
                      <span className="text-[10px] text-[#1DD1A1]">{liveParameters.pulseWidth}μs</span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 紧急停止确认对话框 */}
      <AnimatePresence>
        {showStopConfirm && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute -top-24 left-1/2 -translate-x-1/2 p-4 rounded-xl bg-red-950/95 border border-red-500/30 backdrop-blur-md"
          >
            <p className="text-sm text-red-200 mb-3">确认紧急停止实验？此操作不可撤销。</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowStopConfirm(false)}
                className="px-3 py-1.5 rounded-lg bg-white/10 text-white/60 text-xs hover:bg-white/20"
              >
                取消
              </button>
              <button
                onClick={() => { emergencyStop(); setShowStopConfirm(false); }}
                className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs hover:bg-red-600"
              >
                确认停止
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
