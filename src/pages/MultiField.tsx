import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Thermometer, Zap, Activity, Mountain, Rocket, Atom, Battery,
  ArrowRight, Send, Play, RotateCcw, AlertTriangle,
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
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }
    const chart = chartInstance.current;

    chart.setOption({
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

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [standard, coupled, strains]);

  // Cleanup
  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
    };
  }, []);

  return <div ref={chartRef} className="w-full h-[340px]" />;
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
      // Map 'ev-battery' alias to internal 'ev-crash' id
      const id = rawId === 'ev-battery' ? 'ev-crash' : rawId;
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
              <h1 className="text-3xl font-bold bg-gradient-to-r from-[#00F5FF] to-[#8B5CF6] bg-clip-text text-transparent">
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
                  className="min-w-[200px] flex-shrink-0"
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
            <GlowCard glowColor="#FF9F43" className="p-5 bg-[#0F2847]/80 backdrop-blur-sm border border-cyan-500/10 rounded-xl hover:border-cyan-500/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all duration-300" hoverable={false}>
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
            <GlowCard glowColor="#1DD1A1" className="p-5 bg-[#0F2847]/80 backdrop-blur-sm border border-cyan-500/10 rounded-xl hover:border-cyan-500/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all duration-300" hoverable={false}>
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
            <GlowCard glowColor="#8B5CF6" className="p-5 bg-[#0F2847]/80 backdrop-blur-sm border border-cyan-500/10 rounded-xl hover:border-cyan-500/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all duration-300" hoverable={false}>
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

            {/* CSS Triangle Diagram */}
            <div className="relative w-full max-w-[400px] mx-auto" style={{ height: 240 }}>
              {/* Triangle edges (lines via absolute positioning) */}
              <svg viewBox="0 0 400 240" className="absolute inset-0 w-full h-full">
                {/* Animated energy flow paths */}
                <defs>
                  <style>{`
                    @keyframes flowLeft { 0% { offset-distance: 0%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { offset-distance: 100%; opacity: 0; } }
                    @keyframes flowBottom { 0% { offset-distance: 0%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { offset-distance: 100%; opacity: 0; } }
                    @keyframes flowRight { 0% { offset-distance: 0%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { offset-distance: 100%; opacity: 0; } }
                  `}</style>
                  <path id="pathLeft" d="M200,30 L60,210" />
                  <path id="pathBottom" d="M60,210 L340,210" />
                  <path id="pathRight" d="M340,210 L200,30" />
                </defs>

                {/* T -> σ (left edge) */}
                <line x1="200" y1="30" x2="60" y2="210" stroke="#FF9F4340" strokeWidth="2" strokeDasharray="6 4" />
                {/* σ -> B (bottom edge) */}
                <line x1="60" y1="210" x2="340" y2="210" stroke="#1DD1A140" strokeWidth="2" strokeDasharray="6 4" />
                {/* B -> T (right edge) */}
                <line x1="340" y1="210" x2="200" y2="30" stroke="#8B5CF640" strokeWidth="2" strokeDasharray="6 4" />

                {/* Energy flow particles - left edge */}
                {[0, 1, 2].map(i => (
                  <circle key={`pl${i}`} r="3" fill="#FF9F43" opacity="0"
                    style={{ offsetPath: "path('M200,30 L60,210')", animation: `flowLeft 2.5s ${i * 0.8}s linear infinite` }} />
                ))}
                {/* Energy flow particles - bottom edge */}
                {[0, 1, 2].map(i => (
                  <circle key={`pb${i}`} r="3" fill="#1DD1A1" opacity="0"
                    style={{ offsetPath: "path('M60,210 L340,210')", animation: `flowBottom 2.5s ${i * 0.8}s linear infinite` }} />
                ))}
                {/* Energy flow particles - right edge */}
                {[0, 1, 2].map(i => (
                  <circle key={`pr${i}`} r="3" fill="#8B5CF6" opacity="0"
                    style={{ offsetPath: "path('M340,210 L200,30')", animation: `flowRight 2.5s ${i * 0.8}s linear infinite` }} />
                ))}

                {/* Edge labels */}
                <text x="115" y="115" fill="#FF9F43" fontSize="11" textAnchor="middle" transform="rotate(-55, 115, 115)">热膨胀</text>
                <text x="200" y="230" fill="#1DD1A1" fontSize="11" textAnchor="middle">磁弹性</text>
                <text x="285" y="115" fill="#8B5CF6" fontSize="11" textAnchor="middle" transform="rotate(55, 285, 115)">焦耳热</text>
              </svg>

              {/* Node: 温度场 (top) */}
              <motion.div
                className="absolute left-1/2 top-0 -translate-x-1/2 flex flex-col items-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: 'spring' }}
              >
                <div className="w-12 h-12 rounded-full bg-[#0A2540] border-2 border-[#FF9F43] flex items-center justify-center text-[#FF9F43] font-bold text-lg">
                  T
                </div>
                <span className="text-[10px] text-white/60 mt-1">温度场(T)</span>
              </motion.div>

              {/* Node: 应力场 (bottom-left) */}
              <motion.div
                className="absolute left-[10%] bottom-0 flex flex-col items-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4, type: 'spring' }}
              >
                <div className="w-12 h-12 rounded-full bg-[#0A2540] border-2 border-[#1DD1A1] flex items-center justify-center text-[#1DD1A1] font-bold text-lg">
                  σ
                </div>
                <span className="text-[10px] text-white/60 mt-1">应力场(σ)</span>
              </motion.div>

              {/* Node: 电磁场 (bottom-right) */}
              <motion.div
                className="absolute right-[10%] bottom-0 flex flex-col items-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: 'spring' }}
              >
                <div className="w-12 h-12 rounded-full bg-[#0A2540] border-2 border-[#8B5CF6] flex items-center justify-center text-[#8B5CF6] font-bold text-lg">
                  B
                </div>
                <span className="text-[10px] text-white/60 mt-1">电磁场(B)</span>
              </motion.div>

              {/* Center coupling indicator */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/4">
                <motion.div
                  className="w-14 h-14 rounded-full border border-dashed border-[#00F5FF]/50 flex flex-col items-center justify-center"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
                >
                  <span className="text-[9px] text-[#00F5FF]/70">耦合度</span>
                  <span className="text-sm font-bold text-[#00F5FF] font-mono">{couplingPct}%</span>
                </motion.div>
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
