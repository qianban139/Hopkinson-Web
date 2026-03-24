// src/components/MonitorStrip.tsx
// 全局底部安全监控条 - 在所有页面显示关键指标
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Activity, Zap, Thermometer, Radio, Battery, ChevronUp, ChevronDown, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useExperimentDataBus } from '@/store/useExperimentDataBus';

export default function MonitorStrip() {
  const monitorData = useAppStore(s => s.monitorData);
  const safetyChecklistCompleted = useExperimentDataBus(s => s.safetyChecklistCompleted);
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  if (!monitorData) return null;

  const { voltage = 0, current = 0, capacitance = 0, temperature = 0, emi = 0 } = monitorData;

  // Alert level detection (电压范围0-4000V, 电流0-50000A, 温度0-80°C, EMI 0-100dB)
  const hasWarning = voltage > 3200 || temperature > 65 || emi > 82;
  const hasDanger = voltage > 3500 || temperature > 80 || emi > 92;
  const stripColor = hasDanger ? 'border-red-500/40' : hasWarning ? 'border-yellow-500/30' : 'border-[#00F5FF]/15';
  const stripBg = hasDanger ? 'bg-red-950/60' : hasWarning ? 'bg-yellow-950/40' : 'bg-[#051020]/90';

  const indicators = [
    { icon: Zap, label: '电压', value: `${voltage.toFixed(0)}V`, color: voltage > 3500 ? '#EF4444' : voltage > 3200 ? '#F59E0B' : '#00F5FF' },
    { icon: Activity, label: '电流', value: `${(current / 1000).toFixed(1)}kA`, color: '#10B981' },
    { icon: Battery, label: '储能', value: `${capacitance.toFixed(0)}%`, color: capacitance < 25 ? '#F59E0B' : '#00F5FF' },
    { icon: Thermometer, label: '温度', value: `${temperature.toFixed(0)}°C`, color: temperature > 80 ? '#EF4444' : temperature > 65 ? '#F59E0B' : '#10B981' },
    { icon: Radio, label: 'EMI', value: `${emi.toFixed(0)}dB`, color: emi > 92 ? '#EF4444' : emi > 82 ? '#F59E0B' : '#8B5CF6' },
  ];

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-40 ${stripBg} backdrop-blur-md border-t ${stripColor} transition-colors duration-300`}>
      {/* Compact strip */}
      <div className="h-7 flex items-center justify-between px-4">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-white/40 hover:text-white/70 transition-colors mr-1"
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>

          {/* Safety status */}
          <button
            onClick={() => navigate('/monitor')}
            className="flex items-center gap-1 mr-3 hover:opacity-80 transition-opacity"
          >
            {safetyChecklistCompleted ? (
              <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
            ) : (
              <ShieldAlert className="w-3.5 h-3.5 text-[#F59E0B]" />
            )}
            <span className="text-[10px] text-white/40">
              {safetyChecklistCompleted ? '安全✓' : '未检查'}
            </span>
          </button>

          {/* Indicators */}
          {indicators.map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="flex items-center gap-1 px-2">
              <Icon className="w-3 h-3" style={{ color }} />
              <span className="text-[10px] text-white/40">{label}</span>
              <span className="text-[10px] font-mono font-medium" style={{ color }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Warning indicators */}
        <div className="flex items-center gap-2">
          {hasDanger && (
            <motion.span
              className="text-[10px] text-red-400 font-medium"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            >
              ⚠ 危险
            </motion.span>
          )}
          {hasWarning && !hasDanger && (
            <span className="text-[10px] text-yellow-400">⚠ 警告</span>
          )}
          <button
            onClick={() => navigate('/monitor')}
            className="text-[10px] text-[#00F5FF]/60 hover:text-[#00F5FF] transition-colors"
          >
            详细监控 →
          </button>
        </div>
      </div>

      {/* Expanded view */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="px-4 py-2 grid grid-cols-5 gap-3">
              {indicators.map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.03]">
                  <Icon className="w-4 h-4" style={{ color }} />
                  <div>
                    <div className="text-[10px] text-white/40">{label}</div>
                    <div className="text-sm font-mono font-medium" style={{ color }}>{value}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
