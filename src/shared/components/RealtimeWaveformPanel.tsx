// src/shared/components/RealtimeWaveformPanel.tsx
// 实时波形面板 — 杆上应变片真实信号 (双极入射杆 + 单极透射杆)
// 数据来源: scripts/buildRealWaveforms.py 从真实 SHPB 实验数据反推
import { useRef, useEffect, useMemo } from 'react';
import * as echarts from 'echarts';
import { Waves } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { pickWaveformByVoltage } from '@/data/realBarWaveforms';
import type { ExperimentStage } from '@/hooks/useExperimentAnimation';

export type WaveFilter = 'all' | 'incident-bar' | 'transmitted-bar';

interface RealtimeWaveformPanelProps {
  currentStage: ExperimentStage;
  stageIndex: number;
  stageProgress: number;
  voltage: number;
  stiffnessK?: number;
  dampingC?: number;
  className?: string;
  showStressStrain?: boolean;
  waveFilter?: WaveFilter;
}

export default function RealtimeWaveformPanel({
  currentStage: _currentStage,
  stageIndex,
  stageProgress,
  voltage,
  stiffnessK: _stiffnessK,
  dampingC: _dampingC,
  className = '',
  showStressStrain: _showStressStrain = false,
  waveFilter = 'all',
}: RealtimeWaveformPanelProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // 按当前电压选档真实波形
  const tierWaveform = useMemo(() => pickWaveformByVoltage(voltage), [voltage]);

  // 渐进绘制 — 5 阶段流程:
  //   0-2: 试样变换/围压/充电 — 无波形
  //   3:   strikerLaunch    — 在阶段子进度内渐进绘制
  //   4+:  dataCollect      — 全部完整
  const waveformData = useMemo(() => {
    const incTotal = tierWaveform.incidentBar.length;
    const traTotal = tierWaveform.transmittedBar.length;

    let incCount = 0;
    let traCount = 0;
    if (stageIndex >= 4) {
      incCount = incTotal;
      traCount = traTotal;
    } else if (stageIndex === 3) {
      // 入射杆: 0-100% 子进度内渐进绘完 (双极含反射,需要全程展示)
      incCount = Math.floor(incTotal * Math.min(1, stageProgress));
      // 透射杆: 30%-100% 子进度内渐进 (波到达透射应变片晚于入射)
      if (stageProgress > 0.3) {
        const sub = Math.min(1, (stageProgress - 0.3) / 0.7);
        traCount = Math.floor(traTotal * sub);
      }
    }
    return {
      incidentBar: tierWaveform.incidentBar.slice(0, incCount),
      transmittedBar: tierWaveform.transmittedBar.slice(0, traCount),
    };
  }, [tierWaveform, stageIndex, stageProgress]);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const showInc = waveFilter === 'all' || waveFilter === 'incident-bar';
    const showTra = waveFilter === 'all' || waveFilter === 'transmitted-bar';

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
        valueFormatter: (v) => `${typeof v === 'number' ? v.toFixed(1) : v} μϵ`,
      },
      legend: {
        data: [
          ...(showInc ? ['入射杆'] : []),
          ...(showTra && stageIndex >= 3 ? ['透射杆'] : []),
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
        name: '应变 (μϵ)',
        nameTextStyle: { color: 'rgba(255,255,255,0.5)', fontSize: 9 },
      },
      dataZoom: [
        { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
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
        // 入射杆 — 红色双极 (先负后正)
        ...(showInc ? [{
          name: '入射杆',
          type: 'line' as const,
          data: waveformData.incidentBar,
          smooth: false,
          lineStyle: { color: '#EF4444', width: 1.8, shadowColor: 'rgba(239,68,68,0.5)', shadowBlur: 4 },
          itemStyle: { color: '#EF4444' },
          showSymbol: false,
          z: 3,
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: 'rgba(255,255,255,0.18)', type: 'dashed' as const },
            data: [{ yAxis: 0 }],
          },
        }] : []),
        // 透射杆 — 灰蓝单极负向
        ...(showTra && stageIndex >= 3 ? [{
          name: '透射杆',
          type: 'line' as const,
          data: waveformData.transmittedBar,
          smooth: false,
          lineStyle: { color: '#94A3B8', width: 1.8, shadowColor: 'rgba(148,163,184,0.4)', shadowBlur: 3 },
          itemStyle: { color: '#94A3B8' },
          showSymbol: false,
          z: 2,
        }] : []),
      ],
      // 阶段 0-2 (试样变换/围压/充电) 标注
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
          {stageIndex < 3 ? '杆上应变片信号 (等待实验)' : '杆上应变片信号 (实验数据)'}
        </h3>
        <div className="flex items-center gap-2">
          <Badge className="bg-[#EF4444]/20 text-[#EF4444] text-[10px] border-[#EF4444]/30 px-1.5 py-0">
            入射杆 {stageIndex >= 3 ? '●' : '○'}
          </Badge>
          <Badge className="bg-[#94A3B8]/20 text-[#CBD5E1] text-[10px] border-[#94A3B8]/30 px-1.5 py-0">
            透射杆 {stageIndex >= 3 ? '●' : '○'}
          </Badge>
        </div>
      </div>
      <div ref={chartRef} className="w-full flex-1 min-h-0" />
    </div>
  );
}
