// src/shared/components/ExperimentResultCharts.tsx
// 实验结果6图面板 - 基于真实SHPB实验数据形态
// 1.时间-应力 2.时间-应变率 3.应力-应变 4.时间-应变 5.能量-时间 6.三波应力-时间
import { useRef, useEffect } from 'react';
import * as echarts from 'echarts';

interface ExperimentResultChartsProps {
  voltage: number;
  peakStress: number;
  strainRate: number;
  className?: string;
}

/** 非对称脉冲 */
function asymPulse(t: number, center: number, riseW: number, fallW: number): number {
  return t < center
    ? Math.exp(-Math.pow((t - center) / riseW, 2))
    : Math.exp(-Math.pow((t - center) / fallW, 2));
}

/** 生成全部6组数据 */
function generateResultData(voltage: number, peakStress: number, strainRate: number) {
  const N = 250;
  const time = Array.from({ length: N }, (_, i) => i);

  // 1. 时间-应力: 先升后降脉冲
  const stress = time.map(t => {
    const tn = t / N;
    const env = asymPulse(tn, 0.65, 0.20, 0.15);
    return peakStress * env + (Math.random() - 0.5) * peakStress * 0.03;
  });

  // 2. 时间-应变率: 快速上升，峰值后逐渐下降
  const strainRateData = time.map(t => {
    const tn = t / N;
    const env = asymPulse(tn, 0.28, 0.08, 0.30);
    return strainRate * env + (Math.random() - 0.5) * strainRate * 0.03;
  });

  // 4. 时间-应变: 单调递增趋近饱和（积分应变率）
  const maxStrain = 0.028;
  const strain = time.map(t => {
    const tn = t / N;
    return maxStrain * (1 - Math.exp(-tn * 5)) * (0.3 + 0.7 * Math.min(1, tn / 0.8));
  });

  // 3. 应力-应变: 参数化曲线（含加载和卸载）
  const stressStrain: { stress: number; strain: number }[] = [];
  for (let i = 0; i < N; i++) {
    if (strain[i] > 0.001) {
      stressStrain.push({ stress: stress[i], strain: strain[i] });
    }
  }

  // 5. 能量-时间: 入射能 > 反射能 + 透射能 + 吸收能
  const baseEnergy = voltage * voltage * 0.000003;
  const incidentEnergy = time.map(t => {
    const tn = t / N;
    return baseEnergy * (1 - Math.exp(-tn * 4)) * 250;
  });
  const reflectedEnergy = time.map(t => {
    const tn = t / N;
    if (tn < 0.15) return 0;
    return baseEnergy * 0.35 * (1 - Math.exp(-(tn - 0.15) * 5)) * 250;
  });
  const transmittedEnergy = time.map(t => {
    const tn = t / N;
    if (tn < 0.18) return 0;
    return baseEnergy * 0.40 * (1 - Math.exp(-(tn - 0.18) * 4)) * 250;
  });
  const absorbedEnergy = time.map((_, i) => {
    return Math.max(0, incidentEnergy[i] - reflectedEnergy[i] - transmittedEnergy[i]);
  });

  // 6. 三波应力-时间
  const amplitude = voltage * 0.04;
  const reflCoeff = 0.75;
  const transCoeff = 0.55;
  const incidentWave = time.map(t => {
    const tn = t / N;
    return -amplitude * asymPulse(tn, 0.48, 0.12, 0.18) + (Math.random() - 0.5) * amplitude * 0.02;
  });
  const reflectedWave = time.map(t => {
    const tn = t / N;
    return amplitude * reflCoeff * asymPulse(tn, 0.22, 0.06, 0.10) + (Math.random() - 0.5) * amplitude * 0.02;
  });
  const transmittedWave = time.map(t => {
    const tn = t / N;
    return -amplitude * transCoeff * asymPulse(tn, 0.68, 0.10, 0.12) + (Math.random() - 0.5) * amplitude * 0.02;
  });
  const incPlusRef = time.map((_, i) => incidentWave[i] + reflectedWave[i]);

  return {
    time,
    stress,
    strainRateData,
    strain,
    stressStrain,
    incidentEnergy,
    reflectedEnergy,
    transmittedEnergy,
    absorbedEnergy,
    incidentWave,
    reflectedWave,
    transmittedWave,
    incPlusRef,
  };
}

function createChartOption(
  title: string,
  xName: string,
  yName: string,
  series: { name: string; data: number[] | { value: [number, number] }[]; color: string; lineWidth?: number }[],
  xData?: number[],
): echarts.EChartsOption {
  return {
    backgroundColor: 'transparent',
    animation: false,
    title: {
      text: title,
      textStyle: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 'bold' },
      left: 'center',
      top: 4,
    },
    grid: { left: '14%', right: '6%', top: '20%', bottom: '16%' },
    legend: {
      data: series.map(s => s.name),
      textStyle: { color: 'rgba(255,255,255,0.6)', fontSize: 9 },
      bottom: 0,
      itemWidth: 12,
      itemHeight: 8,
    },
    xAxis: {
      type: xData ? 'category' : 'value',
      ...(xData ? { data: xData.map(String) } : {}),
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.3)' } },
      axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 9, interval: xData ? 49 : undefined },
      name: xName,
      nameTextStyle: { color: 'rgba(255,255,255,0.5)', fontSize: 9 },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.3)' } },
      axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 9 },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      name: yName,
      nameTextStyle: { color: 'rgba(255,255,255,0.5)', fontSize: 9 },
    },
    series: series.map(s => ({
      name: s.name,
      type: 'line' as const,
      data: s.data,
      smooth: 0.3,
      lineStyle: { color: s.color, width: s.lineWidth ?? 1.5 },
      showSymbol: false,
    })),
  };
}

export default function ExperimentResultCharts({
  voltage,
  peakStress,
  strainRate,
  className = '',
}: ExperimentResultChartsProps) {
  const chartRefs = useRef<(HTMLDivElement | null)[]>([]);
  const chartInstances = useRef<(echarts.ECharts | null)[]>([]);

  useEffect(() => {
    const data = generateResultData(voltage, peakStress, strainRate);

    const charts: { option: echarts.EChartsOption }[] = [
      // 1. 时间-应力
      {
        option: createChartOption(
          '时间-应力',
          'Time',
          '应力',
          [{ name: '应力', data: data.stress, color: '#333333', lineWidth: 2 }],
          data.time,
        ),
      },
      // 2. 时间-应变率
      {
        option: createChartOption(
          '时间-应变率',
          'Time',
          '应变率',
          [{ name: '应变率', data: data.strainRateData, color: '#333333', lineWidth: 2 }],
          data.time,
        ),
      },
      // 3. 应力-应变
      {
        option: createChartOption(
          '应力-应变',
          '应变',
          '应力/MPa',
          [{
            name: '应力-应变',
            data: data.stressStrain.map(p => ({ value: [p.strain, p.stress] as [number, number] })),
            color: '#333333',
            lineWidth: 2,
          }],
        ),
      },
      // 4. 时间-应变
      {
        option: createChartOption(
          '时间-应变',
          'Time',
          '应变',
          [{ name: '应变', data: data.strain, color: '#333333', lineWidth: 2 }],
          data.time,
        ),
      },
      // 5. 能量-时间
      {
        option: createChartOption(
          '能量-时间',
          'Time',
          '能量',
          [
            { name: '入射能', data: data.incidentEnergy, color: '#333333', lineWidth: 2 },
            { name: '反射能', data: data.reflectedEnergy, color: '#3B82F6' },
            { name: '透射能', data: data.transmittedEnergy, color: '#EF4444' },
            { name: '吸收能', data: data.absorbedEnergy, color: '#10B981' },
          ],
          data.time,
        ),
      },
      // 6. 三波应力-时间
      {
        option: createChartOption(
          '三波应力-时间',
          'Time',
          '应力/MPa',
          [
            { name: '入射应力', data: data.incidentWave, color: '#333333', lineWidth: 2 },
            { name: '反射应力', data: data.reflectedWave, color: '#3B82F6', lineWidth: 2 },
            { name: '透射应力', data: data.transmittedWave, color: '#EF4444' },
            { name: '入射+反射应力', data: data.incPlusRef, color: '#10B981' },
          ],
          data.time,
        ),
      },
    ];

    charts.forEach((chart, idx) => {
      const el = chartRefs.current[idx];
      if (!el) return;

      if (!chartInstances.current[idx]) {
        chartInstances.current[idx] = echarts.init(el);
      }
      chartInstances.current[idx]!.setOption(chart.option, true);
    });

    const handleResize = () => {
      chartInstances.current.forEach(c => c?.resize());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [voltage, peakStress, strainRate]);

  useEffect(() => {
    return () => {
      chartInstances.current.forEach(c => c?.dispose());
      chartInstances.current = [];
    };
  }, []);

  return (
    <div className={`grid grid-cols-2 gap-0 ${className}`}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          ref={el => { chartRefs.current[i] = el; }}
          className="w-full h-[200px] bg-[#051020]/50 border-[0.5px] border-[#00F5FF]/10"
        />
      ))}
    </div>
  );
}
