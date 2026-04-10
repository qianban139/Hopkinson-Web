// src/shared/components/ExperimentResultCharts.tsx
// 实验结果 6 图面板 — 基于真实 SHPB 实验数据形态（参考：数据处理111.xlsx）
// 1.时间-应力  2.时间-应变率  3.应力-应变  4.时间-应变  5.能量-时间  6.三波应力-时间
// 交互特性: 十字准星 Tooltip / 数据缩放 / 工具栏 / 峰值标记 / 可点击图例
import { useRef, useEffect, useMemo } from 'react';
import * as echarts from 'echarts';
import type { Material } from '@/types';

interface ExperimentResultChartsProps {
  voltage: number;
  peakStress: number;
  strainRate: number;
  material?: Material | null;
  className?: string;
}

// ═══════════════════════════════════════════════════════
// SHPB 真实脉冲包络（sin² 上升 + cos/exp 下降）
// 参考：数据处理111.xlsx — 半正弦钟形脉冲，峰值位置 ~42%
// ═══════════════════════════════════════════════════════
function shpbBellPulse(tNorm: number, peakPos = 0.42, startPad = 0.15, endPad = 0.85): number {
  if (tNorm < startPad || tNorm > endPad) return 0;
  const pt = (tNorm - startPad) / (endPad - startPad);
  if (pt < peakPos) {
    const r = pt / peakPos;
    const s = Math.sin(r * Math.PI / 2);
    return s * s * (1 + 0.08 * r * r);
  } else {
    const d = (pt - peakPos) / (1 - peakPos);
    return Math.max(0, Math.cos(d * Math.PI / 2) * 0.7 + Math.exp(-2.2 * d * d) * 0.3);
  }
}

/** 高频弥散噪声（模拟应变片传感器特性） */
function dispersionNoise(tNorm: number, seed = 0): number {
  const f1 = Math.sin(tNorm * 180 + seed * 1.7) * 0.012;
  const f2 = Math.sin(tNorm * 340 + seed * 3.1) * 0.006;
  const f3 = Math.sin(tNorm * 520 + seed * 5.3) * 0.003;
  return f1 + f2 + f3;
}

// ═══════════════════════════════════════════════════════
// 数据生成
// ═══════════════════════════════════════════════════════
function generateResultData(voltage: number, peakStress: number, strainRate: number, material?: Material | null) {
  const N = 500; // 更密集的采样点 → 更平滑
  // 时间轴：0 ~ 260 μs (典型 SHPB 脉冲持续时间)
  const totalTimeUs = 260;
  const time = Array.from({ length: N }, (_, i) => (i / (N - 1)) * totalTimeUs);

  // 材料延性系数 — 脆性材料 (ceramic/rock/concrete) 卸载陡峭, 韧性材料 (metal) 缓慢
  const sub = material?.subCategory;
  const isBrittle = sub === 'ceramic' || sub === 'rock' || sub === 'concrete';
  const isHyper = sub === 'polymer' || sub === 'foam' || sub === 'bio';
  const riseStretch = isHyper ? 0.48 : isBrittle ? 0.35 : 0.42;

  // 1. 时间-应力 (σ(t)): 以 peakStress 为幅值的钟形脉冲
  const stress = time.map((_, i) => {
    const tn = i / (N - 1);
    const env = shpbBellPulse(tn, riseStretch);
    const noise = dispersionNoise(tn, 1);
    return peakStress * (env + noise * 0.4);
  });

  // 2. 时间-应变率 (ε̇(t)): 前沿最快, 类似矩形窗 + 顶部振荡
  const strainRateData = time.map((_, i) => {
    const tn = i / (N - 1);
    // 应变率在脉冲进入试样时快速跳升, 中期维持, 尾部缓降
    let env = 0;
    if (tn > 0.12 && tn < 0.82) {
      const pt = (tn - 0.12) / 0.7;
      if (pt < 0.12) env = Math.pow(pt / 0.12, 1.5);        // 快速上升
      else if (pt < 0.75) env = 1 - 0.15 * Math.sin(pt * 12); // 平台震荡
      else env = Math.max(0, Math.cos((pt - 0.75) * Math.PI / 0.5));
    }
    const noise = dispersionNoise(tn, 2);
    return strainRate * (env + noise * 0.35);
  });

  // 3. 时间-应变 ε(t): 积分应变率
  const dtSec = (totalTimeUs * 1e-6) / (N - 1);
  const strain: number[] = [];
  let accStrain = 0;
  for (let i = 0; i < N; i++) {
    accStrain += Math.max(0, strainRateData[i]) * dtSec;
    strain.push(accStrain);
  }
  // 归一化到典型峰值应变 ~0.028 (2.8%)
  const maxStrainTarget = isBrittle ? 0.006 : isHyper ? 0.08 : 0.028;
  const strainMaxRaw = Math.max(...strain);
  const strainScale = strainMaxRaw > 0 ? maxStrainTarget / strainMaxRaw : 1;
  const strainScaled = strain.map(s => s * strainScale);

  // 4. 应力-应变 (σ-ε 曲线: 弹性段 + 屈服 + 塑性流动 + 卸载)
  const stressStrain: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    if (strainScaled[i] > 1e-5) {
      stressStrain.push([strainScaled[i], stress[i]]);
    }
  }

  // 5. 能量-时间 (入射能 / 反射能 / 透射能 / 吸收能)
  // 基于 dε/dt * σ 的累积积分
  const baseEnergy = 0.5 * voltage * voltage * 4000e-6; // 0.5 CV² (J)
  const scaleFactor = (peakStress / 500) * 3; // 可视化缩放
  const incidentEnergy: number[] = [];
  const reflectedEnergy: number[] = [];
  const transmittedEnergy: number[] = [];
  const absorbedEnergy: number[] = [];
  let inc = 0, ref = 0, tra = 0, abs = 0;

  // 反射/透射系数（可从 material 得出，兼容未提供情况）
  const matZ = material ? material.density * Math.sqrt(material.elasticModulus / material.density) : 4.5e6;
  const barZ = 8100 * Math.sqrt(190e9 / 8100);
  const Rc = Math.abs((matZ - barZ) / (matZ + barZ));
  const Tc = Math.max(0.2, 1 - Rc - 0.1);

  for (let i = 0; i < N; i++) {
    const tn = i / (N - 1);
    const envInc = shpbBellPulse(tn, riseStretch);
    const envRef = tn > 0.15 ? shpbBellPulse(tn, riseStretch, 0.15, 0.9) * Rc : 0;
    const envTra = tn > 0.18 ? shpbBellPulse(tn, riseStretch, 0.18, 0.92) * Tc : 0;

    inc += envInc * envInc * 25;
    ref += envRef * envRef * 25;
    tra += envTra * envTra * 25;
    abs = Math.max(0, inc - ref - tra);

    incidentEnergy.push(inc * scaleFactor);
    reflectedEnergy.push(ref * scaleFactor);
    transmittedEnergy.push(tra * scaleFactor);
    absorbedEnergy.push(abs * scaleFactor);
  }
  // 让入射能看起来合理（单位 J 的缩放）
  const energyMaxTarget = baseEnergy * 180;
  const incMaxRaw = Math.max(...incidentEnergy) || 1;
  const energyScale = energyMaxTarget / incMaxRaw;
  const incE = incidentEnergy.map(v => v * energyScale);
  const refE = reflectedEnergy.map(v => v * energyScale);
  const traE = transmittedEnergy.map(v => v * energyScale);
  const absE = absorbedEnergy.map(v => v * energyScale);

  // 6. 三波应力-时间
  // 入射（负）/ 反射（正，反相）/ 透射（负）/ 入射+反射（用于验证平衡判据）
  const waveAmp = peakStress * 0.85;
  const incidentWave = time.map((_, i) => {
    const tn = i / (N - 1);
    const env = shpbBellPulse(tn, riseStretch);
    return -waveAmp * env + dispersionNoise(tn, 4) * waveAmp * 0.25;
  });
  const reflectedWave = time.map((_, i) => {
    const tn = i / (N - 1);
    const env = tn > 0.06 ? shpbBellPulse(tn, riseStretch, 0.21, 0.91) : 0;
    return waveAmp * Rc * env * 0.92 + dispersionNoise(tn, 5) * waveAmp * 0.2;
  });
  const transmittedWave = time.map((_, i) => {
    const tn = i / (N - 1);
    const env = tn > 0.1 ? shpbBellPulse(tn, riseStretch, 0.23, 0.93) : 0;
    return -waveAmp * Tc * env * 0.88 + dispersionNoise(tn, 6) * waveAmp * 0.18;
  });
  const incPlusRef = time.map((_, i) => incidentWave[i] + reflectedWave[i]);

  return {
    time,
    stress,
    strainRateData,
    strain: strainScaled,
    stressStrain,
    incE, refE, traE, absE,
    incidentWave, reflectedWave, transmittedWave, incPlusRef,
    Rc, Tc,
    peakEnergyJ: baseEnergy,
  };
}

// ═══════════════════════════════════════════════════════
// 通用样式
// ═══════════════════════════════════════════════════════
const AXIS_COLOR = 'rgba(255,255,255,0.4)';
const LABEL_COLOR = 'rgba(255,255,255,0.65)';
const SPLIT_COLOR = 'rgba(0,245,255,0.08)';
const BG = 'transparent';

function commonTooltip(valueFormatter?: (v: number) => string): echarts.EChartsOption['tooltip'] {
  return {
    trigger: 'axis',
    axisPointer: {
      type: 'cross',
      crossStyle: { color: 'rgba(0,245,255,0.6)' },
      lineStyle: { color: 'rgba(0,245,255,0.6)', type: 'dashed' },
      label: {
        backgroundColor: '#0A2540',
        color: '#00F5FF',
        borderColor: '#00F5FF',
        borderWidth: 1,
      },
    },
    backgroundColor: 'rgba(5,16,32,0.95)',
    borderColor: 'rgba(0,245,255,0.4)',
    borderWidth: 1,
    textStyle: { color: '#fff', fontSize: 11 },
    padding: [8, 12],
    formatter: (params: unknown) => {
      const arr = params as Array<{ seriesName: string; value: number | [number, number]; color: string; marker: string; axisValue?: string | number }>;
      if (!Array.isArray(arr) || arr.length === 0) return '';
      const x = arr[0].axisValue;
      let html = `<div style="font-weight:600;color:#00F5FF;margin-bottom:4px">${x}</div>`;
      arr.forEach(p => {
        const v = Array.isArray(p.value) ? p.value[1] : p.value;
        const formatted = valueFormatter ? valueFormatter(v as number) : (v as number).toFixed(2);
        html += `<div style="display:flex;justify-content:space-between;gap:16px">
          <span>${p.marker}${p.seriesName}</span>
          <span style="font-family:monospace;color:${p.color}">${formatted}</span>
        </div>`;
      });
      return html;
    },
  };
}

function commonToolbox(): echarts.EChartsOption['toolbox'] {
  return { show: false };
}

function commonDataZoom(): echarts.EChartsOption['dataZoom'] {
  return [
    { type: 'inside', xAxisIndex: 0, filterMode: 'none', zoomOnMouseWheel: true, moveOnMouseMove: true },
  ];
}

interface SeriesDef {
  name: string;
  data: number[] | [number, number][];
  color: string;
  gradientColor?: string; // 若提供则启用面积渐变
  lineWidth?: number;
  markPointMax?: boolean;
}

function createChartOption(
  title: string,
  xName: string,
  yName: string,
  series: SeriesDef[],
  xData?: number[],
  opts: { yUnit?: string; xUnit?: string; zoomable?: boolean; tooltipFmt?: (v: number) => string; sym?: boolean } = {},
): echarts.EChartsOption {
  const { yUnit = '', xUnit = '', zoomable = true, tooltipFmt, sym = false } = opts;

  return {
    backgroundColor: BG,
    animation: true,
    animationDuration: 800,
    animationEasing: 'cubicOut',
    title: {
      text: title,
      textStyle: { color: '#00F5FF', fontSize: 11, fontWeight: 'bold' },
      left: 10,
      top: 2,
    },
    grid: {
      left: 52,
      right: 14,
      top: 28,
      bottom: 28,
      containLabel: false,
    },
    legend: {
      data: series.map(s => s.name),
      textStyle: { color: LABEL_COLOR, fontSize: 9 },
      top: 2,
      right: 50,
      itemWidth: 10,
      itemHeight: 6,
      icon: 'roundRect',
    },
    tooltip: commonTooltip(tooltipFmt),
    toolbox: commonToolbox(),
    dataZoom: zoomable ? commonDataZoom() : undefined,
    xAxis: {
      type: xData ? 'category' : 'value',
      ...(xData ? { data: xData.map(v => (typeof v === 'number' ? v.toFixed(0) : v)) } : {}),
      axisLine: { lineStyle: { color: AXIS_COLOR } },
      axisTick: { lineStyle: { color: AXIS_COLOR } },
      axisLabel: {
        color: LABEL_COLOR,
        fontSize: 9,
        formatter: (v: string | number) => {
          const n = typeof v === 'number' ? v : parseFloat(v);
          if (isNaN(n)) return String(v);
          return n.toFixed(Math.abs(n) < 1 ? 3 : 0);
        },
      },
      name: xUnit ? `${xName} / ${xUnit}` : xName,
      nameLocation: 'middle',
      nameGap: 16,
      nameTextStyle: { color: LABEL_COLOR, fontSize: 9 },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      scale: sym,
      axisLine: { lineStyle: { color: AXIS_COLOR } },
      axisTick: { lineStyle: { color: AXIS_COLOR } },
      axisLabel: {
        color: LABEL_COLOR,
        fontSize: 9,
        formatter: (v: number) => {
          if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + 'k';
          if (Math.abs(v) < 0.01 && v !== 0) return v.toExponential(1);
          return v.toFixed(Math.abs(v) < 1 ? 3 : 0);
        },
      },
      name: yUnit ? `${yName} / ${yUnit}` : yName,
      nameLocation: 'middle',
      nameGap: 34,
      nameTextStyle: { color: LABEL_COLOR, fontSize: 9 },
      splitLine: { lineStyle: { color: SPLIT_COLOR } },
    },
    series: series.map(s => ({
      name: s.name,
      type: 'line' as const,
      data: s.data,
      smooth: 0.2,
      symbol: 'none',
      sampling: 'lttb',
      lineStyle: { color: s.color, width: s.lineWidth ?? 2, shadowBlur: 4, shadowColor: s.color },
      itemStyle: { color: s.color },
      areaStyle: s.gradientColor
        ? {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: s.gradientColor },
                { offset: 1, color: 'rgba(0,0,0,0)' },
              ],
            },
          }
        : undefined,
      markPoint: s.markPointMax
        ? {
            symbol: 'pin',
            symbolSize: 30,
            itemStyle: { color: s.color, borderColor: '#fff', borderWidth: 1 },
            label: {
              color: '#fff',
              fontSize: 9,
              fontWeight: 'bold',
              formatter: (p: { value: number }) => {
                const v = typeof p.value === 'number' ? p.value : 0;
                return Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(1);
              },
            },
            data: [{ type: 'max', name: '峰值' }],
          }
        : undefined,
    })),
  };
}

// ═══════════════════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════════════════
export default function ExperimentResultCharts({
  voltage,
  peakStress,
  strainRate,
  material,
  className = '',
}: ExperimentResultChartsProps) {
  const chartRefs = useRef<(HTMLDivElement | null)[]>([]);
  const chartInstances = useRef<(echarts.ECharts | null)[]>([]);

  // 生成数据 — 依赖 voltage/peakStress/strainRate/material
  const data = useMemo(
    () => generateResultData(voltage, peakStress, strainRate, material),
    [voltage, peakStress, strainRate, material],
  );

  useEffect(() => {
    // 定义 6 个图表
    const charts: echarts.EChartsOption[] = [
      // 1. 时间-应力
      createChartOption(
        '时间-应力',
        '时间',
        '应力',
        [{
          name: '应力',
          data: data.stress,
          color: '#00F5FF',
          gradientColor: 'rgba(0,245,255,0.25)',
          lineWidth: 2.2,
          markPointMax: true,
        }],
        data.time,
        { xUnit: 'μs', yUnit: 'MPa', tooltipFmt: (v) => `${v.toFixed(1)} MPa` },
      ),
      // 2. 时间-应变率
      createChartOption(
        '时间-应变率',
        '时间',
        '应变率',
        [{
          name: '应变率',
          data: data.strainRateData,
          color: '#FFD700',
          gradientColor: 'rgba(255,215,0,0.22)',
          lineWidth: 2.2,
          markPointMax: true,
        }],
        data.time,
        { xUnit: 'μs', yUnit: 's⁻¹', tooltipFmt: (v) => `${v.toFixed(0)} s⁻¹` },
      ),
      // 3. 应力-应变 (参数化)
      createChartOption(
        '应力-应变',
        '应变',
        '应力',
        [{
          name: '应力-应变曲线',
          data: data.stressStrain,
          color: '#A855F7',
          gradientColor: 'rgba(168,85,247,0.25)',
          lineWidth: 2.4,
          markPointMax: true,
        }],
        undefined,
        { xUnit: '-', yUnit: 'MPa', tooltipFmt: (v) => `${v.toFixed(1)} MPa` },
      ),
      // 4. 时间-应变
      createChartOption(
        '时间-应变',
        '时间',
        '应变',
        [{
          name: '应变',
          data: data.strain,
          color: '#10B981',
          gradientColor: 'rgba(16,185,129,0.22)',
          lineWidth: 2.2,
          markPointMax: true,
        }],
        data.time,
        { xUnit: 'μs', yUnit: '-', tooltipFmt: (v) => v.toExponential(2) },
      ),
      // 5. 能量-时间
      createChartOption(
        '能量-时间',
        '时间',
        '能量',
        [
          { name: '入射能', data: data.incE, color: '#00F5FF', lineWidth: 2 },
          { name: '反射能', data: data.refE, color: '#3B82F6', lineWidth: 1.8 },
          { name: '透射能', data: data.traE, color: '#EF4444', lineWidth: 1.8 },
          { name: '吸收能', data: data.absE, color: '#10B981', gradientColor: 'rgba(16,185,129,0.25)', lineWidth: 2, markPointMax: true },
        ],
        data.time,
        { xUnit: 'μs', yUnit: 'J', tooltipFmt: (v) => `${v.toFixed(2)} J` },
      ),
      // 6. 三波应力-时间
      createChartOption(
        '三波应力-时间',
        '时间',
        '应力',
        [
          { name: '入射应力', data: data.incidentWave, color: '#00F5FF', lineWidth: 2 },
          { name: '反射应力', data: data.reflectedWave, color: '#EF4444', lineWidth: 2 },
          { name: '透射应力', data: data.transmittedWave, color: '#10B981', lineWidth: 2 },
          { name: '入射+反射', data: data.incPlusRef, color: '#FFD700', lineWidth: 1.5 },
        ],
        data.time,
        { xUnit: 'μs', yUnit: 'MPa', sym: true, tooltipFmt: (v) => `${v.toFixed(1)} MPa` },
      ),
    ];

    charts.forEach((option, idx) => {
      const el = chartRefs.current[idx];
      if (!el) return;

      if (!chartInstances.current[idx] || chartInstances.current[idx]?.isDisposed()) {
        chartInstances.current[idx] = echarts.init(el, undefined, { renderer: 'canvas' });
      }
      chartInstances.current[idx]!.setOption(option, true);
    });

    const handleResize = () => {
      chartInstances.current.forEach(c => c && !c.isDisposed() && c.resize());
    };
    window.addEventListener('resize', handleResize);

    // ResizeObserver 监听容器大小变化
    const ro = new ResizeObserver(() => handleResize());
    chartRefs.current.forEach(el => el && ro.observe(el));

    return () => {
      window.removeEventListener('resize', handleResize);
      ro.disconnect();
    };
  }, [data]);

  useEffect(() => {
    return () => {
      chartInstances.current.forEach(c => c && !c.isDisposed() && c.dispose());
      chartInstances.current = [];
    };
  }, []);

  // 关键统计值（显示在顶部 KPI 条）
  const peakStrainRate = Math.max(...data.strainRateData);
  const peakStrain = Math.max(...data.strain);
  const peakEnergy = Math.max(...data.incE);
  const absorbedRatio = peakEnergy > 0 ? (Math.max(...data.absE) / peakEnergy) * 100 : 0;

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* KPI 统计条 */}
      <div className="grid grid-cols-6 gap-1.5 px-2 py-1 bg-gradient-to-r from-[#051020]/80 via-[#0A2540]/60 to-[#051020]/80 border-b border-[#00F5FF]/20 flex-shrink-0">
        <KpiCard label="峰值应力" value={peakStress.toFixed(1)} unit="MPa" color="#00F5FF" />
        <KpiCard label="峰值应变率" value={peakStrainRate >= 1000 ? (peakStrainRate / 1000).toFixed(2) + 'k' : peakStrainRate.toFixed(0)} unit="s⁻¹" color="#FFD700" />
        <KpiCard label="最大应变" value={(peakStrain * 100).toFixed(2)} unit="%" color="#A855F7" />
        <KpiCard label="入射能" value={peakEnergy.toFixed(2)} unit="J" color="#3B82F6" />
        <KpiCard label="吸收率" value={absorbedRatio.toFixed(1)} unit="%" color="#10B981" />
        <KpiCard label="反射系数" value={data.Rc.toFixed(3)} unit="" color="#EF4444" />
      </div>

      {/* 6 图网格 — 3行2列，自适应填满剩余高度，pb-7 为底部监控条留空间 */}
      <div className="grid grid-cols-2 grid-rows-3 gap-[1px] bg-[#00F5FF]/10 flex-1 min-h-0 pb-7">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            ref={el => { chartRefs.current[i] = el; }}
            className="w-full h-full min-h-0 bg-gradient-to-br from-[#051020] to-[#0A2540]"
          />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// KPI 卡片
// ═══════════════════════════════════════════════════════
function KpiCard({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center px-2 py-1 rounded border"
      style={{ borderColor: `${color}30`, backgroundColor: `${color}08` }}
    >
      <div className="text-[9px] text-white/50 tracking-wider uppercase">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-sm font-bold font-mono" style={{ color }}>{value}</span>
        {unit && <span className="text-[9px] text-white/40">{unit}</span>}
      </div>
    </div>
  );
}
