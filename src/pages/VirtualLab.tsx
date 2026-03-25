import { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import * as echarts from 'echarts';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Activity, Box, Sparkles,
  Waves, Clock, Database, Beaker, Info, ChevronUp,
  Search, ChevronRight, ChevronDown, ArrowRight,
  Play, Pause, RotateCcw, PanelLeftClose, PanelLeftOpen, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import GLTFModel from '@/components/GLTFModel';
import { HopkinsonBar2DRealistic } from '@/features/experiment-2d';
import ExperimentResultsPanel from '@/components/ExperimentResults';
import RealtimeWaveformPanel from '@/shared/components/RealtimeWaveformPanel';
import ExperimentResultCharts from '@/shared/components/ExperimentResultCharts';
import SliderInputCombo from '@/shared/components/SliderInputCombo';
import ModuleConnectionBadge from '@/shared/components/ModuleConnectionBadge';
import { useExperimentWorkflow } from '@/store/experimentWorkflow';
import { useExperimentDataBus } from '@/store/useExperimentDataBus';
import { useAppStore } from '@/store/useAppStore';
import { useExperimentAnimation } from '@/hooks/useExperimentAnimation';
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
    <div className="border border-[#00F5FF]/10 rounded-lg overflow-hidden mb-2">
      <button
        onClick={onToggle}
        className="w-full p-3 flex items-center justify-between bg-[#0A2540]/50 hover:bg-[#0A2540] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{category.icon}</span>
          <span className="text-sm font-medium text-white">{category.name}</span>
          <span className="text-xs text-white/40">({categoryMaterials.length}种)</span>
        </div>
        <ChevronRight className={`w-4 h-4 text-white/50 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-2 space-y-1 bg-[#051020]/50">
              {categoryMaterials.map((material) => (
                <button
                  key={material.id}
                  onClick={() => onSelectMaterial(material)}
                  className={`w-full p-2 rounded-lg text-left transition-all border ${
                    selectedMaterial.id === material.id
                      ? 'bg-[#00F5FF]/10 border-[#00F5FF]/50'
                      : 'bg-transparent border-transparent hover:bg-[#0A2540]/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: material.color }} />
                    <span className="text-sm text-white">{material.name}</span>
                    <span className="text-xs text-white/40 ml-auto">{material.subcategoryLabel}</span>
                  </div>
                  <div className="mt-1 grid grid-cols-3 gap-1 text-xs text-white/50">
                    <span>ρ:{(material.density / 1000).toFixed(1)}</span>
                    <span>E:{(material.elasticModulus / 1e9).toFixed(0)}GPa</span>
                    <span>σs:{(material.yieldStrength / 1e6).toFixed(0)}MPa</span>
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
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
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
  const [showInfo, setShowInfo] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['metal']);
  const [searchQuery, setSearchQuery] = useState('');

  // 全局状态
  const materials = useAppStore(s => s.materials);
  const materialCategories = useAppStore(s => s.materialCategories);
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
      const mode = (e as CustomEvent).detail as '2d' | '3d';
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
    window.addEventListener('ai-start-experiment', handleStart);
    window.addEventListener('ai-pause-experiment', handlePause);
    window.addEventListener('ai-reset-experiment', handleReset);
    window.addEventListener('ai-apply-preset', handlePreset);
    window.addEventListener('ai-set-confining', handleSetConfining);
    window.addEventListener('ai-toggle-confining', handleToggleConfining);
    window.addEventListener('ai-jump-stage', handleJumpStage);
    return () => {
      window.removeEventListener('ai-start-experiment', handleStart);
      window.removeEventListener('ai-pause-experiment', handlePause);
      window.removeEventListener('ai-reset-experiment', handleReset);
      window.removeEventListener('ai-apply-preset', handlePreset);
      window.removeEventListener('ai-set-confining', handleSetConfining);
      window.removeEventListener('ai-toggle-confining', handleToggleConfining);
      window.removeEventListener('ai-jump-stage', handleJumpStage);
    };
  }, [animState, setVoltage, setCurrent, setPulseWidth, enableConfining]);

  // 实验动画完成时自动发布数据
  useEffect(() => {
    if (animState.isComplete) {
      handleExperimentComplete();
    }
  }, [animState.isComplete, handleExperimentComplete]);

  // 侧栏折叠状态
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // AI启动确认弹窗
  const [showAIConfirm, setShowAIConfirm] = useState(false);
  // 波形显示 tab
  const [waveformTab, setWaveformTab] = useState('all');

  // 筛选材料
  const filteredMaterials = searchQuery
    ? materials.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            m.subcategoryLabel.toLowerCase().includes(searchQuery.toLowerCase()))
    : selectedCategory === 'all'
    ? materials
    : materials.filter(m => m.subCategory === selectedCategory);

  return (
    <div className="min-h-screen pt-24">
      {/* 模块连接指示 */}
      <div className="h-8 bg-[#051020] border-b border-[#00F5FF]/10 flex items-center px-4">
        <ModuleConnectionBadge
          dataTo={[
            { module: 'AI智能控制', path: '/ai' },
            { module: '材料力学分析', path: '/analysis' },
          ]}
          dataFrom={[
            { module: '系统监控', path: '/monitor', hasData: safetyChecklistCompleted },
          ]}
        />
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
          <Tabs defaultValue="materials" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="w-full bg-[#0A2540] border-b border-[#00F5FF]/10 rounded-none flex-shrink-0">
              <TabsTrigger value="materials" className="flex-1 text-xs data-[state=active]:bg-[#00F5FF]/20">材料库</TabsTrigger>
              <TabsTrigger value="params" className="flex-1 text-xs data-[state=active]:bg-[#00F5FF]/20">参数</TabsTrigger>
              <TabsTrigger value="info" className="flex-1 text-xs data-[state=active]:bg-[#00F5FF]/20">材料</TabsTrigger>
            </TabsList>

            <TabsContent value="materials" className="flex-1 flex flex-col overflow-hidden mt-0">
          <div className="p-3 border-b border-[#00F5FF]/10 flex-shrink-0">
            <p className="text-xs text-white/50">7大类材料 · {materials.length}种材料</p>
          </div>

          {/* 搜索框 */}
          <div className="p-3 border-b border-[#00F5FF]/10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="搜索材料..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#0A2540] border border-[#00F5FF]/20 rounded-lg text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[#00F5FF]/50"
              />
            </div>
          </div>

          {/* 分类筛选 */}
          <div className="p-3 border-b border-[#00F5FF]/10">
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-2 py-1 text-xs rounded ${selectedCategory === 'all' ? 'bg-[#00F5FF] text-[#0A2540]' : 'bg-[#0A2540] text-white/60'}`}
              >
                全部
              </button>
              {materialCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2 py-1 text-xs rounded ${selectedCategory === cat.id ? 'bg-[#00F5FF] text-[#0A2540]' : 'bg-[#0A2540] text-white/60'}`}
                >
                  {cat.icon}
                </button>
              ))}
            </div>
          </div>

          {/* 材料列表 */}
          <div className="flex-1 overflow-y-auto p-3">
            {searchQuery ? (
              <div className="space-y-2">
                {filteredMaterials.map((material) => (
                  <button
                    key={material.id}
                    onClick={() => setSelectedMaterial(material)}
                    className={`w-full p-3 rounded-lg text-left transition-all border ${
                      selectedMaterial.id === material.id
                        ? 'bg-[#00F5FF]/10 border-[#00F5FF]/50'
                        : 'bg-[#0A2540]/30 border-transparent hover:bg-[#0A2540]/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: material.color }} />
                      <span className="text-sm text-white">{material.name}</span>
                      <span className="text-xs text-white/40 ml-auto">{material.subcategoryLabel}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1 text-xs text-white/50">
                      <span>ρ:{(material.density / 1000).toFixed(1)}</span>
                      <span>E:{(material.elasticModulus / 1e9).toFixed(0)}GPa</span>
                      <span>σs:{(material.yieldStrength / 1e6).toFixed(0)}MPa</span>
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

            <TabsContent value="params" className="flex-1 overflow-y-auto mt-0 p-4 space-y-2">
              {/* 参数预设 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/50">快速预设</span>
                  {aiOptimizedParams && (
                    <button
                      onClick={() => {
                        setVoltage(aiOptimizedParams.voltage);
                        setCurrent(aiOptimizedParams.current);
                        setPulseWidth(aiOptimizedParams.pulseWidth);
                      }}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 text-[10px] text-[#8B5CF6] hover:bg-[#8B5CF6]/25 transition-colors"
                    >
                      <Sparkles className="w-3 h-3" />
                      应用AI推荐
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {PARAM_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => {
                        setVoltage(p.voltage);
                        setCurrent(p.current);
                        setPulseWidth(p.pulseWidth);
                      }}
                      disabled={isAnimationPlaying}
                      className="p-1.5 rounded-lg bg-[#0A2540]/50 border border-white/10 hover:border-[#00F5FF]/30 transition-all text-left disabled:opacity-40"
                    >
                      <div className="text-[10px] font-medium text-white/80">{p.label}</div>
                      <div className="text-[9px] text-white/40">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 电压 */}
              <div data-ai-target="lab-voltage">
                <SliderInputCombo
                  value={voltage} onChange={setVoltage} min={1000} max={4000} step={50}
                  disabled={isAnimationPlaying} label="电压" unit="V"
                  icon={<Zap className="w-4 h-4 text-[#00F5FF]" />} color="#00F5FF"
                />
                {aiOptimizedParams && aiOptimizedParams.voltage !== voltage && (
                  <button onClick={() => setVoltage(aiOptimizedParams.voltage)} className="text-[9px] text-[#8B5CF6] hover:underline mt-0.5 ml-1">
                    AI推荐: {aiOptimizedParams.voltage}V
                  </button>
                )}
              </div>

              {/* 电流 */}
              <div data-ai-target="lab-current">
                <SliderInputCombo
                  value={current} onChange={setCurrent} min={0} max={50000} step={500}
                  disabled={isAnimationPlaying} label="电流" unit="kA"
                  icon={<Activity className="w-4 h-4 text-[#1DD1A1]" />} color="#1DD1A1"
                  formatDisplay={(v) => (v / 1000).toFixed(1)}
                />
                {aiOptimizedParams && aiOptimizedParams.current !== current && (
                  <button onClick={() => setCurrent(aiOptimizedParams.current)} className="text-[9px] text-[#8B5CF6] hover:underline mt-0.5 ml-1">
                    AI推荐: {(aiOptimizedParams.current / 1000).toFixed(1)}kA
                  </button>
                )}
              </div>

              {/* 脉宽 */}
              <div data-ai-target="lab-pulseWidth">
                <SliderInputCombo
                  value={pulseWidth} onChange={setPulseWidth} min={200} max={1100} step={50}
                  disabled={isAnimationPlaying} label="脉宽" unit="μs"
                  icon={<Clock className="w-4 h-4 text-[#FF9F43]" />} color="#FF9F43"
                />
                {aiOptimizedParams && aiOptimizedParams.pulseWidth !== pulseWidth && (
                  <button onClick={() => setPulseWidth(aiOptimizedParams.pulseWidth)} className="text-[9px] text-[#8B5CF6] hover:underline mt-0.5 ml-1">
                    AI推荐: {aiOptimizedParams.pulseWidth}μs
                  </button>
                )}
              </div>

              {/* 波形类型 */}
              <div className="space-y-2">
                <label className="text-sm text-white/70 flex items-center gap-2">
                  <Waves className="w-4 h-4 text-[#8B5CF6]" />
                  波形类型
                </label>
                <Select value={waveform} onValueChange={(v) => setWaveform(v)} disabled={isAnimationPlaying}>
                  <SelectTrigger className="bg-[#0A2540] border-[#00F5FF]/30 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0A2540] border-[#00F5FF]/30">
                    {waveformTypes.map((w) => (
                      <SelectItem key={w.value} value={w.value} className="text-white hover:bg-[#00F5FF]/20">
                        <div>
                          <div>{w.label}</div>
                          <div className="text-xs text-white/50">{w.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 围压控制 */}
              <div className="space-y-2 border-t border-[#00F5FF]/10 pt-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-white/70">启用围压控制</label>
                  <Switch checked={enableConfining} onCheckedChange={setEnableConfining} disabled={isAnimationPlaying} />
                </div>
                {enableConfining ? (
                  <div className="space-y-2">
                    {(['x', 'y', 'z'] as const).map((axis) => (
                      <SliderInputCombo
                        key={axis}
                        value={confiningPressure[axis]}
                        onChange={(v) => setConfiningPressure(prev => ({ ...prev, [axis]: v }))}
                        min={0} max={200} step={5}
                        disabled={isAnimationPlaying}
                        label={`${axis.toUpperCase()}轴围压`} unit="MPa" color="#00F5FF"
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-white/30 italic">开启后可设置三轴围压参数</p>
                )}
              </div>

              {/* 实时计算参数 */}
              <div className="p-3 bg-[#0A2540]/50 rounded-lg border border-[#00F5FF]/20">
                <h4 className="text-xs text-[#00F5FF] mb-2 font-medium">实时计算参数</h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-white/60">电容储能</span>
                    <span className="text-[#00F5FF] font-mono">{capacitance.toFixed(2)} kJ</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">子弹初速</span>
                    <span className="text-[#FFD700] font-mono">{bulletVelocity.toFixed(1)} m/s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">预估应变率</span>
                    <span className="text-[#8B5CF6] font-mono">~{Math.round(bulletVelocity * 10)} /s</span>
                  </div>
                </div>
              </div>

              {/* 实验状态概览 */}
              <div className="p-3 bg-gradient-to-r from-[#00F5FF]/5 to-transparent rounded-lg border border-[#00F5FF]/15">
                <h4 className="text-xs text-[#00F5FF] mb-2 font-medium flex items-center gap-1.5">
                  <Activity className="w-3 h-3" />
                  实验状态概览
                </h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-white/60">当前材料</span>
                    <span className="text-white font-medium flex items-center gap-1">
                      <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: selectedMaterial.color }} />
                      {selectedMaterial.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">实验阶段</span>
                    <span className={`font-mono ${animState.isPlaying ? 'text-[#10B981]' : animState.isComplete ? 'text-[#FFD700]' : 'text-white/40'}`}>
                      {animState.isComplete ? '已完成' : animState.isPlaying ? animState.stages[animState.stageIndex]?.label || '进行中' : '就绪'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">总进度</span>
                    <span className="text-white/70 font-mono">{(animState.globalProgress * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#0A2540] rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${animState.globalProgress * 100}%`,
                        background: animState.isComplete ? '#FFD700' : 'linear-gradient(90deg, #00F5FF, #1DD1A1)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="info" className="flex-1 overflow-y-auto mt-0 p-4 space-y-2">
              {/* 当前材料信息 */}
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Beaker className="w-4 h-4 text-[#00F5FF]" />
                当前材料
              </h3>
              <div className="bg-[#0A2540]/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: selectedMaterial.color }} />
                  <span className="text-white font-medium">{selectedMaterial.name}</span>
                </div>
                <p className="text-xs text-white/50">{selectedMaterial.description}</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-white/60">
                  <div>密度: {(selectedMaterial.density / 1000).toFixed(1)} g/cm³</div>
                  <div>弹性模量: {(selectedMaterial.elasticModulus / 1e9).toFixed(0)} GPa</div>
                  <div>屈服强度: {(selectedMaterial.yieldStrength / 1e6).toFixed(0)} MPa</div>
                  <div>刚度: {selectedMaterial.stiffnessK} GPa</div>
                  <div>阻尼: {selectedMaterial.dampingC}</div>
                  <div>EMI阈值: {selectedMaterial.emiThreshold} dB</div>
                </div>
              </div>
              {/* 材料属性雷达图 */}
              <MaterialRadarMini material={selectedMaterial} />

              <ExperimentResultsSection />

              {/* 说明区 */}
              <div className="border-t border-[#00F5FF]/10 pt-2">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Info className="w-4 h-4 text-[#00F5FF]" />
                    关于
                  </h3>
                  <button onClick={() => setShowInfo(!showInfo)} className="text-white/50 hover:text-white">
                    {showInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
                {showInfo && (
                  <div className="text-xs text-white/60 space-y-1.5">
                    <p>模拟电磁驱动霍普金森杆实验过程，支持参数优化与波形预测。</p>
                    <div className="flex items-center gap-1 text-[#00F5FF]">
                      <ArrowRight className="w-3 h-3" />
                      <span>实验数据将自动传递至 AI控制 和 材料分析</span>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
          )}
        </motion.div>

        {/* 主实验区域 */}
        <div className="flex-1 flex flex-col">
          {/* 顶部工具栏 */}
          <div className="h-14 bg-[#051020] border-b border-[#00F5FF]/10 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('2d')}
                className={`px-4 py-1.5 rounded-lg text-sm transition-all ${
                  viewMode === '2d' ? 'bg-[#00F5FF] text-[#0A2540] font-medium' : 'bg-[#0A2540] text-white/70 hover:bg-[#0A2540]/80'
                }`}
              >
                2D视图
              </button>
              <button
                onClick={() => setViewMode('3d')}
                className={`px-4 py-1.5 rounded-lg text-sm transition-all ${
                  viewMode === '3d' ? 'bg-[#00F5FF] text-[#0A2540] font-medium' : 'bg-[#0A2540] text-white/70 hover:bg-[#0A2540]/80'
                }`}
              >
                3D视图
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

          {/* 阶段进度条 + 控制按钮 */}
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
                  className="w-8 h-8 rounded-lg bg-[#10B981]/20 border border-[#10B981]/30 flex items-center justify-center hover:bg-[#10B981]/30 transition-colors"
                  title="开始实验"
                >
                  <Play className="w-4 h-4 text-[#10B981]" />
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

          {/* 可调大小的可视化 + 波形区域 */}
          <ResizablePanelGroup direction="vertical" className="flex-1">
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
                  ) : (
                    <motion.div
                      key="3d"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0"
                    >
                      <Suspense fallback={
                        <div className="w-full h-full flex items-center justify-center text-white/50">
                          <div className="text-center">
                            <Box className="w-16 h-16 mx-auto mb-4 opacity-50 animate-pulse" />
                            <p>3D模型加载中...</p>
                          </div>
                        </div>
                      }>
                        <GLTFModel
                          modelUrl="/models/new_hopkinson.gltf"
                          isAnimating={isAnimationPlaying}
                          className="w-full h-full"
                        />
                      </Suspense>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle className="bg-[#00F5FF]/10 hover:bg-[#00F5FF]/20 transition-colors" />

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

          {/* 实验完成后展示6图结果 */}
          {animState.isComplete && (
            <div className="p-4 border-t border-[#00F5FF]/10 bg-[#051020]">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Database className="w-4 h-4 text-[#00F5FF]" />
                实验结果分析
              </h3>
              <ExperimentResultCharts
                voltage={voltage}
                peakStress={voltage * 0.025}
                strainRate={2500}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
