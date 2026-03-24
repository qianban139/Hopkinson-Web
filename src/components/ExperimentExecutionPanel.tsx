// src/components/ExperimentExecutionPanel.tsx
// 自动实验执行面板 - 安全检查通过后显示执行过程
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle, Zap } from 'lucide-react';
import { useExperimentWorkflow, type ExperimentResults } from '@/store/experimentWorkflow';

interface ExperimentExecutionPanelProps {
  onComplete: (results: ExperimentResults) => void;
}

// 模拟执行时间 (毫秒)
const STEP_DURATIONS: Record<string, number> = {
  init:    1500,
  charge:  2500,
  ready:   1000,
  launch:  1800,
  capture: 2000,
  process: 2200,
  result:  1500,
};

export default function ExperimentExecutionPanel({ onComplete }: ExperimentExecutionPanelProps) {
  const { executionSteps, updateExecutionStep, requirements } = useExperimentWorkflow();
  const [countdown, setCountdown] = useState<number | null>(null);
  const [chargeLevel, setChargeLevel] = useState(0);
  const hasStartedRef = useRef(false);

  // 模拟实验执行过程
  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    let totalDelay = 0;

    executionSteps.forEach((step, index) => {
      const duration = STEP_DURATIONS[step.id] || 1500;

      // 开始此步骤
      setTimeout(() => {
        updateExecutionStep(step.id, { status: 'running', progress: 0 });

        // 进度动画
        const progressInterval = setInterval(() => {
          updateExecutionStep(step.id, {
            progress: Math.min(100, (Date.now() - (totalDelay + performance.now() - performance.now())) % 100 + Math.random() * 30),
          });
        }, 200);

        // 特殊效果：电容充能进度
        if (step.id === 'charge') {
          const chargeInterval = setInterval(() => {
            setChargeLevel(prev => {
              const next = prev + 4;
              if (next >= 100) { clearInterval(chargeInterval); return 100; }
              return next;
            });
          }, 100);
        }

        // 特殊效果：发射倒计时
        if (step.id === 'ready') {
          setCountdown(3);
          setTimeout(() => setCountdown(2), 300);
          setTimeout(() => setCountdown(1), 600);
          setTimeout(() => setCountdown(null), 900);
        }

        // 完成此步骤
        setTimeout(() => {
          clearInterval(progressInterval);
          updateExecutionStep(step.id, { status: 'complete', progress: 100 });

          // 最后一步完成 → 生成结果
          if (index === executionSteps.length - 1) {
            const results = generateResults(requirements.strainRate);
            setTimeout(() => onComplete(results), 500);
          }
        }, duration);
      }, totalDelay);

      totalDelay += duration + 300; // 步骤间留300ms间隔
    });
  }, []);

  return (
    <div className="w-full rounded-xl bg-[#051020] border border-[#00F5FF]/20 overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-[#00F5FF]/10 to-transparent border-b border-[#00F5FF]/10">
        <Zap className="w-4 h-4 text-[#00F5FF]" />
        <span className="text-sm font-semibold text-white">实验执行</span>
        <span className="ml-auto text-xs text-white/40">
          {executionSteps.filter(s => s.status === 'complete').length}/{executionSteps.length}
        </span>
      </div>

      {/* 执行步骤 */}
      <div className="p-3 space-y-1">
        {executionSteps.map((step, index) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0.5 }}
            animate={{ opacity: step.status === 'pending' ? 0.4 : 1 }}
            className="relative"
          >
            <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              step.status === 'running' ? 'bg-[#00F5FF]/10 border border-[#00F5FF]/30' :
              step.status === 'complete' ? 'bg-emerald-400/5' :
              'bg-transparent'
            }`}>
              {/* 状态图标 */}
              <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                {step.status === 'complete' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                ) : step.status === 'running' ? (
                  <Loader2 className="w-4 h-4 text-[#00F5FF] animate-spin" />
                ) : (
                  <div className="w-3 h-3 rounded-full border border-white/20" />
                )}
              </div>

              {/* 内容 */}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white/90 font-medium">{step.label}</div>
                {step.status === 'running' && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs text-[#00F5FF]/70 mt-0.5"
                  >
                    {step.description}
                  </motion.p>
                )}
              </div>

              {/* 进度 */}
              {step.status === 'running' && (
                <span className="text-xs text-[#00F5FF] font-mono">{Math.min(99, Math.round(step.progress))}%</span>
              )}
              {step.status === 'complete' && (
                <span className="text-xs text-emerald-400">完成</span>
              )}
            </div>

            {/* 连接线 */}
            {index < executionSteps.length - 1 && (
              <div className={`absolute left-[21px] top-[38px] w-0.5 h-2 ${
                step.status === 'complete' ? 'bg-emerald-400/30' : 'bg-white/10'
              }`} />
            )}
          </motion.div>
        ))}
      </div>

      {/* 特殊效果区 */}
      <AnimatePresence>
        {/* 充能仪表 */}
        {chargeLevel > 0 && chargeLevel < 100 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-3 mb-3 px-4 py-3 rounded-lg bg-[#00F5FF]/5 border border-[#00F5FF]/20"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/60">电容充能</span>
              <span className="text-sm text-[#00F5FF] font-mono font-bold">{chargeLevel}%</span>
            </div>
            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#00F5FF] to-[#0080FF] rounded-full"
                style={{ width: `${chargeLevel}%` }}
              />
            </div>
          </motion.div>
        )}

        {/* 发射倒计时 */}
        {countdown !== null && (
          <motion.div
            key={countdown}
            initial={{ scale: 2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            className="text-center py-4"
          >
            <span className="text-4xl font-bold text-[#00F5FF] font-mono">{countdown}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// 模拟生成实验结果
function generateResults(targetStrainRate: number): ExperimentResults {
  const strainRate = targetStrainRate * (0.9 + Math.random() * 0.2);
  const peakStress = 200 + strainRate * 0.08 + Math.random() * 50;
  return {
    peakStress: Math.round(peakStress),
    strainRate: Math.round(strainRate),
    energyAbsorption: Math.round(peakStress * 0.15 * 100) / 100,
    yieldStrength: Math.round(peakStress * 0.7),
    maxStrain: Math.round((8 + Math.random() * 12) * 100) / 100,
    duration: Math.round(150 + Math.random() * 200),
    incidentWavePeak: Math.round(peakStress * 1.4),
    reflectedWavePeak: Math.round(peakStress * 0.3),
    transmittedWavePeak: Math.round(peakStress * 0.7),
  };
}
