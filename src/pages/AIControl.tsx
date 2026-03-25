import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Brain, Activity, Target, TrendingUp, Zap, Layers,
  CheckCircle2, AlertCircle, RefreshCw, Cpu,
  Sparkles, Play, Pause, Settings, Lightbulb,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import * as echarts from 'echarts';
import { useExperimentDataBus } from '@/store/useExperimentDataBus';
import { useAppStore } from '@/store/useAppStore';
import GlowCard from '@/shared/components/GlowCard';
import ModuleConnectionBadge from '@/shared/components/ModuleConnectionBadge';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';

/* ─── Constants ─── */

const CYAN = '#00F5FF';
const ORANGE = '#FF9F43';
const GREEN = '#1DD1A1';
const PURPLE = '#A855F6';
const BG = '#0A2540';
const CARD_BG = '#051020';

interface AlgoConfig {
  id: 'lstm' | 'wgan' | 'ppo';
  name: string;
  fullName: string;
  color: string;
  icon: typeof Brain;
  params: { name: string; value: number; range: [number, number]; step: number }[];
  defaultAccuracy: number;
}

const algorithms: AlgoConfig[] = [
  {
    id: 'lstm', name: 'LSTM 时序预测', fullName: 'Long Short-Term Memory',
    color: CYAN, icon: Brain, defaultAccuracy: 0.924,
    params: [
      { name: '学习率', value: 0.001, range: [0.0001, 0.01], step: 0.0001 },
      { name: '隐藏层数', value: 128, range: [64, 256], step: 8 },
      { name: '批大小', value: 32, range: [16, 128], step: 8 },
      { name: '训练轮数', value: 100, range: [20, 300], step: 10 },
    ],
  },
  {
    id: 'wgan', name: 'WGAN-GP 波形生成', fullName: 'Wasserstein GAN + Gradient Penalty',
    color: ORANGE, icon: Layers, defaultAccuracy: 0.881,
    params: [
      { name: '学习率', value: 0.0002, range: [0.00005, 0.005], step: 0.00005 },
      { name: '生成器层数', value: 4, range: [2, 8], step: 1 },
      { name: '批大小', value: 64, range: [16, 128], step: 8 },
      { name: '训练轮数', value: 200, range: [50, 500], step: 10 },
    ],
  },
  {
    id: 'ppo', name: 'PPO 策略优化', fullName: 'Proximal Policy Optimization',
    color: GREEN, icon: Target, defaultAccuracy: 0.951,
    params: [
      { name: '学习率', value: 0.0003, range: [0.00005, 0.005], step: 0.00005 },
      { name: '裁剪比率', value: 0.2, range: [0.1, 0.4], step: 0.01 },
      { name: '批大小', value: 64, range: [16, 256], step: 16 },
      { name: '策略迭代', value: 10, range: [3, 30], step: 1 },
    ],
  },
];

const pipelineSteps = [
  { id: 'data', label: '数据采集', color: '#3B82F6' },
  { id: 'lstm', label: 'LSTM预测', color: CYAN },
  { id: 'wgan', label: 'WGAN生成', color: ORANGE },
  { id: 'ppo', label: 'PPO优化', color: GREEN },
  { id: 'output', label: '结果', color: PURPLE },
];

/* ─── Helpers ─── */

function generateLossCurve(n: number, start: number, end: number, noise: number): number[] {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const base = start * Math.exp(-3 * t) + end * (1 - Math.exp(-3 * t));
    return parseFloat((base + (Math.random() - 0.5) * noise * Math.exp(-2 * t)).toFixed(4));
  });
}

function generateRewardCurve(n: number): number[] {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return parseFloat((-1 + 1.87 * (1 - Math.exp(-4 * t)) + (Math.random() - 0.5) * 0.15 * Math.exp(-2 * t)).toFixed(3));
  });
}

/* ─── Pipeline Bar with Pulse Glow ─── */

function PipelineBar({ activeStep, completedSteps }: { activeStep: string | null; completedSteps: string[] }) {
  return (
    <div className="flex items-center gap-0 w-full">
      {pipelineSteps.map((step, idx) => {
        const isActive = activeStep === step.id;
        const isComplete = completedSteps.includes(step.id);
        return (
          <div key={step.id} className="flex items-center flex-1 min-w-0">
            <motion.div
              className="flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-lg text-xs font-semibold truncate relative overflow-hidden"
              style={{
                backgroundColor: isActive ? `${step.color}20` : isComplete ? `${step.color}12` : 'rgba(255,255,255,0.03)',
                color: isActive || isComplete ? step.color : 'rgba(255,255,255,0.25)',
                border: `1px solid ${isActive ? `${step.color}60` : isComplete ? `${step.color}30` : 'rgba(255,255,255,0.06)'}`,
              }}
              animate={isActive ? {
                boxShadow: [
                  `0 0 8px ${step.color}20, 0 0 20px ${step.color}10`,
                  `0 0 16px ${step.color}40, 0 0 40px ${step.color}20`,
                  `0 0 8px ${step.color}20, 0 0 20px ${step.color}10`,
                ],
              } : { boxShadow: '0 0 0px transparent' }}
              transition={isActive ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}}
            >
              {/* Pulse glow overlay for active step */}
              {isActive && (
                <motion.div
                  className="absolute inset-0 rounded-lg"
                  style={{ background: `radial-gradient(ellipse at center, ${step.color}15, transparent 70%)` }}
                  animate={{ opacity: [0.5, 1, 0.5], scale: [0.95, 1.02, 0.95] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              {isComplete && <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 relative z-10" />}
              {isActive && (
                <motion.div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 relative z-10"
                  style={{ backgroundColor: step.color }}
                  animate={{ opacity: [1, 0.3, 1], scale: [1, 1.3, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                />
              )}
              <span className="truncate relative z-10">{step.label}</span>
            </motion.div>
            {idx < pipelineSteps.length - 1 && (
              <motion.div
                className="w-8 flex items-center justify-center flex-shrink-0"
                animate={isComplete ? { color: step.color } : {}}
              >
                <svg width="20" height="12" viewBox="0 0 20 12">
                  <motion.path
                    d="M2 6 L14 6 M11 2 L15 6 L11 10"
                    stroke={isComplete ? step.color : 'rgba(255,255,255,0.15)'}
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    animate={isActive ? { stroke: [step.color + '60', step.color, step.color + '60'] } : {}}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                </svg>
              </motion.div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Training Chart (ECharts) ─── */

function TrainingChart({ algoId, color, triggerKey, progress = 100 }: { algoId: string; color: string; triggerKey: number; progress?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const instance = useRef<echarts.ECharts | null>(null);
  const fullDataRef = useRef<{ xData: number[]; seriesData: number[][]; isPPO: boolean } | null>(null);

  // Generate full data once when triggerKey changes
  useEffect(() => {
    const n = 100;
    const xData = Array.from({ length: n }, (_, i) => i + 1);
    const isPPO = algoId === 'ppo';
    const seriesData: number[][] = isPPO
      ? [generateRewardCurve(n)]
      : [generateLossCurve(n, 2.5, 0.12, 0.3), generateLossCurve(n, 2.8, 0.18, 0.4)];
    fullDataRef.current = { xData, seriesData, isPPO };
  }, [algoId, triggerKey]);

  useEffect(() => {
    if (!ref.current || !fullDataRef.current) return;
    if (!instance.current) {
      instance.current = echarts.init(ref.current);
    }

    const { xData, seriesData, isPPO } = fullDataRef.current;
    const n = xData.length;
    const visibleCount = Math.max(1, Math.floor(n * progress / 100));
    const visibleX = xData.slice(0, visibleCount);

    const series: echarts.SeriesOption[] = isPPO
      ? [{
          name: '累计奖励', type: 'line', data: seriesData[0].slice(0, visibleCount), smooth: true,
          lineStyle: { color, width: 2 }, symbol: 'none',
          areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: `${color}30` }, { offset: 1, color: `${color}05` }]) },
          itemStyle: { color },
        }]
      : [
          {
            name: '训练损失', type: 'line', data: seriesData[0].slice(0, visibleCount), smooth: true,
            lineStyle: { color, width: 2 }, symbol: 'none',
            areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: `${color}25` }, { offset: 1, color: `${color}05` }]) },
            itemStyle: { color },
          },
          {
            name: '验证损失', type: 'line', data: seriesData[1].slice(0, visibleCount), smooth: true,
            lineStyle: { color: `${color}80`, width: 1.5, type: 'dashed' }, symbol: 'none',
            itemStyle: { color: `${color}80` },
          },
        ];

    instance.current.setOption({
      backgroundColor: 'transparent',
      grid: { top: 35, right: 15, bottom: 30, left: 50 },
      tooltip: { trigger: 'axis', backgroundColor: '#0D2847', borderColor: `${color}40`, textStyle: { color: '#fff', fontSize: 11 } },
      legend: { top: 0, textStyle: { color: '#fff8', fontSize: 10 }, itemWidth: 16, itemHeight: 8 },
      xAxis: { type: 'category', data: visibleX, axisLine: { lineStyle: { color: '#ffffff20' } }, axisLabel: { color: '#ffffff60', fontSize: 10 }, name: isPPO ? 'Episode' : 'Epoch', nameTextStyle: { color: '#ffffff40', fontSize: 10 } },
      yAxis: { type: 'value', axisLine: { lineStyle: { color: '#ffffff20' } }, axisLabel: { color: '#ffffff60', fontSize: 10 }, splitLine: { lineStyle: { color: '#ffffff08' } }, name: isPPO ? 'Reward' : 'Loss', nameTextStyle: { color: '#ffffff40', fontSize: 10 } },
      series,
    } as echarts.EChartsOption);

    const onResize = () => instance.current?.resize();
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); instance.current?.dispose(); instance.current = null; };
  }, [algoId, color, triggerKey, progress]);

  return <div ref={ref} className="w-full h-[320px]" />;
}

/* ─── Waveform Comparison Chart ─── */

function WaveformChart({ voltage, optimizedVoltage }: { voltage: number; optimizedVoltage: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const instance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    instance.current = echarts.init(ref.current);

    const n = 200;
    const timeAxis = Array.from({ length: n }, (_, i) => (i * 5).toFixed(0));
    const wave = (v: number, shift: number) =>
      Array.from({ length: n }, (_, i) => {
        const t = i / n;
        return parseFloat((v * 0.8 * Math.exp(-Math.pow((t - 0.35 + shift) / 0.12, 2)) * Math.sin(t * 30)).toFixed(1));
      });

    instance.current.setOption({
      backgroundColor: 'transparent',
      grid: { top: 40, right: 20, bottom: 35, left: 55 },
      tooltip: { trigger: 'axis', backgroundColor: '#0D2847', borderColor: `${CYAN}40`, textStyle: { color: '#fff', fontSize: 11 } },
      legend: { top: 5, textStyle: { color: '#fff8', fontSize: 11 }, data: ['原始波形', 'AI优化波形'] },
      xAxis: { type: 'category', data: timeAxis, axisLine: { lineStyle: { color: '#ffffff20' } }, axisLabel: { color: '#ffffff60', fontSize: 10, interval: 39 }, name: '时间 (us)', nameTextStyle: { color: '#ffffff40', fontSize: 10 } },
      yAxis: { type: 'value', axisLine: { lineStyle: { color: '#ffffff20' } }, axisLabel: { color: '#ffffff60', fontSize: 10 }, splitLine: { lineStyle: { color: '#ffffff08' } }, name: '应力 (MPa)', nameTextStyle: { color: '#ffffff40', fontSize: 10 } },
      series: [
        { name: '原始波形', type: 'line', data: wave(voltage, 0), smooth: true, lineStyle: { color: '#ffffff50', width: 1.5, type: 'dashed' }, itemStyle: { color: '#ffffff50' }, symbol: 'none' },
        {
          name: 'AI优化波形', type: 'line', data: wave(optimizedVoltage, -0.02), smooth: true,
          lineStyle: { color: CYAN, width: 2 }, itemStyle: { color: CYAN }, symbol: 'none',
          areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: `${CYAN}25` }, { offset: 1, color: `${CYAN}03` }]) },
        },
      ],
    } as echarts.EChartsOption);

    const onResize = () => instance.current?.resize();
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); instance.current?.dispose(); };
  }, [voltage, optimizedVoltage]);

  return <div ref={ref} className="w-full h-[260px]" />;
}

/* ─── Network Architecture Visualization ─── */

const networkLayers: Record<string, { layers: { name: string; nodes: number; color: string }[]; description: string }> = {
  lstm: {
    description: '时序数据 -> 嵌入层 -> LSTM层x2 -> 全连接 -> 预测输出',
    layers: [
      { name: 'Input', nodes: 4, color: '#3B82F6' },
      { name: 'Embed', nodes: 6, color: '#6366F1' },
      { name: 'LSTM-1', nodes: 8, color: CYAN },
      { name: 'LSTM-2', nodes: 8, color: CYAN },
      { name: 'Dense', nodes: 4, color: '#8B5CF6' },
      { name: 'Output', nodes: 2, color: '#10B981' },
    ],
  },
  wgan: {
    description: '噪声向量 -> 生成器网络 -> 判别器网络 -> Wasserstein距离',
    layers: [
      { name: 'Noise', nodes: 3, color: '#3B82F6' },
      { name: 'Gen-1', nodes: 6, color: ORANGE },
      { name: 'Gen-2', nodes: 8, color: ORANGE },
      { name: 'Gen-Out', nodes: 6, color: '#F59E0B' },
      { name: 'Disc-1', nodes: 6, color: '#EF4444' },
      { name: 'W-Dist', nodes: 1, color: '#10B981' },
    ],
  },
  ppo: {
    description: '状态观测 -> 共享网络 -> Actor(策略) / Critic(价值)',
    layers: [
      { name: 'State', nodes: 5, color: '#3B82F6' },
      { name: 'Shared-1', nodes: 6, color: '#6366F1' },
      { name: 'Shared-2', nodes: 8, color: GREEN },
      { name: 'Actor', nodes: 5, color: '#F59E0B' },
      { name: 'Critic', nodes: 3, color: '#EF4444' },
      { name: 'Action', nodes: 2, color: '#10B981' },
    ],
  },
};

function NetworkArchViz({ algoId }: { algoId: string }) {
  const config = networkLayers[algoId];
  if (!config) return null;

  const svgW = 360;
  const svgH = 200;
  const layerGap = svgW / (config.layers.length + 1);

  return (
    <div className="bg-[#0F2847]/80 backdrop-blur-sm border border-cyan-500/10 rounded-xl p-4">
      <p className="text-[11px] text-white/40 mb-3">{config.description}</p>
      <svg width="100%" height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="overflow-visible">
        {/* Connection lines between layers */}
        {config.layers.map((layer, li) => {
          if (li === 0) return null;
          const prevLayer = config.layers[li - 1];
          const cx = layerGap * (li + 1);
          const px = layerGap * li;
          const lines: React.ReactNode[] = [];
          for (let pi = 0; pi < prevLayer.nodes; pi++) {
            const py = (svgH / (prevLayer.nodes + 1)) * (pi + 1);
            for (let ci = 0; ci < layer.nodes; ci++) {
              const cy = (svgH / (layer.nodes + 1)) * (ci + 1);
              lines.push(
                <line
                  key={`${li}-${pi}-${ci}`}
                  x1={px} y1={py} x2={cx} y2={cy}
                  stroke={`${layer.color}18`} strokeWidth="0.8"
                />
              );
            }
          }
          return <g key={`conn-${li}`}>{lines}</g>;
        })}
        {/* Layer nodes */}
        {config.layers.map((layer, li) => {
          const cx = layerGap * (li + 1);
          return (
            <g key={`layer-${li}`}>
              {Array.from({ length: layer.nodes }, (_, ni) => {
                const cy = (svgH / (layer.nodes + 1)) * (ni + 1);
                return (
                  <g key={ni}>
                    <circle cx={cx} cy={cy} r={5} fill={`${layer.color}30`} stroke={layer.color} strokeWidth="1" />
                    <circle cx={cx} cy={cy} r={2} fill={layer.color} />
                  </g>
                );
              })}
              <text x={cx} y={svgH - 4} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="9" fontFamily="monospace">
                {layer.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ─── Metrics Card ─── */

function MetricCard({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <motion.div
      className="bg-[#0F2847]/80 backdrop-blur-sm border border-cyan-500/10 rounded-xl p-3 hover:border-cyan-500/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all duration-300"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="text-[10px] text-white/40 mb-1">{label}</div>
      <div className="text-lg font-bold font-mono" style={{ color }}>{value}</div>
      <div className="text-[10px] text-white/30">{unit}</div>
    </motion.div>
  );
}

const algoMetrics: Record<string, { label: string; value: string; unit: string }[]> = {
  lstm: [
    { label: 'MSE Loss', value: '0.0124', unit: '均方误差' },
    { label: 'R² Score', value: '0.924', unit: '决定系数' },
    { label: 'MAE', value: '0.087', unit: '平均绝对误差' },
  ],
  wgan: [
    { label: 'W-Distance', value: '0.341', unit: 'Wasserstein距离' },
    { label: 'FID Score', value: '18.7', unit: '分布差异' },
    { label: 'GP Loss', value: '0.052', unit: '梯度惩罚' },
  ],
  ppo: [
    { label: 'Reward', value: '0.871', unit: '累计奖励' },
    { label: 'Policy Loss', value: '0.023', unit: '策略损失' },
    { label: 'Value Loss', value: '0.041', unit: '价值损失' },
  ],
};

/* ════════════════════════════════════════════════════════
   Main Component
   ════════════════════════════════════════════════════════ */

export default function AIControl() {
  const { lastLabExperiment, publishAIOptimization, logDataFlow } = useExperimentDataBus();
  const { experimentParams, startAIOptimization, setExperimentParams } = useAppStore();

  const hasLabData = lastLabExperiment !== null;
  const materialName = hasLabData ? lastLabExperiment.materialName : '测试材料';

  /* ─── Algorithm training state ─── */
  const [runningAlgos, setRunningAlgos] = useState<Record<string, boolean>>({ lstm: false, wgan: false, ppo: false });
  const [progressValues, setProgressValues] = useState<Record<string, number>>({ lstm: 0, wgan: 0, ppo: 0 });
  const [chartKeys, setChartKeys] = useState<Record<string, number>>({ lstm: 0, wgan: 0, ppo: 0 });
  const [paramValues, setParamValues] = useState<Record<string, number[]>>(() =>
    Object.fromEntries(algorithms.map((a) => [a.id, a.params.map((p) => p.value)])),
  );
  const progressIntervals = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  /* ─── Pipeline state ─── */
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [isParamsApplied, setIsParamsApplied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ─── Derived params ─── */
  const originalParams = useMemo(() => ({
    voltage: hasLabData ? lastLabExperiment.params.voltage : experimentParams.voltage,
    current: hasLabData ? lastLabExperiment.params.current : experimentParams.current,
    pulseWidth: hasLabData ? lastLabExperiment.params.pulseWidth : experimentParams.pulseWidth,
  }), [hasLabData, lastLabExperiment, experimentParams]);

  const optimizedParams = useMemo(() => ({
    voltage: Math.min(Math.round(originalParams.voltage * 1.14), 4000),
    current: Math.round(originalParams.current * 1.12),
    pulseWidth: Math.round(originalParams.pulseWidth * 1.18),
  }), [originalParams]);

  /* ─── Toggle single algo training ─── */
  const toggleAlgoRun = useCallback((algoId: string) => {
    setRunningAlgos((prev) => {
      const wasRunning = prev[algoId];
      if (wasRunning) {
        if (progressIntervals.current[algoId]) { clearInterval(progressIntervals.current[algoId]); delete progressIntervals.current[algoId]; }
        return { ...prev, [algoId]: false };
      }
      setProgressValues((pv) => ({ ...pv, [algoId]: 0 }));
      progressIntervals.current[algoId] = setInterval(() => {
        setProgressValues((pv) => {
          const next = Math.min((pv[algoId] ?? 0) + Math.random() * 3 + 0.5, 100);
          if (next >= 100) {
            clearInterval(progressIntervals.current[algoId]);
            delete progressIntervals.current[algoId];
            setRunningAlgos((r) => ({ ...r, [algoId]: false }));
            setChartKeys((ck) => ({ ...ck, [algoId]: ck[algoId] + 1 }));
          }
          return { ...pv, [algoId]: parseFloat(next.toFixed(1)) };
        });
      }, 200);
      return { ...prev, [algoId]: true };
    });
  }, []);

  /* ─── Full pipeline ─── */
  const runFullPipeline = useCallback(() => {
    if (isOptimizing) return;
    setIsOptimizing(true);
    setIsParamsApplied(false);
    setCompletedSteps([]);
    setActiveStep('data');
    startAIOptimization();
    logDataFlow({ from: 'VirtualLab', to: 'AIControl', dataType: 'experiment-data', description: '实验数据输入AI优化管线' });

    const schedule: { step: string; delay: number }[] = [
      { step: 'lstm', delay: 800 },
      { step: 'wgan', delay: 2200 },
      { step: 'ppo', delay: 3800 },
      { step: 'output', delay: 5200 },
    ];

    let prevStep = 'data';
    schedule.forEach(({ step, delay }) => {
      timerRef.current = setTimeout(() => {
        setCompletedSteps((cs) => [...cs, prevStep]);
        setActiveStep(step);
        prevStep = step;
        if (step === 'output') {
          setCompletedSteps((cs) => [...cs, step]);
          setIsOptimizing(false);
          setActiveStep(null);
          logDataFlow({ from: 'AIControl', to: 'DataBus', dataType: 'ai-optimization', description: '优化完成，参数就绪' });
        }
      }, delay);
    });
  }, [isOptimizing, startAIOptimization, logDataFlow]);

  /* ─── Apply optimized params ─── */
  const applyOptimizedParams = useCallback(() => {
    publishAIOptimization({
      voltage: optimizedParams.voltage,
      current: optimizedParams.current,
      pulseWidth: optimizedParams.pulseWidth,
      improvements: { stressUniformity: 23, energyEfficiency: 15 },
      timestamp: Date.now(),
    });
    setExperimentParams({
      voltage: optimizedParams.voltage,
      current: optimizedParams.current,
      pulseWidth: optimizedParams.pulseWidth,
    });
    setIsParamsApplied(true);
    logDataFlow({ from: 'AIControl', to: 'VirtualLab', dataType: 'optimized-params', description: `优化参数已写回: ${optimizedParams.voltage}V` });
  }, [optimizedParams, publishAIOptimization, setExperimentParams, logDataFlow]);

  /* ─── Parameter change highlight ─── */
  const [changedParam, setChangedParam] = useState<string | null>(null);

  /* ─── Active tab state ─── */
  const [activeTab, setActiveTab] = useState<string>('lstm');

  /* ─── Cleanup ─── */
  useEffect(() => {
    return () => {
      Object.values(progressIntervals.current).forEach(clearInterval);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (changedParamTimer.current) clearTimeout(changedParamTimer.current);
    };
  }, []);

  /* ─── Param change ─── */
  const changedParamTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleParamChange = useCallback((algoId: string, idx: number, val: number) => {
    setParamValues((prev) => {
      const arr = [...(prev[algoId] ?? [])];
      arr[idx] = val;
      return { ...prev, [algoId]: arr };
    });
    const algo = algorithms.find(a => a.id === algoId);
    const paramName = algo?.params[idx]?.name ?? null;
    setChangedParam(paramName);
    if (changedParamTimer.current) clearTimeout(changedParamTimer.current);
    changedParamTimer.current = setTimeout(() => setChangedParam(null), 800);
  }, []);

  /* ─── AI event listeners ─── */
  useEffect(() => {
    const handleSwitchTab = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail === 'lstm' || detail === 'wgan' || detail === 'ppo') {
        setActiveTab(detail);
      }
    };
    const handleToggleTraining = (e: Event) => {
      const { algorithm, action } = (e as CustomEvent).detail as { algorithm: string; action?: string };
      if (action === 'stop') {
        setRunningAlgos(prev => ({ ...prev, [algorithm]: false }));
      } else {
        toggleAlgoRun(algorithm);
      }
    };
    const handleSetHyperParam = (e: Event) => {
      const { algorithm, param, value } = (e as CustomEvent).detail as { algorithm: string; param: string; value: number };
      const algo = algorithms.find(a => a.id === algorithm);
      if (!algo) return;
      const paramMap: Record<string, Record<string, number>> = {
        lstm: { learningRate: 0, hiddenLayers: 1, batchSize: 2, epochs: 3 },
        wgan: { learningRate: 0, generatorLayers: 1, batchSize: 2, epochs: 3 },
        ppo: { learningRate: 0, clipRatio: 1, batchSize: 2, policyIter: 3 },
      };
      const idx = paramMap[algorithm]?.[param];
      if (idx !== undefined) handleParamChange(algorithm, idx, value);
    };
    window.addEventListener('ai-switch-tab', handleSwitchTab);
    window.addEventListener('ai-toggle-training', handleToggleTraining);
    window.addEventListener('ai-set-hyperparam', handleSetHyperParam);
    return () => {
      window.removeEventListener('ai-switch-tab', handleSwitchTab);
      window.removeEventListener('ai-toggle-training', handleToggleTraining);
      window.removeEventListener('ai-set-hyperparam', handleSetHyperParam);
    };
  }, [toggleAlgoRun, handleParamChange]);

  /* ─── AI decision insights ─── */
  const insights = useMemo(() => {
    const vDiff = optimizedParams.voltage - originalParams.voltage;
    const pDiff = optimizedParams.pulseWidth - originalParams.pulseWidth;
    return [
      vDiff > 0
        ? `电压 ${originalParams.voltage}V -> ${optimizedParams.voltage}V: 提高电压增加电容储能，确保${materialName}在目标应变率下达到完全屈服。`
        : `电压 ${originalParams.voltage}V -> ${optimizedParams.voltage}V: 降低电压避免${materialName}因过高能量输入导致试样破碎。`,
      `电流 ${originalParams.current}A -> ${optimizedParams.current}A: 调整线圈驱动电流优化电磁推力，产生更高质量的入射波前沿。`,
      pDiff > 0
        ? `脉宽 ${originalParams.pulseWidth}us -> ${optimizedParams.pulseWidth}us: 加宽脉冲使应力波在试样中充分传播，提高应变均匀性。`
        : `脉宽 ${originalParams.pulseWidth}us -> ${optimizedParams.pulseWidth}us: 缩短脉宽提高应变率，匹配高动态力学测试需求。`,
    ];
  }, [originalParams, optimizedParams, materialName]);

  /* ─── Comparison table data ─── */
  const comparisonRows = useMemo(() => [
    { label: '电压 (V)', before: originalParams.voltage, after: optimizedParams.voltage },
    { label: '电流 (A)', before: originalParams.current, after: optimizedParams.current },
    { label: '脉宽 (us)', before: originalParams.pulseWidth, after: optimizedParams.pulseWidth },
  ], [originalParams, optimizedParams]);

  /* ═══════════ RENDER ═══════════ */

  return (
    <div className="relative min-h-screen">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-8 space-y-6">

        {/* ─── Header ─── */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <motion.div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${CYAN}15`, border: `1px solid ${CYAN}30` }}
                  animate={{ boxShadow: [`0 0 15px ${CYAN}20`, `0 0 25px ${CYAN}40`, `0 0 15px ${CYAN}20`] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Cpu className="w-5 h-5" style={{ color: CYAN }} />
                </motion.div>
                AI 智能优化控制
              </h1>
              <p className="text-white/40 text-sm mt-1 ml-[52px]">LSTM + WGAN-GP + PPO 三级优化管线</p>
            </div>
            <div className="flex items-center gap-3">
              {hasLabData ? (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  数据: {materialName}, {originalParams.voltage}V
                </Badge>
              ) : (
                <Link to="/lab">
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30 cursor-pointer">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    请先运行实验
                  </Badge>
                </Link>
              )}
              <Button
                data-ai-target="ai-startOptimization"
                onClick={runFullPipeline}
                disabled={isOptimizing}
                className="gap-2"
                style={{ backgroundColor: `${CYAN}20`, color: CYAN, borderColor: `${CYAN}40` }}
                variant="outline"
              >
                {isOptimizing ? (
                  <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><RefreshCw className="w-4 h-4" /></motion.div>优化中...</>
                ) : (
                  <><Sparkles className="w-4 h-4" />启动全流程优化</>
                )}
              </Button>
            </div>
          </div>
          <ModuleConnectionBadge
            dataFrom={[
              { module: 'VirtualLab', path: '/lab', hasData: hasLabData },
              { module: '多场耦合', path: '/multi-field', hasData: false },
            ]}
            dataTo={[
              { module: 'VirtualLab', path: '/lab' },
              { module: '系统监控', path: '/monitor' },
            ]}
            className="ml-[52px]"
          />
        </motion.div>

        {/* ─── Pipeline Bar ─── */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <GlowCard className="p-4" glowColor={CYAN} hoverable={false}>
            <PipelineBar activeStep={activeStep} completedSteps={completedSteps} />
          </GlowCard>
        </motion.div>

        {/* ─── Algorithm Tabs ─── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <div className="bg-[#0F2847]/80 backdrop-blur-sm border border-cyan-500/10 rounded-xl overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full rounded-none border-b border-white/10 bg-transparent h-12 p-0">
                {algorithms.map((algo) => {
                  const Icon = algo.icon;
                  return (
                    <TabsTrigger
                      key={algo.id}
                      value={algo.id}
                      className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-b-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none h-12 gap-2 text-white/50 data-[state=active]:text-white transition-all duration-300"
                      style={{ '--active-border': algo.color } as React.CSSProperties}
                    >
                      <Icon className="w-4 h-4" style={{ color: algo.color }} />
                      <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent font-semibold">{algo.name}</span>
                      {runningAlgos[algo.id] && (
                        <motion.div className="w-2 h-2 rounded-full" style={{ backgroundColor: algo.color }} animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {algorithms.map((algo) => (
                <TabsContent key={algo.id} value={algo.id} className="p-6">
                  <ResizablePanelGroup direction="horizontal" className="min-h-[500px]">
                    {/* Left panel: Training chart + network architecture */}
                    <ResizablePanel defaultSize={60} minSize={30}>
                      <div className="space-y-4 pr-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Activity className="w-4 h-4" style={{ color: algo.color }} />
                          <span className="text-sm font-semibold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                            {algo.id === 'ppo' ? '奖励曲线' : '训练损失曲线'}
                          </span>
                        </div>
                        <div className="bg-[#0F2847]/80 backdrop-blur-sm border border-cyan-500/10 rounded-xl overflow-hidden hover:border-cyan-500/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all duration-300">
                          <TrainingChart algoId={algo.id} color={algo.color} triggerKey={chartKeys[algo.id]} progress={progressValues[algo.id] ?? 0} />
                        </div>
                        {/* Key metrics cards */}
                        <div className="grid grid-cols-3 gap-3">
                          {(algoMetrics[algo.id] ?? []).map((m) => (
                            <MetricCard key={m.label} label={m.label} value={m.value} unit={m.unit} color={algo.color} />
                          ))}
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <Layers className="w-4 h-4" style={{ color: algo.color }} />
                          <span className="text-sm font-semibold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">网络架构</span>
                          <span className="text-xs text-white/30">{algo.fullName}</span>
                        </div>
                        <NetworkArchViz algoId={algo.id} />
                      </div>
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    {/* Right panel: Parameter sliders */}
                    <ResizablePanel defaultSize={40} minSize={25}>
                      <div className="space-y-4 pl-3">
                        <div className="bg-[#0F2847]/80 backdrop-blur-sm border border-cyan-500/10 rounded-xl p-4 hover:border-cyan-500/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all duration-300">
                          <div className="flex items-center gap-2 mb-3">
                            <Settings className="w-3.5 h-3.5" style={{ color: algo.color }} />
                            <span className="text-xs font-medium text-white/70">超参数配置</span>
                          </div>
                          <div className="space-y-3">
                            {algo.params.map((p, idx) => (
                              <motion.div
                                key={p.name}
                                className="rounded-lg px-1"
                                animate={changedParam === p.name ? {
                                  backgroundColor: ['rgba(0,245,255,0)', 'rgba(0,245,255,0.08)', 'rgba(0,245,255,0)'],
                                  scale: [1, 1.01, 1],
                                } : {}}
                                transition={{ duration: 0.6 }}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[11px] text-white/50">{p.name}</span>
                                  <span className="text-[11px] font-mono" style={{ color: algo.color }}>
                                    {paramValues[algo.id]?.[idx] ?? p.value}
                                  </span>
                                </div>
                                <Slider
                                  value={[paramValues[algo.id]?.[idx] ?? p.value]}
                                  min={p.range[0]}
                                  max={p.range[1]}
                                  step={p.step}
                                  onValueChange={([v]) => handleParamChange(algo.id, idx, v)}
                                  className="h-4"
                                />
                              </motion.div>
                            ))}
                          </div>

                          {/* Progress */}
                          {runningAlgos[algo.id] && (
                            <div className="mt-3">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-white/40">训练进度</span>
                                <span style={{ color: algo.color }}>{progressValues[algo.id]?.toFixed(0) ?? 0}%</span>
                              </div>
                              <Progress value={progressValues[algo.id] ?? 0} className="h-1.5" />
                            </div>
                          )}

                          {/* Buttons + accuracy */}
                          <div className="flex items-center gap-3 pt-3">
                            <Button
                              size="sm"
                              onClick={() => toggleAlgoRun(algo.id)}
                              className="gap-1.5"
                              style={{
                                backgroundColor: runningAlgos[algo.id] ? '#EF444420' : `${algo.color}20`,
                                color: runningAlgos[algo.id] ? '#EF4444' : algo.color,
                                borderColor: runningAlgos[algo.id] ? '#EF444440' : `${algo.color}40`,
                              }}
                              variant="outline"
                            >
                              {runningAlgos[algo.id] ? <><Pause className="w-3.5 h-3.5" />停止</> : <><Play className="w-3.5 h-3.5" />训练</>}
                            </Button>
                            <Badge style={{ backgroundColor: `${algo.color}15`, color: algo.color, borderColor: `${algo.color}30` }}>
                              精度: {(algo.defaultAccuracy * 100).toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </ResizablePanel>
                  </ResizablePanelGroup>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </motion.div>

        {/* ─── Optimization Results ─── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5" style={{ color: PURPLE }} />
            <h2 className="text-lg font-semibold text-white">优化结果</h2>
            <div className="flex-1 h-px ml-3" style={{ background: `linear-gradient(90deg, ${PURPLE}30, transparent)` }} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: comparison table */}
            <GlowCard className="p-5" glowColor={PURPLE} hoverable={false}>
              <h3 className="text-sm font-semibold text-white mb-4">参数对比</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-white/40 text-xs pb-2 font-medium">参数</th>
                    <th className="text-right text-white/40 text-xs pb-2 font-medium">原始值</th>
                    <th className="text-right text-xs pb-2 font-medium" style={{ color: PURPLE }}>优化值</th>
                    <th className="text-right text-white/40 text-xs pb-2 font-medium">变化</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => {
                    const diff = row.after - row.before;
                    const pct = row.before !== 0 ? ((diff / row.before) * 100).toFixed(1) : '0';
                    const isUp = diff > 0;
                    return (
                      <tr key={row.label} className="border-b border-white/5">
                        <td className="py-3 text-white/60 text-xs">{row.label}</td>
                        <td className="py-3 text-right text-white/50 font-mono text-xs">{row.before.toLocaleString()}</td>
                        <td className="py-3 text-right text-white font-mono text-xs font-semibold">{row.after.toLocaleString()}</td>
                        <td className={`py-3 text-right text-xs font-mono ${isUp ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {isUp ? '+' : ''}{pct}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <Button
                onClick={applyOptimizedParams}
                disabled={isParamsApplied}
                className="w-full mt-5 gap-2"
                style={{
                  backgroundColor: isParamsApplied ? '#10B98120' : `${PURPLE}20`,
                  color: isParamsApplied ? '#10B981' : PURPLE,
                  borderColor: isParamsApplied ? '#10B98140' : `${PURPLE}40`,
                }}
                variant="outline"
              >
                {isParamsApplied ? <><CheckCircle2 className="w-4 h-4" />已应用到实验室</> : <><Zap className="w-4 h-4" />应用优化参数到实验室</>}
              </Button>
            </GlowCard>

            {/* Right: waveform comparison */}
            <GlowCard className="p-5" glowColor={CYAN} hoverable={false}>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4" style={{ color: CYAN }} />
                波形对比: 原始 vs AI优化
              </h3>
              <p className="text-[11px] text-white/40 mb-3">虚线为原始波形，实线为AI优化后波形</p>
              <WaveformChart voltage={originalParams.voltage} optimizedVoltage={optimizedParams.voltage} />
            </GlowCard>
          </div>
        </motion.div>

        {/* ─── AI Decision Insights ─── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <GlowCard className="p-5" glowColor={ORANGE} hoverable={false}>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4" style={{ color: ORANGE }} />
              AI 决策洞察 -- 为什么这样调整？
            </h3>
            <ul className="space-y-2">
              {insights.map((text, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-white/60 leading-relaxed">
                  <span className="mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: [CYAN, ORANGE, GREEN][i] }} />
                  {text}
                </li>
              ))}
            </ul>
          </GlowCard>
        </motion.div>

        <div className="h-8" />
      </div>
    </div>
  );
}
