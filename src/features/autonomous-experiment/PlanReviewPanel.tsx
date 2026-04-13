// src/features/autonomous-experiment/PlanReviewPanel.tsx
// 实验计划审批面板 — 展示计划详情，支持编辑、批准、拒绝
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2, XCircle, Edit3, Zap, Thermometer, Target,
  ChevronDown, ChevronUp, AlertTriangle, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAutonomousExperimentStore } from '@/store/useAutonomousExperimentStore';

const strategyLabels: Record<string, { label: string; icon: JSX.Element; color: string }> = {
  strain_rate_sweep: { label: '应变率扫描', icon: <Zap className="w-4 h-4" />, color: 'text-blue-400' },
  temperature_sweep: { label: '温度扫描', icon: <Thermometer className="w-4 h-4" />, color: 'text-orange-400' },
  material_comparison: { label: '材料对比', icon: <Target className="w-4 h-4" />, color: 'text-green-400' },
  parameter_optimization: { label: '参数优化', icon: <Zap className="w-4 h-4" />, color: 'text-purple-400' },
  custom: { label: '自定义', icon: <Info className="w-4 h-4" />, color: 'text-gray-400' },
};

export default function PlanReviewPanel() {
  const plan = useAutonomousExperimentStore(s => s.plan);
  const approvePlan = useAutonomousExperimentStore(s => s.approvePlan);
  const rejectPlan = useAutonomousExperimentStore(s => s.rejectPlan);
  const editExperiment = useAutonomousExperimentStore(s => s.editExperiment);
  const removeExperiment = useAutonomousExperimentStore(s => s.removeExperiment);

  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{ voltage?: number; temperature?: number }>({});

  if (!plan) return null;

  const strategyInfo = strategyLabels[plan.strategy] || strategyLabels.custom;
  const totalTime = plan.experiments.length * 13; // 约13秒/实验

  const handleSaveEdit = (index: number) => {
    if (editValues.voltage !== undefined || editValues.temperature !== undefined) {
      editExperiment(index, editValues);
    }
    setEditingIndex(null);
    setEditValues({});
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col h-full"
    >
      {/* 策略概述 */}
      <div className="p-3 bg-slate-800/50 rounded-lg mb-3">
        <div className="flex items-center gap-2 mb-2">
          <span className={strategyInfo.color}>{strategyInfo.icon}</span>
          <span className="text-sm font-medium text-white">{strategyInfo.label}</span>
          <Badge variant="outline" className="ml-auto text-xs">
            {plan.experiments.length} 个实验
          </Badge>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">{plan.rationale}</p>
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
          <span>预计耗时 ~{totalTime}s</span>
          <span>|</span>
          <span>目标: {plan.goal}</span>
        </div>
      </div>

      {/* 实验列表 */}
      <div className="flex-1 overflow-y-auto space-y-2 mb-3 pr-1">
        {plan.experiments.map((exp, i) => (
          <motion.div
            key={exp.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-slate-800/30 rounded-lg border border-slate-700/50 overflow-hidden"
          >
            {/* 实验头部 */}
            <div
              className="flex items-center gap-2 p-2.5 cursor-pointer hover:bg-slate-700/30 transition-colors"
              onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
            >
              <span className="text-xs font-mono text-slate-500 w-5">#{i + 1}</span>
              <span className="text-sm text-white flex-1 truncate">{exp.materialName}</span>
              <Badge variant="outline" className="text-[10px] px-1.5">
                {exp.voltage}V
              </Badge>
              {exp.temperature > 25 && (
                <Badge variant="outline" className="text-[10px] px-1.5 text-orange-400 border-orange-400/30">
                  {exp.temperature}°C
                </Badge>
              )}
              <button className="p-0.5" onClick={(e) => { e.stopPropagation(); setExpandedIndex(expandedIndex === i ? null : i); }}>
                {expandedIndex === i ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
              </button>
            </div>

            {/* 展开详情 */}
            {expandedIndex === i && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                className="border-t border-slate-700/50 p-2.5"
              >
                <p className="text-xs text-slate-400 mb-2">{exp.rationale}</p>

                {editingIndex === i ? (
                  // 编辑模式
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 w-12">电压:</span>
                      <Input
                        type="number"
                        min={1000}
                        max={4000}
                        value={editValues.voltage ?? exp.voltage}
                        onChange={(e) => setEditValues({ ...editValues, voltage: Number(e.target.value) })}
                        className="h-7 text-xs bg-slate-900/50"
                      />
                      <span className="text-xs text-slate-500">V</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 w-12">温度:</span>
                      <Input
                        type="number"
                        min={25}
                        max={800}
                        value={editValues.temperature ?? exp.temperature}
                        onChange={(e) => setEditValues({ ...editValues, temperature: Number(e.target.value) })}
                        className="h-7 text-xs bg-slate-900/50"
                      />
                      <span className="text-xs text-slate-500">°C</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { setEditingIndex(null); setEditValues({}); }}>
                        取消
                      </Button>
                      <Button size="sm" className="h-6 text-xs" onClick={() => handleSaveEdit(i)}>
                        保存
                      </Button>
                    </div>
                  </div>
                ) : (
                  // 查看模式
                  <div className="flex items-center gap-1">
                    <div className="grid grid-cols-2 gap-1 flex-1 text-[10px] text-slate-500">
                      <span>电压: {exp.voltage}V</span>
                      <span>电流: {(exp.current / 1000).toFixed(1)}kA</span>
                      <span>脉宽: {exp.pulseWidth}μs</span>
                      <span>温度: {exp.temperature}°C</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => { setEditingIndex(i); setEditValues({}); }}
                    >
                      <Edit3 className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                      onClick={() => removeExperiment(i)}
                    >
                      <XCircle className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      {/* 安全提示 */}
      <div className="flex items-start gap-2 p-2 bg-amber-500/10 rounded-lg border border-amber-500/20 mb-3">
        <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
        <p className="text-[10px] text-amber-300/80 leading-relaxed">
          每个实验执行前将自动进行安全检查。超出安全阈值的实验将被自动跳过。执行期间可随时暂停或终止。
        </p>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-9 text-sm border-slate-600 hover:bg-slate-700"
          onClick={rejectPlan}
        >
          <XCircle className="w-4 h-4 mr-1.5" />
          拒绝
        </Button>
        <Button
          size="sm"
          className="flex-1 h-9 text-sm bg-blue-600 hover:bg-blue-500"
          onClick={approvePlan}
        >
          <CheckCircle2 className="w-4 h-4 mr-1.5" />
          批准执行
        </Button>
      </div>
    </motion.div>
  );
}
