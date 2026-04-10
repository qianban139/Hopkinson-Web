// src/shared/components/RealtimeWaveformPanel.tsx
// 实时波形面板 - 基于真实SHPB三波数据的渐进绘制
// 使用从数据处理111.xlsx提取的真实入射/反射/透射波形
import { useRef, useEffect, useMemo, useState } from 'react';
import * as echarts from 'echarts';
import { Waves, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  incidentWaveData,
  reflectedWaveData,
  transmittedWaveData,
  incidentWaveDataRaw,
  reflectedWaveDataRaw,
  transmittedWaveDataRaw,
  stressStrainData,
  waveformMeta,
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

  // 是否显示原始(未优化)信号 — 用于演示 AI 算法降噪/弥散校正效果
  const [showRaw, setShowRaw] = useState(true);

  // 电压缩放因子 — 根据实际电压调整波形幅值
  const voltageScale = voltage / 2000;

  // 根据实验阶段计算可见数据量（渐进绘制）
  // 5 阶段流程:
  //   0: specimenChange    (试样变换) — 无波形
  //   1: confiningPressure (增加围压) — 无波形
  //   2: charging          (电容充电) — 无波形
  //   3: strikerLaunch     (子弹发射) — 入射/反射/透射波在该阶段内渐进绘制
  //   4: dataCollect       (数据采集) — 所有波形完整
  const waveformData = useMemo(() => {
    const totalPoints = incidentWaveData.length;

    let incidentCount = 0;
    let reflectedCount = 0;
    let transmittedCount = 0;

    if (stageIndex >= 4) {
      // dataCollect 阶段 — 全部完整
      incidentCount = totalPoints;
      reflectedCount = totalPoints;
      transmittedCount = totalPoints;
    } else if (stageIndex === 3) {
      // strikerLaunch 阶段 — 波形在 0-100% 的子进度内渐进绘制
      // 入射波: 0-60% 内完成
      // 反射/透射波: 25%-90% 内完成
      incidentCount = Math.floor(totalPoints * Math.min(1, stageProgress / 0.6));
      if (stageProgress > 0.25) {
        const subProg = Math.min(1, (stageProgress - 0.25) / 0.65);
        reflectedCount = Math.floor(totalPoints * subProg);
        transmittedCount = Math.floor(totalPoints * subProg);
      }
    }

    // 处理后(AI优化)信号
    const incident = incidentWaveData.slice(0, incidentCount).map(
      ([t, v]) => [t, v * voltageScale] as [number, number]
    );
    const reflected = reflectedWaveData.slice(0, reflectedCount).map(
      ([t, v]) => [t, v * voltageScale] as [number, number]
    );
    const transmitted = transmittedWaveData.slice(0, transmittedCount).map(
      ([t, v]) => [t, v * voltageScale] as [number, number]
    );
    // 原始(应变片直采)信号 — 含 Pochhammer-Chree 弥散与电子噪声
    const incidentRaw = incidentWaveDataRaw.slice(0, incidentCount).map(
      ([t, v]) => [t, v * voltageScale] as [number, number]
    );
    const reflectedRaw = reflectedWaveDataRaw.slice(0, reflectedCount).map(
      ([t, v]) => [t, v * voltageScale] as [number, number]
    );
    const transmittedRaw = transmittedWaveDataRaw.slice(0, transmittedCount).map(
      ([t, v]) => [t, v * voltageScale] as [number, number]
    );

    return { incident, reflected, transmitted, incidentRaw, reflectedRaw, transmittedRaw };
  }, [stageIndex, stageProgress, voltageScale]);

  // 应力-应变数据（可选显示，预留给后续应力-应变图表）
  const _ssData = useMemo(() => {
    if (!showStressStrain || stageIndex < 3) return null;
    return stressStrainData;
  }, [showStressStrain, stageIndex]);

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
          ...(showRaw ? ['原始信号'] : []),
          '入射波 (AI优化)',
          ...(stageIndex >= 3 ? ['反射波 (AI优化)', '透射波 (AI优化)'] : []),
        ],
        textStyle: { color: 'rgba(255,255,255,0.7)', fontSize: 10 },
        icon: 'roundRect',
        itemWidth: 16,
        itemHeight: 8,
        itemGap: 14,
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
        // ─── 原始信号层（细线、无填充、低透明度，用统一灰色聚合在 legend 单一项里） ───
        ...((showRaw && (waveFilter === 'all' || waveFilter === 'incident')) ? [{
          name: '原始信号',
          type: 'line' as const,
          data: waveformData.incidentRaw,
          smooth: false,
          lineStyle: { color: 'rgba(180,200,220,0.55)', width: 1, type: 'solid' as const },
          itemStyle: { color: 'rgba(180,200,220,0.55)' },
          showSymbol: false,
          z: 1,
          silent: true,
        }] : []),
        ...((showRaw && stageIndex >= 3 && (waveFilter === 'all' || waveFilter === 'reflected')) ? [{
          name: '原始信号',
          type: 'line' as const,
          data: waveformData.reflectedRaw,
          smooth: false,
          lineStyle: { color: 'rgba(180,200,220,0.55)', width: 1, type: 'solid' as const },
          itemStyle: { color: 'rgba(180,200,220,0.55)' },
          showSymbol: false,
          z: 1,
          silent: true,
          legendHoverLink: false,
        }] : []),
        ...((showRaw && stageIndex >= 3 && (waveFilter === 'all' || waveFilter === 'transmitted')) ? [{
          name: '原始信号',
          type: 'line' as const,
          data: waveformData.transmittedRaw,
          smooth: false,
          lineStyle: { color: 'rgba(180,200,220,0.55)', width: 1, type: 'solid' as const },
          itemStyle: { color: 'rgba(180,200,220,0.55)' },
          showSymbol: false,
          z: 1,
          silent: true,
          legendHoverLink: false,
        }] : []),
        // ─── AI 优化后信号层（粗线、彩色、带渐变填充） ───
        ...((waveFilter === 'all' || waveFilter === 'incident') ? [{
          name: '入射波 (AI优化)',
          type: 'line' as const,
          data: waveformData.incident,
          smooth: false,
          lineStyle: { color: '#10B981', width: 2.4, shadowColor: 'rgba(16,185,129,0.6)', shadowBlur: 6 },
          itemStyle: { color: '#10B981' },
          showSymbol: false,
          z: 3,
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
        ...(stageIndex >= 3 && (waveFilter === 'all' || waveFilter === 'reflected') ? [{
          name: '反射波 (AI优化)',
          type: 'line' as const,
          data: waveformData.reflected,
          smooth: false,
          lineStyle: { color: '#3B82F6', width: 2.4, shadowColor: 'rgba(59,130,246,0.6)', shadowBlur: 6 },
          itemStyle: { color: '#3B82F6' },
          showSymbol: false,
          z: 3,
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(59,130,246,0.25)' },
              { offset: 1, color: 'rgba(59,130,246,0.02)' },
            ]),
          },
        }] : []),
        ...(stageIndex >= 3 && (waveFilter === 'all' || waveFilter === 'transmitted') ? [{
          name: '透射波 (AI优化)',
          type: 'line' as const,
          data: waveformData.transmitted,
          smooth: false,
          lineStyle: { color: '#EF4444', width: 2.4, shadowColor: 'rgba(239,68,68,0.6)', shadowBlur: 6 },
          itemStyle: { color: '#EF4444' },
          showSymbol: false,
          z: 3,
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(239,68,68,0.25)' },
              { offset: 1, color: 'rgba(239,68,68,0.02)' },
            ]),
          },
        }] : []),
      ],
      // 阶段 0-1 (围压/充电) 标注
      ...(stageIndex < 3 ? {
        graphic: [
          {
            type: 'text',
            left: 'center',
            top: 'middle',
            style: {
              text: '实验待开始...',
              fill: '#00F5FF',
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
  }, [waveformData, stageIndex, waveFilter, showRaw]);

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
          {stageIndex < 3 ? '三波信号 (等待实验)' : '三波信号 — 原始 vs AI 优化'}
          {stageIndex >= 3 && (
            <span className="flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded bg-gradient-to-r from-[#00F5FF]/20 to-[#A855F7]/20 border border-[#00F5FF]/30">
              <Sparkles className="w-3 h-3 text-[#FFD700]" />
              <span className="text-[9px] text-[#00F5FF] font-mono">
                SNR +{waveformMeta.aiOptimization.snrGainDb}dB
              </span>
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowRaw(v => !v)}
            className={`text-[9px] px-1.5 py-0.5 rounded border font-mono transition-colors ${
              showRaw
                ? 'bg-[#00F5FF]/15 text-[#00F5FF] border-[#00F5FF]/40'
                : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'
            }`}
            title="切换原始信号叠加显示"
          >
            {showRaw ? '● 原始信号' : '○ 原始信号'}
          </button>
          <Badge className="bg-[#10B981]/20 text-[#10B981] text-[10px] border-[#10B981]/30 px-1.5 py-0">
            入射 {stageIndex >= 3 ? '●' : '○'}
          </Badge>
          <Badge className="bg-[#3B82F6]/20 text-[#3B82F6] text-[10px] border-[#3B82F6]/30 px-1.5 py-0">
            反射 {stageIndex >= 3 ? '●' : '○'}
          </Badge>
          <Badge className="bg-[#EF4444]/20 text-[#EF4444] text-[10px] border-[#EF4444]/30 px-1.5 py-0">
            透射 {stageIndex >= 3 ? '●' : '○'}
          </Badge>
        </div>
      </div>
      <div ref={chartRef} className="w-full flex-1 min-h-0" />
    </div>
  );
}
