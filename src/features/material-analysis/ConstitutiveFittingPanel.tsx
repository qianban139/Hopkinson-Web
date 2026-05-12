/**
 * 多本构模型拟合面板（MaterialAnalysis Tab 3 增强部分）
 *
 * 功能：
 *   - 模型选择器（5 种本构模型）
 *   - 一键拟合 + R² / RMSE 显示
 *   - 实验曲线 vs 拟合曲线叠加图
 *   - 残差分析图
 *   - 拟合参数表 + 公式渲染
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { Sparkles, Activity, Target, BarChart3, BrainCircuit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import GlowCard from '@/shared/components/GlowCard';
import {
  MODEL_REGISTRY,
  fitConstitutiveModel,
  curveToDataPoints,
  jcStress,
  csStress,
  zaStress,
  powerLawStress,
  bilinearStress,
  type ConstitutiveModelId,
  type FitResult,
  type DataPoint,
} from '@/services/constitutiveFitting';
import BPPredictionPanel from './BPPredictionPanel';
import type { Material } from '@/types';

/** 选项:传统本构模型 ID 或 BP-ANN 预测 */
type ModeId = ConstitutiveModelId | 'bp-ann';

/* ============================================================
 * 主组件
 * ============================================================ */

export default function ConstitutiveFittingPanel({
  material, strainRate, temperature,
}: {
  material: Material;
  strainRate: number;
  temperature: number;
}) {
  const [selectedModel, setSelectedModel] = useState<ModeId>('johnson-cook');
  const [fitResult, setFitResult] = useState<FitResult<unknown> | null>(null);
  const [isFitting, setIsFitting] = useState(false);

  // 把材料的应力-应变曲线转为 DataPoint
  const dataPoints = useMemo<DataPoint[]>(
    () => curveToDataPoints(
      material.stressStrainSample.map((p) => p.strain),
      material.stressStrainSample.map((p) => p.stress),
      strainRate,
      temperature + 273.15,
    ),
    [material, strainRate, temperature],
  );

  // 切换材料/模型时清空结果
  useEffect(() => {
    setFitResult(null);
  }, [material.id, selectedModel]);

  const handleFit = () => {
    if (dataPoints.length < 3 || selectedModel === 'bp-ann') return;
    setIsFitting(true);
    setTimeout(() => {
      const result = fitConstitutiveModel(selectedModel, dataPoints, {
        refStrainRate: 1,
        refTemperature: 300,
        meltingTemperature: 1800,
      });
      setFitResult(result);
      setIsFitting(false);
    }, 500);
  };

  const isBPMode = selectedModel === 'bp-ann';
  const modelInfo = !isBPMode ? MODEL_REGISTRY.find((m) => m.id === selectedModel)! : null;

  if (isBPMode) {
    return (
      <div className="space-y-4">
        <ModelSelectorTabs selected={selectedModel} onSelect={setSelectedModel} />
        <BPPredictionPanel
          material={material}
          strainRate={strainRate}
          temperature={temperature}
        />
      </div>
    );
  }

  return (
    <GlowCard glowColor="#00F5FF" hoverable={false} className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-[#00F5FF]" />
        <h2 className="text-base font-bold">多本构模型拟合</h2>
        <Sparkles className="w-4 h-4 text-[#00F5FF]/60" />
      </div>

      {/* 模型选择卡片 */}
      <ModelSelectorTabs selected={selectedModel} onSelect={setSelectedModel} />

      {/* 模型详情 */}
      <div className="bg-[#051020] rounded-lg p-3 border border-white/10 mb-4 mt-4">
        <div className="text-[11px] text-white/40 mb-1">本构方程</div>
        <div className="text-xs font-mono text-[#00F5FF] mb-2">{modelInfo!.formula}</div>
        <div className="text-[11px] text-white/60">{modelInfo!.description}</div>
        <div className="text-[10px] text-white/30 mt-1">适用范围:{modelInfo!.applicableRange}</div>
      </div>

      {/* 操作按钮 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="bg-[#051020] rounded-lg p-3 border border-white/10">
          <div className="text-[10px] text-white/40">数据点数</div>
          <div className="text-lg font-bold text-white">{dataPoints.length}</div>
        </div>
        <div className="bg-[#051020] rounded-lg p-3 border border-white/10">
          <div className="text-[10px] text-white/40">应变率 / 温度</div>
          <div className="text-sm font-bold text-[#00F5FF] font-mono">{strainRate} /s · {temperature}°C</div>
        </div>
        <Button
          onClick={handleFit}
          disabled={isFitting || dataPoints.length < 3}
          className="bg-gradient-to-r from-[#0E7490] to-[#0EA5C2] text-white h-full font-semibold"
        >
          <Target className="w-4 h-4 mr-1.5" />
          {isFitting ? '拟合中...' : '执行拟合'}
        </Button>
      </div>

      {/* 拟合结果 */}
      {fitResult && (
        <div className="space-y-4">
          {/* 指标卡片 */}
          <div className="grid grid-cols-3 gap-3">
            <MetricCard label="R²" value={fitResult.rSquared.toFixed(4)} color="#1DD1A1" />
            <MetricCard label="RMSE" value={`${fitResult.rmse.toFixed(2)} MPa`} color="#FF9F43" />
            <MetricCard label="迭代次数" value={String(fitResult.iterations)} color="#8B5CF6" />
          </div>

          {/* 参数表 */}
          <div className="bg-[#051020] rounded-lg p-3 border border-white/10">
            <div className="text-[11px] text-white/40 mb-2 flex items-center gap-1">
              <BarChart3 className="w-3 h-3" /> 拟合参数
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(fitResult.params as Record<string, number>).map(([key, value]) => (
                <div key={key} className="bg-[#0A2540]/40 rounded px-2 py-1.5 border border-white/5">
                  <div className="text-[9px] text-white/40">{key}</div>
                  <div className="text-xs font-mono text-[#00F5FF]">
                    {typeof value === 'number'
                      ? value < 1 && value > -1
                        ? value.toFixed(4)
                        : value.toFixed(2)
                      : String(value)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 拟合曲线对比图 */}
          <div>
            <div className="text-[11px] text-white/40 mb-2">拟合曲线 vs 实验数据</div>
            <FittedCurveChart
              dataPoints={dataPoints}
              fitResult={fitResult}
              modelId={selectedModel}
              strainRate={strainRate}
              temperature={temperature + 273.15}
            />
          </div>

          {/* 残差图 */}
          <div>
            <div className="text-[11px] text-white/40 mb-2">残差分布</div>
            <ResidualChart residuals={fitResult.residuals} />
          </div>
        </div>
      )}

      {!fitResult && (
        <div className="text-center text-xs text-white/30 py-6">
          选择模型后点击「执行拟合」生成结果
        </div>
      )}
    </GlowCard>
  );
}

/* ============================================================
 * 子组件:模型选择标签(含 BP-ANN)
 * ============================================================ */

function ModelSelectorTabs({
  selected, onSelect,
}: {
  selected: ModeId;
  onSelect: (id: ModeId) => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
      {MODEL_REGISTRY.map((m) => (
        <button
          key={m.id}
          onClick={() => onSelect(m.id)}
          className={`text-left p-2.5 rounded-lg border transition-all ${
            selected === m.id
              ? 'bg-[#00F5FF]/10 border-[#00F5FF]/50 ring-1 ring-[#00F5FF]/30'
              : 'bg-[#051020] border-white/10 hover:border-white/30'
          }`}
        >
          <div className="text-[11px] font-semibold text-white">{m.name}</div>
          <div className="text-[9px] text-white/40 mt-0.5">{m.paramCount} 个参数</div>
        </button>
      ))}
      <button
        onClick={() => onSelect('bp-ann')}
        className={`text-left p-2.5 rounded-lg border transition-all ${
          selected === 'bp-ann'
            ? 'bg-[#F472B6]/10 border-[#F472B6]/50 ring-1 ring-[#F472B6]/30'
            : 'bg-[#051020] border-white/10 hover:border-white/30'
        }`}
      >
        <div className="text-[11px] font-semibold text-white flex items-center gap-1">
          <BrainCircuit className="w-3 h-3 text-[#F472B6]" /> BP-ANN
        </div>
        <div className="text-[9px] text-white/40 mt-0.5">神经网络预测</div>
      </button>
    </div>
  );
}

/* ============================================================
 * 子组件:指标卡片
 * ============================================================ */

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      className="bg-[#051020] rounded-lg p-3 border"
      style={{ borderColor: `${color}40` }}
    >
      <div className="text-[10px] text-white/40">{label}</div>
      <div className="text-xl font-bold mt-1" style={{ color }}>{value}</div>
    </div>
  );
}

/* ============================================================
 * 子组件：拟合曲线图
 * ============================================================ */

function FittedCurveChart({
  dataPoints, fitResult, modelId, strainRate, temperature,
}: {
  dataPoints: DataPoint[];
  fitResult: FitResult<unknown>;
  modelId: ConstitutiveModelId;
  strainRate: number;
  temperature: number;
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

    const expData = dataPoints.map((p) => [+(p.strain * 100).toFixed(2), p.stress]);

    // 平滑拟合曲线（密集采样）
    const maxStrain = Math.max(...dataPoints.map((p) => p.strain), 0.3);
    const fittedCurve: [number, number][] = [];
    const PTS = 80;
    for (let i = 0; i <= PTS; i++) {
      const eps = (i / PTS) * maxStrain;
      const point: DataPoint = { strain: eps, stress: 0, strainRate, temperature };
      let sigma = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params = fitResult.params as any;
      switch (modelId) {
        case 'johnson-cook':
          sigma = jcStress(params, point);
          break;
        case 'cowper-symonds':
          sigma = csStress(params, point);
          break;
        case 'zerilli-armstrong':
          sigma = zaStress(params, point);
          break;
        case 'power-law':
          sigma = powerLawStress(params, point);
          break;
        case 'bilinear':
          sigma = bilinearStress(params, point);
          break;
      }
      fittedCurve.push([+(eps * 100).toFixed(2), +sigma.toFixed(1)]);
    }

    chart.setOption({
      animation: false,
      backgroundColor: 'transparent',
      grid: { left: '12%', right: '4%', top: '10%', bottom: '14%' },
      legend: {
        data: ['实验数据', '拟合曲线'],
        bottom: 0,
        textStyle: { color: 'rgba(255,255,255,0.6)', fontSize: 10 },
      },
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(10,37,64,0.95)', textStyle: { color: '#fff', fontSize: 11 } },
      xAxis: {
        type: 'value', name: '应变 (%)', nameLocation: 'middle', nameGap: 24,
        nameTextStyle: { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } },
        axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 9 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      yAxis: {
        type: 'value', name: '应力 (MPa)', nameLocation: 'middle', nameGap: 40,
        nameTextStyle: { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } },
        axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 9 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      series: [
        {
          name: '实验数据',
          type: 'scatter',
          data: expData,
          itemStyle: { color: '#FF9F43' },
          symbolSize: 6,
        },
        {
          name: '拟合曲线',
          type: 'line',
          data: fittedCurve,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: '#00F5FF', width: 2 },
        },
      ],
    }, true);
  }, [dataPoints, fitResult, modelId, strainRate, temperature]);

  return <div ref={containerRef} className="w-full h-[260px]" />;
}

/* ============================================================
 * 子组件：残差图
 * ============================================================ */

function ResidualChart({ residuals }: { residuals: number[] }) {
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

    const data = residuals.map((r, i) => [i, r]);
    const maxAbs = Math.max(...residuals.map((r) => Math.abs(r)), 1);

    chart.setOption({
      animation: false,
      backgroundColor: 'transparent',
      grid: { left: '12%', right: '4%', top: '10%', bottom: '20%' },
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(10,37,64,0.95)', textStyle: { color: '#fff', fontSize: 11 } },
      xAxis: {
        type: 'value', name: '数据点索引', nameLocation: 'middle', nameGap: 24,
        nameTextStyle: { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } },
        axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 9 },
      },
      yAxis: {
        type: 'value', name: '残差 (MPa)', nameLocation: 'middle', nameGap: 40,
        min: -maxAbs * 1.2, max: maxAbs * 1.2,
        nameTextStyle: { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } },
        axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 9 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      series: [
        {
          type: 'bar',
          data,
          itemStyle: {
            color: (params: { value: [number, number] }) =>
              params.value[1] >= 0 ? '#1DD1A1' : '#EF4444',
          },
          barWidth: '60%',
        },
      ],
    }, true);
  }, [residuals]);

  return <div ref={containerRef} className="w-full h-[160px]" />;
}
