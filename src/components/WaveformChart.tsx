import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface WaveformChartProps {
  title?: string;
  height?: string;
  showLegend?: boolean;
}

export default function WaveformChart({
  title = '波形预览',
  height = '300px',
  showLegend = true,
}: WaveformChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // 初始化图表
    const chart = echarts.init(chartRef.current);
    chartInstanceRef.current = chart;

    // 生成默认波形数据
    const generateWaveform = (type: string, offset: number = 0) => {
      const points: [number, number][] = [];
      for (let t = 0; t <= 1200; t += 10) {
        let y = 0;
        const normalizedT = (t - 200) / 800;
        
        if (t < 200 || t > 1000) {
          y = 0;
        } else {
          switch (type) {
            case 'target':
              // 梯形波
              if (normalizedT < 0.2) y = normalizedT / 0.2;
              else if (normalizedT < 0.8) y = 1;
              else y = (1 - normalizedT) / 0.2;
              break;
            case 'generated':
              // 带噪声的梯形波
              if (normalizedT < 0.2) y = normalizedT / 0.2;
              else if (normalizedT < 0.8) y = 1;
              else y = (1 - normalizedT) / 0.2;
              y += (Math.random() - 0.5) * 0.1;
              break;
            case 'optimized':
              // 优化后的波形
              if (normalizedT < 0.15) y = normalizedT / 0.15;
              else if (normalizedT < 0.85) y = 1;
              else y = (1 - normalizedT) / 0.15;
              y += Math.sin(normalizedT * Math.PI * 4) * 0.02;
              break;
            case 'measured':
              // 实测波形
              if (normalizedT < 0.2) y = normalizedT / 0.2;
              else if (normalizedT < 0.8) y = 1;
              else y = (1 - normalizedT) / 0.2;
              y += (Math.random() - 0.5) * 0.15;
              break;
            default:
              y = 0;
          }
        }
        points.push([t, y * (1 - offset * 0.1)]);
      }
      return points;
    };

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      title: {
        text: title,
        left: 'center',
        textStyle: {
          color: '#fff',
          fontSize: 14,
          fontWeight: 'normal',
        },
      },
      grid: {
        left: '10%',
        right: '5%',
        top: '15%',
        bottom: '15%',
      },
      xAxis: {
        type: 'value',
        name: '时间 (μs)',
        nameLocation: 'middle',
        nameGap: 25,
        min: 0,
        max: 1200,
        axisLine: {
          lineStyle: { color: 'rgba(255,255,255,0.3)' },
        },
        axisLabel: {
          color: 'rgba(255,255,255,0.7)',
        },
        splitLine: {
          lineStyle: { color: 'rgba(255,255,255,0.1)' },
        },
      },
      yAxis: {
        type: 'value',
        name: '幅值',
        nameLocation: 'middle',
        nameGap: 35,
        min: 0,
        max: 1.2,
        axisLine: {
          lineStyle: { color: 'rgba(255,255,255,0.3)' },
        },
        axisLabel: {
          color: 'rgba(255,255,255,0.7)',
        },
        splitLine: {
          lineStyle: { color: 'rgba(255,255,255,0.1)' },
        },
      },
      legend: showLegend
        ? {
            data: ['目标波形', '生成波形', '优化波形', '实测波形'],
            bottom: 0,
            textStyle: {
              color: 'rgba(255,255,255,0.7)',
            },
          }
        : undefined,
      series: [
        {
          name: '目标波形',
          type: 'line',
          data: generateWaveform('target'),
          smooth: true,
          symbol: 'none',
          lineStyle: {
            color: '#00F5FF',
            width: 2,
          },
        },
        {
          name: '生成波形',
          type: 'line',
          data: generateWaveform('generated', 1),
          smooth: true,
          symbol: 'none',
          lineStyle: {
            color: '#FFD700',
            width: 2,
          },
        },
        {
          name: '优化波形',
          type: 'line',
          data: generateWaveform('optimized', 2),
          smooth: true,
          symbol: 'none',
          lineStyle: {
            color: '#00FF88',
            width: 2,
          },
        },
        {
          name: '实测波形',
          type: 'line',
          data: generateWaveform('measured', 3),
          smooth: true,
          symbol: 'none',
          lineStyle: {
            color: '#FF6B6B',
            width: 2,
          },
        },
      ],
      animation: true,
      animationDuration: 1000,
    };

    chart.setOption(option);

    // 响应式
    const handleResize = () => {
      chart.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [title, showLegend]);

  return (
    <div
      ref={chartRef}
      style={{ height }}
      className="w-full rounded-lg overflow-hidden"
    />
  );
}
