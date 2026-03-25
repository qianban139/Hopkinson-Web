// src/shared/components/RealtimeWaveformPanel.tsx
// 实时波形面板 - 基于真实SHPB三波数据的渐进绘制
// 使用从数据处理111.xlsx提取的真实入射/反射/透射波形
import { useRef, useEffect, useMemo } from 'react';
import * as echarts from 'echarts';
import { Waves } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  incidentWaveData,
  reflectedWaveData,
  transmittedWaveData,
  stressStrainData,
} from '@/data/waveformData';
import type { ExperimentStage } from '@/hooks/useExperimentAnimation';

interface RealtimeWaveformPanelProps {
  currentStage: ExperimentStage;
  stageIndex: number;
  stageProgress: number;
  voltage: number;
  stiffnessK?: number;
  dampingC?: number;
  className?: string;
  showStressStrain?: boolean;
  waveFilter?: 'all' | 'incident' | 'reflected' | 'transmitted';
}

export default function RealtimeWaveformPanel({
  currentStage: _currentStage,
  stageIndex,
  stageProgress,
  voltage,
  stiffnessK: _stiffnessK,
  dampingC: _dampingC,
  className = '',
  showStressStrain = false,
  waveFilter = 'all',
}: RealtimeWaveformPanelProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // 电压缩放因子 — 根据实际电压调整波形幅值
  const voltageScale = voltage / 2000;

  // 根据实验阶段计算可见数据量（渐进绘制）
  const waveformData = useMemo(() => {
    const totalPoints = incidentWaveData.length;

    // 阶段 0-2: 无波形（充电/加速/发射前）
    // 阶段 3: 入射波逐渐出现
    // 阶段 4: 反射波+透射波出现
    // 阶段 5: 全部完整

    let incidentCount = 0;
    let reflectedCount = 0;
    let transmittedCount = 0;

    if (stageIndex >= 5) {
      incidentCount = totalPoints;
      reflectedCount = totalPoints;
      transmittedCount = totalPoints;
    } else if (stageIndex === 4) {
      incidentCount = totalPoints;
      reflectedCount = Math.floor(totalPoints * stageProgress);
      transmittedCount = Math.floor(totalPoints * stageProgress);
    } else if (stageIndex === 3) {
      incidentCount = Math.floor(totalPoints * stageProgress);
    }

    const incident = incidentWaveData.slice(0, incidentCount).map(
      ([t, v]) => [t, v * voltageScale] as [number, number]
    );
    const reflected = reflectedWaveData.slice(0, reflectedCount).map(
      ([t, v]) => [t, v * voltageScale] as [number, number]
    );
    const transmitted = transmittedWaveData.slice(0, transmittedCount).map(
      ([t, v]) => [t, v * voltageScale] as [number, number]
    );

    return { incident, reflected, transmitted };
  }, [stageIndex, stageProgress, voltageScale]);

  // 应力-应变数据（可选显示，预留给后续应力-应变图表）
  const _ssData = useMemo(() => {
    if (!showStressStrain || stageIndex < 5) return null;
    const visibleCount = stageIndex >= 5
      ? stressStrainData.length
      : Math.floor(stressStrainData.length * stageProgress);
    return stressStrainData.slice(0, visibleCount);
  }, [showStressStrain, stageIndex, stageProgress]);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      animation: false,
      grid: { left: '8%', right: '4%', top: '18%', bottom: '22%' },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(5, 16, 32, 0.9)',
        borderColor: 'rgba(0, 245, 255, 0.2)',
        textStyle: { color: '#fff', fontSize: 11 },
        axisPointer: { type: 'cross', crossStyle: { color: 'rgba(0,245,255,0.3)' } },
      },
      legend: {
        data: [
          '入射波',
          ...(stageIndex >= 4 ? ['反射波', '透射波'] : []),
        ],
        textStyle: { color: 'rgba(255,255,255,0.7)', fontSize: 10 },
        icon: 'roundRect',
        itemWidth: 16,
        itemHeight: 8,
        itemGap: 20,
        top: 0,
      },
      xAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.3)' } },
        axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 9 },
        name: '时间 (μs)',
        nameTextStyle: { color: 'rgba(255,255,255,0.5)', fontSize: 9 },
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.3)' } },
        axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 9 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)', type: 'dashed' as const } },
        name: '幅值 (mV)',
        nameTextStyle: { color: 'rgba(255,255,255,0.5)', fontSize: 9 },
      },
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: 0,
          filterMode: 'none',
        },
        {
          type: 'slider',
          xAxisIndex: 0,
          height: 18,
          bottom: 2,
          borderColor: 'rgba(0,245,255,0.1)',
          backgroundColor: 'rgba(5,16,32,0.5)',
          fillerColor: 'rgba(0,245,255,0.15)',
          handleStyle: { color: '#00F5FF', borderColor: '#00F5FF' },
          textStyle: { color: 'rgba(255,255,255,0.5)', fontSize: 9 },
          dataBackground: {
            lineStyle: { color: 'rgba(0,245,255,0.3)' },
            areaStyle: { color: 'rgba(0,245,255,0.05)' },
          },
        },
      ],
      series: [
        ...((waveFilter === 'all' || waveFilter === 'incident') ? [{
          name: '入射波',
          type: 'line' as const,
          data: waveformData.incident,
          smooth: false,
          lineStyle: { color: '#10B981', width: 2 },
          itemStyle: { color: '#10B981' },
          showSymbol: false,
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(16,185,129,0.3)' },
              { offset: 1, color: 'rgba(16,185,129,0.02)' },
            ]),
          },
          markPoint: {
            data: [{ type: 'min' as const, name: '峰值' }],
            symbolSize: 28,
            label: { fontSize: 9, color: '#10B981' },
            itemStyle: { color: '#10B981' },
          },
        }] : []),
        ...(stageIndex >= 4 && (waveFilter === 'all' || waveFilter === 'reflected') ? [{
          name: '反射波',
          type: 'line' as const,
          data: waveformData.reflected,
          smooth: false,
          lineStyle: { color: '#3B82F6', width: 2 },
          itemStyle: { color: '#3B82F6' },
          showSymbol: false,
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(59,130,246,0.25)' },
              { offset: 1, color: 'rgba(59,130,246,0.02)' },
            ]),
          },
        }] : []),
        ...(stageIndex >= 4 && (waveFilter === 'all' || waveFilter === 'transmitted') ? [{
          name: '透射波',
          type: 'line' as const,
          data: waveformData.transmitted,
          smooth: false,
          lineStyle: { color: '#EF4444', width: 2 },
          itemStyle: { color: '#EF4444' },
          showSymbol: false,
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(239,68,68,0.25)' },
              { offset: 1, color: 'rgba(239,68,68,0.02)' },
            ]),
          },
        }] : []),
      ],
      // 阶段 0-2 标注
      ...(stageIndex < 3 ? {
        graphic: [
          {
            type: 'text',
            left: 'center',
            top: 'middle',
            style: {
              text: stageIndex === 0 ? '电容充电中...' : stageIndex === 1 ? '线圈加速中...' : '子弹发射中...',
              fill: '#FFD700',
              fontSize: 14,
              fontWeight: 'bold',
            },
          },
        ],
      } : {}),
    };

    chartInstance.current.setOption(option, true);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); };
  }, [waveformData, stageIndex, waveFilter]);

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  // Resize chart when container size changes
  useEffect(() => {
    if (!chartRef.current || !chartInstance.current) return;
    const observer = new ResizeObserver(() => chartInstance.current?.resize());
    observer.observe(chartRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`bg-[#051020]/80 border-t border-[#00F5FF]/10 p-3 flex flex-col ${className}`}>
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <h3 className="text-xs font-semibold text-white flex items-center gap-2">
          <Waves className="w-3.5 h-3.5 text-[#00F5FF]" />
          {stageIndex < 3 ? '三波信号 (等待实验)' : '三波信号 — 真实数据'}
        </h3>
        <div className="flex gap-2">
          <Badge className="bg-[#10B981]/20 text-[#10B981] text-[10px] border-[#10B981]/30 px-1.5 py-0">
            入射 {stageIndex >= 3 ? '●' : '○'}
          </Badge>
          <Badge className="bg-[#3B82F6]/20 text-[#3B82F6] text-[10px] border-[#3B82F6]/30 px-1.5 py-0">
            反射 {stageIndex >= 4 ? '●' : '○'}
          </Badge>
          <Badge className="bg-[#EF4444]/20 text-[#EF4444] text-[10px] border-[#EF4444]/30 px-1.5 py-0">
            透射 {stageIndex >= 4 ? '●' : '○'}
          </Badge>
        </div>
      </div>
      <div ref={chartRef} className="w-full flex-1 min-h-0" />
    </div>
  );
}
