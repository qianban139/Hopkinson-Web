import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface GaugeMonitorProps {
  value: number;
  min: number;
  max: number;
  title: string;
  unit: string;
  warningThreshold?: number;
  dangerThreshold?: number;
  size?: 'sm' | 'md' | 'lg';
}

export default function GaugeMonitor({
  value,
  min,
  max,
  title,
  unit,
  warningThreshold,
  dangerThreshold,
  size = 'md',
}: GaugeMonitorProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  const sizeMap = {
    sm: { height: '150px', radius: '75%' },
    md: { height: '200px', radius: '85%' },
    lg: { height: '250px', radius: '95%' },
  };

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = echarts.init(chartRef.current);
    chartInstanceRef.current = chart;

    // 确定颜色
    let color = '#00F5FF';
    if (dangerThreshold && value >= dangerThreshold) {
      color = '#FF2E63';
    } else if (warningThreshold && value >= warningThreshold) {
      color = '#FFD700';
    }

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      series: [
        {
          type: 'gauge',
          radius: sizeMap[size].radius,
          center: ['50%', '60%'],
          startAngle: 200,
          endAngle: -20,
          min,
          max,
          splitNumber: 10,
          itemStyle: {
            color,
          },
          progress: {
            show: true,
            width: 18,
          },
          pointer: {
            show: true,
            length: '60%',
            width: 6,
            itemStyle: {
              color,
            },
          },
          axisLine: {
            lineStyle: {
              width: 18,
              color: [
                [1, 'rgba(255,255,255,0.1)'],
              ],
            },
          },
          axisTick: {
            distance: -25,
            splitNumber: 5,
            lineStyle: {
              width: 1,
              color: 'rgba(255,255,255,0.3)',
            },
          },
          splitLine: {
            distance: -30,
            length: 14,
            lineStyle: {
              width: 2,
              color: 'rgba(255,255,255,0.3)',
            },
          },
          axisLabel: {
            distance: -15,
            color: 'rgba(255,255,255,0.7)',
            fontSize: 10,
          },
          anchor: {
            show: true,
            size: 20,
            itemStyle: {
              borderColor: color,
              borderWidth: 2,
            },
          },
          title: {
            show: true,
            offsetCenter: [0, '30%'],
            fontSize: 14,
            color: 'rgba(255,255,255,0.8)',
          },
          detail: {
            valueAnimation: true,
            fontSize: size === 'lg' ? 32 : size === 'md' ? 24 : 18,
            offsetCenter: [0, '-10%'],
            formatter: `{value}${unit}`,
            color: '#fff',
            fontWeight: 'bold',
          },
          data: [
            {
              value,
              name: title,
            },
          ],
        },
      ],
    };

    chart.setOption(option);

    const handleResize = () => {
      chart.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [value, min, max, title, unit, warningThreshold, dangerThreshold, size]);

  return (
    <div
      ref={chartRef}
      style={{ height: sizeMap[size].height }}
      className="w-full"
    />
  );
}
