// src/components/ExperimentResults.tsx
// 实验完成后的结果摘要卡片 - 关键指标 + 一键导出
import { useRef } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, Zap, Activity, Clock,
  FileSpreadsheet, FileJson, Printer,
} from 'lucide-react';
import { useExperimentWorkflow } from '@/store/experimentWorkflow';
import {
  exportResultsCSV,
  exportExperimentJSON,
  exportExperimentReport,
} from '@/services/exportService';

// 指标卡片
function MetricCard({ label, value, unit, icon: Icon, color, delay }: {
  label: string;
  value: string | number;
  unit: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="data-card p-4 group"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs text-white/50">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-white font-mono">{value}</span>
        <span className="text-xs text-white/40">{unit}</span>
      </div>
    </motion.div>
  );
}

export default function ExperimentResultsPanel() {
  const { experimentResults, requirements } = useExperimentWorkflow();
  const panelRef = useRef<HTMLDivElement>(null);

  if (!experimentResults) return null;

  const r = experimentResults;

  const metrics = [
    { label: '峰值应力', value: r.peakStress, unit: 'MPa', icon: TrendingUp, color: 'bg-[#00F5FF]/15 text-[#00F5FF]' },
    { label: '实际应变率', value: r.strainRate, unit: '/s', icon: Zap, color: 'bg-amber-400/15 text-amber-400' },
    { label: '屈服强度', value: r.yieldStrength, unit: 'MPa', icon: Activity, color: 'bg-emerald-400/15 text-emerald-400' },
    { label: '最大应变', value: r.maxStrain, unit: '%', icon: TrendingUp, color: 'bg-purple-400/15 text-purple-400' },
    { label: '能量吸收', value: r.energyAbsorption, unit: 'J/m³', icon: Zap, color: 'bg-orange-400/15 text-orange-400' },
    { label: '持续时间', value: r.duration, unit: 'μs', icon: Clock, color: 'bg-blue-400/15 text-blue-400' },
  ];

  const waveMetrics = [
    { label: '入射波', value: r.incidentWavePeak, color: 'text-blue-400', barColor: 'bg-blue-400' },
    { label: '反射波', value: r.reflectedWavePeak, color: 'text-red-400', barColor: 'bg-red-400' },
    { label: '透射波', value: r.transmittedWavePeak, color: 'text-emerald-400', barColor: 'bg-emerald-400' },
  ];
  const maxWave = Math.max(r.incidentWavePeak, r.reflectedWavePeak, r.transmittedWavePeak);

  const handleExportCSV = () => exportResultsCSV(r, requirements);
  const handleExportJSON = () => exportExperimentJSON(r, requirements);
  const handleExportReport = () => exportExperimentReport(r, requirements);

  return (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 ai-pulse-ring" />
            实验结果
          </h2>
          <p className="text-xs text-white/40 mt-1">
            {requirements.materialName} · {requirements.testType === 'compression' ? '压缩' : requirements.testType === 'tension' ? '拉伸' : '剪切'}测试
          </p>
        </div>
      </div>

      {/* 关键指标网格 */}
      <div className="grid grid-cols-3 gap-3">
        {metrics.map((m, i) => (
          <MetricCard key={m.label} {...m} delay={i * 0.08} />
        ))}
      </div>

      {/* 三波信号对比 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="data-card p-4"
      >
        <h3 className="text-sm font-semibold text-white/80 mb-3">三波信号峰值 (MPa)</h3>
        <div className="space-y-3">
          {waveMetrics.map(wm => (
            <div key={wm.label} className="flex items-center gap-3">
              <span className={`text-xs w-14 text-right ${wm.color}`}>{wm.label}</span>
              <div className="flex-1 h-5 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(wm.value / maxWave) * 100}%` }}
                  transition={{ delay: 0.7, duration: 0.8, ease: 'easeOut' }}
                  className={`h-full ${wm.barColor} rounded-full flex items-center justify-end pr-2`}
                >
                  <span className="text-[10px] font-mono text-white font-bold">{wm.value}</span>
                </motion.div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* 导出按钮组 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="grid grid-cols-2 gap-2"
      >
        <button
          onClick={handleExportCSV}
          className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#00F5FF]/10 border border-[#00F5FF]/20 text-sm text-[#00F5FF] hover:bg-[#00F5FF]/20 transition-colors"
        >
          <FileSpreadsheet className="w-4 h-4" />
          导出CSV
        </button>
        <button
          onClick={handleExportJSON}
          className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-400/10 border border-amber-400/20 text-sm text-amber-400 hover:bg-amber-400/20 transition-colors"
        >
          <FileJson className="w-4 h-4" />
          导出JSON
        </button>
        <button
          onClick={handleExportReport}
          className="col-span-2 flex items-center justify-center gap-2 py-3 rounded-lg bg-gradient-to-r from-[#00F5FF]/20 to-[#0080FF]/20 border border-[#00F5FF]/30 text-sm text-white font-medium hover:from-[#00F5FF]/30 hover:to-[#0080FF]/30 transition-all"
        >
          <Printer className="w-4 h-4 text-[#00F5FF]" />
          生成实验报告 (PDF)
        </button>
      </motion.div>
    </motion.div>
  );
}
