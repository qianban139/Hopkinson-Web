import { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Search, Download, ChevronRight, ChevronDown,
  FileSpreadsheet, FileJson, Sparkles,
  ZoomIn, ZoomOut, Waves, SlidersHorizontal,
  GitCompareArrows, ClipboardList, Database, FileText, ExternalLink, Microscope as MicroscopeIcon,
} from 'lucide-react';
import CTFissureExtractorPanel from '@/features/ct-analysis/CTFissureExtractorPanel';
import { LITERATURE_CORPUS } from '@/data/literature';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import * as echarts from 'echarts';
import { useAppStore } from '@/store/useAppStore';
import { useExperimentDataBus } from '@/store/useExperimentDataBus';
import GlowCard from '@/shared/components/GlowCard';
import ModuleConnectionBadge from '@/shared/components/ModuleConnectionBadge';
import SignalProcessingPanel from '@/features/material-analysis/SignalProcessingPanel';
import ConstitutiveFittingPanel from '@/features/material-analysis/ConstitutiveFittingPanel';
import ReportGenerationPanel from '@/features/material-analysis/ReportGenerationPanel';
import type { Material } from '@/types';

/* ------------------------------------------------------------------ */
/*  Constants & Types                                                  */
/* ------------------------------------------------------------------ */

const CHART_COLORS = ['#00F5FF', '#FF9F43', '#1DD1A1', '#8B5CF6'];

const SIDEBAR_CATEGORIES = [
  { id: 'metal', label: '金属' },
  { id: 'rock', label: '岩石' },
  { id: 'concrete', label: '混凝土' },
  { id: 'ceramic', label: '陶瓷' },
  { id: 'polymer', label: '聚合物' },
  { id: 'foam', label: '泡沫' },
  { id: 'bio', label: '复合材料' },
] as const;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function jcQuasiStatic(eps: number, A: number, B: number, n: number) {
  return A + B * Math.pow(Math.max(eps, 1e-9), n);
}

function jcFull(
  eps: number, epsDot: number, T: number,
  A: number, B: number, n: number, C: number, m: number, Tm: number,
  epsDot0 = 1, Troom = 25,
) {
  const q = jcQuasiStatic(eps, A, B, n);
  const rate = 1 + C * Math.log(Math.max(epsDot / epsDot0, 1));
  const Tstar = Math.max(0, Math.min(1, (T - Troom) / (Tm - Troom)));
  return q * rate * (1 - Math.pow(Tstar, m));
}

function computeR2(data: { strain: number; stress: number }[], A: number, B: number, n: number) {
  if (data.length < 2) return 0;
  const mean = data.reduce((s, p) => s + p.stress, 0) / data.length;
  let ssTot = 0, ssRes = 0;
  for (const p of data) {
    ssTot += (p.stress - mean) ** 2;
    ssRes += (p.stress - jcQuasiStatic(p.strain, A, B, n)) ** 2;
  }
  return ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportChartImage(chart: echarts.ECharts | null, name: string) {
  if (!chart) return;
  const url = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#0A2540' });
  const a = document.createElement('a');
  a.href = url; a.download = `${name}.png`; a.click();
}

/** Mock J-C params adjusted by material subcategory */
function mockJCParams(mat: Material) {
  const jc = mat.johnsonCookParams;
  return { A: jc.A, B: jc.B, n: jc.n, C: jc.C, m: jc.m, Tm: jc.Tm };
}

/** Mock radar values [strength, toughness, hardness, density, modulus, heatResistance] normalised 0-100 */
function radarValues(mat: Material): number[] {
  const sub = mat.subCategory;
  const presets: Record<string, number[]> = {
    //        str  tgh  hrd  den  mod  heat
    metal:    [85, 65,  75,  70,  80,  60],
    rock:     [50, 25,  85,  80,  60,  70],
    concrete: [40, 20,  60,  75,  45,  55],
    ceramic:  [55, 15,  95,  60,  70,  90],
    polymer:  [30, 90,  20,  25,  20,  15],
    foam:     [15, 95,  10,  10,  10,  10],
    bio:      [40, 70,  30,  35,  35,  25],
  };
  return presets[sub] ?? [50, 50, 50, 50, 50, 50];
}

/* ------------------------------------------------------------------ */
/*  useEChart hook                                                     */
/* ------------------------------------------------------------------ */

function useEChart(deps: unknown[]) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    instanceRef.current?.dispose();
    instanceRef.current = echarts.init(containerRef.current);
    const ro = new ResizeObserver(() => instanceRef.current?.resize());
    ro.observe(containerRef.current);
    return () => { ro.disconnect(); instanceRef.current?.dispose(); instanceRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { containerRef, instanceRef };
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function MaterialAnalysis() {
  const materials = useAppStore(s => s.materials);
  const lastLab = useExperimentDataBus(s => s.lastLabExperiment);
  const lastMulti = useExperimentDataBus(s => s.lastMultiFieldExperiment);

  // --- State ---
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(['metal']));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  // AI prediction
  const [strainRate, setStrainRate] = useState(1000);
  const [temperature, setTemperature] = useState(25);
  const [confiningPressure, setConfiningPressure] = useState(0);
  const [aiResult, setAiResult] = useState<{ sigma: number; epsilon: number; r2: number } | null>(null);
  const [aiPredicting, setAiPredicting] = useState(false);

  // Chart refs & zoom
  const stressChartRef = useRef<echarts.ECharts | null>(null);
  const [chartZoom, setChartZoom] = useState<{ start: number; end: number }>({ start: 0, end: 100 });

  // --- Derived ---
  const selectedMaterial = useMemo(
    () => materials.find(m => m.id === selectedId) ?? materials[0] ?? null,
    [materials, selectedId],
  );

  // Auto-select first material
  useEffect(() => {
    if (!selectedId && materials.length > 0) setSelectedId(materials[0].id);
  }, [materials, selectedId]);

  const filteredMaterials = useMemo(() => {
    if (!searchTerm.trim()) return materials;
    const q = searchTerm.toLowerCase();
    return materials.filter(m => m.name.toLowerCase().includes(q) || m.category.includes(q));
  }, [materials, searchTerm]);

  const materialsForChart = useMemo(() => {
    if (!selectedMaterial) return [];
    if (compareMode && compareIds.length > 0) {
      const ids = [selectedMaterial.id, ...compareIds.filter(id => id !== selectedMaterial.id)];
      return ids.slice(0, 4).map(id => materials.find(m => m.id === id)).filter(Boolean) as Material[];
    }
    return [selectedMaterial];
  }, [selectedMaterial, compareMode, compareIds, materials]);

  // --- Handlers ---
  const toggleCategory = useCallback((catId: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(catId) ? next.delete(catId) : next.add(catId);
      return next;
    });
  }, []);

  const handleSelectMaterial = useCallback((id: string) => {
    setSelectedId(id);
    if (compareMode && id !== selectedId) {
      setCompareIds(prev => {
        if (prev.includes(id)) return prev.filter(x => x !== id);
        if (prev.length >= 3) return [...prev.slice(1), id];
        return [...prev, id];
      });
    }
    setAiResult(null);
  }, [compareMode, selectedId]);

  const handleAIPredict = useCallback(() => {
    if (!selectedMaterial) return;
    setAiPredicting(true);
    setTimeout(() => {
      const jc = mockJCParams(selectedMaterial);
      const maxStrain = Math.max(...selectedMaterial.stressStrainSample.map(p => p.strain), 0.3);
      const sigma = jcFull(maxStrain * 0.8, strainRate, temperature, jc.A, jc.B, jc.n, jc.C, jc.m, jc.Tm);
      const epsilon = maxStrain * (0.7 + Math.random() * 0.25);
      const r2 = 0.92 + Math.random() * 0.07;
      setAiResult({ sigma: +sigma.toFixed(1), epsilon: +epsilon.toFixed(4), r2: +r2.toFixed(4) });
      setAiPredicting(false);
    }, 1200);
  }, [selectedMaterial, strainRate, temperature]);

  // --- Export handlers ---
  const handleExportCSV = useCallback(() => {
    if (!selectedMaterial) return;
    const header = 'strain,stress_MPa\n';
    const rows = selectedMaterial.stressStrainSample.map(p => `${p.strain},${p.stress}`).join('\n');
    downloadFile(header + rows, `${selectedMaterial.name}_data.csv`, 'text/csv');
  }, [selectedMaterial]);

  const handleExportJSON = useCallback(() => {
    if (!selectedMaterial) return;
    const data = { material: selectedMaterial.name, jc: mockJCParams(selectedMaterial), data: selectedMaterial.stressStrainSample };
    downloadFile(JSON.stringify(data, null, 2), `${selectedMaterial.name}_data.json`, 'application/json');
  }, [selectedMaterial]);

  const handleExportPNG = useCallback(() => {
    exportChartImage(stressChartRef.current, selectedMaterial?.name ?? 'chart');
  }, [selectedMaterial]);

  const handleExportReport = useCallback(() => {
    if (!selectedMaterial) return;
    const jc = mockJCParams(selectedMaterial);
    const r2 = computeR2(selectedMaterial.stressStrainSample, jc.A, jc.B, jc.n);
    const txt = [
      `材料分析报告 - ${selectedMaterial.name}`,
      `日期: ${new Date().toLocaleDateString()}`,
      `\nJ-C参数: A=${jc.A}, B=${jc.B}, n=${jc.n}, C=${jc.C}, m=${jc.m}`,
      `R² = ${r2.toFixed(4)}`,
      `\n数据点数: ${selectedMaterial.stressStrainSample.length}`,
      aiResult ? `\nAI预测结果: σ=${aiResult.sigma} MPa, ε=${aiResult.epsilon}, R²=${aiResult.r2}` : '',
    ].join('\n');
    downloadFile(txt, `${selectedMaterial.name}_report.txt`, 'text/plain');
  }, [selectedMaterial, aiResult]);

  // --- Zoom handlers ---
  const handleZoomIn = useCallback(() => {
    setChartZoom(prev => {
      const mid = (prev.start + prev.end) / 2;
      const range = (prev.end - prev.start) * 0.4;
      return { start: Math.max(0, mid - range), end: Math.min(100, mid + range) };
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setChartZoom(prev => {
      const mid = (prev.start + prev.end) / 2;
      const range = (prev.end - prev.start) * 0.8;
      return { start: Math.max(0, mid - range), end: Math.min(100, mid + range) };
    });
  }, []);

  const handleZoomReset = useCallback(() => {
    setChartZoom({ start: 0, end: 100 });
  }, []);

  // --- AI event listeners (from AI assistant sidebar) ---
  useEffect(() => {
    const onStartPrediction = () => { handleAIPredict(); };
    const onExportData = (e: Event) => {
      const format = (e as CustomEvent).detail as 'csv' | 'json' | 'png';
      if (format === 'csv') handleExportCSV();
      else if (format === 'json') handleExportJSON();
      else if (format === 'png') handleExportPNG();
    };
    const onExportReport = () => { handleExportReport(); };
    const onSetPredictionParams = (e: Event) => {
      const detail = (e as CustomEvent).detail as { strainRate?: number; temperature?: number; confiningPressure?: number };
      if (detail.strainRate !== undefined) setStrainRate(detail.strainRate);
      if (detail.temperature !== undefined) setTemperature(detail.temperature);
      if (detail.confiningPressure !== undefined) setConfiningPressure(detail.confiningPressure);
    };
    const onToggleCompare = (e: Event) => {
      const enabled = (e as CustomEvent).detail as boolean;
      setCompareMode(enabled);
      if (!enabled) setCompareIds([]);
    };
    const onZoomChart = (e: Event) => {
      const action = (e as CustomEvent).detail as string;
      if (action === 'in') handleZoomIn();
      else if (action === 'out') handleZoomOut();
      else if (action === 'reset') handleZoomReset();
    };
    window.addEventListener('ai-start-prediction', onStartPrediction);
    window.addEventListener('ai-export-data', onExportData);
    window.addEventListener('ai-export-report', onExportReport);
    window.addEventListener('ai-set-prediction-params', onSetPredictionParams);
    window.addEventListener('ai-toggle-compare', onToggleCompare);
    window.addEventListener('ai-zoom-chart', onZoomChart);
    return () => {
      window.removeEventListener('ai-start-prediction', onStartPrediction);
      window.removeEventListener('ai-export-data', onExportData);
      window.removeEventListener('ai-export-report', onExportReport);
      window.removeEventListener('ai-set-prediction-params', onSetPredictionParams);
      window.removeEventListener('ai-toggle-compare', onToggleCompare);
      window.removeEventListener('ai-zoom-chart', onZoomChart);
    };
  }, [handleAIPredict, handleExportCSV, handleExportJSON, handleExportPNG, handleExportReport, handleZoomIn, handleZoomOut, handleZoomReset]);

  if (!selectedMaterial) return <div className="text-white/50 p-8">加载材料数据...</div>;

  const jc = mockJCParams(selectedMaterial);
  const r2 = computeR2(selectedMaterial.stressStrainSample, jc.A, jc.B, jc.n);
  const radar = radarValues(selectedMaterial);

  return (
    <motion.div
      className="min-h-screen text-white overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex h-[calc(100vh-96px)] pt-24">
      {/* ======================== Left Sidebar ======================== */}
      <aside className="w-[280px] flex-shrink-0 border-r border-white/10 flex flex-col bg-[#0A2540]/60">
        {/* Search */}
        <div className="p-3 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              placeholder="搜索材料..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 bg-[#051020] border-white/15 text-sm h-8 text-white placeholder:text-white/30"
            />
          </div>
        </div>

        {/* Material list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {SIDEBAR_CATEGORIES.map(cat => {
            const catMaterials = filteredMaterials.filter(m => m.subCategory === cat.id);
            if (catMaterials.length === 0 && searchTerm) return null;
            const isExpanded = expandedCats.has(cat.id);

            return (
              <div key={cat.id}>
                <button
                  onClick={() => toggleCategory(cat.id)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-white/60 hover:text-white/90 hover:bg-white/5 transition-colors"
                >
                  <span>{cat.label} ({catMaterials.length})</span>
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      {catMaterials.map(mat => {
                        const isSelected = mat.id === selectedId;
                        const isCompared = compareIds.includes(mat.id);
                        return (
                          <button
                            key={mat.id}
                            onClick={() => handleSelectMaterial(mat.id)}
                            className={`w-full text-left px-4 py-2 text-xs transition-colors border-l-2 ${
                              isSelected
                                ? 'bg-[#00F5FF]/10 border-[#00F5FF] text-[#00F5FF]'
                                : isCompared
                                  ? 'bg-[#8B5CF6]/10 border-[#8B5CF6] text-[#8B5CF6]'
                                  : 'border-transparent text-white/70 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <div className="font-medium truncate">{mat.name}</div>
                            <div className="flex gap-2 mt-0.5 text-[10px] text-white/40">
                              <span>{(mat.density).toFixed(0)} kg/m³</span>
                              <span>{(mat.elasticModulus / 1e9).toFixed(0)} GPa</span>
                              <span>{(mat.yieldStrength / 1e6).toFixed(0)} MPa</span>
                            </div>
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Compare toggle */}
        <div className="p-3 border-t border-white/10 flex items-center justify-between">
          <span className="text-xs text-white/60">对比模式</span>
          <Switch
            checked={compareMode}
            onCheckedChange={v => { setCompareMode(v); if (!v) setCompareIds([]); }}
          />
        </div>
      </aside>

      {/* ======================== Right Main Content ======================== */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-[#051020]/90 backdrop-blur-md border-b border-white/10 px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">材料力学分析</h1>
            <ModuleConnectionBadge
              dataFrom={[
                { module: '虚拟实验室', path: '/lab', hasData: !!lastLab },
              ]}
              dataTo={[]}
              className="mt-1"
            />
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-[#00F5FF]">{selectedMaterial.name}</div>
            <div className="text-[10px] text-white/40">{selectedMaterial.category} · {selectedMaterial.subcategoryLabel}</div>
          </div>
        </div>

        {/* 5 Tab 分析系统 */}
        <Tabs defaultValue="raw" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="flex-shrink-0 w-full bg-[#051020] border-b border-white/10 rounded-none h-11 px-6 justify-start gap-1">
            <TabsTrigger value="raw" className="text-xs data-[state=active]:bg-[#00F5FF]/15 data-[state=active]:text-[#00F5FF] gap-1.5 px-3">
              <Database className="w-3.5 h-3.5" /> 原始数据
            </TabsTrigger>
            <TabsTrigger value="signal" className="text-xs data-[state=active]:bg-[#FF9F43]/15 data-[state=active]:text-[#FF9F43] gap-1.5 px-3">
              <Waves className="w-3.5 h-3.5" /> 信号处理
            </TabsTrigger>
            <TabsTrigger value="fitting" className="text-xs data-[state=active]:bg-[#8B5CF6]/15 data-[state=active]:text-[#8B5CF6] gap-1.5 px-3">
              <SlidersHorizontal className="w-3.5 h-3.5" /> 参数拟合
            </TabsTrigger>
            <TabsTrigger value="compare" className="text-xs data-[state=active]:bg-[#1DD1A1]/15 data-[state=active]:text-[#1DD1A1] gap-1.5 px-3">
              <GitCompareArrows className="w-3.5 h-3.5" /> 对比分析
            </TabsTrigger>
            <TabsTrigger value="report" className="text-xs data-[state=active]:bg-[#F472B6]/15 data-[state=active]:text-[#F472B6] gap-1.5 px-3">
              <ClipboardList className="w-3.5 h-3.5" /> 报告生成
            </TabsTrigger>
            <TabsTrigger value="ct" className="text-xs data-[state=active]:bg-[#6366F1]/15 data-[state=active]:text-[#6366F1] gap-1.5 px-3">
              <MicroscopeIcon className="w-3.5 h-3.5" /> CT 裂隙提取
            </TabsTrigger>
            <TabsTrigger value="refs" className="text-xs data-[state=active]:bg-[#8B5CF6]/15 data-[state=active]:text-[#8B5CF6] gap-1.5 px-3">
              <FileText className="w-3.5 h-3.5" /> 参考文献
            </TabsTrigger>
          </TabsList>

          {/* ═══════ Tab 1: 原始数据 ═══════ */}
          <TabsContent value="raw" className="flex-1 overflow-y-auto mt-0 scrollbar-thin">
            <div className="p-6 space-y-6">
              {/* 数据来源 */}
              <div className="flex items-center gap-3 text-xs">
                <span className="text-white/40">数据来源:</span>
                {lastLab ? (
                  <span className="px-2 py-1 rounded bg-[#1DD1A1]/10 text-[#1DD1A1] border border-[#1DD1A1]/20">
                    虚拟实验室 · {lastLab.materialName} · {new Date(lastLab.timestamp).toLocaleTimeString()}
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded bg-white/5 text-white/30 border border-white/10">
                    材料数据库（未接收实验数据）
                  </span>
                )}
              </div>

              {/* 应力-应变曲线 */}
              <GlowCard glowColor="#00F5FF" hoverable={false} className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-[3px] h-5 rounded-full bg-[#00F5FF]" />
                    <h2 className="text-base font-bold bg-gradient-to-r from-[#00F5FF] to-[#00B4CC] bg-clip-text text-transparent">应力-应变曲线</h2>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="ghost" onClick={handleZoomIn} className="h-7 w-7 p-0 text-white/40 hover:text-white"><ZoomIn className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={handleZoomOut} className="h-7 w-7 p-0 text-white/40 hover:text-white"><ZoomOut className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={handleZoomReset} className="h-7 px-2 text-[10px] text-white/40 hover:text-white">重置</Button>
                  </div>
                </div>
                <StressStrainChart
                  materials={materialsForChart}
                  highlightId={selectedId}
                  aiCurve={aiResult && selectedMaterial ? buildAIPredictionCurve(selectedMaterial, strainRate, temperature) : null}
                  onReady={chart => { stressChartRef.current = chart; }}
                />
              </GlowCard>

              {/* 材料基本参数 */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {([
                  { label: '密度', value: `${(selectedMaterial.density / 1000).toFixed(2)}`, unit: 'g/cm³', color: '#00F5FF' },
                  { label: '弹性模量', value: `${(selectedMaterial.elasticModulus / 1e9).toFixed(1)}`, unit: 'GPa', color: '#1DD1A1' },
                  { label: '屈服强度', value: `${(selectedMaterial.yieldStrength / 1e6).toFixed(0)}`, unit: 'MPa', color: '#FFD700' },
                  { label: '波速', value: `${Math.sqrt(selectedMaterial.elasticModulus / selectedMaterial.density).toFixed(0)}`, unit: 'm/s', color: '#8B5CF6' },
                ] as const).map((p) => (
                  <div key={p.label} className="bg-[#051020] rounded-lg p-3 border border-white/5">
                    <div className="text-[10px] text-white/40 mb-1">{p.label}</div>
                    <div className="text-lg font-mono font-bold" style={{ color: p.color }}>{p.value}</div>
                    <div className="text-[10px] text-white/30">{p.unit}</div>
                  </div>
                ))}
              </div>

              {/* 数据导出 */}
              <div className="flex items-center justify-between bg-[#051020] rounded-lg p-3 border border-white/5">
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <Download className="w-3.5 h-3.5" />
                  导出原始数据
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleExportCSV} className="border-white/15 text-white/60 text-[10px] h-7 gap-1">
                    <FileSpreadsheet className="w-3 h-3" /> CSV
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleExportJSON} className="border-white/15 text-white/60 text-[10px] h-7 gap-1">
                    <FileJson className="w-3 h-3" /> JSON
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ═══════ Tab 2: 信号处理 ═══════ */}
          <TabsContent value="signal" className="flex-1 overflow-y-auto mt-0 scrollbar-thin">
            <SignalProcessingPanel />
          </TabsContent>

          {/* ═══════ Tab 3: 参数拟合 ═══════ */}
          <TabsContent value="fitting" className="flex-1 overflow-y-auto mt-0 scrollbar-thin">
            <div className="p-6 space-y-6">
              {/* AI 预测 */}
              <GlowCard glowColor="#8B5CF6" pulse hoverable={false} className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="w-5 h-5 text-[#8B5CF6]" />
                  <h2 className="text-base font-bold">AI 本构参数预测</h2>
                  <Sparkles className="w-4 h-4 text-[#8B5CF6]/60" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-4 md:col-span-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-white/60">应变率</span>
                        <span className="text-[#00F5FF] font-mono">{strainRate} /s</span>
                      </div>
                      <Slider min={100} max={10000} step={100} value={[strainRate]} onValueChange={v => setStrainRate(v[0])}
                        className="[&_[data-slot=slider-range]]:bg-[#8B5CF6] [&_[data-slot=slider-thumb]]:border-[#8B5CF6]" />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-white/60">温度</span>
                        <span className="text-[#00F5FF] font-mono">{temperature} °C</span>
                      </div>
                      <Slider min={20} max={800} step={10} value={[temperature]} onValueChange={v => setTemperature(v[0])}
                        className="[&_[data-slot=slider-range]]:bg-[#8B5CF6] [&_[data-slot=slider-thumb]]:border-[#8B5CF6]" />
                    </div>
                    <Button onClick={handleAIPredict} disabled={aiPredicting}
                      className="w-full bg-gradient-to-r from-[#0A4A6B] to-[#0E7490] hover:from-[#0C5A7E] hover:to-[#1098B0] text-[#00F5FF] font-semibold h-10 text-sm border border-[#00F5FF]/20">
                      {aiPredicting ? '预测中...' : '开始 AI 预测'}
                    </Button>
                    <div className="mt-2">
                      <div className="text-[10px] text-white/40 mb-1">应变率灵敏度预览 (±20%)</div>
                      <SensitivityMiniChart material={selectedMaterial} strainRate={strainRate} temperature={temperature} />
                    </div>
                  </div>
                  <div className="flex flex-col justify-center">
                    {aiResult ? (
                      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-2 bg-[#051020] rounded-lg p-4 border border-[#8B5CF6]/20">
                        <div className="text-xs text-white/50">预测结果</div>
                        <div className="flex justify-between items-end"><span className="text-xs text-white/60">σ</span><span className="text-xl font-bold text-[#00F5FF]">{aiResult.sigma} <span className="text-xs font-normal">MPa</span></span></div>
                        <div className="flex justify-between items-end"><span className="text-xs text-white/60">ε</span><span className="text-lg font-semibold text-[#1DD1A1]">{aiResult.epsilon}</span></div>
                        <div className="flex justify-between items-end"><span className="text-xs text-white/60">R²</span><span className="text-lg font-semibold text-[#FF9F43]">{aiResult.r2}</span></div>
                      </motion.div>
                    ) : (
                      <div className="text-center text-xs text-white/30 py-6">调整参数后点击开始预测</div>
                    )}
                  </div>
                </div>
              </GlowCard>

              {/* J-C 参数 + 雷达图 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <GlowCard glowColor="#FF9F43" hoverable={false} className="p-5">
                  <h2 className="text-base font-bold mb-3">J-C 本构参数</h2>
                  <div className="text-[11px] text-white/50 mb-3 font-mono bg-[#051020] rounded px-3 py-2 border border-white/10">
                    {'σ = (A + Bε'}<sup>n</sup>{')(1 + Cln'}<span className="text-[#00F5FF]">ε̇*</span>{')(1 - T*'}<sup>m</sup>{')'}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      ['A', jc.A, 'MPa', '屈服强度'], ['B', jc.B, 'MPa', '硬化系数'],
                      ['n', jc.n, '', '硬化指数'], ['C', jc.C, '', '应变率系数'], ['m', jc.m, '', '热软化指数'],
                    ] as const).map(([label, value, unit, desc]) => (
                      <div key={label} className="bg-[#051020] rounded-lg p-2.5 border border-white/10">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs font-bold text-[#FF9F43]">{label}</span>
                          <span className="text-sm font-mono text-white">{typeof value === 'number' && value < 1 ? value.toFixed(3) : value}</span>
                        </div>
                        <div className="text-[10px] text-white/40 mt-0.5">{desc} {unit && `(${unit})`}</div>
                      </div>
                    ))}
                    <div className="bg-[#051020] rounded-lg p-2.5 border border-[#1DD1A1]/20">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs font-bold text-[#1DD1A1]">R²</span>
                        <span className="text-sm font-mono text-[#1DD1A1]">{r2.toFixed(4)}</span>
                      </div>
                      <div className="text-[10px] text-white/40 mt-0.5">拟合优度</div>
                    </div>
                  </div>
                </GlowCard>

                <GlowCard glowColor="#1DD1A1" hoverable={false} className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-[3px] h-5 rounded-full bg-[#8B5CF6]" />
                    <h2 className="text-base font-bold bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA] bg-clip-text text-transparent">性能雷达图</h2>
                  </div>
                  <RadarChart values={radar} materialName={selectedMaterial.name} />
                </GlowCard>
              </div>

              {/* 多本构模型拟合（Phase 4 新增） */}
              <ConstitutiveFittingPanel
                material={selectedMaterial}
                strainRate={strainRate}
                temperature={temperature}
              />

              {/* 微观变形机制 */}
              <GlowCard glowColor="#8B5CF6" hoverable={false} className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-[3px] h-5 rounded-full bg-[#FFD700]" />
                  <h2 className="text-base font-bold bg-gradient-to-r from-[#FFD700] to-[#FFA500] bg-clip-text text-transparent">微观变形机制</h2>
                  <span className="text-xs text-white/40 ml-2">应变率对微观结构的影响</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#0A2540]/60 rounded-xl p-4 border border-white/5">
                    <div className="text-xs text-[#00F5FF] font-medium mb-2">低应变率 (~10²/s)</div>
                    <div className="text-[10px] text-white/50 mb-3">位错滑移主导变形</div>
                    <svg viewBox="0 0 200 100" className="w-full h-20">
                      <style>{`@keyframes dislocationSlide { 0% { transform: translateX(0); } 100% { transform: translateX(8px); } }`}</style>
                      {Array.from({length: 7}).map((_, row) =>
                        Array.from({length: 10}).map((_, col) => (
                          <circle key={`l${row}-${col}`} cx={10 + col * 19} cy={8 + row * 13}
                            r="2.5" fill={row === 3 && col > 3 ? '#00F5FF' : '#ffffff30'}
                            style={row === 3 && col > 3 ? { animation: `dislocationSlide ${1.5 + col * 0.15}s ease-in-out infinite alternate` } : {}} />
                        ))
                      )}
                      <text x="100" y="97" fill="#00F5FF" fontSize="8" textAnchor="middle" opacity="0.6">滑移面</text>
                    </svg>
                  </div>
                  <div className="bg-[#0A2540]/60 rounded-xl p-4 border border-white/5">
                    <div className="text-xs text-[#EF4444] font-medium mb-2">高应变率 (~10⁴/s)</div>
                    <div className="text-[10px] text-white/50 mb-3">绝热剪切带形成</div>
                    <svg viewBox="0 0 200 100" className="w-full h-20">
                      <style>{`@keyframes shearGlow { 0%,100% { opacity: 0.12; } 50% { opacity: 0.55; } }`}</style>
                      {Array.from({length: 7}).map((_, row) =>
                        Array.from({length: 10}).map((_, col) => {
                          const inBand = Math.abs(row - 3 + (col - 5) * 0.3) < 0.8;
                          const offset = row > 3 ? (row - 3) * 3 : 0;
                          return <circle key={`h${row}-${col}`} cx={10 + col * 19 + offset} cy={8 + row * 13}
                            r="2.5" fill={inBand ? '#EF4444' : '#ffffff30'} />;
                        })
                      )}
                      <line x1="25" y1="70" x2="180" y2="28" stroke="#EF4444" strokeWidth="9" style={{ animation: 'shearGlow 0.7s ease-in-out infinite' }} />
                      <line x1="25" y1="70" x2="180" y2="28" stroke="#EF4444" strokeWidth="1" strokeDasharray="3 2" opacity="0.7" />
                      <text x="130" y="97" fill="#EF4444" fontSize="8" textAnchor="middle" opacity="0.6">绝热剪切带</text>
                    </svg>
                  </div>
                </div>
              </GlowCard>
            </div>
          </TabsContent>

          {/* ═══════ Tab 4: 对比分析 ═══════ */}
          <TabsContent value="compare" className="flex-1 overflow-y-auto mt-0 scrollbar-thin">
            <div className="p-6 space-y-6">
              {/* 对比模式提示 */}
              <div className="flex items-center gap-3 bg-[#1DD1A1]/5 border border-[#1DD1A1]/15 rounded-lg p-4">
                <GitCompareArrows className="w-5 h-5 text-[#1DD1A1] flex-shrink-0" />
                <div>
                  <p className="text-sm text-white/80">多材料对比分析</p>
                  <p className="text-[11px] text-white/40 mt-0.5">
                    {compareMode
                      ? `对比模式已开启，已选 ${compareIds.length + 1} 种材料。在左侧点击其他材料添加到对比。`
                      : '打开左下角「对比模式」开关，然后点击不同材料进行对比。'}
                  </p>
                </div>
                <Switch checked={compareMode} onCheckedChange={v => { setCompareMode(v); if (!v) setCompareIds([]); }} />
              </div>

              {/* 对比曲线 */}
              <GlowCard glowColor="#1DD1A1" hoverable={false} className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-[3px] h-5 rounded-full bg-[#1DD1A1]" />
                  <h2 className="text-base font-bold">应力-应变对比曲线</h2>
                  {compareMode && compareIds.length > 0 && (
                    <span className="text-[10px] text-white/30 ml-2">{materialsForChart.length} 种材料</span>
                  )}
                </div>
                <StressStrainChart
                  materials={materialsForChart}
                  highlightId={selectedId}
                  aiCurve={null}
                  onReady={chart => { stressChartRef.current = chart; }}
                />
              </GlowCard>

              {/* 性能雷达对比 */}
              <GlowCard glowColor="#8B5CF6" hoverable={false} className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-[3px] h-5 rounded-full bg-[#8B5CF6]" />
                  <h2 className="text-base font-bold">性能雷达图</h2>
                </div>
                <RadarChart values={radar} materialName={selectedMaterial.name} />
              </GlowCard>

              {/* 关键参数对比表 */}
              {compareMode && compareIds.length > 0 && (
                <GlowCard glowColor="#00F5FF" hoverable={false} className="p-5">
                  <h2 className="text-base font-bold mb-3">关键参数对比</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-2 text-white/40 font-medium">材料</th>
                          <th className="text-right py-2 text-white/40 font-medium">密度 (g/cm³)</th>
                          <th className="text-right py-2 text-white/40 font-medium">弹性模量 (GPa)</th>
                          <th className="text-right py-2 text-white/40 font-medium">屈服强度 (MPa)</th>
                          <th className="text-right py-2 text-white/40 font-medium">J-C A</th>
                          <th className="text-right py-2 text-white/40 font-medium">J-C n</th>
                        </tr>
                      </thead>
                      <tbody>
                        {materialsForChart.map((mat, i) => {
                          const mjc = mockJCParams(mat);
                          return (
                            <tr key={mat.id} className="border-b border-white/5">
                              <td className="py-2 font-medium" style={{ color: CHART_COLORS[i % CHART_COLORS.length] }}>{mat.name}</td>
                              <td className="text-right py-2 text-white/60 font-mono">{(mat.density / 1000).toFixed(2)}</td>
                              <td className="text-right py-2 text-white/60 font-mono">{(mat.elasticModulus / 1e9).toFixed(1)}</td>
                              <td className="text-right py-2 text-white/60 font-mono">{(mat.yieldStrength / 1e6).toFixed(0)}</td>
                              <td className="text-right py-2 text-white/60 font-mono">{mjc.A}</td>
                              <td className="text-right py-2 text-white/60 font-mono">{mjc.n.toFixed(3)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </GlowCard>
              )}
            </div>
          </TabsContent>

          {/* ═══════ Tab 5: 报告生成 ═══════ */}
          <TabsContent value="report" className="flex-1 overflow-y-auto mt-0 scrollbar-thin">
            <ReportGenerationPanel
              material={selectedMaterial}
              jcParams={jc}
              fitR2={r2}
              strainRate={strainRate}
              temperature={temperature}
              aiResult={aiResult}
            />
          </TabsContent>

          {/* ═══════ Tab 6: CT 裂隙提取 ═══════ */}
          <TabsContent value="ct" className="flex-1 overflow-y-auto mt-0 scrollbar-thin">
            <div className="p-6">
              <CTFissureExtractorPanel />
            </div>
          </TabsContent>

          {/* ═══════ Tab 7: 参考文献 ═══════ */}
          <TabsContent value="refs" className="flex-1 overflow-y-auto mt-0 scrollbar-thin">
            <ReferencePapersPanel material={selectedMaterial} />
          </TabsContent>
        </Tabs>
      </main>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  参考文献面板 — 根据材料过滤 LITERATURE_CORPUS                     */
/* ------------------------------------------------------------------ */

function ReferencePapersPanel({ material }: { material: Material }) {
  const papers = useMemo(() => {
    const matId = material.id;
    const cat = material.category ?? '';
    return LITERATURE_CORPUS.filter(p => {
      if (p.materials?.includes(matId)) return true;
      if (cat.includes('混凝土') && p.keywords.some(k => k.includes('混凝土'))) return true;
      if (
        (cat.includes('岩') || cat.includes('矿石') || cat === '岩石') &&
        p.keywords.some(k => /岩|Micro-CT|煤/.test(k))
      ) return true;
      return false;
    });
  }, [material]);

  const CATEGORY_COLOR: Record<string, string> = {
    'shpb-theory': '#00F5FF',
    'constitutive-model': '#8B5CF6',
    'material-science': '#1DD1A1',
    'signal-processing': '#FF9F43',
    'experimental-method': '#F472B6',
    'simulation': '#FFD700',
  };
  const CATEGORY_LABEL: Record<string, string> = {
    'shpb-theory': 'SHPB 理论',
    'constitutive-model': '本构模型',
    'material-science': '材料科学',
    'signal-processing': '信号处理',
    'experimental-method': '实验方法',
    'simulation': '数值仿真',
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="w-4 h-4 text-[#8B5CF6]" />
        <h2 className="text-sm font-bold text-white">相关学术文献</h2>
        <span className="text-xs text-white/40">· {material.name} · 共 {papers.length} 篇</span>
      </div>

      {papers.length === 0 && (
        <div className="rounded-lg border border-white/10 bg-[#051020] p-8 text-center text-sm text-white/40">
          当前材料暂无关联文献
        </div>
      )}

      {papers.map(p => {
        const color = CATEGORY_COLOR[p.category] ?? '#8B5CF6';
        return (
          <div
            key={p.id}
            className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-5 transition-colors hover:border-white/25"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide"
                  style={{ borderColor: `${color}55`, color, background: `${color}10` }}
                >
                  {CATEGORY_LABEL[p.category] ?? p.category}
                </span>
                <span className="text-[11px] text-white/40">{p.year}</span>
                <span className="text-[11px] text-white/40">· {p.venue}</span>
              </div>
              {p.doi && (
                <a
                  href={`https://doi.org/${p.doi}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[11px] text-[#00F5FF]/80 hover:text-[#00F5FF] transition-colors flex-shrink-0"
                >
                  DOI <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <h3 className="text-sm font-semibold text-white mb-1 leading-snug">{p.title}</h3>
            <p className="text-[11px] text-white/50 mb-3">{p.authors.join('、')}</p>
            <p className="text-xs text-white/70 leading-relaxed mb-3">{p.abstract}</p>
            <div className="flex flex-wrap gap-1.5">
              {p.keywords.map(k => (
                <span
                  key={k}
                  className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/60"
                >
                  {k}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Build AI prediction curve data                                     */
/* ------------------------------------------------------------------ */

function buildAIPredictionCurve(mat: Material, epsDot: number, T: number): [number, number][] {
  const jc = mockJCParams(mat);
  const maxStrain = Math.max(...mat.stressStrainSample.map(p => p.strain), 0.3);
  const pts: [number, number][] = [];
  for (let i = 0; i <= 80; i++) {
    const eps = (i / 80) * maxStrain;
    const sigma = jcFull(eps, epsDot, T, jc.A, jc.B, jc.n, jc.C, jc.m, jc.Tm);
    pts.push([+(eps * 100).toFixed(2), +sigma.toFixed(1)]);
  }
  return pts;
}

/* ------------------------------------------------------------------ */
/*  Sensitivity Mini-Chart sub-component                               */
/* ------------------------------------------------------------------ */

function SensitivityMiniChart({
  material, strainRate, temperature,
}: {
  material: Material;
  strainRate: number;
  temperature: number;
}) {
  const { containerRef, instanceRef } = useEChart([material.id, strainRate, temperature]);

  useEffect(() => {
    const chart = instanceRef.current;
    if (!chart) return;

    const jc = mockJCParams(material);
    const maxStrain = Math.max(...material.stressStrainSample.map(p => p.strain), 0.3);
    const PTS = 40;

    const buildCurve = (rate: number): [number, number][] => {
      const pts: [number, number][] = [];
      for (let i = 0; i <= PTS; i++) {
        const eps = (i / PTS) * maxStrain;
        const sigma = jcFull(eps, rate, temperature, jc.A, jc.B, jc.n, jc.C, jc.m, jc.Tm);
        pts.push([+(eps * 100).toFixed(2), +sigma.toFixed(1)]);
      }
      return pts;
    };

    const mainCurve = buildCurve(strainRate);
    const highCurve = buildCurve(strainRate * 1.2);
    const lowCurve  = buildCurve(strainRate * 0.8);

    chart.setOption({
      animation: false,
      backgroundColor: 'transparent',
      grid: { left: '14%', right: '4%', top: '8%', bottom: '20%' },
      xAxis: {
        type: 'value',
        axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      },
      legend: {
        data: ['主预测', '+20%', '-20%'],
        bottom: 0,
        textStyle: { color: 'rgba(255,255,255,0.5)', fontSize: 8 },
        itemWidth: 10, itemHeight: 6,
      },
      tooltip: { show: false },
      series: [
        {
          name: '+20%',
          type: 'line',
          data: highCurve,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: '#10B981', width: 1, type: 'dashed', opacity: 0.8 },
        },
        {
          name: '-20%',
          type: 'line',
          data: lowCurve,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: '#EF4444', width: 1, type: 'dashed', opacity: 0.8 },
        },
        {
          name: '主预测',
          type: 'line',
          data: mainCurve,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: '#00F5FF', width: 2, opacity: 1 },
        },
      ],
    }, true);
  }, [material, strainRate, temperature, instanceRef]);

  return <div ref={containerRef} className="w-full h-[150px]" />;
}

/* ------------------------------------------------------------------ */
/*  Stress-Strain Chart sub-component                                  */
/* ------------------------------------------------------------------ */

function StressStrainChart({
  materials, highlightId, aiCurve, onReady,
}: {
  materials: Material[];
  highlightId: string | null;
  aiCurve: [number, number][] | null;
  onReady?: (chart: echarts.ECharts) => void;
}) {
  const key = materials.map(m => m.id).join(',');
  const { containerRef, instanceRef } = useEChart([key, highlightId]);

  // Refs for progressive AI curve animation
  const rafRef = useRef<number | null>(null);
  const aiIndexRef = useRef<number>(0);

  // Build base series (without AI curve) and apply static options
  useEffect(() => {
    const chart = instanceRef.current;
    if (!chart || materials.length === 0) return;

    const series: echarts.SeriesOption[] = materials.map((mat, i) => ({
      name: mat.name,
      type: 'line',
      data: mat.stressStrainSample.map(p => [+(p.strain * 100).toFixed(2), p.stress]),
      smooth: true,
      symbol: 'none',
      lineStyle: {
        color: CHART_COLORS[i % CHART_COLORS.length],
        width: highlightId === mat.id ? 3 : 2,
        opacity: highlightId && highlightId !== mat.id ? 0.3 : 1,
      },
    }));

    chart.setOption({
      animation: false,
      backgroundColor: 'transparent',
      legend: {
        data: [...materials.map(m => m.name), ...(aiCurve ? ['AI预测'] : [])],
        bottom: 0,
        textStyle: { color: 'rgba(255,255,255,0.65)', fontSize: 10 },
        itemWidth: 14, itemHeight: 8,
      },
      grid: { left: '12%', right: '6%', top: '6%', bottom: '16%' },
      xAxis: {
        type: 'value', name: '应变 (%)', nameLocation: 'middle', nameGap: 28,
        nameTextStyle: { color: 'rgba(255,255,255,0.6)' },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.2)' } },
        axisLabel: { color: 'rgba(255,255,255,0.6)' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      yAxis: {
        type: 'value', name: '应力 (MPa)', nameLocation: 'middle', nameGap: 45,
        nameTextStyle: { color: 'rgba(255,255,255,0.6)' },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.2)' } },
        axisLabel: { color: 'rgba(255,255,255,0.6)' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(10,37,64,0.95)',
        borderColor: 'rgba(0,245,255,0.3)',
        textStyle: { color: '#fff', fontSize: 12 },
      },
      series,
    }, true);

    onReady?.(chart);
  }, [materials, highlightId, instanceRef, onReady, aiCurve]);

  // Progressive AI curve drawing
  useEffect(() => {
    // Cancel any running animation
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    aiIndexRef.current = 0;

    const chart = instanceRef.current;
    if (!chart || !aiCurve || aiCurve.length === 0) return;

    const totalPts = aiCurve.length;
    // How many points to add per frame — faster on fewer points
    const STEP = Math.max(1, Math.ceil(totalPts / 40));

    const animate = () => {
      if (!instanceRef.current) return;
      const idx = aiIndexRef.current;
      if (idx >= totalPts) return;
      const nextIdx = Math.min(idx + STEP, totalPts);
      aiIndexRef.current = nextIdx;

      instanceRef.current.setOption({
        series: [{
          name: 'AI预测',
          type: 'line',
          data: aiCurve.slice(0, nextIdx),
          smooth: true,
          symbol: 'none',
          lineStyle: { color: '#8B5CF6', width: 2, type: 'dashed' },
          itemStyle: { color: '#8B5CF6' },
        }],
      });

      if (nextIdx < totalPts) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [aiCurve, instanceRef]);

  return <div ref={containerRef} className="w-full h-[360px]" />;
}

/* ------------------------------------------------------------------ */
/*  Radar Chart sub-component                                          */
/* ------------------------------------------------------------------ */

function RadarChart({ values, materialName }: { values: number[]; materialName: string }) {
  const { containerRef, instanceRef } = useEChart([materialName]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const chart = instanceRef.current;
    if (!chart) return;

    chart.setOption({
      animation: true,
      animationDuration: 800,
      animationEasing: 'cubicOut',
      backgroundColor: 'transparent',
      radar: {
        indicator: [
          { name: '强度', max: 100 },
          { name: '韧性', max: 100 },
          { name: '硬度', max: 100 },
          { name: '密度', max: 100 },
          { name: '模量', max: 100 },
          { name: '耐热', max: 100 },
        ],
        shape: 'polygon',
        axisName: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
        splitArea: { areaStyle: { color: ['rgba(0,245,255,0.02)', 'rgba(0,245,255,0.04)'] } },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      },
      series: [{
        type: 'radar',
        data: [{
          value: values,
          name: materialName,
          areaStyle: { color: 'rgba(29,209,161,0.2)' },
          lineStyle: { color: '#1DD1A1', width: 2 },
          itemStyle: { color: '#1DD1A1' },
        }],
      }],
    }, true);
  }, [values, materialName, instanceRef]);

  // CSS entrance animation: opacity 0→1, scale 0.8→1
  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'scale(0.8)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s cubic-bezier(0.34,1.56,0.64,1)';
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.opacity = '1';
        el.style.transform = 'scale(1)';
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [materialName]);

  return (
    <div ref={wrapperRef} className="w-full h-[260px]">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
