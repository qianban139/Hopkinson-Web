import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Thermometer, Zap, Activity, Mountain, Rocket, Atom, Battery,
  ArrowRight, Send, Play, RotateCcw, AlertTriangle,
  Anchor, Train, Shield, Pickaxe, Snowflake, Flame,
} from 'lucide-react';
import * as echarts from 'echarts';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useAppStore } from '@/store/useAppStore';
import { useExperimentDataBus } from '@/store/useExperimentDataBus';
import GlowCard from '@/shared/components/GlowCard';
import ModuleConnectionBadge from '@/shared/components/ModuleConnectionBadge';
import type { MultiFieldExperimentResult, StressStrainPoint } from '@/types';

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */

interface ScenarioPreset {
  id: string;
  title: string;
  tagline: string;
  icon: React.ReactNode;
  color: string;
  temperature: number;
  stress: number;
  emField: number;
}

const SCENARIOS: ScenarioPreset[] = [
  {
    id: 'mine',
    title: '深部矿井',
    tagline: 'T=800°C, σ=200MPa',
    icon: <Mountain className="w-5 h-5" />,
    color: '#FF9F43',
    temperature: 800,
    stress: 200,
    emField: 35,
  },
  {
    id: 'aerospace',
    title: '航空航天',
    tagline: 'T=-60~300°C, v=900m/s',
    icon: <Rocket className="w-5 h-5" />,
    color: '#00F5FF',
    temperature: 300,
    stress: 1200,
    emField: 15,
  },
  {
    id: 'nuclear',
    title: '核反应堆',
    tagline: 'T=1000°C, γ射线',
    icon: <Atom className="w-5 h-5" />,
    color: '#8B5CF6',
    temperature: 1000,
    stress: 680,
    emField: 55,
  },
  {
    id: 'ev-crash',
    title: 'EV碰撞',
    tagline: 'v=30m/s, B=5T',
    icon: <Battery className="w-5 h-5" />,
    color: '#1DD1A1',
    temperature: 180,
    stress: 350,
    emField: 80,
  },
  {
    id: 'deep-sub',
    title: '海洋深潜器',
    tagline: 'P=110MPa, T=2°C',
    icon: <Anchor className="w-5 h-5" />,
    color: '#0EA5E9',
    temperature: 2,
    stress: 1100,
    emField: 20,
  },
  {
    id: 'rail',
    title: '高铁轨道',
    tagline: 'v=350km/h, T=60°C',
    icon: <Train className="w-5 h-5" />,
    color: '#F97316',
    temperature: 60,
    stress: 450,
    emField: 65,
  },
  {
    id: 'ballistic',
    title: '弹道防护',
    tagline: 'v=1200m/s, T=500°C',
    icon: <Shield className="w-5 h-5" />,
    color: '#EF4444',
    temperature: 500,
    stress: 1800,
    emField: 10,
  },
  {
    id: 'oil-drill',
    title: '石油钻井',
    tagline: 'T=200°C, P=140MPa',
    icon: <Pickaxe className="w-5 h-5" />,
    color: '#A3E635',
    temperature: 200,
    stress: 1400,
    emField: 30,
  },
  {
    id: 'polar',
    title: '极地工程',
    tagline: 'T=-50°C, 冰载荷',
    icon: <Snowflake className="w-5 h-5" />,
    color: '#67E8F9',
    temperature: -50,
    stress: 600,
    emField: 15,
  },
  {
    id: 'weld-haz',
    title: '焊接热影响区',
    tagline: 'T=1500°C, 急冷',
    icon: <Flame className="w-5 h-5" />,
    color: '#FB923C',
    temperature: 1500,
    stress: 300,
    emField: 45,
  },
];

/* ═══════════════════════════════════════════════════════════════
   Stress-Strain ECharts Component
   ═══════════════════════════════════════════════════════════════ */

function StressStrainChart({
  temperature,
  stress,
  emField,
}: {
  temperature: number;
  stress: number;
  emField: number;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const tNorm = temperature / 1000;
  const eNorm = emField / 100;

  // Generate data
  const { standard, coupled, strains } = useMemo(() => {
    const strains: number[] = [];
    const standard: number[] = [];
    const coupled: number[] = [];
    for (let i = 0; i <= 50; i++) {
      const strain = i * 0.01;
      strains.push(strain);
      const base = stress * (1 - Math.exp(-strain * 8));
      standard.push(Math.max(0, base));
      const thermalSoftening = base * (1 - tNorm * 0.3);
      const emEffect = eNorm * 20 * Math.sin(strain * 10);
      coupled.push(Math.max(0, thermalSoftening + emEffect));
    }
    return { standard, coupled, strains };
  }, [temperature, stress, emField, tNorm, eNorm]);

  useEffect(() => {
    if (!chartRef.current) return;
    // Initialize chart instance if not yet created
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }
    const chart = chartInstance.current;

    chart.setOption({
      animation: false,
      backgroundColor: 'transparent',
      grid: { top: 40, right: 20, bottom: 40, left: 60 },
      legend: {
        top: 4,
        textStyle: { color: '#ffffff99', fontSize: 11 },
        data: ['标准SHPB', '多场耦合'],
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0A2540ee',
        borderColor: '#00F5FF40',
        textStyle: { color: '#fff', fontSize: 11 },
        formatter: (params: any) => {
          const strain = params[0]?.axisValue ?? '';
          let html = `<div style="font-size:11px">应变: ${strain}</div>`;
          params.forEach((p: any) => {
            html += `<div>${p.marker} ${p.seriesName}: ${p.value.toFixed(1)} MPa</div>`;
          });
          return html;
        },
      },
      xAxis: {
        type: 'category',
        data: strains.map((s) => s.toFixed(2)),
        name: '应变 ε',
        nameTextStyle: { color: '#ffffff60', fontSize: 11 },
        axisLine: { lineStyle: { color: '#ffffff30' } },
        axisLabel: { color: '#ffffff60', fontSize: 10, interval: 9 },
      },
      yAxis: {
        type: 'value',
        name: '应力 σ (MPa)',
        nameTextStyle: { color: '#ffffff60', fontSize: 11 },
        axisLine: { lineStyle: { color: '#ffffff30' } },
        axisLabel: { color: '#ffffff60', fontSize: 10 },
        splitLine: { lineStyle: { color: '#ffffff10' } },
      },
      series: [
        {
          name: '标准SHPB',
          type: 'line',
          data: standard,
          smooth: true,
          lineStyle: { color: '#3B82F6', width: 2 },
          itemStyle: { color: '#3B82F6' },
          symbol: 'none',
        },
        {
          name: '多场耦合',
          type: 'line',
          data: coupled,
          smooth: true,
          lineStyle: { color: '#FF6B6B', width: 2 },
          itemStyle: { color: '#FF6B6B' },
          symbol: 'none',
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(255,107,107,0.15)' },
              { offset: 1, color: 'rgba(255,107,107,0)' },
            ]),
          },
        },
      ],
    });

    // Resize on window change
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    // ResizeObserver for container size changes
    let resizeObserver: ResizeObserver | null = null;
    if (chartRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        chart.resize();
      });
      resizeObserver.observe(chartRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();
    };
  }, [standard, coupled, strains]);

  // Cleanup
  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
    };
  }, []);

  return <div ref={chartRef} className="w-full h-[420px]" />;
}

/* ═══════════════════════════════════════════════════════════════
   Scene SVG Illustrations
   ═══════════════════════════════════════════════════════════════ */

function getSceneSVG(id: string, color: string): React.ReactNode {
  switch (id) {
    case 'mine':
      return <>
        <rect x="40" y="30" width="80" height="26" rx="2" fill={`${color}30`} stroke={color} strokeWidth="0.8" />
        <line x1="60" y1="0" x2="60" y2="30" stroke={color} strokeWidth="0.8" strokeDasharray="3 2" />
        <line x1="100" y1="0" x2="100" y2="30" stroke={color} strokeWidth="0.8" strokeDasharray="3 2" />
        <circle cx="80" cy="42" r="6" fill={`${color}40`} />
      </>;
    case 'aerospace':
      return <>
        <polygon points="80,4 95,44 65,44" fill={`${color}25`} stroke={color} strokeWidth="0.8" />
        <line x1="80" y1="44" x2="80" y2="56" stroke={color} strokeWidth="1.5" />
        <circle cx="80" cy="20" r="3" fill={color} opacity="0.6" />
      </>;
    case 'nuclear':
      return <>
        <circle cx="80" cy="28" r="18" fill="none" stroke={color} strokeWidth="0.8" />
        <circle cx="80" cy="28" r="5" fill={`${color}40`} />
        <ellipse cx="80" cy="28" rx="18" ry="8" fill="none" stroke={`${color}60`} strokeWidth="0.6" transform="rotate(60,80,28)" />
        <ellipse cx="80" cy="28" rx="18" ry="8" fill="none" stroke={`${color}60`} strokeWidth="0.6" transform="rotate(-60,80,28)" />
      </>;
    case 'ev-crash':
      return <>
        <rect x="30" y="22" width="40" height="18" rx="4" fill={`${color}25`} stroke={color} strokeWidth="0.8" />
        <rect x="90" y="22" width="40" height="18" rx="4" fill={`${color}25`} stroke={color} strokeWidth="0.8" />
        <path d="M70,31 L90,31" stroke={color} strokeWidth="1.5" strokeDasharray="4 2" />
        <polygon points="85,27 90,31 85,35" fill={color} opacity="0.6" />
      </>;
    case 'deep-sub':
      return <>
        <ellipse cx="80" cy="28" rx="25" ry="14" fill={`${color}20`} stroke={color} strokeWidth="0.8" />
        <circle cx="70" cy="28" r="4" fill="none" stroke={color} strokeWidth="0.6" />
        <line x1="55" y1="28" x2="60" y2="28" stroke={color} strokeWidth="0.8" />
        {[10, 20, 30, 40].map(y => <line key={y} x1="20" y1={y} x2="140" y2={y} stroke={`${color}15`} strokeWidth="0.5" />)}
      </>;
    case 'rail':
      return <>
        <line x1="20" y1="36" x2="140" y2="36" stroke={color} strokeWidth="1.5" />
        <line x1="20" y1="40" x2="140" y2="40" stroke={color} strokeWidth="1.5" />
        {[30, 50, 70, 90, 110].map(x => <rect key={x} x={x-2} y="36" width="4" height="4" fill={`${color}40`} />)}
        <rect x="60" y="18" width="40" height="18" rx="3" fill={`${color}20`} stroke={color} strokeWidth="0.8" />
      </>;
    case 'ballistic':
      return <>
        <rect x="95" y="8" width="12" height="40" rx="1" fill={`${color}25`} stroke={color} strokeWidth="0.8" />
        <circle cx="50" cy="28" r="5" fill={color} opacity="0.6" />
        <line x1="55" y1="28" x2="95" y2="28" stroke={color} strokeWidth="1" strokeDasharray="4 3" />
        <polygon points="88,24 95,28 88,32" fill={color} opacity="0.4" />
      </>;
    case 'oil-drill':
      return <>
        <line x1="80" y1="4" x2="80" y2="50" stroke={color} strokeWidth="1.5" />
        <polygon points="74,50 86,50 80,56" fill={color} opacity="0.5" />
        <rect x="70" y="4" width="20" height="8" fill={`${color}25`} stroke={color} strokeWidth="0.6" />
        {[20, 30, 40].map(y => <circle key={y} cx="80" cy={y} r="2" fill={`${color}30`} />)}
      </>;
    case 'polar':
      return <>
        <polygon points="80,8 90,22 86,22 96,36 60,36 70,22 66,22" fill={`${color}20`} stroke={color} strokeWidth="0.6" />
        <line x1="20" y1="44" x2="140" y2="44" stroke={`${color}40`} strokeWidth="1" />
        <circle cx="45" cy="20" r="3" fill="none" stroke={color} strokeWidth="0.5" />
        <circle cx="120" cy="16" r="4" fill="none" stroke={color} strokeWidth="0.5" />
      </>;
    case 'weld-haz':
      return <>
        <rect x="30" y="18" width="45" height="24" rx="1" fill={`${color}15`} stroke={color} strokeWidth="0.6" />
        <rect x="85" y="18" width="45" height="24" rx="1" fill={`${color}15`} stroke={color} strokeWidth="0.6" />
        <line x1="75" y1="14" x2="75" y2="46" stroke={color} strokeWidth="2" />
        <circle cx="75" cy="30" r="8" fill={`${color}30`} />
      </>;
    default:
      return <circle cx="80" cy="28" r="15" fill={`${color}20`} stroke={color} strokeWidth="0.8" />;
  }
}

/* ═══════════════════════════════════════════════════════════════
   Main Page Component
   ═══════════════════════════════════════════════════════════════ */

export default function MultiField() {
  const navigate = useNavigate();
  const { selectedMaterial } = useAppStore();
  const { publishMultiFieldExperiment, logDataFlow, lastLabExperiment } = useExperimentDataBus();

  // Field parameters
  const [temperature, setTemperature] = useState(300);
  const [stress, setStress] = useState(500);
  const [emField, setEmField] = useState(40);

  // Effect toggles
  const [thermalSoftening, setThermalSoftening] = useState(true);
  const [adiabaticHeating, setAdiabaticHeating] = useState(true);
  const [eddyCurrentLoss, setEddyCurrentLoss] = useState(true);

  // UI state
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [simulationDone, setSimulationDone] = useState(false);

  // Scenario selection
  const handleSelectScenario = useCallback((s: ScenarioPreset) => {
    setActiveScenario(s.id);
    setTemperature(s.temperature);
    setStress(s.stress);
    setEmField(s.emField);
    setSimulationDone(false);
  }, []);

  // Coupling degree
  const couplingPct = useMemo(() => {
    const t = temperature / 1000;
    const m = stress / 2000;
    const e = emField / 100;
    return Math.round(((t + m + e) / 3) * 100);
  }, [temperature, stress, emField]);

  // Deviation calculations
  const deviations = useMemo(() => {
    const tDev = thermalSoftening ? (temperature / 1000) * 18 : 0;
    const eDev = eddyCurrentLoss ? (emField / 100) * 12 : 0;
    const total = Math.min(tDev + eDev + (adiabaticHeating ? 3 : 0), 45);
    return {
      thermal: +tDev.toFixed(1),
      eddy: +eDev.toFixed(1),
      total: +total.toFixed(1),
    };
  }, [temperature, emField, thermalSoftening, eddyCurrentLoss, adiabaticHeating]);

  // Generate result data
  const generateResultData = useCallback((): MultiFieldExperimentResult => {
    const tNorm = temperature / 1000;
    const eNorm = emField / 100;
    const coupledStressStrain: StressStrainPoint[] = [];
    for (let i = 0; i <= 50; i++) {
      const strain = i * 0.01;
      const baseStress = stress * (1 - Math.exp(-strain * 8)) * (1 - tNorm * 0.3);
      const emEffect = eNorm * 20 * Math.sin(strain * 10);
      coupledStressStrain.push({ strain, stress: Math.max(0, baseStress + emEffect) });
    }
    return {
      thermalParams: { temperature, intensity: temperature },
      mechanicalParams: { stress, intensity: stress },
      emParams: { fieldStrength: emField, intensity: emField },
      couplingStrength: (tNorm + stress / 2000 + eNorm) / 3,
      materialId: selectedMaterial?.id ?? 'metal-01',
      resultData: {
        coupledStressStrain,
        temperatureProfile: Array.from({ length: 100 }, (_, i) => temperature * (1 + 0.3 * Math.exp(-((i - 50) ** 2) / 200))),
        stressProfile: Array.from({ length: 100 }, (_, i) => stress * Math.sin((i / 100) * Math.PI) * (1 - tNorm * 0.2)),
        emProfile: Array.from({ length: 100 }, (_, i) => emField * (0.8 + 0.2 * Math.cos((i / 100) * Math.PI * 4))),
      },
      timestamp: Date.now(),
    };
  }, [temperature, stress, emField, selectedMaterial]);

  // Run simulation
  const handleRun = useCallback(() => {
    setIsRunning(true);
    setSimulationDone(false);
    setTimeout(() => {
      setIsRunning(false);
      setSimulationDone(true);
    }, 2000);
  }, []);

  // Reset
  const handleReset = useCallback(() => {
    setTemperature(300);
    setStress(500);
    setEmField(40);
    setActiveScenario(null);
    setSimulationDone(false);
    setIsRunning(false);
  }, []);

  // Send to analysis
  const handleSendToAnalysis = useCallback(() => {
    const result = generateResultData();
    publishMultiFieldExperiment(result);
    logDataFlow({
      from: '多场耦合',
      to: '材料分析',
      dataType: 'multi-field-result',
      description: `T=${temperature}°C, σ=${stress}MPa, B=${emField}T → 材料分析模块`,
    });
    navigate('/analysis');
  }, [generateResultData, publishMultiFieldExperiment, logDataFlow, navigate, temperature, stress, emField]);

  // AI event listeners
  useEffect(() => {
    const onAISelectScenario = (e: Event) => {
      const rawId = (e as CustomEvent).detail;
      const aliasMap: Record<string, string> = {
        'ev-battery': 'ev-crash',
        'submarine': 'deep-sub',
        'ocean': 'deep-sub',
        'train': 'rail',
        'armor': 'ballistic',
        'drilling': 'oil-drill',
        'arctic': 'polar',
        'welding': 'weld-haz',
      };
      const id = aliasMap[rawId] || rawId;
      const s = SCENARIOS.find((sc) => sc.id === id);
      if (s) handleSelectScenario(s);
    };
    const onAISetParams = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.temperature !== undefined) setTemperature(detail.temperature);
      if (detail.stress !== undefined) setStress(detail.stress);
      if (detail.emField !== undefined) setEmField(detail.emField);
      setSimulationDone(false);
    };
    const onAIRunCoupling = () => handleRun();
    const onAIToggleEffect = (e: Event) => {
      const { effect, enabled } = (e as CustomEvent).detail as { effect: string; enabled: boolean };
      if (effect === 'thermalSoftening') setThermalSoftening(enabled);
      else if (effect === 'adiabaticHeating') setAdiabaticHeating(enabled);
      else if (effect === 'eddyCurrentLoss') setEddyCurrentLoss(enabled);
    };
    const onAIReset = () => handleReset();
    const onAISendToAnalysis = () => { if (simulationDone) handleSendToAnalysis(); };
    window.addEventListener('ai-select-scenario', onAISelectScenario);
    window.addEventListener('ai-set-multifield-params', onAISetParams);
    window.addEventListener('ai-run-coupling', onAIRunCoupling);
    window.addEventListener('ai-toggle-effect', onAIToggleEffect);
    window.addEventListener('ai-reset-multifield', onAIReset);
    window.addEventListener('ai-send-to-analysis', onAISendToAnalysis);
    return () => {
      window.removeEventListener('ai-select-scenario', onAISelectScenario);
      window.removeEventListener('ai-set-multifield-params', onAISetParams);
      window.removeEventListener('ai-run-coupling', onAIRunCoupling);
      window.removeEventListener('ai-toggle-effect', onAIToggleEffect);
      window.removeEventListener('ai-reset-multifield', onAIReset);
      window.removeEventListener('ai-send-to-analysis', onAISendToAnalysis);
    };
  }, [handleSelectScenario, handleRun, handleReset, handleSendToAnalysis, simulationDone]);

  return (
    <div className="min-h-screen text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-28 pb-10 space-y-8">

        {/* ── Page Header ──────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-[#7EC8E3] to-[#A78BDA] bg-clip-text text-transparent">
                极端环境模拟器
              </h1>
              <p className="text-sm text-white/50 mt-1">
                忽略耦合效应，预测偏差可达30%+
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={handleRun} disabled={isRunning} className="bg-[#00F5FF]/20 text-[#00F5FF] border border-[#00F5FF]/40 hover:bg-[#00F5FF]/30 h-9 px-5">
                {isRunning ? (
                  <motion.span className="flex items-center gap-2" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity }}>
                    <span className="w-3 h-3 border-2 border-[#00F5FF] border-t-transparent rounded-full animate-spin" />
                    计算中...
                  </motion.span>
                ) : (
                  <span className="flex items-center gap-2"><Play className="w-3.5 h-3.5" />运行仿真</span>
                )}
              </Button>
              <Button variant="outline" onClick={handleReset} className="border-white/20 text-white/60 hover:text-white h-9">
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />重置
              </Button>
              <Button onClick={handleSendToAnalysis} disabled={!simulationDone} className={`h-9 px-5 ${simulationDone ? 'bg-gradient-to-r from-[#8B5CF6] to-[#00F5FF] text-white hover:opacity-90' : 'bg-white/5 text-white/30 border border-white/10'}`}>
                <Send className="w-3.5 h-3.5 mr-1.5" />发送至分析 <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
          <ModuleConnectionBadge
            dataFrom={[{ module: '虚拟实验室', path: '/lab', hasData: !!lastLabExperiment }]}
            dataTo={[{ module: '材料分析', path: '/analysis' }, { module: '系统监控', path: '/monitor' }]}
          />
        </motion.div>

        {/* ── Scenario Selection (horizontal scroll) ─── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 rounded-full bg-[#00F5FF]" />
            <h2 className="text-base font-semibold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">典型工程场景</h2>
            <span className="text-xs text-white/40 ml-2">选择场景自动预设参数</span>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10" data-ai-target="multifield-scenarios">
            {SCENARIOS.map((s, i) => {
              const isActive = activeScenario === s.id;
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="min-w-[240px] flex-shrink-0"
                >
                  <div
                    onClick={() => handleSelectScenario(s)}
                    className={`relative p-4 h-full rounded-xl border backdrop-blur-sm cursor-pointer transition-all duration-300
                      ${isActive
                        ? 'border-cyan-400/60 bg-gradient-to-br from-cyan-500/15 via-blue-500/10 to-purple-500/10 shadow-[0_0_20px_rgba(6,182,212,0.25),inset_0_0_20px_rgba(6,182,212,0.05)]'
                        : 'bg-[#0F2847]/80 border-cyan-500/10 hover:border-cyan-500/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                      }`}
                  >
                    {/* Active glow border overlay */}
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 rounded-xl pointer-events-none"
                        style={{ boxShadow: `0 0 25px ${s.color}30, inset 0 0 25px ${s.color}08` }}
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    )}
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${s.color}20`, color: s.color }}>
                          {s.icon}
                        </div>
                        <div>
                          <h3 className="font-semibold text-white text-sm">{s.title}</h3>
                          <p className="text-[10px] text-white/50 font-mono">{s.tagline}</p>
                        </div>
                      </div>
                      {/* Scene illustration */}
                      <div className="h-16 mb-2 rounded-lg flex items-center justify-center overflow-hidden"
                        style={{ background: `linear-gradient(135deg, ${s.color}08, ${s.color}15)` }}>
                        <svg width="100%" height="56" viewBox="0 0 160 56" className="opacity-40">
                          {getSceneSVG(s.id, s.color)}
                        </svg>
                      </div>
                      <div className={`text-[10px] text-center py-1 rounded ${isActive ? 'bg-[#00F5FF]/20 text-[#00F5FF]' : 'text-white/40'}`}>
                        {isActive ? '已选择' : '点击选择'}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* ── Three Field Parameter Controls ──────────── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 rounded-full bg-[#FF9F43]" />
            <h2 className="text-base font-semibold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent" data-ai-target="multifield-params">场参数控制</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Temperature Field */}
            <GlowCard glowColor="#FF9F43" className="p-5 bg-[#0F2847]/80 backdrop-blur-sm border border-cyan-500/10 rounded-xl hover:border-cyan-500/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all duration-300" hoverable={false} style={{ borderTop: '3px solid #FF9F43' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🌡</span>
                  <span className="text-sm font-medium text-white/90">温度场</span>
                </div>
                <span className="text-xl font-bold font-mono text-[#FF9F43]">{temperature}°C</span>
              </div>
              <Slider
                value={[temperature]}
                onValueChange={(v) => setTemperature(v[0])}
                min={20}
                max={1000}
                step={5}
                className="mb-4"
              />
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">热软化效应</span>
                <Switch checked={thermalSoftening} onCheckedChange={setThermalSoftening} />
              </div>
            </GlowCard>

            {/* Stress Field */}
            <GlowCard glowColor="#1DD1A1" className="p-5 bg-[#0F2847]/80 backdrop-blur-sm border border-cyan-500/10 rounded-xl hover:border-cyan-500/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all duration-300" hoverable={false} style={{ borderTop: '3px solid #1DD1A1' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💪</span>
                  <span className="text-sm font-medium text-white/90">应力场</span>
                </div>
                <span className="text-xl font-bold font-mono text-[#1DD1A1]">{stress} MPa</span>
              </div>
              <Slider
                value={[stress]}
                onValueChange={(v) => setStress(v[0])}
                min={0}
                max={2000}
                step={10}
                className="mb-4"
              />
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">绝热升温</span>
                <Switch checked={adiabaticHeating} onCheckedChange={setAdiabaticHeating} />
              </div>
            </GlowCard>

            {/* Electromagnetic Field */}
            <GlowCard glowColor="#8B5CF6" className="p-5 bg-[#0F2847]/80 backdrop-blur-sm border border-cyan-500/10 rounded-xl hover:border-cyan-500/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all duration-300" hoverable={false} style={{ borderTop: '3px solid #8B5CF6' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚡</span>
                  <span className="text-sm font-medium text-white/90">电磁场</span>
                </div>
                <span className="text-xl font-bold font-mono text-[#8B5CF6]">{emField} T</span>
              </div>
              <Slider
                value={[emField]}
                onValueChange={(v) => setEmField(v[0])}
                min={0}
                max={100}
                step={1}
                className="mb-4"
              />
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">涡流损耗</span>
                <Switch checked={eddyCurrentLoss} onCheckedChange={setEddyCurrentLoss} />
              </div>
            </GlowCard>
          </div>
        </motion.div>

        {/* ── Coupling Relationship Triangle ──────────── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <GlowCard className="p-6" hoverable={false}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 rounded-full bg-[#8B5CF6]" />
              <h2 className="text-base font-semibold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">三场耦合关系</h2>
              <span className="ml-auto text-sm font-mono text-[#00F5FF]">
                耦合度: {couplingPct}%
              </span>
            </div>

            {/* Enhanced Triangle Diagram */}
            <div className="relative w-full max-w-[500px] mx-auto" style={{ height: 300 }}>
              <svg viewBox="0 0 500 300" className="absolute inset-0 w-full h-full">
                <defs>
                  {/* Animated gradient for left edge (T→σ) */}
                  <linearGradient id="gradLeft" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FF9F43" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#1DD1A1" stopOpacity="0.9" />
                  </linearGradient>
                  {/* Animated gradient for bottom edge (σ→B) */}
                  <linearGradient id="gradBottom" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#1DD1A1" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.9" />
                  </linearGradient>
                  {/* Animated gradient for right edge (B→T) */}
                  <linearGradient id="gradRight" x1="100%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#FF9F43" stopOpacity="0.9" />
                  </linearGradient>
                  {/* Glow filters */}
                  <filter id="glowOrange" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                    <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  <filter id="glowGreen" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                    <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  <filter id="glowPurple" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                    <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  <filter id="glowCyan" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="6" result="coloredBlur" />
                    <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  {/* Flow animation paths */}
                  <path id="pathLeft2" d="M250,36 L75,262" />
                  <path id="pathBottom2" d="M75,262 L425,262" />
                  <path id="pathRight2" d="M425,262 L250,36" />
                  <style>{`
                    @keyframes edgeFlow { 0%,100% { stroke-dashoffset: 24; } }
                    @keyframes particleFlow { 0% { offset-distance:0%; opacity:0; } 8% { opacity:1; } 88% { opacity:1; } 100% { offset-distance:100%; opacity:0; } }
                    @keyframes couplingPulse { 0%,100% { r:28; opacity:0.15; } 50% { r:40; opacity:0; } }
                  `}</style>
                </defs>

                {/* Triangle fill — subtle */}
                <polygon points="250,36 75,262 425,262"
                  fill="url(#gradBottom)" fillOpacity="0.04"
                  stroke="none" />

                {/* Animated gradient edges */}
                <line x1="250" y1="36" x2="75" y2="262"
                  stroke="url(#gradLeft)" strokeWidth="3" strokeDasharray="8 5"
                  style={{ animation: 'edgeFlow 1.8s linear infinite' }}
                  filter="url(#glowOrange)" />
                <line x1="75" y1="262" x2="425" y2="262"
                  stroke="url(#gradBottom)" strokeWidth="3" strokeDasharray="8 5"
                  style={{ animation: 'edgeFlow 1.8s linear infinite' }}
                  filter="url(#glowGreen)" />
                <line x1="425" y1="262" x2="250" y2="36"
                  stroke="url(#gradRight)" strokeWidth="3" strokeDasharray="8 5"
                  style={{ animation: 'edgeFlow 1.8s linear infinite' }}
                  filter="url(#glowPurple)" />

                {/* Energy flow particles — left edge */}
                {[0, 1, 2].map(i => (
                  <circle key={`pl2${i}`} r="4" fill="#FF9F43" opacity="0"
                    style={{ offsetPath: "path('M250,36 L75,262')", animation: `particleFlow 2.8s ${i * 0.9}s linear infinite` }} />
                ))}
                {/* Energy flow particles — bottom edge */}
                {[0, 1, 2].map(i => (
                  <circle key={`pb2${i}`} r="4" fill="#1DD1A1" opacity="0"
                    style={{ offsetPath: "path('M75,262 L425,262')", animation: `particleFlow 2.8s ${i * 0.9}s linear infinite` }} />
                ))}
                {/* Energy flow particles — right edge */}
                {[0, 1, 2].map(i => (
                  <circle key={`pr2${i}`} r="4" fill="#8B5CF6" opacity="0"
                    style={{ offsetPath: "path('M425,262 L250,36')", animation: `particleFlow 2.8s ${i * 0.9}s linear infinite` }} />
                ))}

                {/* Edge labels */}
                <text x="145" y="140" fill="#FF9F43" fontSize="12" textAnchor="middle"
                  transform="rotate(-52, 145, 140)" opacity="0.9">热膨胀</text>
                <text x="250" y="286" fill="#1DD1A1" fontSize="12" textAnchor="middle" opacity="0.9">磁弹性</text>
                <text x="360" y="140" fill="#8B5CF6" fontSize="12" textAnchor="middle"
                  transform="rotate(52, 360, 140)" opacity="0.9">焦耳热</text>

                {/* Pulsing glow ring behind center indicator */}
                <circle cx="250" cy="175" r="28" fill="#00F5FF" fillOpacity="0.12" filter="url(#glowCyan)">
                  <animate attributeName="r" values="26;42;26" dur="2.5s" repeatCount="indefinite" />
                  <animate attributeName="fill-opacity" values="0.18;0;0.18" dur="2.5s" repeatCount="indefinite" />
                </circle>
              </svg>

              {/* Node: 温度场 T (top) */}
              <motion.div
                className="absolute left-1/2 top-0 -translate-x-1/2 flex flex-col items-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: 'spring' }}
              >
                <div
                  className="w-14 h-14 rounded-full bg-[#0A2540] border-2 border-[#FF9F43] flex items-center justify-center text-[#FF9F43] font-bold text-xl"
                  style={{ boxShadow: '0 0 16px #FF9F4380, 0 0 32px #FF9F4330' }}
                >
                  T
                </div>
                <span className="text-[10px] text-white/60 mt-1">温度场(T)</span>
                <span className="text-[10px] font-mono text-[#FF9F43] font-semibold">{temperature}°C</span>
              </motion.div>

              {/* Node: 应力场 σ (bottom-left) */}
              <motion.div
                className="absolute left-[8%] bottom-0 flex flex-col items-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4, type: 'spring' }}
              >
                <div
                  className="w-14 h-14 rounded-full bg-[#0A2540] border-2 border-[#1DD1A1] flex items-center justify-center text-[#1DD1A1] font-bold text-xl"
                  style={{ boxShadow: '0 0 16px #1DD1A180, 0 0 32px #1DD1A130' }}
                >
                  σ
                </div>
                <span className="text-[10px] text-white/60 mt-1">应力场(σ)</span>
                <span className="text-[10px] font-mono text-[#1DD1A1] font-semibold">{stress} MPa</span>
              </motion.div>

              {/* Node: 电磁场 B (bottom-right) */}
              <motion.div
                className="absolute right-[8%] bottom-0 flex flex-col items-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: 'spring' }}
              >
                <div
                  className="w-14 h-14 rounded-full bg-[#0A2540] border-2 border-[#8B5CF6] flex items-center justify-center text-[#8B5CF6] font-bold text-xl"
                  style={{ boxShadow: '0 0 16px #8B5CF680, 0 0 32px #8B5CF630' }}
                >
                  B
                </div>
                <span className="text-[10px] text-white/60 mt-1">电磁场(B)</span>
                <span className="text-[10px] font-mono text-[#8B5CF6] font-semibold">{emField} T</span>
              </motion.div>

              {/* Center coupling indicator — bigger with pulsing glow */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/4">
                <motion.div
                  className="w-[72px] h-[72px] rounded-full border-2 border-dashed border-[#00F5FF]/60 flex flex-col items-center justify-center"
                  style={{ boxShadow: '0 0 20px #00F5FF50, 0 0 40px #00F5FF20' }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
                >
                  <span className="text-[9px] text-[#00F5FF]/70 leading-tight">耦合度</span>
                  <span className="text-base font-bold text-[#00F5FF] font-mono leading-tight">{couplingPct}%</span>
                </motion.div>
              </div>
            </div>

            {/* Pairwise coupling strength bars */}
            <div className="mt-5 grid grid-cols-3 gap-3">
              {/* T–σ coupling */}
              <div>
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-[#FF9F43] font-mono font-semibold">T–σ</span>
                  <span className="text-white/50">{Math.round((temperature / 1000 + stress / 2000) / 2 * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #FF9F43, #1DD1A1)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round((temperature / 1000 + stress / 2000) / 2 * 100)}%` }}
                    transition={{ duration: 0.8 }}
                  />
                </div>
              </div>
              {/* σ–B coupling */}
              <div>
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-[#1DD1A1] font-mono font-semibold">σ–B</span>
                  <span className="text-white/50">{Math.round((stress / 2000 + emField / 100) / 2 * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #1DD1A1, #8B5CF6)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round((stress / 2000 + emField / 100) / 2 * 100)}%` }}
                    transition={{ duration: 0.8, delay: 0.1 }}
                  />
                </div>
              </div>
              {/* B–T coupling */}
              <div>
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-[#8B5CF6] font-mono font-semibold">B–T</span>
                  <span className="text-white/50">{Math.round((emField / 100 + temperature / 1000) / 2 * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #8B5CF6, #FF9F43)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round((emField / 100 + temperature / 1000) / 2 * 100)}%` }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                  />
                </div>
              </div>
            </div>

            {/* Overall coupling strength bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-white/60 font-medium">综合耦合强度</span>
                <span className="text-[#00F5FF] font-mono font-bold">{couplingPct}%</span>
              </div>
              <div className="h-3 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #FF9F43, #1DD1A1, #8B5CF6, #00F5FF)' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${couplingPct}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </div>
            </div>
          </GlowCard>
        </motion.div>

        {/* ── Key Results ─────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 rounded-full bg-[#FF6B6B]" />
            <h2 className="text-base font-semibold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">应力-应变曲线对比</h2>
            {simulationDone && (
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-[#1DD1A1]/40 text-[#1DD1A1] ml-2">仿真完成</span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Chart (2 cols) */}
            <GlowCard glowColor="#3B82F6" className="lg:col-span-2 p-4" hoverable={false}>
              <StressStrainChart temperature={temperature} stress={stress} emField={emField} />
              <div className="flex items-center justify-center gap-6 text-xs text-white/50 mt-2">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-[#3B82F6] inline-block rounded" /> 标准SHPB (蓝)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-[#FF6B6B] inline-block rounded" /> 多场耦合 (红)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-2 bg-[#FF6B6B]/20 inline-block rounded" /> 偏差区域
                </span>
              </div>
            </GlowCard>

            {/* Deviation Breakdown (1 col) */}
            <GlowCard glowColor="#FF6B6B" className="p-5 flex flex-col justify-between" hoverable={false}>
              <div>
                <h3 className="text-sm font-medium text-white/80 mb-4">偏差分析</h3>
                <div className="space-y-4">
                  {/* Thermal softening deviation */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-white/60">热软化偏差</span>
                      <span className="text-[#FF9F43] font-mono font-bold">{deviations.thermal}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-[#FF9F43]"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(deviations.thermal / 20 * 100, 100)}%` }}
                        transition={{ duration: 0.8 }}
                      />
                    </div>
                  </div>

                  {/* Eddy current deviation */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-white/60">涡流损耗偏差</span>
                      <span className="text-[#8B5CF6] font-mono font-bold">{deviations.eddy}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-[#8B5CF6]"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(deviations.eddy / 15 * 100, 100)}%` }}
                        transition={{ duration: 0.8, delay: 0.1 }}
                      />
                    </div>
                  </div>

                  {/* Total deviation */}
                  <div className="pt-3 border-t border-white/10">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-white/80 font-medium">总偏差</span>
                      <span className={`text-lg font-bold font-mono ${deviations.total > 20 ? 'text-[#FF6B6B]' : deviations.total > 10 ? 'text-[#FF9F43]' : 'text-[#1DD1A1]'}`}>
                        {deviations.total}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          background: deviations.total > 20
                            ? 'linear-gradient(90deg, #FF9F43, #FF6B6B)'
                            : 'linear-gradient(90deg, #1DD1A1, #FF9F43)',
                        }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(deviations.total / 45 * 100, 100)}%` }}
                        transition={{ duration: 1, delay: 0.2 }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Warning text */}
              {deviations.total > 5 && (
                <motion.div
                  className="mt-4 p-3 rounded-lg bg-[#FF6B6B]/10 border border-[#FF6B6B]/20"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#FF6B6B] flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-[#FF6B6B]/90 leading-relaxed">
                      不考虑多场耦合，强度预测偏高{deviations.total}%
                    </p>
                  </div>
                </motion.div>
              )}
            </GlowCard>
          </div>
        </motion.div>

        {/* ── Running Overlay ─────────────────────────── */}
        <AnimatePresence>
          {isRunning && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
            >
              <div className="bg-[#0A2540]/95 border border-[#00F5FF]/30 rounded-xl px-6 py-3 backdrop-blur-md flex items-center gap-4 shadow-2xl">
                <div className="w-5 h-5 border-2 border-[#00F5FF] border-t-transparent rounded-full animate-spin" />
                <div>
                  <p className="text-sm text-white font-medium">求解热-力-电磁耦合方程</p>
                  <motion.p className="text-xs text-white/50 font-mono" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }}>
                    迭代收敛中 | T={temperature}°C, σ={stress}MPa, B={emField}T
                  </motion.p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
