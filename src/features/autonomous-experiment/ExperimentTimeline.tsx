// src/features/autonomous-experiment/ExperimentTimeline.tsx
// 实验执行进度时间线 — 纵向时间线展示已完成/当前/待执行实验
import { motion } from 'framer-motion';
import {
  CheckCircle2, Loader2, Clock, SkipForward, XCircle,
  Pause, Play, Square, ChevronDown, ChevronUp,
  ShieldCheck, ShieldAlert, ShieldX,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAutonomousExperimentStore } from '@/store/useAutonomousExperimentStore';

/** 单个实验在时间线上的状态图标 */
function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'complete':
      return <CheckCircle2 className="w-4 h-4 text-green-400" />;
    case 'running':
      return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
    case 'skipped':
      return <SkipForward className="w-4 h-4 text-yellow-400" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-400" />;
    default:
      return <Clock className="w-4 h-4 text-slate-500" />;
  }
}

/** 状态颜色 */
function statusColor(status: string): string {
  switch (status) {
    case 'complete': return 'border-green-500/50 bg-green-500/5';
    case 'running': return 'border-blue-500/50 bg-blue-500/10';
    case 'skipped': return 'border-yellow-500/30 bg-yellow-500/5';
    case 'failed': return 'border-red-500/30 bg-red-500/5';
    default: return 'border-slate-700/50 bg-slate-800/20';
  }
}

export default function ExperimentTimeline() {
  const plan = useAutonomousExperimentStore(s => s.plan);
  const status = useAutonomousExperimentStore(s => s.status);
  const progressPercent = useAutonomousExperimentStore(s => s.progressPercent);
  const currentStepDescription = useAutonomousExperimentStore(s => s.currentStepDescription);
  const pause = useAutonomousExperimentStore(s => s.pause);
  const resume = useAutonomousExperimentStore(s => s.resume);
  const abort = useAutonomousExperimentStore(s => s.abort);
  const skipExperiment = useAutonomousExperimentStore(s => s.skipExperiment);
  const analyses = useAutonomousExperimentStore(s => s.analyses);

  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [showAbortConfirm, setShowAbortConfirm] = useState(false);

  if (!plan) return null;

  const isPaused = status === 'paused';
  const isRunning = status === 'running';
  const isAnalyzing = status === 'analyzing';

  return (
    <div className="flex flex-col h-full">
      {/* 总进度条 */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-400">{currentStepDescription}</span>
          <span className="text-xs font-mono text-slate-500">{progressPercent}%</span>
        </div>
        <Progress value={progressPercent} className="h-1.5" />
      </div>

      {/* 中间分析状态 */}
      {isAnalyzing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 p-2 bg-purple-500/10 rounded-lg border border-purple-500/20 mb-3"
        >
          <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
          <span className="text-xs text-purple-300">AI 正在分析中间结果...</span>
        </motion.div>
      )}

      {/* 时间线 */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-1 mb-3">
        {plan.experiments.map((exp, i) => {
          // 查找该实验之后是否有中间分析
          const analysisAfter = analyses.find(a => a.afterExperimentIndex === i);

          return (
            <div key={exp.id}>
              {/* 实验节点 */}
              <motion.div
                layout
                className={`rounded-lg border p-2 transition-all ${statusColor(exp.status)} ${
                  exp.status === 'running' ? 'ring-1 ring-blue-500/30' : ''
                }`}
              >
                <div
                  className="flex items-center gap-2 cursor-pointer"
                  onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
                >
                  <StatusIcon status={exp.status} />
                  <span className="text-xs font-mono text-slate-500">#{i + 1}</span>
                  <span className="text-xs text-white flex-1 truncate">{exp.materialName}</span>
                  <Badge variant="outline" className="text-[10px] px-1">
                    {exp.voltage}V
                  </Badge>
                  {/* 安全检查状态图标 */}
                  {(exp as { safetyStatus?: string }).safetyStatus && (
                    (exp as { safetyStatus?: string }).safetyStatus === 'pass'
                      ? <ShieldCheck className="w-3 h-3 text-green-400" title="安全检查通过" />
                      : (exp as { safetyStatus?: string }).safetyStatus === 'warning'
                      ? <ShieldAlert className="w-3 h-3 text-yellow-400" title="安全检查通过（有警告）" />
                      : <ShieldX className="w-3 h-3 text-red-400" title="安全检查未通过" />
                  )}
                  {exp.status === 'pending' && (isRunning || isPaused) && (
                    <button
                      className="p-0.5 hover:bg-slate-700/50 rounded"
                      onClick={(e) => { e.stopPropagation(); skipExperiment(i, '用户手动跳过'); }}
                      title="跳过此实验"
                    >
                      <SkipForward className="w-3 h-3 text-slate-400" />
                    </button>
                  )}
                  {(exp.status === 'complete' || exp.status === 'failed' || exp.status === 'skipped') && (
                    <button className="p-0.5" onClick={(e) => { e.stopPropagation(); setExpandedIndex(expandedIndex === i ? null : i); }}>
                      {expandedIndex === i ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
                    </button>
                  )}
                </div>

                {/* 展开的结果详情 */}
                {expandedIndex === i && exp.status === 'complete' && exp.result && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="mt-2 pt-2 border-t border-slate-700/30"
                  >
                    <div className="grid grid-cols-2 gap-1 text-[10px]">
                      <div className="text-slate-400">
                        峰值应力: <span className="text-white">{exp.result.peakStress.toFixed(1)} MPa</span>
                      </div>
                      <div className="text-slate-400">
                        应变率: <span className="text-white">{exp.result.strainRate.toFixed(0)} /s</span>
                      </div>
                      <div className="text-slate-400">
                        屈服强度: <span className="text-white">{exp.result.yieldStrength.toFixed(1)} MPa</span>
                      </div>
                      <div className="text-slate-400">
                        能量吸收: <span className="text-white">{exp.result.energyAbsorption.toFixed(0)} J/m³</span>
                      </div>
                      <div className="text-slate-400">
                        最大应变: <span className="text-white">{exp.result.maxStrain.toFixed(2)}%</span>
                      </div>
                      <div className="text-slate-400">
                        持续时间: <span className="text-white">{exp.result.duration.toFixed(0)} μs</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 跳过/失败原因 */}
                {expandedIndex === i && (exp.status === 'skipped' || exp.status === 'failed') && exp.failReason && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="mt-2 pt-2 border-t border-slate-700/30"
                  >
                    <p className="text-[10px] text-yellow-400/80">{exp.failReason}</p>
                  </motion.div>
                )}
              </motion.div>

              {/* 中间分析节点 */}
              {analysisAfter && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mx-4 my-1 p-2 bg-purple-500/10 rounded-lg border border-purple-500/20"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-2 h-2 rounded-full bg-purple-400" />
                    <span className="text-[10px] font-medium text-purple-300">AI 分析</span>
                  </div>
                  <p className="text-[10px] text-slate-300 leading-relaxed">{analysisAfter.observation}</p>
                  {analysisAfter.addedExperiments && analysisAfter.addedExperiments.length > 0 && (
                    <p className="text-[10px] text-purple-400 mt-1">
                      +{analysisAfter.addedExperiments.length} 个追加实验
                    </p>
                  )}
                </motion.div>
              )}
            </div>
          );
        })}
      </div>

      {/* 控制按钮 */}
      <div className="flex gap-2">
        {isRunning && (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
            onClick={pause}
          >
            <Pause className="w-3.5 h-3.5 mr-1" />
            暂停
          </Button>
        )}
        {isPaused && (
          <Button
            size="sm"
            className="flex-1 h-8 text-xs bg-blue-600 hover:bg-blue-500"
            onClick={resume}
          >
            <Play className="w-3.5 h-3.5 mr-1" />
            继续
          </Button>
        )}
        {(isRunning || isPaused || isAnalyzing) && (
          showAbortConfirm ? (
            <div className="flex gap-1 flex-1">
              <Button
                size="sm"
                variant="ghost"
                className="flex-1 h-8 text-xs"
                onClick={() => setShowAbortConfirm(false)}
              >
                取消
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1 h-8 text-xs"
                onClick={() => { abort(); setShowAbortConfirm(false); }}
              >
                确认终止
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
              onClick={() => setShowAbortConfirm(true)}
            >
              <Square className="w-3.5 h-3.5 mr-1" />
              终止
            </Button>
          )
        )}
      </div>
    </div>
  );
}
