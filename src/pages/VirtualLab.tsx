import { useState, useEffect, useRef, useCallback } from 'react';
import * as echarts from 'echarts';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Activity, Sparkles,
  Waves, Clock, Database, Beaker, Info, ChevronUp,
  Search, ChevronRight, ChevronDown, ArrowRight,
  Play, Pause, RotateCcw, PanelLeftClose, PanelLeftOpen, AlertTriangle,
  Thermometer, Radio, Brain, CheckCircle2, X,
  Wifi, WifiOff, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { HopkinsonBar2DRealistic } from '@/features/experiment-2d';
import HopkinsonBar3D from '@/features/experiment-3d/HopkinsonBar3D';
import ExperimentResultsPanel from '@/components/ExperimentResults';
import RealtimeWaveformPanel from '@/shared/components/RealtimeWaveformPanel';
import ExperimentResultCharts from '@/shared/components/ExperimentResultCharts';
import SliderInputCombo from '@/shared/components/SliderInputCombo';
import ModuleConnectionBadge from '@/shared/components/ModuleConnectionBadge';
import { useExperimentWorkflow } from '@/store/experimentWorkflow';
import { useExperimentDataBus } from '@/store/useExperimentDataBus';
import { useAppStore } from '@/store/useAppStore';
import { useConnectionStore, type LabMode } from '@/store/useConnectionStore';
import { useBackendConnection } from '@/hooks/useBackendConnection';
import { useExperimentAnimation } from '@/hooks/useExperimentAnimation';
import { runSHPBSimulation } from '@/services/shpbPhysicsEngine';
import type { Material } from '@/types';

// 波形类型
const waveformTypes = [
  { value: 'sine', label: '正弦波', description: '标准正弦波形，适用于常规测试' },
  { value: 'square', label: '方波', description: '快速上升沿，适用于冲击测试' },
  { value: 'triangle', label: '三角波', description: '线性变化，适用于疲劳测试' },
  { value: 'pulse', label: '脉冲波', description: '单脉冲波形，适用于高应变率测试' },
];

// 参数预设方案
const PARAM_PRESETS = [
  { label: '标准SHPB', voltage: 2000, current: 25000, pulseWidth: 500, desc: '常规金属测试' },
  { label: '高应变率', voltage: 3500, current: 40000, pulseWidth: 350, desc: '高速冲击(>3000/s)' },
  { label: '岩石冲击', voltage: 3000, current: 35000, pulseWidth: 700, desc: '岩石/混凝土适用' },
  { label: '低速测试', voltage: 1200, current: 15000, pulseWidth: 800, desc: '聚合物/泡沫适用' },
];

// 材料分类折叠组件
function MaterialCategoryAccordion({
  category,
  categoryMaterials,
  selectedMaterial,
  onSelectMaterial,
  isOpen,
  onToggle
}: {
  category: { id: string; name: string; icon: string; color: string };
  categoryMaterials: Material[];
  selectedMaterial: Material;
  onSelectMaterial: (m: Material) => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
  if (categoryMaterials.length === 0) return null;

  return (
    <div className="border border-[#00F5FF]/10 rounded-lg overflow-hidden mb-1">
      <button
        onClick={onToggle}
        className="w-full px-2.5 py-1.5 flex items-center justify-between bg-[#0A2540]/50 hover:bg-[#0A2540] transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{category.icon}</span>
          <span className="text-xs font-medium text-white">{category.name}</span>
          <span className="text-[10px] text-white/40">({categoryMaterials.length})</span>
        </div>
        <ChevronRight className={`w-3.5 h-3.5 text-white/50 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-1.5 py-1 space-y-0.5 bg-[#051020]/50">
              {categoryMaterials.map((material) => (
                <button
                  key={material.id}
                  onClick={() => onSelectMaterial(material)}
                  className={`w-full px-2 py-1.5 rounded text-left transition-all border ${
                    selectedMaterial.id === material.id
                      ? 'bg-[#00F5FF]/10 border-[#00F5FF]/50'
                      : 'bg-transparent border-transparent hover:bg-[#0A2540]/50'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: material.color }} />
                    <span className="text-xs text-white">{material.name}</span>
                    <span className="text-[10px] text-white/40 ml-auto">{material.subcategoryLabel}</span>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// 材料属性迷你雷达图
function MaterialRadarMini({ material }: { material: Material }) {
  const radarRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!radarRef.current) return;
    if (!chartRef.current) {
      chartRef.current = echarts.init(radarRef.current);
    }
    // 归一化到 0-100 的6维属性
    const densityScore = Math.min(100, (material.density / 1000) / 20 * 100); // 0~20 g/cm³
    const modulusScore = Math.min(100, (material.elasticModulus / 1e9) / 400 * 100); // 0~400 GPa
    const strengthScore = Math.min(100, (material.yieldStrength / 1e6) / 2000 * 100); // 0~2000 MPa
    const stiffnessScore = Math.min(100, material.stiffnessK / 300 * 100);
    const dampingScore = Math.min(100, material.dampingC / 5000 * 100);
    const emiScore = Math.min(100, material.emiThreshold / 100 * 100);

    chartRef.current.setOption({
      animation: true,
      animationDuration: 600,
      radar: {
        indicator: [
          { name: '密度', max: 100 },
          { name: '模量', max: 100 },
          { name: '强度', max: 100 },
          { name: '刚度', max: 100 },
          { name: '阻尼', max: 100 },
          { name: '耐热', max: 100 },
        ],
        shape: 'polygon',
        axisName: { color: 'rgba(255,255,255,0.5)', fontSize: 9 },
        splitArea: { areaStyle: { color: ['rgba(0,245,255,0.02)', 'rgba(0,245,255,0.05)'] } },
        splitLine: { lineStyle: { color: 'rgba(0,245,255,0.15)' } },
        axisLine: { lineStyle: { color: 'rgba(0,245,255,0.15)' } },
      },
      series: [{
        type: 'radar',
        data: [{
          value: [densityScore, modulusScore, strengthScore, stiffnessScore, dampingScore, emiScore],
          areaStyle: { color: 'rgba(0,245,255,0.2)' },
          lineStyle: { color: '#00F5FF', width: 2 },
          itemStyle: { color: '#00F5FF' },
          symbol: 'circle',
          symbolSize: 4,
        }],
      }],
    }, true);
    return () => {};
  }, [material]);

  useEffect(() => {
    if (!radarRef.current || !chartRef.current) return;
    const obs = new ResizeObserver(() => chartRef.current?.resize());
    obs.observe(radarRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    return () => { chartRef.current?.dispose(); chartRef.current = null; };
  }, []);

  return (
    <div className="bg-[#0A2540]/50 rounded-lg border border-[#00F5FF]/15 p-2">
      <h4 className="text-[10px] text-[#00F5FF]/70 mb-1 text-center">材料六维属性</h4>
      <div ref={radarRef} className="w-full h-[160px]" />
    </div>
  );
}

// 实验结果区域
function ExperimentResultsSection() {
  const experimentResults = useExperimentWorkflow(s => s.experimentResults);
  if (!experimentResults) return null;
  return (
    <div className="p-4 border-t border-[#00F5FF]/10">
      <ExperimentResultsPanel />
    </div>
  );
}

export default function VirtualLab() {
  const [viewMode, setViewMode] = useState<'2d' | '3d' | '3d-exp'>('2d');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isAnimationPlaying] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  // 参数状态: 本地管理 + 响应AI store变更
  const storeParams = useAppStore(s => s.experimentParams);
  const setStoreParams = useAppStore(s => s.setExperimentParams);
  const [voltage, setVoltageLocal] = useState(storeParams.voltage);
  const [current, setCurrentLocal] = useState(storeParams.current);
  const [pulseWidth, setPulseWidthLocal] = useState(storeParams.pulseWidth);
  const [waveform, setWaveformLocal] = useState(storeParams.waveform || 'sine');

  // 双向同步: 本地→store
  const setVoltage = useCallback((v: number) => { setVoltageLocal(v); setStoreParams({ voltage: v }); }, [setStoreParams]);
  const setCurrent = useCallback((v: number) => { setCurrentLocal(v); setStoreParams({ current: v }); }, [setStoreParams]);
  const setPulseWidth = useCallback((v: number) => { setPulseWidthLocal(v); setStoreParams({ pulseWidth: v }); }, [setStoreParams]);
  const setWaveform = useCallback((v: string) => { setWaveformLocal(v); setStoreParams({ waveform: v }); }, [setStoreParams]);

  // 响应AI store变更→本地 (当AI修改store时同步到UI)
  useEffect(() => {
    setVoltageLocal(storeParams.voltage);
    setCurrentLocal(storeParams.current);
    setPulseWidthLocal(storeParams.pulseWidth);
    if (storeParams.waveform) setWaveformLocal(storeParams.waveform);
  }, [storeParams.voltage, storeParams.current, storeParams.pulseWidth, storeParams.waveform]);
  const [confiningPressure, setConfiningPressure] = useState({ x: 50, y: 30, z: 20 });
  const [enableConfining, setEnableConfining] = useState(false);
  // 多场耦合参数
  const [enableMultiField, setEnableMultiField] = useState(false);
  const [multiFieldTemp, setMultiFieldTemp] = useState(25);
  const [multiFieldEMI, setMultiFieldEMI] = useState(0);
  // AI 优化 Modal
  const [showAIOptimize, setShowAIOptimize] = useState(false);
  const [aiOptStep, setAiOptStep] = useState<'idle' | 'lstm' | 'wgan' | 'ppo' | 'done'>('idle');
  const [aiOptProgress, setAiOptProgress] = useState(0);
  const [aiOptResult, setAiOptResult] = useState<{ voltage: number; current: number; pulseWidth: number; improvement: number } | null>(null);
  const [showInfo, setShowInfo] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Phase 3: 双模式 (仿真 / 连接)
  const labMode = useConnectionStore(s => s.labMode);
  const setLabMode = useConnectionStore(s => s.setLabMode);
  const { status: backendStatus, connect: connectBackend, disconnect: disconnectBackend } = useBackendConnection();
  const backendVersion = useConnectionStore(s => s.backendVersion);
  const isConnected = backendStatus === 'connected';

  // 切换到连接模式前先确保后端在线
  const handleModeSwitch = useCallback(async (mode: LabMode) => {
    if (mode === 'connected' && backendStatus !== 'connected') {
      const ok = await connectBackend();
      if (!ok) return; // 连接失败不切换
    }
    if (mode === 'simulation' && backendStatus === 'connected') {
      disconnectBackend();
    }
    setLabMode(mode);
  }, [backendStatus, connectBackend, disconnectBackend, setLabMode]);

  // 全局状态
  const materials = useAppStore(s => s.materials);
  const materialCategories = useAppStore(s => s.materialCategories);
  // 首次加载时展开全部分类
  useEffect(() => {
    if (expandedCategories.length === 0 && materialCategories.length > 0) {
      setExpandedCategories(materialCategories.map(c => c.id));
    }
  }, [materialCategories]); // eslint-disable-line react-hooks/exhaustive-deps
  const globalSelectedMaterial = useAppStore(s => s.selectedMaterial);
  const setGlobalSelectedMaterial = useAppStore(s => s.setSelectedMaterial);
  const publishLabExperiment = useExperimentDataBus(s => s.publishLabExperiment);
  const safetyChecklistCompleted = useExperimentDataBus(s => s.safetyChecklistCompleted);
  const aiOptimizedParams = useExperimentDataBus(s => s.aiOptimizedParams);

  // 使用全局材料或默认第一个
  const selectedMaterial = globalSelectedMaterial || materials[0];
  const setSelectedMaterial = useCallback((m: Material) => {
    setGlobalSelectedMaterial(m);
  }, [setGlobalSelectedMaterial]);

  // 监听AI视图切换事件
  useEffect(() => {
    const handler = (e: Event) => {
      const mode = (e as CustomEvent).detail as '2d' | '3d' | '3d-exp';
      setViewMode(mode);
    };
    window.addEventListener('ai-set-view-mode', handler);
    return () => window.removeEventListener('ai-set-view-mode', handler);
  }, []);

  // 动画状态(用于波形面板)
  const animState = useExperimentAnimation();

  // 计算参数
  const capacitance = (voltage * voltage * 0.000003);
  const bulletVelocity = Math.sqrt(2 * capacitance * 1000 / 0.5);
  const oilCapacity = 85;

  // 实验完成回调
  const handleExperimentComplete = useCallback(() => {
    if (!selectedMaterial) return;
    // 发布实验数据到数据总线
    publishLabExperiment({
      materialId: selectedMaterial.id,
      materialName: selectedMaterial.name,
      params: { voltage, current, pulseWidth, waveform: '梯形', materialId: selectedMaterial.id },
      waveformData: {
        incident: Array.from({ length: 50 }, (_, i) => -(voltage * 0.025) * Math.exp(-Math.pow((i * 0.1 - 2) / 0.8, 2))),
        reflected: Array.from({ length: 50 }, (_, i) => (voltage * 0.018) * Math.exp(-Math.pow((i * 0.1 - 3.5) / 0.6, 2))),
        transmitted: Array.from({ length: 50 }, (_, i) => -(voltage * 0.015) * Math.exp(-Math.pow((i * 0.1 - 2.5) / 0.7, 2))),
        timeAxis: Array.from({ length: 50 }, (_, i) => i * 20),
      },
      peakStress: voltage * 0.025,
      strainRate: 2500,
      energyAbsorption: capacitance * 0.7,
      yieldStrength: selectedMaterial.yieldStrength / 1e6,
      maxStrain: 0.08,
      duration: 650,
      timestamp: Date.now(),
    });
  }, [selectedMaterial, voltage, current, pulseWidth, capacitance, publishLabExperiment]);

  // AI 三级优化流程
  const handleAIOptimize = useCallback(() => {
    setShowAIOptimize(true);
    setAiOptStep('lstm');
    setAiOptProgress(0);
    setAiOptResult(null);

    // 模拟三阶段优化流程
    let progress = 0;
    const interval = setInterval(() => {
      progress += 2;
      setAiOptProgress(progress);
      if (progress === 34) setAiOptStep('wgan');
      if (progress === 68) setAiOptStep('ppo');
      if (progress >= 100) {
        clearInterval(interval);
        setAiOptStep('done');
        // 基于当前参数生成优化结果
        const optVoltage = Math.min(4000, Math.round(voltage * (1 + (Math.random() * 0.15 - 0.05))));
        const optCurrent = Math.min(50000, Math.round(current * (1 + (Math.random() * 0.1))));
        const optPulseWidth = Math.round(pulseWidth * (0.9 + Math.random() * 0.15));
        const improvement = +(8 + Math.random() * 12).toFixed(1);
        setAiOptResult({ voltage: optVoltage, current: optCurrent, pulseWidth: optPulseWidth, improvement });
        // 发布到数据总线
        useExperimentDataBus.getState().publishAIOptimization({
          voltage: optVoltage, current: optCurrent, pulseWidth: optPulseWidth,
        });
      }
    }, 80);
  }, [voltage, current, pulseWidth]);

  // AI事件监听: 启动/暂停/重置/预设
  useEffect(() => {
    const handleStart = () => { setShowAIConfirm(true); };
    const handlePause = () => { animState.pause(); };
    const handleReset = () => { animState.reset(); };
    const handlePreset = (e: Event) => {
      const presetId = (e as CustomEvent).detail as string;
      const presetMap: Record<string, typeof PARAM_PRESETS[0]> = {
        standard: PARAM_PRESETS[0],
        highSpeed: PARAM_PRESETS[1],
        rock: PARAM_PRESETS[2],
        lowSpeed: PARAM_PRESETS[3],
      };
      const p = presetMap[presetId];
      if (p) { setVoltage(p.voltage); setCurrent(p.current); setPulseWidth(p.pulseWidth); }
    };
    const handleSetConfining = (e: Event) => {
      const detail = (e as CustomEvent).detail as { x?: number; y?: number; z?: number };
      if (!enableConfining) setEnableConfining(true);
      setConfiningPressure(prev => ({
        x: detail.x ?? prev.x,
        y: detail.y ?? prev.y,
        z: detail.z ?? prev.z,
      }));
    };
    const handleToggleConfining = (e: Event) => {
      setEnableConfining(!!(e as CustomEvent).detail);
    };
    const handleJumpStage = (e: Event) => {
      const stageName = (e as CustomEvent).detail as string;
      const stageMap: Record<string, number> = {
        charging: 0, coilAccel: 1, strikerLaunch: 2,
        wavePropagate: 3, deformation: 4, dataCollect: 5,
      };
      const idx = stageMap[stageName];
      if (idx !== undefined) animState.jumpToStage(idx);
    };
    // AI侧边栏控制：参数设置时打开，实验运行时关闭
    const handleSidebarOpen = () => setSidebarCollapsed(false);
    const handleSidebarClose = () => setSidebarCollapsed(true);

    window.addEventListener('ai-start-experiment', handleStart);
    window.addEventListener('ai-pause-experiment', handlePause);
    window.addEventListener('ai-reset-experiment', handleReset);
    window.addEventListener('ai-apply-preset', handlePreset);
    window.addEventListener('ai-set-confining', handleSetConfining);
    window.addEventListener('ai-toggle-confining', handleToggleConfining);
    window.addEventListener('ai-jump-stage', handleJumpStage);
    window.addEventListener('ai-sidebar-open', handleSidebarOpen);
    window.addEventListener('ai-sidebar-close', handleSidebarClose);
    return () => {
      window.removeEventListener('ai-start-experiment', handleStart);
      window.removeEventListener('ai-pause-experiment', handlePause);
      window.removeEventListener('ai-reset-experiment', handleReset);
      window.removeEventListener('ai-apply-preset', handlePreset);
      window.removeEventListener('ai-set-confining', handleSetConfining);
      window.removeEventListener('ai-toggle-confining', handleToggleConfining);
      window.removeEventListener('ai-jump-stage', handleJumpStage);
      window.removeEventListener('ai-sidebar-open', handleSidebarOpen);
      window.removeEventListener('ai-sidebar-close', handleSidebarClose);
    };
  }, [animState, setVoltage, setCurrent, setPulseWidth, enableConfining]);

  // 实验动画完成时自动发布数据
  useEffect(() => {
    if (animState.isComplete) {
      handleExperimentComplete();
    }
  }, [animState.isComplete, handleExperimentComplete]);

  // 3D实验视频同步: 播放/暂停（让视频自然播放，不做逐帧 scrub）
  useEffect(() => {
    const video = videoRef.current;
    if (!video || viewMode !== '3d-exp') return;

    if (animState.isPlaying) {
      if (video.paused) {
        if (video.ended || animState.stageIndex === -1) {
          video.currentTime = 0;
        }
        video.play().catch(() => {});
      }
    } else if (!animState.isComplete) {
      // 只在用户主动暂停时暂停视频（实验完成不强制暂停，让视频自然播完）
      if (!video.paused) video.pause();
    }
  }, [animState.isPlaying, animState.isComplete, animState.stageIndex, viewMode]);

  // 3D实验视频同步: 重置检测
  useEffect(() => {
    const video = videoRef.current;
    if (!video || viewMode !== '3d-exp') return;

    if (!animState.isPlaying && !animState.isComplete && animState.stageIndex === -1) {
      video.pause();
      video.currentTime = 0;
    }
  }, [animState.stageIndex, animState.isPlaying, animState.isComplete, viewMode]);

  // 3D实验视频同步: 切换标签时同步进度
  useEffect(() => {
    const video = videoRef.current;
    if (!video || viewMode !== '3d-exp') return;

    if (animState.isPlaying) {
      const targetTime = animState.globalProgress * video.duration;
      if (isFinite(targetTime) && Math.abs(video.currentTime - targetTime) > 1) {
        video.currentTime = targetTime;
      }
      if (video.paused) {
        video.play().catch(() => {});
      }
    }
  }, [viewMode]);

  // 侧栏折叠状态
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // AI启动确认弹窗
  const [showAIConfirm, setShowAIConfirm] = useState(false);
  // 波形显示 tab
  const [waveformTab, setWaveformTab] = useState('all');
  const [resultsPanelOpen, setResultsPanelOpen] = useState(true);

  // 筛选材料
  const filteredMaterials = searchQuery
    ? materials.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            m.subcategoryLabel.toLowerCase().includes(searchQuery.toLowerCase()))
    : selectedCategory === 'all'
    ? materials
    : materials.filter(m => m.subCategory === selectedCategory);

  return (
    <div className="min-h-screen pt-24">
      {/* 模块连接指示 + 双模式切换 */}
      <div className="h-10 bg-[#051020] border-b border-[#00F5FF]/10 flex items-center justify-between px-4">
        <ModuleConnectionBadge
          dataTo={[
            { module: '材料力学分析', path: '/analysis' },
          ]}
          dataFrom={[
            { module: '系统监控', path: '/monitor', hasData: safetyChecklistCompleted },
          ]}
        />

        {/* Phase 3: 仿真 / 连接模式切换 */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-white/10 overflow-hidden text-xs">
            <button
              onClick={() => handleModeSwitch('simulation')}
              className={`px-3 py-1.5 flex items-center gap-1 transition-colors ${
                labMode === 'simulation'
                  ? 'bg-[#00F5FF]/20 text-[#00F5FF] font-medium'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/5'
              }`}
            >
              <Zap className="w-3 h-3" />仿真模式
            </button>
            <button
              onClick={() => handleModeSwitch('connected')}
              className={`px-3 py-1.5 flex items-center gap-1 transition-colors ${
                labMode === 'connected'
                  ? 'bg-emerald-500/20 text-emerald-400 font-medium'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/5'
              }`}
            >
              {backendStatus === 'connecting' || backendStatus === 'reconnecting' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : isConnected ? (
                <Wifi className="w-3 h-3" />
              ) : (
                <WifiOff className="w-3 h-3" />
              )}
              连接模式
            </button>
          </div>

          {/* 连接状态指示 */}
          {labMode === 'connected' && (
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className={`w-1.5 h-1.5 rounded-full ${
                isConnected ? 'bg-emerald-400 shadow-[0_0_4px_rgba(16,185,129,0.6)]' :
                backendStatus === 'connecting' || backendStatus === 'reconnecting' ? 'bg-yellow-400 animate-pulse' :
                'bg-red-400'
              }`} />
              <span className="text-white/40">
                {isConnected ? `v${backendVersion || '?'}` :
                 backendStatus === 'connecting' ? '连接中' :
                 backendStatus === 'reconnecting' ? '重连中' : '未连接'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* AI启动确认弹窗 */}
      <AnimatePresence>
        {showAIConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAIConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0A2540] border border-[#00F5FF]/30 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">AI 请求启动实验</h3>
                  <p className="text-xs text-white/50">请确认以下参数后开始</p>
                </div>
              </div>
              <div className="bg-[#051020] rounded-lg p-4 space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">电压</span>
                  <span className="text-[#00F5FF] font-mono">{voltage} V</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">电流</span>
                  <span className="text-[#1DD1A1] font-mono">{(current / 1000).toFixed(1)} kA</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">脉宽</span>
                  <span className="text-[#FF9F43] font-mono">{pulseWidth} μs</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">材料</span>
                  <span className="text-white">{selectedMaterial.name}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowAIConfirm(false)}
                  variant="outline"
                  className="flex-1 border-white/20 text-white/60"
                >
                  取消
                </Button>
                <Button
                  onClick={() => { setShowAIConfirm(false); animState.reset(); animState.play(); }}
                  className="flex-1 bg-[#00F5FF]/20 text-[#00F5FF] border border-[#00F5FF]/40 hover:bg-[#00F5FF]/30"
                >
                  <Play className="w-4 h-4 mr-1.5" />
                  确认启动
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI 三级优化 Modal */}
      <AnimatePresence>
        {showAIOptimize && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => { if (aiOptStep === 'done' || aiOptStep === 'idle') { setShowAIOptimize(false); setAiOptStep('idle'); } }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0A2540] border border-[#8B5CF6]/30 rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/20 flex items-center justify-center">
                    <Brain className="w-5 h-5 text-[#8B5CF6]" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">AI 三级优化引擎</h3>
                    <p className="text-[10px] text-white/40">LSTM 预测 → WGAN-GP 增强 → PPO 精细搜索</p>
                  </div>
                </div>
                {(aiOptStep === 'done' || aiOptStep === 'idle') && (
                  <button onClick={() => { setShowAIOptimize(false); setAiOptStep('idle'); }} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* 三阶段进度 */}
              <div className="space-y-3 mb-5">
                {([
                  { id: 'lstm', label: 'LSTM 时序预测', desc: '扫描参数空间，预测最优区域', color: '#00F5FF', threshold: 0 },
                  { id: 'wgan', label: 'WGAN-GP 数据增强', desc: '生成高质量训练数据', color: '#FF9F43', threshold: 34 },
                  { id: 'ppo', label: 'PPO 策略优化', desc: '强化学习精细搜索', color: '#1DD1A1', threshold: 68 },
                ] as const).map((stage) => {
                  const isActive = aiOptStep === stage.id;
                  const isDone = aiOptProgress > stage.threshold + 32;
                  const stageProgress = isActive ? Math.min(100, Math.max(0, (aiOptProgress - stage.threshold) * 100 / 32)) : isDone ? 100 : 0;
                  return (
                    <div key={stage.id} className="rounded-lg border overflow-hidden" style={{ borderColor: isActive ? `${stage.color}40` : isDone ? `${stage.color}20` : 'rgba(255,255,255,0.06)' }}>
                      <div className="px-3 py-2 flex items-center justify-between" style={{ background: isActive ? `${stage.color}10` : 'transparent' }}>
                        <div className="flex items-center gap-2">
                          {isDone ? (
                            <CheckCircle2 className="w-4 h-4" style={{ color: stage.color }} />
                          ) : isActive ? (
                            <motion.div className="w-4 h-4 rounded-full border-2 border-t-transparent" style={{ borderColor: stage.color }} animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-white/20" />
                          )}
                          <div>
                            <span className="text-xs font-medium" style={{ color: isActive || isDone ? stage.color : 'rgba(255,255,255,0.4)' }}>{stage.label}</span>
                            <span className="text-[10px] text-white/30 ml-2">{stage.desc}</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono" style={{ color: stage.color }}>{isDone ? '100%' : isActive ? `${stageProgress.toFixed(0)}%` : ''}</span>
                      </div>
                      {(isActive || isDone) && (
                        <div className="h-1 bg-[#051020]">
                          <motion.div className="h-full" style={{ backgroundColor: stage.color, width: `${stageProgress}%` }} transition={{ duration: 0.3 }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 总进度 */}
              <div className="mb-4">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-white/40">总进度</span>
                  <span className="text-[#8B5CF6] font-mono">{aiOptProgress}%</span>
                </div>
                <div className="h-2 bg-[#051020] rounded-full overflow-hidden">
                  <motion.div className="h-full rounded-full bg-gradient-to-r from-[#00F5FF] via-[#FF9F43] to-[#1DD1A1]" style={{ width: `${aiOptProgress}%` }} />
                </div>
              </div>

              {/* 优化结果 */}
              {aiOptStep === 'done' && aiOptResult && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  <div className="bg-[#051020] rounded-lg p-4 border border-[#1DD1A1]/20">
                    <div className="text-xs text-[#1DD1A1] font-medium mb-2 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      优化完成 · 性能提升 {aiOptResult.improvement}%
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center">
                        <div className="text-[#00F5FF] font-mono text-sm font-bold">{aiOptResult.voltage}</div>
                        <div className="text-[9px] text-white/40">电压 V</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[#1DD1A1] font-mono text-sm font-bold">{(aiOptResult.current / 1000).toFixed(1)}</div>
                        <div className="text-[9px] text-white/40">电流 kA</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[#FF9F43] font-mono text-sm font-bold">{aiOptResult.pulseWidth}</div>
                        <div className="text-[9px] text-white/40">脉宽 μs</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => { setShowAIOptimize(false); setAiOptStep('idle'); }}
                      variant="outline"
                      className="flex-1 border-white/20 text-white/60"
                    >
                      关闭
                    </Button>
                    <Button
                      onClick={() => {
                        setVoltage(aiOptResult.voltage);
                        setCurrent(aiOptResult.current);
                        setPulseWidth(aiOptResult.pulseWidth);
                        setShowAIOptimize(false);
                        setAiOptStep('idle');
                      }}
                      className="flex-1 bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/40 hover:bg-[#8B5CF6]/30"
                    >
                      <Sparkles className="w-4 h-4 mr-1.5" />
                      应用参数
                    </Button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="h-[calc(100vh-128px)] flex">
        {/* 左侧合并面板 — 材料库 + 参数控制 */}
        <motion.div
          initial={{ x: -360, opacity: 0 }}
          animate={{ x: 0, opacity: 1, width: sidebarCollapsed ? 48 : 360 }}
          transition={{ duration: 0.3 }}
          className="bg-[#051020] border-r border-[#00F5FF]/20 flex flex-col flex-shrink-0 overflow-hidden"
        >
          {/* 折叠按钮 */}
          <div className="p-2 border-b border-[#00F5FF]/10 flex items-center justify-between">
            {!sidebarCollapsed && (
              <span className="text-sm font-semibold text-white flex items-center gap-2 ml-2">
                <Database className="w-4 h-4 text-[#00F5FF]" />
                实验控制台
              </span>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 rounded-lg hover:bg-white/5 text-white/60 hover:text-white transition-colors"
            >
              {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          </div>

          {sidebarCollapsed ? (
            /* 折叠态 — 只显示图标 */
            <div className="flex flex-col items-center gap-2 py-4">
              <button onClick={() => setSidebarCollapsed(false)} className="p-2 rounded-lg hover:bg-white/5 text-white/50" title="材料库">
                <Database className="w-4 h-4" />
              </button>
              <button onClick={() => setSidebarCollapsed(false)} className="p-2 rounded-lg hover:bg-white/5 text-white/50" title="参数设置">
                <Zap className="w-4 h-4" />
              </button>
              <button onClick={() => setSidebarCollapsed(false)} className="p-2 rounded-lg hover:bg-white/5 text-white/50" title="材料信息">
                <Beaker className="w-4 h-4" />
              </button>
            </div>
          ) : (
          /* 展开态 — Tabs: 材料库 / 参数 / 围压 */
          <Tabs defaultValue="materials" className="flex-1 flex flex-col gap-0 overflow-hidden">
            <TabsList className="w-full bg-[#0A2540] border-b border-[#00F5FF]/10 rounded-none flex-shrink-0">
              <TabsTrigger value="materials" className="flex-1 text-xs data-[state=active]:bg-[#00F5FF]/20">材料库</TabsTrigger>
              <TabsTrigger value="params" className="flex-1 text-xs data-[state=active]:bg-[#00F5FF]/20">参数</TabsTrigger>
              <TabsTrigger value="info" className="flex-1 text-xs data-[state=active]:bg-[#00F5FF]/20">材料</TabsTrigger>
            </TabsList>

            <TabsContent value="materials" className="flex-1 overflow-hidden mt-0 data-[state=active]:flex flex-col">
          {/* 搜索框 + 分类筛选 */}
          <div className="px-2.5 py-2 border-b border-[#00F5FF]/10 flex-shrink-0 space-y-1.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
              <input
                type="text"
                placeholder="搜索材料..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-[#0A2540] border border-[#00F5FF]/20 rounded-lg text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-[#00F5FF]/50"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-2 py-0.5 text-[10px] rounded ${selectedCategory === 'all' ? 'bg-[#00F5FF] text-[#0A2540]' : 'bg-[#0A2540] text-white/60'}`}
              >
                全部
              </button>
              {materialCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-1.5 py-0.5 text-[10px] rounded ${selectedCategory === cat.id ? 'bg-[#00F5FF] text-[#0A2540]' : 'bg-[#0A2540] text-white/60'}`}
                >
                  {cat.icon}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-white/30">{materialCategories.length}大类 · {materials.length}种材料</p>
          </div>

          {/* 材料列表 */}
          <div className="flex-1 overflow-y-auto px-2.5 py-1.5">
            {searchQuery ? (
              <div className="space-y-0.5">
                {filteredMaterials.map((material) => (
                  <button
                    key={material.id}
                    onClick={() => setSelectedMaterial(material)}
                    className={`w-full px-2 py-1.5 rounded text-left transition-all border ${
                      selectedMaterial.id === material.id
                        ? 'bg-[#00F5FF]/10 border-[#00F5FF]/50'
                        : 'bg-transparent border-transparent hover:bg-[#0A2540]/50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: material.color }} />
                      <span className="text-xs text-white">{material.name}</span>
                      <span className="text-[10px] text-white/40 ml-auto">{material.subcategoryLabel}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {materialCategories.map((category) => {
                  const catMaterials = filteredMaterials.filter(m => m.subCategory === category.id);
                  return (
                    <MaterialCategoryAccordion
                      key={category.id}
                      category={category}
                      categoryMaterials={catMaterials}
                      selectedMaterial={selectedMaterial}
                      onSelectMaterial={setSelectedMaterial}
                      isOpen={expandedCategories.includes(category.id)}
                      onToggle={() => {
                        setExpandedCategories(prev =>
                          prev.includes(category.id)
                            ? prev.filter(id => id !== category.id)
                            : [...prev, category.id]
                        );
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
            </TabsContent>

            <TabsContent value="params" className="flex-1 overflow-y-auto mt-0">
              <div className="p-3 space-y-3">

              {/* ── 实验状态概览（置顶） ── */}
              <div className="rounded-lg overflow-hidden border border-[#00F5FF]/15">
                <div className="px-3 py-2 bg-gradient-to-r from-[#00F5FF]/10 to-transparent flex items-center justify-between">
                  <h4 className="text-xs text-[#00F5FF] font-medium flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" />
                    实验状态
                  </h4>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${animState.isPlaying ? 'bg-[#10B981]/20 text-[#10B981]' : animState.isComplete ? 'bg-[#FFD700]/20 text-[#FFD700]' : 'bg-white/5 text-white/40'}`}>
                    {animState.isComplete ? 'COMPLETE' : animState.isPlaying ? 'RUNNING' : 'READY'}
                  </span>
                </div>
                <div className="px-3 py-2 bg-[#0A2540]/30 space-y-2">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-white/50">材料</span>
                      <span className="text-white font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: selectedMaterial.color }} />
                        {selectedMaterial.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">阶段</span>
                      <span className="text-white/70 font-mono">
                        {animState.isComplete ? `${animState.stages.length}/${animState.stages.length}` : animState.stageIndex >= 0 ? `${animState.stageIndex + 1}/${animState.stages.length}` : `0/${animState.stages.length}`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">储能</span>
                      <span className="text-[#00F5FF] font-mono">{capacitance.toFixed(2)} kJ</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">初速</span>
                      <span className="text-[#FFD700] font-mono">{bulletVelocity.toFixed(1)} m/s</span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-[#051020] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${animState.globalProgress * 100}%`, background: animState.isComplete ? '#FFD700' : 'linear-gradient(90deg, #00F5FF, #1DD1A1)' }} />
                  </div>
                </div>
              </div>

              {/* ── 快速预设 ── */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-white/50 font-medium">快速预设</span>
                  {aiOptimizedParams && (
                    <button
                      onClick={() => { setVoltage(aiOptimizedParams.voltage); setCurrent(aiOptimizedParams.current); setPulseWidth(aiOptimizedParams.pulseWidth); }}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 text-[10px] text-[#8B5CF6] hover:bg-[#8B5CF6]/25 transition-colors"
                    >
                      <Sparkles className="w-3 h-3" />
                      AI推荐
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {PARAM_PRESETS.map((p) => (
                    <button key={p.label} onClick={() => { setVoltage(p.voltage); setCurrent(p.current); setPulseWidth(p.pulseWidth); }} disabled={isAnimationPlaying}
                      className="p-2 rounded-lg bg-[#0A2540]/50 border border-white/10 hover:border-[#00F5FF]/30 transition-all text-left disabled:opacity-40">
                      <div className="text-[11px] font-medium text-white/80">{p.label}</div>
                      <div className="text-[9px] text-white/40 mt-0.5">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── 核心参数 ── */}
              <div className="space-y-2">
                <span className="text-[11px] text-white/50 font-medium">核心参数</span>
                <div data-ai-target="lab-voltage">
                  <SliderInputCombo value={voltage} onChange={setVoltage} min={1000} max={4000} step={50} disabled={isAnimationPlaying} label="电压" unit="V" icon={<Zap className="w-4 h-4 text-[#00F5FF]" />} color="#00F5FF" />
                  {aiOptimizedParams && aiOptimizedParams.voltage !== voltage && (
                    <button onClick={() => setVoltage(aiOptimizedParams.voltage)} className="text-[9px] text-[#8B5CF6] hover:underline mt-0.5 ml-1">AI推荐: {aiOptimizedParams.voltage}V</button>
                  )}
                </div>
                <div data-ai-target="lab-current">
                  <SliderInputCombo value={current} onChange={setCurrent} min={0} max={50000} step={500} disabled={isAnimationPlaying} label="电流" unit="kA" icon={<Activity className="w-4 h-4 text-[#1DD1A1]" />} color="#1DD1A1" formatDisplay={(v) => (v / 1000).toFixed(1)} />
                  {aiOptimizedParams && aiOptimizedParams.current !== current && (
                    <button onClick={() => setCurrent(aiOptimizedParams.current)} className="text-[9px] text-[#8B5CF6] hover:underline mt-0.5 ml-1">AI推荐: {(aiOptimizedParams.current / 1000).toFixed(1)}kA</button>
                  )}
                </div>
                <div data-ai-target="lab-pulseWidth">
                  <SliderInputCombo value={pulseWidth} onChange={setPulseWidth} min={200} max={1100} step={50} disabled={isAnimationPlaying} label="脉宽" unit="μs" icon={<Clock className="w-4 h-4 text-[#FF9F43]" />} color="#FF9F43" />
                  {aiOptimizedParams && aiOptimizedParams.pulseWidth !== pulseWidth && (
                    <button onClick={() => setPulseWidth(aiOptimizedParams.pulseWidth)} className="text-[9px] text-[#8B5CF6] hover:underline mt-0.5 ml-1">AI推荐: {aiOptimizedParams.pulseWidth}μs</button>
                  )}
                </div>
              </div>

              {/* ── 波形选择 ── */}
              <div>
                <label className="text-[11px] text-white/50 font-medium flex items-center gap-1.5 mb-1.5">
                  <Waves className="w-3.5 h-3.5 text-[#8B5CF6]" />
                  波形类型
                </label>
                <Select value={waveform} onValueChange={(v) => setWaveform(v)} disabled={isAnimationPlaying}>
                  <SelectTrigger className="bg-[#0A2540] border-[#00F5FF]/30 text-white h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0A2540] border-[#00F5FF]/30">
                    {waveformTypes.map((w) => (
                      <SelectItem key={w.value} value={w.value} className="text-white hover:bg-[#00F5FF]/20">
                        <div><div>{w.label}</div><div className="text-xs text-white/50">{w.description}</div></div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* ── 多场耦合参数 ── */}
              <div className="rounded-lg border border-[#FF9F43]/15 overflow-hidden">
                <div className="px-3 py-2 bg-[#FF9F43]/5 flex items-center justify-between">
                  <label className="text-[11px] text-[#FF9F43] font-medium flex items-center gap-1.5">
                    <Thermometer className="w-3.5 h-3.5" />
                    多场耦合
                  </label>
                  <Switch checked={enableMultiField} onCheckedChange={setEnableMultiField} disabled={isAnimationPlaying} />
                </div>
                {enableMultiField && (
                  <div className="px-3 py-2 space-y-2">
                    {/* 温度场 */}
                    <SliderInputCombo value={multiFieldTemp} onChange={setMultiFieldTemp} min={-50} max={1000} step={10} disabled={isAnimationPlaying} label="温度" unit="°C" icon={<Thermometer className="w-4 h-4 text-[#FF6B6B]" />} color="#FF6B6B" />
                    {/* 围压 */}
                    <div className="pt-1 border-t border-white/5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] text-white/40">围压控制</span>
                        <Switch checked={enableConfining} onCheckedChange={setEnableConfining} disabled={isAnimationPlaying} />
                      </div>
                      {enableConfining && (
                        <div className="space-y-1.5">
                          {(['x', 'y', 'z'] as const).map((axis) => (
                            <SliderInputCombo key={axis} value={confiningPressure[axis]} onChange={(v) => setConfiningPressure(prev => ({ ...prev, [axis]: v }))} min={0} max={200} step={5} disabled={isAnimationPlaying} label={`${axis.toUpperCase()}轴`} unit="MPa" color="#00F5FF" />
                          ))}
                        </div>
                      )}
                    </div>
                    {/* 电磁场 */}
                    <div className="pt-1 border-t border-white/5">
                      <SliderInputCombo value={multiFieldEMI} onChange={setMultiFieldEMI} min={0} max={95} step={5} disabled={isAnimationPlaying} label="EMI 场强" unit="dB" icon={<Radio className="w-4 h-4 text-[#A855F6]" />} color="#A855F6" />
                    </div>
                  </div>
                )}
              </div>

              {!enableMultiField && (
                /* ── 围压控制（多场耦合关闭时独立显示） ── */
                <div className="rounded-lg border border-[#00F5FF]/10 overflow-hidden">
                  <div className="px-3 py-2 bg-[#0A2540]/40 flex items-center justify-between">
                    <label className="text-[11px] text-white/60 font-medium">围压控制</label>
                    <Switch checked={enableConfining} onCheckedChange={setEnableConfining} disabled={isAnimationPlaying} />
                  </div>
                  {enableConfining && (
                    <div className="px-3 py-2 space-y-2">
                      {(['x', 'y', 'z'] as const).map((axis) => (
                        <SliderInputCombo key={axis} value={confiningPressure[axis]} onChange={(v) => setConfiningPressure(prev => ({ ...prev, [axis]: v }))} min={0} max={200} step={5} disabled={isAnimationPlaying} label={`${axis.toUpperCase()}轴`} unit="MPa" color="#00F5FF" />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── AI 智能优化 ── */}
              <button
                onClick={handleAIOptimize}
                disabled={isAnimationPlaying}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[#8B5CF6]/20 to-[#6366F1]/20 border border-[#8B5CF6]/30 text-[#8B5CF6] text-xs font-medium flex items-center justify-center gap-2 hover:from-[#8B5CF6]/30 hover:to-[#6366F1]/30 transition-all disabled:opacity-40"
              >
                <Brain className="w-4 h-4" />
                AI 三级优化 (LSTM → WGAN → PPO)
              </button>

              {/* ── 实时计算 ── */}
              <div className="rounded-lg border border-[#00F5FF]/15 overflow-hidden">
                <div className="px-3 py-1.5 bg-gradient-to-r from-[#00F5FF]/8 to-transparent">
                  <span className="text-[11px] text-[#00F5FF] font-medium">实时计算</span>
                </div>
                <div className="px-3 py-2 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-[#051020]/60 rounded-lg py-2 px-1">
                    <div className="text-[#00F5FF] font-mono text-sm font-bold">{capacitance.toFixed(1)}</div>
                    <div className="text-[9px] text-white/40 mt-0.5">储能 kJ</div>
                  </div>
                  <div className="bg-[#051020]/60 rounded-lg py-2 px-1">
                    <div className="text-[#FFD700] font-mono text-sm font-bold">{bulletVelocity.toFixed(0)}</div>
                    <div className="text-[9px] text-white/40 mt-0.5">初速 m/s</div>
                  </div>
                  <div className="bg-[#051020]/60 rounded-lg py-2 px-1">
                    <div className="text-[#8B5CF6] font-mono text-sm font-bold">{Math.round(bulletVelocity * 10)}</div>
                    <div className="text-[9px] text-white/40 mt-0.5">应变率 /s</div>
                  </div>
                </div>
              </div>

              </div>
            </TabsContent>

            <TabsContent value="info" className="flex-1 overflow-y-auto mt-0">
              <div className="p-3 space-y-3">

              {/* ── 当前材料概览 ── */}
              <div className="rounded-lg overflow-hidden border border-[#00F5FF]/15">
                <div className="px-3 py-2 bg-gradient-to-r from-[#00F5FF]/10 to-transparent flex items-center justify-between">
                  <h4 className="text-xs text-[#00F5FF] font-medium flex items-center gap-1.5">
                    <Beaker className="w-3.5 h-3.5" />
                    当前材料
                  </h4>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: `${selectedMaterial.color}20`, color: selectedMaterial.color, border: `1px solid ${selectedMaterial.color}40` }}>
                    {selectedMaterial.subcategoryLabel || '金属'}
                  </span>
                </div>
                <div className="px-3 py-2 bg-[#0A2540]/30 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded" style={{ backgroundColor: selectedMaterial.color, boxShadow: `0 0 8px ${selectedMaterial.color}40` }} />
                    <span className="text-white font-medium text-sm">{selectedMaterial.name}</span>
                  </div>
                  <p className="text-[11px] text-white/50 leading-relaxed">{selectedMaterial.description}</p>
                </div>
              </div>

              {/* ── 核心力学参数 ── */}
              <div className="rounded-lg border border-[#00F5FF]/15 overflow-hidden">
                <div className="px-3 py-1.5 bg-gradient-to-r from-[#1DD1A1]/8 to-transparent">
                  <span className="text-[11px] text-[#1DD1A1] font-medium">力学参数</span>
                </div>
                <div className="px-3 py-2 space-y-1.5">
                  {[
                    { label: '密度 ρ', value: `${(selectedMaterial.density / 1000).toFixed(2)}`, unit: 'g/cm³', color: '#00F5FF' },
                    { label: '弹性模量 E', value: `${(selectedMaterial.elasticModulus / 1e9).toFixed(1)}`, unit: 'GPa', color: '#1DD1A1' },
                    { label: '屈服强度 σs', value: `${(selectedMaterial.yieldStrength / 1e6).toFixed(0)}`, unit: 'MPa', color: '#FFD700' },
                  ].map((p) => (
                    <div key={p.label} className="flex items-center justify-between text-[11px]">
                      <span className="text-white/50">{p.label}</span>
                      <span className="font-mono" style={{ color: p.color }}>{p.value} <span className="text-white/40 text-[10px]">{p.unit}</span></span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── 动态响应参数 ── */}
              <div className="rounded-lg border border-[#00F5FF]/15 overflow-hidden">
                <div className="px-3 py-1.5 bg-gradient-to-r from-[#8B5CF6]/8 to-transparent">
                  <span className="text-[11px] text-[#8B5CF6] font-medium">动态响应</span>
                </div>
                <div className="px-3 py-2 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-[#051020]/60 rounded-lg py-2 px-1">
                    <div className="text-[#00F5FF] font-mono text-sm font-bold">{selectedMaterial.stiffnessK}</div>
                    <div className="text-[9px] text-white/40 mt-0.5">刚度 GPa</div>
                  </div>
                  <div className="bg-[#051020]/60 rounded-lg py-2 px-1">
                    <div className="text-[#FF9F43] font-mono text-sm font-bold">{selectedMaterial.dampingC}</div>
                    <div className="text-[9px] text-white/40 mt-0.5">阻尼系数</div>
                  </div>
                  <div className="bg-[#051020]/60 rounded-lg py-2 px-1">
                    <div className="text-[#8B5CF6] font-mono text-sm font-bold">{selectedMaterial.emiThreshold}</div>
                    <div className="text-[9px] text-white/40 mt-0.5">EMI dB</div>
                  </div>
                </div>
              </div>

              {/* ── 波阻抗匹配 ── */}
              <div className="rounded-lg border border-[#00F5FF]/15 overflow-hidden">
                <div className="px-3 py-1.5 bg-gradient-to-r from-[#FFD700]/8 to-transparent">
                  <span className="text-[11px] text-[#FFD700] font-medium">波阻抗匹配</span>
                </div>
                <div className="px-3 py-2 space-y-2">
                  {(() => {
                    const barImpedance = 40.5; // 钢杆典型波阻抗 MPa·s/m
                    const specimenImpedance = Math.sqrt(selectedMaterial.elasticModulus * selectedMaterial.density) / 1e6;
                    const matchRatio = specimenImpedance / barImpedance;
                    const matchPercent = Math.min(100, matchRatio * 100);
                    const matchColor = matchPercent > 80 ? '#10B981' : matchPercent > 50 ? '#FFD700' : '#EF4444';
                    const matchLabel = matchPercent > 80 ? '优秀' : matchPercent > 50 ? '良好' : '较差';
                    return (
                      <>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-white/50">试件波阻抗</span>
                          <span className="text-white/80 font-mono">{specimenImpedance.toFixed(1)} MPa·s/m</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-white/50">匹配程度</span>
                          <span className="font-mono font-medium" style={{ color: matchColor }}>{matchLabel} ({matchPercent.toFixed(0)}%)</span>
                        </div>
                        <div className="w-full h-1.5 bg-[#051020] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${matchPercent}%`, backgroundColor: matchColor }} />
                        </div>
                        <div className="text-[9px] text-white/30">匹配比 = 试件阻抗 / 杆件阻抗(≈40.5 MPa·s/m)</div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* ── 材料六维雷达 ── */}
              <MaterialRadarMini material={selectedMaterial} />

              {/* ── 实验结果 ── */}
              <ExperimentResultsSection />

              {/* ── 实验说明 ── */}
              <div className="rounded-lg border border-[#00F5FF]/10 overflow-hidden">
                <div className="px-3 py-2 bg-[#0A2540]/40 flex items-center justify-between cursor-pointer" onClick={() => setShowInfo(!showInfo)}>
                  <span className="text-[11px] text-white/60 font-medium flex items-center gap-1.5">
                    <Info className="w-3 h-3" />
                    关于本实验
                  </span>
                  {showInfo ? <ChevronUp className="w-3.5 h-3.5 text-white/40" /> : <ChevronDown className="w-3.5 h-3.5 text-white/40" />}
                </div>
                {showInfo && (
                  <div className="px-3 py-2 space-y-1.5 text-[11px] text-white/50">
                    <p>模拟电磁驱动霍普金森杆（SHPB）实验过程，支持参数优化与波形预测。</p>
                    <div className="flex items-center gap-1 text-[#00F5FF]">
                      <ArrowRight className="w-3 h-3" />
                      <span>数据自动传递至材料力学分析页面</span>
                    </div>
                    <div className="flex items-center gap-1 text-[#1DD1A1]">
                      <ArrowRight className="w-3 h-3" />
                      <span>支持多种波形与围压组合实验</span>
                    </div>
                  </div>
                )}
              </div>

              </div>
            </TabsContent>
          </Tabs>
          )}
        </motion.div>

        {/* 主实验区域 */}
        <div className="flex-1 flex flex-col">
          {/* 顶部工具栏 */}
          {!(animState.isComplete && resultsPanelOpen) && (
          <div className="h-14 bg-[#051020] border-b border-[#00F5FF]/10 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('3d-exp')}
                className={`px-4 py-1.5 rounded-lg text-sm transition-all ${
                  viewMode === '3d-exp' ? 'bg-[#00F5FF] text-[#0A2540] font-medium' : 'bg-[#0A2540] text-white/70 hover:bg-[#0A2540]/80'
                }`}
              >
                3D实验
              </button>
              <button
                onClick={() => setViewMode('2d')}
                className={`px-4 py-1.5 rounded-lg text-sm transition-all ${
                  viewMode === '2d' ? 'bg-[#00F5FF] text-[#0A2540] font-medium' : 'bg-[#0A2540] text-white/70 hover:bg-[#0A2540]/80'
                }`}
              >
                2D图示
              </button>
              <button
                onClick={() => setViewMode('3d')}
                className={`px-4 py-1.5 rounded-lg text-sm transition-all ${
                  viewMode === '3d' ? 'bg-[#00F5FF] text-[#0A2540] font-medium' : 'bg-[#0A2540] text-white/70 hover:bg-[#0A2540]/80'
                }`}
              >
                3D图示
              </button>
            </div>

            {/* 安全检查状态 */}
            <div className="flex items-center gap-3">
              {safetyChecklistCompleted ? (
                <Badge className="bg-[#10B981]/20 text-[#10B981] border-[#10B981]/30">
                  ✓ 安全检查通过
                </Badge>
              ) : (
                <Badge className="bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/30">
                  ⚠ 需完成安全检查
                </Badge>
              )}
            </div>
          </div>
          )}

          {/* 阶段进度条 + 控制按钮 */}
          {!(animState.isComplete && resultsPanelOpen) && (
          <div className="h-12 bg-[#051020]/80 border-b border-[#00F5FF]/10 flex items-center px-4 gap-3">
            {/* 控制按钮 */}
            <div className="flex items-center gap-1.5">
              {animState.isPlaying ? (
                <button
                  onClick={() => animState.pause()}
                  className="w-8 h-8 rounded-lg bg-[#F59E0B]/20 border border-[#F59E0B]/30 flex items-center justify-center hover:bg-[#F59E0B]/30 transition-colors"
                  title="暂停"
                >
                  <Pause className="w-4 h-4 text-[#F59E0B]" />
                </button>
              ) : (
                <button
                  onClick={() => animState.play()}
                  className="h-8 px-3 rounded-lg bg-[#10B981] text-white font-medium text-xs flex items-center gap-1.5 hover:bg-[#10B981]/80 shadow-[0_0_12px_rgba(16,185,129,0.4)] transition-all"
                  title="开始实验"
                >
                  <Play className="w-4 h-4 fill-current" />
                  开始实验
                </button>
              )}
              <button
                onClick={() => animState.reset()}
                className="w-8 h-8 rounded-lg bg-[#0A2540] border border-white/10 flex items-center justify-center hover:border-white/30 transition-colors"
                title="重置"
              >
                <RotateCcw className="w-4 h-4 text-white/60" />
              </button>
            </div>

            {/* 阶段进度 */}
            <div className="flex-1 flex items-center gap-1">
              {animState.stages.map((stage, i) => {
                const isCurrent = animState.stageIndex === i;
                const isDone = animState.stageIndex > i;
                const isActive = isCurrent || isDone;
                return (
                  <div key={stage.stage} className="flex items-center flex-1">
                    <button
                      onClick={() => animState.jumpToStage(i)}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-all w-full ${
                        isCurrent
                          ? 'bg-[#00F5FF]/15 border border-[#00F5FF]/40 text-[#00F5FF]'
                          : isDone
                          ? 'bg-[#10B981]/10 border border-[#10B981]/20 text-[#10B981]'
                          : 'bg-[#0A2540]/50 border border-white/5 text-white/40'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        isCurrent ? 'bg-[#00F5FF] animate-pulse' : isDone ? 'bg-[#10B981]' : 'bg-white/20'
                      }`} />
                      <span className="truncate">{stage.label}</span>
                    </button>
                    {i < animState.stages.length - 1 && (
                      <div className={`w-3 h-px mx-0.5 flex-shrink-0 ${isActive ? 'bg-[#00F5FF]/30' : 'bg-white/10'}`} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* 进度百分比 */}
            <span className="text-xs text-white/50 font-mono w-12 text-right">
              {(animState.globalProgress * 100).toFixed(0)}%
            </span>
          </div>
          )}

          {/* 可调大小的可视化 + 波形区域 */}
          {!(animState.isComplete && resultsPanelOpen) && (
          <ResizablePanelGroup direction="vertical" className="flex-1 min-h-0">
            {/* 2D/3D 可视化区域 — 默认 65% */}
            <ResizablePanel defaultSize={65} minSize={40}>
              <div className="h-full relative bg-gradient-to-b from-[#0A2540] to-[#051020]">
                <AnimatePresence mode="wait">
                  {viewMode === '2d' ? (
                    <motion.div
                      key="2d"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0"
                    >
                      <HopkinsonBar2DRealistic
                        voltage={voltage}
                        current={current}
                        pulseWidth={pulseWidth}
                        waveform={waveform}
                        materialName={selectedMaterial.name}
                        materialColor={selectedMaterial.color}
                        materialCategory={selectedMaterial.subCategory}
                        stiffnessK={selectedMaterial.stiffnessK}
                        dampingC={selectedMaterial.dampingC}
                        currentStage={animState.currentStage}
                        stageIndex={animState.stageIndex}
                        stageProgress={animState.stageProgress}
                        globalProgress={animState.globalProgress}
                        isPlaying={animState.isPlaying}
                        isComplete={animState.isComplete}
                      />
                    </motion.div>
                  ) : viewMode === '3d' ? (
                    <motion.div
                      key="3d"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-gradient-to-b from-[#0A2540] to-[#051020]"
                    >
                      {/* 3D数字孪生场景 */}
                      <HopkinsonBar3D
                        animState={animState}
                        materialColor={selectedMaterial?.color || '#E8B888'}
                        className="absolute inset-0 w-full h-full"
                      />
                      {/* 左上角3D标签 */}
                      <div className="absolute top-3 left-4 z-20 flex items-center gap-2 pointer-events-none">
                        <div className="px-2 py-1 rounded bg-[#0A2540]/80 border border-[#00F5FF]/20 text-[10px] text-[#00F5FF]/70 font-mono backdrop-blur-sm">
                          3D REAL-TIME · {animState.isPlaying ? 'RUNNING' : animState.isComplete ? 'COMPLETE' : 'STANDBY'}
                        </div>
                      </div>
                      {/* 右下角帧信息 */}
                      <div className="absolute bottom-3 right-4 z-20 pointer-events-none">
                        <div className="px-2 py-1 rounded bg-[#0A2540]/80 border border-[#00F5FF]/10 text-[9px] text-white/30 font-mono backdrop-blur-sm">
                          {animState.isPlaying ? `STAGE ${animState.stageIndex + 1}/${animState.stages.length}` : animState.isComplete ? 'DATA CAPTURED' : 'READY'}
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="3d-exp"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-gradient-to-b from-[#0A2540] to-[#051020]"
                      onContextMenu={(e) => e.preventDefault()}
                    >
                      {/* 伪装视频 — 所有交互被屏蔽 */}
                      <video
                        ref={videoRef}
                        src="https://hopkinson-assets.oss-cn-hangzhou.aliyuncs.com/videos/3Dmodel.mp4"
                        crossOrigin="anonymous"
                        muted
                        playsInline
                        preload="auto"
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
                        style={{ outline: 'none' }}
                      />

                      {/* 左上角状态标签 */}
                      <div className="absolute top-3 left-4 z-20 pointer-events-none">
                        <div className="px-2 py-1 rounded bg-[#0A2540]/80 border border-[#00F5FF]/20 text-[10px] text-[#00F5FF]/70 font-mono backdrop-blur-sm">
                          3D EXPERIMENT · {animState.isPlaying ? 'SIMULATING' : animState.isComplete ? 'COMPLETE' : 'STANDBY'}
                        </div>
                      </div>

                      {/* 右上角模拟渲染帧率 */}
                      {animState.isPlaying && (
                        <div className="absolute top-3 right-4 z-20 pointer-events-none">
                          <div className="px-2 py-1 rounded bg-[#0A2540]/80 border border-[#00F5FF]/10 text-[9px] text-white/30 font-mono backdrop-blur-sm">
                            GPU RENDER · 60 FPS
                          </div>
                        </div>
                      )}

                      {/* 左下角阶段信息 */}
                      {animState.isPlaying && animState.stageIndex >= 0 && (
                        <div className="absolute bottom-3 left-4 z-20 pointer-events-none">
                          <div className="px-2 py-1 rounded bg-[#0A2540]/80 border border-[#00F5FF]/20 text-[10px] text-[#00F5FF]/60 font-mono backdrop-blur-sm">
                            STAGE {animState.stageIndex + 1}/{animState.stages.length} · {animState.stages[animState.stageIndex]?.label}
                          </div>
                        </div>
                      )}

                      {/* 右下角进度/状态 */}
                      <div className="absolute bottom-3 right-4 z-20 pointer-events-none">
                        <div className="px-2 py-1 rounded bg-[#0A2540]/80 border border-[#00F5FF]/10 text-[9px] text-white/30 font-mono backdrop-blur-sm">
                          {animState.isPlaying
                            ? `PROGRESS ${Math.round(animState.globalProgress * 100)}%`
                            : animState.isComplete
                              ? 'DATA CAPTURED'
                              : 'READY'}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle className="bg-[#00F5FF]/10 hover:bg-[#00F5FF]/30 transition-colors [&>div]:bg-[#0A2540] [&>div]:border-[#00F5FF]/30 [&>div]:h-5 [&>div]:w-10 [&_svg]:text-[#00F5FF]/60 [&_svg]:size-4" />

            {/* 波形区域 — 默认 35% */}
            <ResizablePanel defaultSize={35} minSize={20}>
              <div className="h-full flex flex-col bg-[#051020]">
                {/* 波形 Tabs */}
                <div className="flex items-center border-b border-[#00F5FF]/10 px-2 flex-shrink-0">
                  {['all', 'incident', 'reflected', 'transmitted'].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setWaveformTab(tab)}
                      className={`px-3 py-2 text-xs font-medium transition-colors relative ${
                        waveformTab === tab ? 'text-[#00F5FF]' : 'text-white/40 hover:text-white/60'
                      }`}
                    >
                      {{ all: '全部波形', incident: '入射波', reflected: '反射波', transmitted: '透射波' }[tab]}
                      {waveformTab === tab && (
                        <motion.div layoutId="waveform-tab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#00F5FF]" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex-1">
                  <RealtimeWaveformPanel
                    currentStage={animState.currentStage}
                    stageIndex={animState.stageIndex}
                    stageProgress={animState.stageProgress}
                    voltage={voltage}
                    stiffnessK={selectedMaterial.stiffnessK}
                    dampingC={selectedMaterial.dampingC}
                    className="h-full"
                    waveFilter={waveformTab as any}
                  />
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
          )}

          {/* 实验完成后展示6图结果 */}
          {animState.isComplete && (
            <div className={`border-t border-[#00F5FF]/20 bg-[#051020] relative z-10 ${resultsPanelOpen ? 'flex-1 flex flex-col min-h-0 overflow-auto' : 'flex-shrink-0'}`}>
              <button
                onClick={() => setResultsPanelOpen(v => !v)}
                className="w-full h-10 px-4 flex items-center justify-between bg-[#0A2540]/60 hover:bg-[#0A2540] border-b border-[#00F5FF]/15 transition-colors cursor-pointer"
              >
                <span className="text-sm font-semibold text-[#00F5FF] flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  实验结果分析
                </span>
                <span className="flex items-center gap-2 text-xs text-white/40">
                  {resultsPanelOpen ? '收起' : '展开'}
                  {resultsPanelOpen ? (
                    <ChevronDown className="w-4 h-4 text-[#00F5FF]/60" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-[#00F5FF]/60" />
                  )}
                </span>
              </button>
              {resultsPanelOpen && (() => {
                const sim = selectedMaterial
                  ? runSHPBSimulation({ material: selectedMaterial, voltage })
                  : null;
                return (
                  <ExperimentResultCharts
                    voltage={voltage}
                    peakStress={sim?.peakStress ?? voltage * 0.025}
                    strainRate={sim?.strainRate ?? 2500}
                    material={selectedMaterial}
                  />
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
