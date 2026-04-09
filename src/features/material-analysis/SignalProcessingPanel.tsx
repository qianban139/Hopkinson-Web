/**
 * 信号处理面板 (MaterialAnalysis Tab 2)
 *
 * 提供 SHPB 三波形（入射 / 反射 / 透射）的链式信号处理：
 *   - 算法卡片选择 + 启用/禁用切换
 *   - 参数滑块实时调整
 *   - 处理前/后波形对比
 *   - 撤销/重做历史
 *   - 应力平衡判据自动评估
 *
 * 数据源：使用程序生成的模拟三波形（基于 sin·exp 包络 + 高斯噪声），
 *         以便在没有真实采集数据时也能展示算法效果
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import {
  Waves, RotateCcw, RotateCw, Trash2, PlayCircle,
  CheckCircle2, AlertTriangle, Zap, ListChecks,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import GlowCard from '@/shared/components/GlowCard';
import {
  ALGORITHM_REGISTRY,
  evaluateStressEquilibrium,
  runPipeline,
  type PipelineStep,
  type ProcessingResult,
  type ThreeWaveDataset,
  type WaveformData,
} from '@/services/signalProcessing';

/* ============================================================
 * 模拟数据生成
 * ============================================================ */

const SAMPLE_RATE = 1_000_000; // 1 MHz
const N_SAMPLES = 800;

function generateMockWaveform(
  channel: WaveformData['channel'],
  amplitude: number,
  noiseLevel: number,
  baselineDrift: number,
): WaveformData {
  const time: number[] = [];
  const values: number[] = [];
  for (let i = 0; i < N_SAMPLES; i++) {
    const t = i / SAMPLE_RATE; // 秒
    time.push(t * 1e6); // → μs

    let val = 0;
    // 主脉冲：高斯包络 × 正弦
    const center = N_SAMPLES * (channel === 'incident' ? 0.3 : channel === 'reflected' ? 0.55 : 0.5);
    const width = N_SAMPLES * 0.15;
    const envelope = amplitude * Math.exp(-((i - center) ** 2) / (2 * width * width));
    val += envelope * Math.sin((2 * Math.PI * (i - center)) / 60);

    // 高频噪声
    val += (Math.random() - 0.5) * 2 * noiseLevel;
    // 基线漂移
    val += (i / N_SAMPLES) * baselineDrift + 0.05 * baselineDrift * Math.sin(i * 0.01);

    values.push(val);
  }
  return { time, values, sampleRate: SAMPLE_RATE, channel };
}

function generateMockDataset(): ThreeWaveDataset {
  return {
    incident: generateMockWaveform('incident', 800, 60, 30),
    reflected: generateMockWaveform('reflected', -550, 50, 25),
    transmitted: generateMockWaveform('transmitted', 250, 40, 20),
  };
}

/* ============================================================
 * 主组件
 * ============================================================ */

export default function SignalProcessingPanel() {
  // 原始三波数据（首次加载时生成一次）
  const [rawDataset] = useState<ThreeWaveDataset>(() => generateMockDataset());
  const [activeChannel, setActiveChannel] = useState<WaveformData['channel']>('incident');

  // 算法管线步骤（按用户配置）
  const [pipeline, setPipeline] = useState<PipelineStep[]>([]);
  const [history, setHistory] = useState<PipelineStep[][]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  // 最新执行结果
  const [executionLog, setExecutionLog] = useState<ProcessingResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // 应力平衡评估
  const equilibrium = useMemo(() => {
    return evaluateStressEquilibrium(rawDataset, {
      youngModulus: 210, // 钢杆
      windowStart: Math.floor(N_SAMPLES * 0.3),
      windowEnd: Math.floor(N_SAMPLES * 0.7),
    });
  }, [rawDataset]);

  // 当前活动波形（执行管线后）
  const currentWaveform = useMemo(() => {
    const raw = rawDataset[activeChannel];
    if (executionLog.length === 0) return raw;
    return executionLog[executionLog.length - 1].waveform;
  }, [rawDataset, activeChannel, executionLog]);

  /* ----- 历史管理 ----- */
  const pushHistory = (next: PipelineStep[]) => {
    const newHistory = history.slice(0, historyIdx + 1);
    newHistory.push(next);
    setHistory(newHistory);
    setHistoryIdx(newHistory.length - 1);
    setPipeline(next);
  };

  const undo = () => {
    if (historyIdx > 0) {
      setHistoryIdx(historyIdx - 1);
      setPipeline(history[historyIdx - 1]);
    }
  };
  const redo = () => {
    if (historyIdx < history.length - 1) {
      setHistoryIdx(historyIdx + 1);
      setPipeline(history[historyIdx + 1]);
    }
  };

  /* ----- 添加 / 删除 / 切换算法 ----- */
  const addAlgorithm = (algoId: string) => {
    const algo = ALGORITHM_REGISTRY.find((a) => a.id === algoId);
    if (!algo) return;
    const newStep: PipelineStep = {
      id: `${algoId}-${Date.now()}`,
      algorithm: algoId,
      enabled: true,
      params: { ...algo.defaultParams },
    };
    pushHistory([...pipeline, newStep]);
  };

  const toggleStep = (stepId: string) => {
    pushHistory(pipeline.map((s) => (s.id === stepId ? { ...s, enabled: !s.enabled } : s)));
  };

  const removeStep = (stepId: string) => {
    pushHistory(pipeline.filter((s) => s.id !== stepId));
  };

  const updateStepParam = (stepId: string, key: string, value: number) => {
    pushHistory(
      pipeline.map((s) =>
        s.id === stepId ? { ...s, params: { ...s.params, [key]: value } } : s,
      ),
    );
  };

  const clearAll = () => {
    pushHistory([]);
    setExecutionLog([]);
  };

  /* ----- 执行管线 ----- */
  const runProcessingPipeline = () => {
    if (pipeline.length === 0) return;
    setIsRunning(true);
    setTimeout(() => {
      const { history: log } = runPipeline(rawDataset[activeChannel], pipeline);
      setExecutionLog(log);
      setIsRunning(false);
    }, 300);
  };

  // 切换通道时重新执行
  useEffect(() => {
    if (pipeline.length > 0) {
      const { history: log } = runPipeline(rawDataset[activeChannel], pipeline);
      setExecutionLog(log);
    } else {
      setExecutionLog([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannel]);

  /* ----- 渲染 ----- */
  return (
    <div className="p-6 space-y-6">
      {/* ----- 顶部状态栏 ----- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlowCard glowColor="#00F5FF" hoverable={false} className="p-4">
          <div className="flex items-center gap-3">
            <Waves className="w-8 h-8 text-[#00F5FF]" />
            <div>
              <div className="text-[10px] text-white/40">采样率</div>
              <div className="text-sm font-bold text-[#00F5FF]">{(SAMPLE_RATE / 1e6).toFixed(1)} MHz</div>
              <div className="text-[10px] text-white/40">{N_SAMPLES} 点 / 通道</div>
            </div>
          </div>
        </GlowCard>

        <GlowCard glowColor="#FF9F43" hoverable={false} className="p-4">
          <div className="flex items-center gap-3">
            <Zap className="w-8 h-8 text-[#FF9F43]" />
            <div>
              <div className="text-[10px] text-white/40">活动管线</div>
              <div className="text-sm font-bold text-[#FF9F43]">{pipeline.filter(p => p.enabled).length} / {pipeline.length} 步</div>
              <div className="text-[10px] text-white/40">点击「执行管线」应用</div>
            </div>
          </div>
        </GlowCard>

        <GlowCard glowColor={equilibrium.isBalanced ? '#1DD1A1' : '#EF4444'} hoverable={false} className="p-4">
          <div className="flex items-center gap-3">
            {equilibrium.isBalanced ? (
              <CheckCircle2 className="w-8 h-8 text-[#1DD1A1]" />
            ) : (
              <AlertTriangle className="w-8 h-8 text-[#EF4444]" />
            )}
            <div>
              <div className="text-[10px] text-white/40">应力平衡判据</div>
              <div className="text-sm font-bold" style={{ color: equilibrium.isBalanced ? '#1DD1A1' : '#EF4444' }}>
                R = {equilibrium.ratio.toFixed(3)} · {equilibrium.grade}
              </div>
              <div className="text-[10px] text-white/40 truncate" title={equilibrium.description}>{equilibrium.description}</div>
            </div>
          </div>
        </GlowCard>
      </div>

      {/* ----- 主体：左侧算法库 + 右侧波形 ----- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── 左侧：算法库 ── */}
        <GlowCard glowColor="#8B5CF6" hoverable={false} className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <ListChecks className="w-5 h-5 text-[#8B5CF6]" />
            <h2 className="text-base font-bold">算法库</h2>
          </div>
          <p className="text-[11px] text-white/40 mb-3">点击下方算法添加到管线</p>
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin">
            {ALGORITHM_REGISTRY.map((algo) => (
              <button
                key={algo.id}
                onClick={() => addAlgorithm(algo.id)}
                className="w-full text-left bg-[#051020] rounded-lg p-3 border border-white/5 hover:border-[#8B5CF6]/40 transition-colors group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-white group-hover:text-[#8B5CF6]">{algo.name}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/40">{algo.category}</span>
                </div>
                <p className="text-[11px] text-white/40">{algo.description}</p>
              </button>
            ))}
          </div>
        </GlowCard>

        {/* ── 右侧：管线 + 波形 ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* 管线编辑器 */}
          <GlowCard glowColor="#FF9F43" hoverable={false} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold">处理管线 ({pipeline.length})</h2>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={undo} disabled={historyIdx <= 0}
                  className="h-7 px-2 border-white/15 text-white/60 text-xs">
                  <RotateCcw className="w-3 h-3 mr-1" /> 撤销
                </Button>
                <Button size="sm" variant="outline" onClick={redo} disabled={historyIdx >= history.length - 1}
                  className="h-7 px-2 border-white/15 text-white/60 text-xs">
                  <RotateCw className="w-3 h-3 mr-1" /> 重做
                </Button>
                <Button size="sm" variant="outline" onClick={clearAll} disabled={pipeline.length === 0}
                  className="h-7 px-2 border-white/15 text-white/60 text-xs">
                  <Trash2 className="w-3 h-3 mr-1" /> 清空
                </Button>
                <Button size="sm" onClick={runProcessingPipeline} disabled={pipeline.length === 0 || isRunning}
                  className="h-7 px-3 bg-gradient-to-r from-[#0E7490] to-[#0EA5C2] text-white text-xs">
                  <PlayCircle className="w-3 h-3 mr-1" /> {isRunning ? '执行中...' : '执行管线'}
                </Button>
              </div>
            </div>

            {pipeline.length === 0 ? (
              <div className="text-center py-8 text-xs text-white/30">
                管线为空，请从左侧算法库选择算法
              </div>
            ) : (
              <div className="space-y-2">
                {pipeline.map((step, idx) => {
                  const meta = ALGORITHM_REGISTRY.find((a) => a.id === step.algorithm);
                  if (!meta) return null;
                  return (
                    <div key={step.id} className="bg-[#051020] rounded-lg p-3 border border-white/10">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-white/40">#{idx + 1}</span>
                          <span className="text-sm font-medium text-white">{meta.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch checked={step.enabled} onCheckedChange={() => toggleStep(step.id)} />
                          <button
                            onClick={() => removeStep(step.id)}
                            className="text-white/30 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {/* 参数滑块 */}
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(step.params).map(([key, value]) => {
                          if (typeof value !== 'number') return null;
                          const min = 0;
                          const max = value > 1000 ? value * 4 : value > 1 ? value * 4 : 1;
                          return (
                            <div key={key}>
                              <div className="flex justify-between text-[10px] mb-1">
                                <span className="text-white/50">{key}</span>
                                <span className="text-[#00F5FF] font-mono">
                                  {typeof value === 'number' && value < 10 ? value.toFixed(3) : Math.round(value)}
                                </span>
                              </div>
                              <Slider
                                min={min}
                                max={max}
                                step={max > 100 ? 1 : 0.001}
                                value={[value]}
                                onValueChange={(v) => updateStepParam(step.id, key, v[0])}
                                className="[&_[data-slot=slider-range]]:bg-[#FF9F43] [&_[data-slot=slider-thumb]]:border-[#FF9F43]"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlowCard>

          {/* 波形对比图 */}
          <GlowCard glowColor="#1DD1A1" hoverable={false} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold">波形对比</h2>
              <div className="flex items-center gap-1">
                {(['incident', 'reflected', 'transmitted'] as const).map((ch) => (
                  <button
                    key={ch}
                    onClick={() => setActiveChannel(ch)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      activeChannel === ch
                        ? 'bg-[#00F5FF]/15 text-[#00F5FF] border border-[#00F5FF]/40'
                        : 'bg-white/5 text-white/50 border border-white/10 hover:text-white/80'
                    }`}
                  >
                    {ch === 'incident' ? '入射波' : ch === 'reflected' ? '反射波' : '透射波'}
                  </button>
                ))}
              </div>
            </div>

            <WaveformComparisonChart
              raw={rawDataset[activeChannel]}
              processed={currentWaveform}
              processedLabel={executionLog.length > 0 ? '处理后' : '未处理'}
            />

            {/* 执行日志 */}
            {executionLog.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="text-[11px] text-white/40 mb-2">执行日志</div>
                <div className="space-y-1 max-h-[120px] overflow-y-auto scrollbar-thin">
                  {executionLog.map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px] bg-[#051020] rounded px-2 py-1">
                      <span className="text-white/60">
                        <span className="text-[#FF9F43]">#{i + 1}</span> {r.algorithm}
                      </span>
                      <span className="text-white/30 font-mono">{r.durationMs.toFixed(1)} ms</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </GlowCard>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * 波形对比图（前后叠加）
 * ============================================================ */

function WaveformComparisonChart({
  raw, processed, processedLabel,
}: {
  raw: WaveformData;
  processed: WaveformData;
  processedLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    instanceRef.current?.dispose();
    instanceRef.current = echarts.init(containerRef.current);
    const ro = new ResizeObserver(() => instanceRef.current?.resize());
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = instanceRef.current;
    if (!chart) return;

    const rawData = raw.time.map((t, i) => [t, raw.values[i]]);
    const processedData = processed.time.map((t, i) => [t, processed.values[i]]);

    chart.setOption({
      animation: false,
      backgroundColor: 'transparent',
      grid: { left: '10%', right: '4%', top: '12%', bottom: '14%' },
      legend: {
        data: ['原始', processedLabel],
        bottom: 0,
        textStyle: { color: 'rgba(255,255,255,0.6)', fontSize: 10 },
      },
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(10,37,64,0.95)', textStyle: { color: '#fff', fontSize: 11 } },
      xAxis: {
        type: 'value', name: '时间 (μs)', nameLocation: 'middle', nameGap: 24,
        nameTextStyle: { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } },
        axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 9 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      yAxis: {
        type: 'value', name: '幅值', nameLocation: 'middle', nameGap: 36,
        nameTextStyle: { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } },
        axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 9 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      series: [
        {
          name: '原始',
          type: 'line',
          data: rawData,
          symbol: 'none',
          lineStyle: { color: '#FF9F43', width: 1, opacity: 0.5 },
        },
        {
          name: processedLabel,
          type: 'line',
          data: processedData,
          symbol: 'none',
          lineStyle: { color: '#00F5FF', width: 1.5 },
        },
      ],
    }, true);
  }, [raw, processed, processedLabel]);

  return <div ref={containerRef} className="w-full h-[280px]" />;
}
