/**
 * BP-ANN 驱动的 SHPB 本构预测面板
 *
 * 论文来源: 龙旭 等(2021)
 *   "基于人工神经网络的混凝土类材料 SHPB 动态压缩性能预测"
 *
 * 面板功能:
 *   - 隐层神经元数 / 训练轮数 / 学习率可调
 *   - 训练过程实时更新 loss 曲线 + R² 指示
 *   - 训练完成后:
 *       1) BP 预测曲线 vs 实验曲线(同一应变率)
 *       2) 泛化图: 3 条不同应变率下的预测曲线
 */

import { useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { BrainCircuit, Play, Cpu, Target as TargetIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SliderInputCombo from '@/shared/components/SliderInputCombo';
import GlowCard from '@/shared/components/GlowCard';
import { trainBPForMaterial } from '@/services/bpShpbPredictor';
import type { BPNetwork } from '@/services/bpNetwork';
import type { Material } from '@/types';

interface Props {
  material: Material;
  strainRate: number;
  temperature: number;
}

interface TrainState {
  running: boolean;
  epoch: number;
  loss: number;
  r2: number;
  losses: number[];
  r2s: number[];
  network: BPNetwork | null;
  sampleCount: number;
  elapsed: number;
}

const INIT_STATE: TrainState = {
  running: false, epoch: 0, loss: 0, r2: 0,
  losses: [], r2s: [], network: null, sampleCount: 0, elapsed: 0,
};

export default function BPPredictionPanel({ material, strainRate, temperature }: Props) {
  const [hiddenDim, setHiddenDim] = useState(12);
  const [epochs, setEpochs] = useState(120);
  const [lr, setLr] = useState(0.15);
  const [state, setState] = useState<TrainState>(INIT_STATE);
  const lossChartRef = useRef<HTMLDivElement>(null);
  const curveChartRef = useRef<HTMLDivElement>(null);

  // 基准应变序列(用于绘制预测曲线)
  const strainGrid = useMemo(() => {
    const maxEps = Math.max(...material.stressStrainSample.map(p => p.strain), 0.3);
    const N = 60;
    return Array.from({ length: N + 1 }, (_, i) => (i / N) * maxEps);
  }, [material]);

  const handleTrain = async () => {
    setState({ ...INIT_STATE, running: true });

    const losses: number[] = [];
    const r2s: number[] = [];
    const result = await trainBPForMaterial(
      material, strainRate, temperature,
      { hiddenDim, epochs, learningRate: lr },
      (epoch, loss, r2) => {
        losses.push(loss);
        r2s.push(r2);
        setState((s) => ({ ...s, epoch: epoch + 1, loss, r2, losses: [...losses], r2s: [...r2s] }));
        updateLossChart(lossChartRef.current, losses, r2s);
      },
    );

    const predicted = result.predictCurve(strainGrid, strainRate, temperature);
    const predictedLow = result.predictCurve(strainGrid, strainRate / 3, temperature);
    const predictedHigh = result.predictCurve(strainGrid, strainRate * 3, temperature);

    setState((s) => ({
      ...s, running: false,
      network: result.network,
      sampleCount: result.sampleCount,
      elapsed: result.history.elapsed,
    }));

    updateCurveChart(
      curveChartRef.current,
      material.stressStrainSample,
      predicted, predictedLow, predictedHigh,
      strainRate,
    );
  };

  return (
    <GlowCard glowColor="#F472B6" hoverable={false} className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <BrainCircuit className="w-5 h-5 text-[#F472B6]" />
        <h2 className="text-base font-bold">BP-ANN 驱动的 SHPB 本构预测</h2>
        <span className="text-[10px] text-white/40">龙旭 等 (2021)</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <SliderInputCombo
          label="隐层神经元" unit="个" value={hiddenDim} onChange={setHiddenDim}
          min={4} max={32} step={1} color="#F472B6" disabled={state.running}
        />
        <SliderInputCombo
          label="训练轮数" unit="epoch" value={epochs} onChange={setEpochs}
          min={20} max={300} step={10} color="#F472B6" disabled={state.running}
        />
        <SliderInputCombo
          label="学习率" unit="" value={lr} onChange={setLr}
          min={0.01} max={0.5} step={0.01} color="#F472B6" disabled={state.running}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <InfoCell label="训练样本" value={`${state.sampleCount || '—'}`} color="#F472B6" />
        <InfoCell label="当前 Epoch" value={`${state.epoch} / ${epochs}`} color="#00F5FF" />
        <InfoCell label="MSE Loss" value={state.loss ? state.loss.toFixed(4) : '—'} color="#FF9F43" />
        <Button
          onClick={handleTrain}
          disabled={state.running}
          className="bg-gradient-to-r from-[#F472B6] to-[#EC4899] text-white h-full font-semibold"
        >
          <Play className="w-4 h-4 mr-1.5" />
          {state.running ? `训练中 ${Math.round(state.epoch / epochs * 100)}%` : '训练 BP 网络'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg bg-[#051020] border border-white/10 p-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Cpu className="w-3 h-3 text-[#F472B6]" />
            <span className="text-[10px] text-white/60">训练曲线(Loss / R²)</span>
          </div>
          <div ref={lossChartRef} className="w-full h-[200px]" />
        </div>
        <div className="rounded-lg bg-[#051020] border border-white/10 p-2">
          <div className="flex items-center gap-1.5 mb-1">
            <TargetIcon className="w-3 h-3 text-[#F472B6]" />
            <span className="text-[10px] text-white/60">
              应力-应变预测 · 当前应变率 {strainRate}/s
              {state.network && <span className="ml-2 text-[#10B981]">R² = {state.r2.toFixed(3)}</span>}
            </span>
          </div>
          <div ref={curveChartRef} className="w-full h-[200px]" />
        </div>
      </div>

      {!state.network && (
        <div className="text-center text-[11px] text-white/30 mt-3">
          调整参数后点击「训练 BP 网络」,通过 {material.stressStrainSample.length} 组实验点 + J-C 扩充的合成样本训练单隐层反向传播网络
        </div>
      )}
      {state.network && (
        <div className="text-[10px] text-white/50 mt-3 bg-[#051020]/60 rounded p-2 border border-white/5">
          ✔ 训练完成 · 耗时 {state.elapsed.toFixed(0)} ms · 最终 R² = {state.r2.toFixed(4)} · 网络已在 [0.3×, 3×] 应变率范围外推,可观察泛化曲线
        </div>
      )}
    </GlowCard>
  );
}

function InfoCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      className="bg-[#051020] rounded-lg p-3 border"
      style={{ borderColor: `${color}40` }}
    >
      <div className="text-[10px] text-white/40">{label}</div>
      <div className="text-sm font-bold font-mono mt-0.5" style={{ color }}>{value}</div>
    </div>
  );
}

// ——————————————————————————————————————————————
// Loss + R² 曲线
// ——————————————————————————————————————————————
function updateLossChart(el: HTMLDivElement | null, losses: number[], r2s: number[]) {
  if (!el) return;
  let chart = echarts.getInstanceByDom(el);
  if (!chart) chart = echarts.init(el);

  chart.setOption({
    animation: false,
    backgroundColor: 'transparent',
    grid: { left: 40, right: 40, top: 16, bottom: 24 },
    legend: {
      data: ['Loss', 'R²'],
      top: 0, textStyle: { color: 'rgba(255,255,255,0.6)', fontSize: 9 },
      itemWidth: 10, itemHeight: 2,
    },
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(10,37,64,0.95)', textStyle: { color: '#fff', fontSize: 10 } },
    xAxis: {
      type: 'category', name: 'epoch',
      nameTextStyle: { color: 'rgba(255,255,255,0.4)', fontSize: 9 },
      axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } },
      data: losses.map((_, i) => i + 1),
    },
    yAxis: [
      {
        type: 'value', name: 'Loss', position: 'left',
        nameTextStyle: { color: '#FF9F43', fontSize: 9 },
        axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      {
        type: 'value', name: 'R²', position: 'right', min: 0, max: 1,
        nameTextStyle: { color: '#1DD1A1', fontSize: 9 },
        axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } },
      },
    ],
    series: [
      { name: 'Loss', type: 'line', smooth: true, symbol: 'none', data: losses, lineStyle: { color: '#FF9F43', width: 1.5 }, yAxisIndex: 0 },
      { name: 'R²',   type: 'line', smooth: true, symbol: 'none', data: r2s,    lineStyle: { color: '#1DD1A1', width: 1.5 }, yAxisIndex: 1 },
    ],
  }, true);
}

// ——————————————————————————————————————————————
// 应力-应变 预测曲线(实验 + 3 个应变率)
// ——————————————————————————————————————————————
function updateCurveChart(
  el: HTMLDivElement | null,
  experimental: { strain: number; stress: number }[],
  pred: { strain: number; stress: number }[],
  predLow: { strain: number; stress: number }[],
  predHigh: { strain: number; stress: number }[],
  strainRate: number,
) {
  if (!el) return;
  let chart = echarts.getInstanceByDom(el);
  if (!chart) chart = echarts.init(el);

  const xfmt = (d: { strain: number; stress: number }[]) =>
    d.map(p => [+(p.strain * 100).toFixed(2), +p.stress.toFixed(1)]);

  chart.setOption({
    animation: false,
    backgroundColor: 'transparent',
    grid: { left: 44, right: 8, top: 16, bottom: 30 },
    legend: {
      data: ['实验', `BP @ ${strainRate}/s`, `BP @ ${(strainRate / 3).toFixed(0)}/s`, `BP @ ${(strainRate * 3).toFixed(0)}/s`],
      top: 0, textStyle: { color: 'rgba(255,255,255,0.6)', fontSize: 9 },
      itemWidth: 10, itemHeight: 2,
    },
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(10,37,64,0.95)', textStyle: { color: '#fff', fontSize: 10 } },
    xAxis: {
      type: 'value', name: '应变 (%)',
      nameTextStyle: { color: 'rgba(255,255,255,0.4)', fontSize: 9 },
      axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    yAxis: {
      type: 'value', name: '应力 (MPa)',
      nameTextStyle: { color: 'rgba(255,255,255,0.4)', fontSize: 9 },
      axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    series: [
      { name: '实验', type: 'scatter', data: xfmt(experimental), itemStyle: { color: '#FF9F43' }, symbolSize: 5 },
      { name: `BP @ ${strainRate}/s`, type: 'line', smooth: true, symbol: 'none', data: xfmt(pred), lineStyle: { color: '#F472B6', width: 2 } },
      { name: `BP @ ${(strainRate / 3).toFixed(0)}/s`, type: 'line', smooth: true, symbol: 'none', data: xfmt(predLow), lineStyle: { color: '#10B981', width: 1.2, type: 'dashed' } },
      { name: `BP @ ${(strainRate * 3).toFixed(0)}/s`, type: 'line', smooth: true, symbol: 'none', data: xfmt(predHigh), lineStyle: { color: '#00F5FF', width: 1.2, type: 'dashed' } },
    ],
  }, true);
}
