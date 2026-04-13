// src/features/autonomous-experiment/AutoExperimentReport.tsx
// 自主实验最终报告展示面板
import { motion } from 'framer-motion';
import {
  FileText, TrendingUp, Lightbulb, BarChart3,
  Download, RotateCcw, CheckCircle2, XCircle, SkipForward,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAutonomousExperimentStore } from '@/store/useAutonomousExperimentStore';
import { downloadReport } from '@/services/reportGenerator';
import { buildAutoExperimentMarkdown } from '@/features/ai-assistant/services/autoReportExporter';
import IntermediateAnalysisCard from './IntermediateAnalysisCard';

export default function AutoExperimentReport() {
  const report = useAutonomousExperimentStore(s => s.report);
  const reset = useAutonomousExperimentStore(s => s.reset);

  if (!report) return null;

  const { plan, completedExperiments, analyses, summary, findings, recommendations } = report;
  const totalPlanned = plan.experiments.length;
  const skipped = plan.experiments.filter(e => e.status === 'skipped').length;
  const failed = plan.experiments.filter(e => e.status === 'failed').length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full"
    >
      {/* 报告标题 */}
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-5 h-5 text-blue-400" />
        <h3 className="text-sm font-medium text-white">实验报告</h3>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-3">
        {/* 统计概览 */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-green-500/10 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <CheckCircle2 className="w-3 h-3 text-green-400" />
              <span className="text-lg font-bold text-green-400">{completedExperiments.length}</span>
            </div>
            <span className="text-[10px] text-slate-400">完成</span>
          </div>
          {skipped > 0 && (
            <div className="bg-yellow-500/10 rounded-lg p-2 text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <SkipForward className="w-3 h-3 text-yellow-400" />
                <span className="text-lg font-bold text-yellow-400">{skipped}</span>
              </div>
              <span className="text-[10px] text-slate-400">跳过</span>
            </div>
          )}
          {failed > 0 && (
            <div className="bg-red-500/10 rounded-lg p-2 text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <XCircle className="w-3 h-3 text-red-400" />
                <span className="text-lg font-bold text-red-400">{failed}</span>
              </div>
              <span className="text-[10px] text-slate-400">失败</span>
            </div>
          )}
          <div className="bg-slate-500/10 rounded-lg p-2 text-center">
            <span className="text-lg font-bold text-slate-300">{totalPlanned}</span>
            <div className="text-[10px] text-slate-400">总计</div>
          </div>
        </div>

        {/* 摘要 */}
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-medium text-white">研究摘要</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{summary}</p>
        </div>

        {/* 结果表 */}
        {completedExperiments.length > 0 && (
          <div className="bg-slate-800/50 rounded-lg p-3">
            <span className="text-xs font-medium text-white mb-2 block">实验结果</span>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-700/50">
                    <th className="text-left py-1 pr-2">#</th>
                    <th className="text-left py-1 pr-2">材料</th>
                    <th className="text-right py-1 pr-2">电压</th>
                    <th className="text-right py-1 pr-2">峰值应力</th>
                    <th className="text-right py-1 pr-2">应变率</th>
                    <th className="text-right py-1">能量</th>
                  </tr>
                </thead>
                <tbody>
                  {completedExperiments.map((exp, i) => (
                    <tr key={exp.id} className="text-slate-300 border-b border-slate-800/50">
                      <td className="py-1 pr-2 text-slate-500">{i + 1}</td>
                      <td className="py-1 pr-2 truncate max-w-[60px]">{exp.materialName}</td>
                      <td className="py-1 pr-2 text-right">{exp.voltage}V</td>
                      <td className="py-1 pr-2 text-right font-mono">{exp.result?.peakStress.toFixed(0)}</td>
                      <td className="py-1 pr-2 text-right font-mono">{exp.result?.strainRate.toFixed(0)}</td>
                      <td className="py-1 text-right font-mono">{exp.result?.energyAbsorption.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 关键发现 */}
        {findings.length > 0 && (
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs font-medium text-white">关键发现</span>
            </div>
            <ul className="space-y-1">
              {findings.map((f, i) => (
                <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                  <span className="text-green-400 mt-0.5">-</span>
                  <span className="leading-relaxed">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 后续建议 */}
        {recommendations.length > 0 && (
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-xs font-medium text-white">后续建议</span>
            </div>
            <ul className="space-y-1">
              {recommendations.map((r, i) => (
                <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                  <span className="text-yellow-400 mt-0.5">-</span>
                  <span className="leading-relaxed">{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 中间分析记录 */}
        {analyses.length > 0 && (
          <div>
            <span className="text-xs font-medium text-white mb-2 block">AI 分析记录</span>
            <div className="space-y-2">
              {analyses.map((a, i) => (
                <IntermediateAnalysisCard key={i} analysis={a} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 底部操作 */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-8 text-xs"
          onClick={reset}
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1" />
          新实验
        </Button>
        <Button
          size="sm"
          className="flex-1 h-8 text-xs bg-blue-600 hover:bg-blue-500"
          onClick={() => {
            const ts = new Date(report.generatedAt).toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const md = buildAutoExperimentMarkdown(report);
            downloadReport(md, `autonomous-experiment-${ts}.md`, 'text/markdown;charset=utf-8');
            downloadReport(JSON.stringify(report, null, 2), `autonomous-experiment-${ts}.json`, 'application/json');
          }}
        >
          <Download className="w-3.5 h-3.5 mr-1" />
          导出报告
        </Button>
      </div>
    </motion.div>
  );
}
