// src/features/autonomous-experiment/IntermediateAnalysisCard.tsx
// AI 中间分析结果展示卡片
import { motion } from 'framer-motion';
import { Brain, TrendingUp, AlertCircle, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { IntermediateAnalysis } from '@/types';

interface Props {
  analysis: IntermediateAnalysis;
  index: number;
}

export default function IntermediateAnalysisCard({ analysis, index }: Props) {
  const decisionConfig = {
    continue: { label: '继续执行', color: 'text-green-400', bg: 'bg-green-500/10' },
    add_experiments: { label: '追加实验', color: 'text-purple-400', bg: 'bg-purple-500/10' },
    abort: { label: '建议终止', color: 'text-red-400', bg: 'bg-red-500/10' },
  };

  const config = decisionConfig[analysis.decision];

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="bg-slate-800/40 rounded-lg border border-slate-700/50 p-3"
    >
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-2">
        <Brain className="w-4 h-4 text-purple-400" />
        <span className="text-xs font-medium text-white">
          第 {analysis.afterExperimentIndex + 1} 个实验后分析
        </span>
        <Badge variant="outline" className={`ml-auto text-[10px] ${config.color}`}>
          {config.label}
        </Badge>
      </div>

      {/* 观察结果 */}
      <div className="flex items-start gap-2 mb-2">
        <TrendingUp className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
        <p className="text-xs text-slate-300 leading-relaxed">{analysis.observation}</p>
      </div>

      {/* 推理依据 */}
      <div className="flex items-start gap-2">
        <AlertCircle className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
        <p className="text-[10px] text-slate-500 leading-relaxed">{analysis.reasoning}</p>
      </div>

      {/* 追加实验 */}
      {analysis.addedExperiments && analysis.addedExperiments.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-700/30">
          <div className="flex items-center gap-1.5 mb-1">
            <Plus className="w-3 h-3 text-purple-400" />
            <span className="text-[10px] text-purple-400">追加 {analysis.addedExperiments.length} 个实验</span>
          </div>
          {analysis.addedExperiments.map((exp, i) => (
            <div key={i} className="text-[10px] text-slate-400 ml-4">
              {exp.materialName} — {exp.voltage}V — {exp.rationale}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
