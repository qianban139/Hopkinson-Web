import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Power, AlertTriangle, History, Download, Activity, Zap,
  Thermometer, Radio, Battery, Bell, Settings2,
  CheckCircle2, XCircle, TrendingUp, Clock, Play, Pause,
  Shield, ShieldCheck, ShieldAlert, Loader2, ArrowRight,
  Cpu, CircleDot
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppStore } from '@/store/useAppStore';
import { useExperimentDataBus } from '@/store/useExperimentDataBus';
import ModuleConnectionBadge from '@/shared/components/ModuleConnectionBadge';
import GlowCard from '@/shared/components/GlowCard';
import * as echarts from 'echarts';
import type { SafetyChecklistItem } from '@/types';

type AlertLevel = 'normal' | 'warning' | 'danger';

// 操作日志条目类型
interface OperationLogEntry {
  id: number;
  timestamp: string;
  event: string;
  level: 'normal' | 'warning' | 'danger';
  message: string;
}

// 历史日志
const historyLogs: OperationLogEntry[] = [
  { id: 1, timestamp: '2026-03-17 14:32:15', event: '系统启动', level: 'normal', message: '系统初始化完成' },
  { id: 2, timestamp: '2026-03-17 14:35:20', event: '安全检查', level: 'normal', message: '实验前安全检查通过' },
  { id: 3, timestamp: '2026-03-17 14:36:45', event: '实验开始', level: 'normal', message: '电压: 280V, 电流: 25kA' },
  { id: 4, timestamp: '2026-03-17 14:38:10', event: '实验完成', level: 'normal', message: '数据采集完成' },
  { id: 5, timestamp: '2026-03-17 15:10:30', event: '系统待机', level: 'normal', message: '进入待机模式' },
];

// 设备状态类型
interface DeviceStatus {
  name: string;
  online: boolean;
  lastSeen: string;
}

// 卡片样式常量
const CARD_CLASS = 'bg-[#0F2847]/80 backdrop-blur-sm border border-cyan-500/10 rounded-xl';
const TITLE_CLASS = 'bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent';
const HOVER_CLASS = 'hover:border-cyan-500/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.1)]';

// 容器入场动画变体
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: 'easeOut' },
  }),
};

// 平滑数值过渡
function useSmoothValue(targetValue: number, duration: number = 500) {
  const [displayValue, setDisplayValue] = useState(targetValue);
  const animationRef = useRef<number | null>(null);
  const startValueRef = useRef(targetValue);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    startValueRef.current = displayValue;
    startTimeRef.current = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = startValueRef.current + (targetValue - startValueRef.current) * easeProgress;
      setDisplayValue(currentValue);
      if (progress < 1) animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [targetValue, duration]);

  return displayValue;
}

// ====== 环形仪表盘 ======
function RingGaugeChart({ value, threshold, title, unit, icon, color, decimals = 1 }: {
  value: number; threshold: number; title: string; unit: string;
  icon: React.ReactNode; color: string; decimals?: number;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const percentage = Math.min((value / threshold) * 100, 120);
  const isWarning = percentage >= 80;
  const isDanger = percentage >= 100;
  const ringColor = isDanger ? '#EF4444' : isWarning ? '#F59E0B' : color;

  useEffect(() => {
    if (!chartRef.current) return;
    const { clientWidth, clientHeight } = chartRef.current;
    if (!clientWidth || !clientHeight) return;
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }
    chartInstance.current.setOption({
      backgroundColor: 'transparent',
      series: [
        {
          type: 'gauge',
          startAngle: 225,
          endAngle: -45,
          min: 0,
          max: 100,
          pointer: { show: false },
          progress: {
            show: true,
            overlap: false,
            roundCap: true,
            clip: false,
            width: 10,
            itemStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 1, y2: 0,
                colorStops: [
                  { offset: 0, color: ringColor },
                  { offset: 1, color: isDanger ? '#FF6B6B' : isWarning ? '#FBBF24' : `${color}CC` },
                ],
              },
            },
          },
          axisLine: {
            lineStyle: {
              width: 10,
              color: [[1, 'rgba(255,255,255,0.06)']],
            },
          },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          title: { show: false },
          detail: {
            fontSize: 22,
            fontWeight: 'bold',
            color: '#fff',
            offsetCenter: [0, '0%'],
            formatter: () => `${value.toFixed(decimals)}`,
            valueAnimation: true,
          },
          data: [{ value: Math.min(percentage, 100) }],
        },
      ],
    }, true);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); };
  }, [value, threshold, percentage, ringColor, isDanger, isWarning, color, decimals]);

  useEffect(() => {
    return () => { chartInstance.current?.dispose(); chartInstance.current = null; };
  }, []);

  return (
    <motion.div
      className={`${CARD_CLASS} ${HOVER_CLASS} p-4 text-center transition-all duration-300`}
      variants={cardVariants}
      whileHover={{ scale: 1.02 }}
    >
      <div className="flex items-center justify-center gap-1.5 mb-1">
        {icon}
        <span className={`text-xs font-semibold ${TITLE_CLASS}`}>{title}</span>
      </div>
      <div ref={chartRef} className="w-full h-[130px]" />
      <div className="flex items-center justify-center gap-1 -mt-2">
        <span className="text-xs text-white/50">{unit}</span>
        <span className="text-[10px] text-white/30 ml-1">/ {threshold}{unit} 阈值</span>
      </div>
      <div className="mt-1.5">
        <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: ringColor }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(percentage, 100)}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-white/30">{percentage.toFixed(0)}%</span>
          {isDanger && (
            <Badge className="text-[9px] px-1.5 py-0 bg-red-500/20 text-red-400 animate-pulse">
              <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />超限
            </Badge>
          )}
          {isWarning && !isDanger && (
            <Badge className="text-[9px] px-1.5 py-0 bg-yellow-500/20 text-yellow-400">
              <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />预警
            </Badge>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ====== 旧版半圆仪表盘（保留用于 EMI / 电容） ======
function GaugeChart({ value, min, max, title, unit, warningThreshold, dangerThreshold, decimals = 1 }: {
  value: number; min: number; max: number; title: string; unit: string;
  warningThreshold: number; dangerThreshold: number; decimals?: number;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  let color = '#00F5FF';
  if (value >= dangerThreshold) color = '#EF4444';
  else if (value >= warningThreshold) color = '#F59E0B';

  useEffect(() => {
    if (!chartRef.current) return;
    const { clientWidth: cw, clientHeight: ch } = chartRef.current;
    if (!cw || !ch) return;
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }
    chartInstance.current.setOption({
      backgroundColor: 'transparent',
      series: [{
        type: 'gauge', startAngle: 180, endAngle: 0, min, max, splitNumber: 5,
        itemStyle: { color },
        progress: { show: true, width: 12 },
        pointer: { show: true, width: 4 },
        axisLine: { lineStyle: { width: 12, color: [
          [warningThreshold / max, 'rgba(0,245,255,0.3)'],
          [dangerThreshold / max, 'rgba(245,158,11,0.3)'],
          [1, 'rgba(239,68,68,0.3)']
        ] } },
        axisTick: { show: false },
        splitLine: { length: 8, lineStyle: { width: 2, color: 'rgba(255,255,255,0.3)' } },
        axisLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10, distance: 16 },
        title: { show: false },
        detail: { valueAnimation: true, fontSize: 24, fontWeight: 'bold', color: '#fff', offsetCenter: [0, '30%'], formatter: `{value}${unit}` },
        data: [{ value: Number(value.toFixed(decimals)) }]
      }]
    }, true);
    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); };
  }, [value, min, max, unit, color, warningThreshold, dangerThreshold, decimals]);

  useEffect(() => {
    return () => { chartInstance.current?.dispose(); chartInstance.current = null; };
  }, []);

  return (
    <div className="text-center">
      <div ref={chartRef} className="w-full h-[140px]" />
      <p className="text-sm text-white/70 -mt-4">{title}</p>
      {value >= dangerThreshold && (
        <Badge className="mt-2 bg-red-500/20 text-red-400 animate-pulse"><AlertTriangle className="w-3 h-3 mr-1" />危险</Badge>
      )}
      {value >= warningThreshold && value < dangerThreshold && (
        <Badge className="mt-2 bg-yellow-500/20 text-yellow-400"><AlertTriangle className="w-3 h-3 mr-1" />警告</Badge>
      )}
    </div>
  );
}

// ====== 增强趋势图（30秒滚动窗口 + 异常区域标红） ======
function EnhancedTrendChart({ data, dataKey, color, title, unit, min, max, dangerThreshold, warningThreshold }: {
  data: { time: string; voltage: number; current: number; temp: number }[];
  dataKey: 'voltage' | 'current' | 'temp'; color: string; title: string; unit: string;
  min: number; max: number; dangerThreshold?: number; warningThreshold?: number;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    const { clientWidth, clientHeight } = chartRef.current;
    if (!clientWidth || !clientHeight) return;
    if (!chartInstance.current) chartInstance.current = echarts.init(chartRef.current);

    // 30秒滚动窗口 (2秒间隔 = 15个点)
    const windowData = data.slice(-15);
    const values = windowData.map(d => d[dataKey]);

    // 计算异常区域 (markArea)
    const markAreaData: any[] = [];
    if (dangerThreshold !== undefined) {
      let startIdx: number | null = null;
      for (let i = 0; i < values.length; i++) {
        if (values[i] >= dangerThreshold) {
          if (startIdx === null) startIdx = i;
        } else {
          if (startIdx !== null) {
            markAreaData.push([
              { xAxis: windowData[startIdx].time, itemStyle: { color: 'rgba(239,68,68,0.15)' } },
              { xAxis: windowData[i - 1].time },
            ]);
            startIdx = null;
          }
        }
      }
      if (startIdx !== null) {
        markAreaData.push([
          { xAxis: windowData[startIdx].time, itemStyle: { color: 'rgba(239,68,68,0.15)' } },
          { xAxis: windowData[windowData.length - 1].time },
        ]);
      }
    }

    const markLines: any[] = [];
    if (dangerThreshold !== undefined) {
      markLines.push({
        yAxis: dangerThreshold,
        lineStyle: { color: '#EF4444', type: 'dashed', width: 1 },
        label: { show: true, formatter: '危险', color: '#EF4444', fontSize: 9 },
      });
    }
    if (warningThreshold !== undefined) {
      markLines.push({
        yAxis: warningThreshold,
        lineStyle: { color: '#F59E0B', type: 'dashed', width: 1 },
        label: { show: true, formatter: '警告', color: '#F59E0B', fontSize: 9 },
      });
    }

    chartInstance.current.setOption({
      backgroundColor: 'transparent',
      grid: { left: '15%', right: '5%', top: '18%', bottom: '15%' },
      title: {
        text: `${title} (${unit})`,
        textStyle: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
        left: 'center', top: 0,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15,40,71,0.95)',
        borderColor: 'rgba(6,182,212,0.3)',
        textStyle: { color: '#fff', fontSize: 11 },
      },
      xAxis: {
        type: 'category',
        data: windowData.map(d => d.time),
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } },
        axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9, rotate: 30 },
      },
      yAxis: {
        type: 'value', min, max,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } },
        axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 9 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      series: [{
        type: 'line',
        data: values,
        smooth: true,
        lineStyle: { color, width: 2 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: `${color}40` },
              { offset: 1, color: `${color}05` },
            ],
          },
        },
        showSymbol: false,
        markLine: markLines.length > 0 ? { silent: true, data: markLines } : undefined,
        markArea: markAreaData.length > 0 ? { silent: true, data: markAreaData } : undefined,
      }],
    }, true);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); };
  }, [data, dataKey, color, title, unit, min, max, dangerThreshold, warningThreshold]);

  useEffect(() => { return () => { chartInstance.current?.dispose(); chartInstance.current = null; }; }, []);

  return <div ref={chartRef} className="w-full h-[160px]" />;
}

// ====== 设备状态矩阵组件 ======
function DeviceStatusMatrix({ devices }: { devices: DeviceStatus[] }) {
  return (
    <motion.div
      className={`${CARD_CLASS} p-4 transition-all duration-300`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
    >
      <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${TITLE_CLASS}`}>
        <Cpu className="w-4 h-4 text-cyan-400" />
        设备状态矩阵
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {devices.map((device, idx) => (
          <motion.div
            key={device.name}
            className={`flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/5 ${HOVER_CLASS} transition-all duration-300`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.05, duration: 0.3 }}
          >
            <div className="relative flex-shrink-0">
              <div
                className={`w-2.5 h-2.5 rounded-full ${device.online ? 'bg-emerald-400' : 'bg-red-400'}`}
              />
              {device.online && (
                <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping opacity-40" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-white/80 truncate">{device.name}</div>
              <div className="text-[10px] text-white/30">
                {device.online ? '在线' : '离线'}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ====== 操作日志时间线组件 ======
function OperationLogTimeline({ logs }: { logs: OperationLogEntry[] }) {
  return (
    <motion.div
      className={`${CARD_CLASS} p-4 transition-all duration-300`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-sm font-semibold flex items-center gap-2 ${TITLE_CLASS}`}>
          <History className="w-4 h-4 text-cyan-400" />
          操作日志时间线
        </h3>
        <Button variant="ghost" size="sm" className="text-xs text-white/50 hover:text-white">
          <Download className="w-3 h-3 mr-1" />导出
        </Button>
      </div>
      <div className="space-y-0 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
        {logs.slice(0, 20).map((log, idx) => (
          <motion.div
            key={log.id}
            className="flex gap-3 group"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.03, duration: 0.3 }}
          >
            {/* 时间线 */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={`w-2 h-2 rounded-full mt-2 ${
                log.level === 'danger' ? 'bg-red-400' :
                log.level === 'warning' ? 'bg-yellow-400' :
                'bg-cyan-400'
              }`} />
              {idx < logs.slice(0, 20).length - 1 && (
                <div className="w-px flex-1 bg-white/10 my-1" />
              )}
            </div>
            {/* 内容 */}
            <div className={`flex-1 pb-3 border-b border-white/5 group-last:border-0`}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/80 font-medium">{log.event}</span>
                <span className="text-[10px] text-white/30 font-mono">{log.timestamp}</span>
              </div>
              <p className="text-[11px] text-white/50 mt-0.5">{log.message}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ====== 安全检查清单组件 ======
function SafetyChecklist() {
  const { safetyChecklist, setSafetyChecklist, completeSafetyChecklist, resetSafetyChecklist, safetyChecklistCompleted } = useExperimentDataBus();
  const [isRunning, setIsRunning] = useState(false);

  const runAllChecks = useCallback(async () => {
    setIsRunning(true);
    const items = [...safetyChecklist];

    for (let i = 0; i < items.length; i++) {
      // 设为检查中
      items[i] = { ...items[i], status: 'checking' };
      setSafetyChecklist([...items]);
      // 模拟检查延迟
      await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
      // 模拟检查结果（大部分通过）
      const rand = Math.random();
      const simValues: Record<string, number> = {
        capacitor: 23.5, cooling: 42, 'emi-shield': 38, specimen: 1,
        daq: 100000, emergency: 15, personnel: 1,
      };
      items[i] = {
        ...items[i],
        status: rand > 0.05 ? 'pass' : 'warning',
        currentValue: simValues[items[i].id] || 0,
      };
      setSafetyChecklist([...items]);
    }

    // 判断是否全部通过
    const allPassed = items.every(it => it.status === 'pass' || it.status === 'warning');
    if (allPassed) completeSafetyChecklist();
    setIsRunning(false);
  }, [safetyChecklist, setSafetyChecklist, completeSafetyChecklist]);

  const handleReset = () => {
    resetSafetyChecklist();
  };

  const statusIcon = (status: SafetyChecklistItem['status']) => {
    switch (status) {
      case 'pass': return <CheckCircle2 className="w-5 h-5 text-[#10B981]" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />;
      case 'fail': return <XCircle className="w-5 h-5 text-[#EF4444]" />;
      case 'checking': return <Loader2 className="w-5 h-5 text-[#00F5FF] animate-spin" />;
      default: return <div className="w-5 h-5 rounded-full border-2 border-white/20" />;
    }
  };

  return (
    <GlowCard glowColor={safetyChecklistCompleted ? '#10B981' : '#F59E0B'} pulse={isRunning} hoverable={false} className="p-0">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {safetyChecklistCompleted ? (
              <ShieldCheck className="w-5 h-5 text-[#10B981]" />
            ) : (
              <Shield className="w-5 h-5 text-[#F59E0B]" />
            )}
            <h3 className="text-sm font-semibold text-white">实验前安全检查</h3>
          </div>
          <div className="flex items-center gap-2">
            {safetyChecklistCompleted && (
              <Badge className="bg-[#10B981]/20 text-[#10B981] border-[#10B981]/30">全部通过</Badge>
            )}
          </div>
        </div>
        <p className="text-xs text-white/50 mt-1">每次实验前必须完成以下安全检查项</p>
      </div>

      <div className="p-4 space-y-2">
        {safetyChecklist.map((item) => (
          <motion.div
            key={item.id}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
              item.status === 'pass' ? 'border-[#10B981]/30 bg-[#10B981]/5' :
              item.status === 'warning' ? 'border-[#F59E0B]/30 bg-[#F59E0B]/5' :
              item.status === 'fail' ? 'border-[#EF4444]/30 bg-[#EF4444]/5' :
              item.status === 'checking' ? 'border-[#00F5FF]/30 bg-[#00F5FF]/5' :
              'border-white/10 bg-white/5'
            }`}
            layout
          >
            {statusIcon(item.status)}
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white font-medium">{item.name}</div>
              <div className="text-xs text-white/50">{item.description}</div>
            </div>
            {item.currentValue !== undefined && item.status !== 'pending' && item.status !== 'checking' && (
              <div className="text-xs font-mono text-white/60">
                {item.currentValue}{item.unit || ''}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <div className="p-4 border-t border-white/10 flex gap-2">
        <Button
          data-ai-target="monitor-safetyCheck"
          onClick={runAllChecks}
          disabled={isRunning || safetyChecklistCompleted}
          className="flex-1 bg-[#00F5FF] text-[#0A2540] hover:bg-[#00F5FF]/90 disabled:opacity-50"
        >
          {isRunning ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />检查中...</>
          ) : safetyChecklistCompleted ? (
            <><ShieldCheck className="w-4 h-4 mr-2" />检查已完成</>
          ) : (
            <><Shield className="w-4 h-4 mr-2" />执行安全检查</>
          )}
        </Button>
        <Button
          onClick={handleReset}
          variant="outline"
          className="border-white/20 text-white/70 hover:bg-white/10"
        >
          重置
        </Button>
      </div>
    </GlowCard>
  );
}

// ====== 主页面 ======
export default function SystemMonitor() {
  const setMonitorData = useAppStore(s => s.setMonitorData);
  const safetyChecklistCompleted = useExperimentDataBus(s => s.safetyChecklistCompleted);

  const [isMonitoring, setIsMonitoring] = useState(true);
  const [targetValues, setTargetValues] = useState({ voltage: 2000, current: 25000, capacitance: 85, temperature: 45, emi: 72 });
  const [trendData, setTrendData] = useState<{ time: string; voltage: number; current: number; temp: number }[]>([]);
  const [alerts, setAlerts] = useState<{ id: number; message: string; level: AlertLevel; time: string }[]>([]);
  const [alertRules, setAlertRules] = useState({
    voltageWarning: 3500, voltageDanger: 3800,
    capacitanceLow: 25,
    tempWarning: 75, tempDanger: 88,
    emiWarning: 82, emiDanger: 92,
  });

  // AI 自定义阈值
  const [aiThresholds, setAiThresholds] = useState({
    voltage: 4000,
    current: 50000,
    temperature: 90,
    energy: 95,
  });

  // 操作日志 (动态)
  const [operationLogs, setOperationLogs] = useState<OperationLogEntry[]>([...historyLogs]);

  // 设备状态矩阵
  const [deviceStatuses, setDeviceStatuses] = useState<DeviceStatus[]>([
    { name: '电容器组', online: true, lastSeen: new Date().toLocaleTimeString('zh-CN') },
    { name: '电磁线圈', online: true, lastSeen: new Date().toLocaleTimeString('zh-CN') },
    { name: '应变片 #1', online: true, lastSeen: new Date().toLocaleTimeString('zh-CN') },
    { name: '应变片 #2', online: true, lastSeen: new Date().toLocaleTimeString('zh-CN') },
    { name: '应变片 #3', online: true, lastSeen: new Date().toLocaleTimeString('zh-CN') },
    { name: '应变片 #4', online: false, lastSeen: '14:32:10' },
    { name: 'DAQ系统', online: true, lastSeen: new Date().toLocaleTimeString('zh-CN') },
    { name: '冷却系统', online: true, lastSeen: new Date().toLocaleTimeString('zh-CN') },
    { name: '安全联锁', online: true, lastSeen: new Date().toLocaleTimeString('zh-CN') },
  ]);

  // 平滑显示值
  const displayVoltage = useSmoothValue(targetValues.voltage, 800);
  const displayCurrent = useSmoothValue(targetValues.current, 800);
  const displayCapacitance = useSmoothValue(targetValues.capacitance, 800);
  const displayTemperature = useSmoothValue(targetValues.temperature, 800);
  const displayEmi = useSmoothValue(targetValues.emi, 800);

  const generateStableValue = useCallback((current: number, base: number, variance: number) => {
    const time = Date.now() / 1000;
    const sineComponent = Math.sin(time * 0.5) * variance * 0.3;
    const randomComponent = (Math.random() - 0.5) * variance * 0.4;
    const newValue = base + sineComponent + randomComponent;
    const maxChange = variance * 0.2;
    return Math.max(base - variance, Math.min(base + variance,
      current + Math.max(-maxChange, Math.min(maxChange, newValue - current))
    ));
  }, []);

  // ====== AI 事件监听: ai-set-alert ======
  useEffect(() => {
    const handleAiSetAlert = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        type: 'voltage' | 'current' | 'temperature' | 'energy';
        threshold: number;
      };
      if (!detail || !detail.type || typeof detail.threshold !== 'number') return;

      setAiThresholds(prev => ({ ...prev, [detail.type]: detail.threshold }));

      // 同步到 alertRules（映射关系）
      switch (detail.type) {
        case 'voltage':
          setAlertRules(r => ({
            ...r,
            voltageWarning: detail.threshold * 0.85,
            voltageDanger: detail.threshold,
          }));
          break;
        case 'temperature':
          setAlertRules(r => ({
            ...r,
            tempWarning: detail.threshold * 0.85,
            tempDanger: detail.threshold,
          }));
          break;
      }

      // 记录操作日志
      const now = new Date();
      const timestamp = `${now.toLocaleDateString('zh-CN').replace(/\//g, '-')} ${now.toLocaleTimeString('zh-CN', { hour12: false })}`;
      setOperationLogs(prev => [{
        id: Date.now(),
        timestamp,
        event: 'AI设定阈值',
        level: 'normal',
        message: `${detail.type} 阈值设为 ${detail.threshold}`,
      }, ...prev].slice(0, 20));
    };

    window.addEventListener('ai-set-alert', handleAiSetAlert);
    return () => window.removeEventListener('ai-set-alert', handleAiSetAlert);
  }, []);

  // ====== AI 事件监听: 详细告警规则 ======
  useEffect(() => {
    const handleSetAlertRule = (e: Event) => {
      const { rule, value } = (e as CustomEvent).detail as { rule: string; value: number };
      if (!rule || typeof value !== 'number') return;
      setAlertRules(prev => ({ ...prev, [rule]: value }));
      const now = new Date();
      const timestamp = `${now.toLocaleDateString('zh-CN').replace(/\//g, '-')} ${now.toLocaleTimeString('zh-CN', { hour12: false })}`;
      setOperationLogs(prev => [{ id: Date.now(), timestamp, event: 'AI设定告警规则', level: 'normal' as const, message: `${rule} 设为 ${value}` }, ...prev].slice(0, 20));
    };
    const handleToggleMonitoring = (e: Event) => {
      const enabled = (e as CustomEvent).detail;
      setIsMonitoring(enabled !== false);
    };
    const handleEmergency = () => {
      handleEmergencyStop();
    };
    window.addEventListener('ai-set-alert-rule', handleSetAlertRule);
    window.addEventListener('ai-toggle-monitoring', handleToggleMonitoring);
    window.addEventListener('ai-emergency-stop', handleEmergency);
    return () => {
      window.removeEventListener('ai-set-alert-rule', handleSetAlertRule);
      window.removeEventListener('ai-toggle-monitoring', handleToggleMonitoring);
      window.removeEventListener('ai-emergency-stop', handleEmergency);
    };
  }, []);

  // 数据生成
  useEffect(() => {
    if (!isMonitoring) return;
    const interval = setInterval(() => {
      setTargetValues(prev => ({
        voltage: generateStableValue(prev.voltage, 2000, 150),
        current: generateStableValue(prev.current, 25000, 3000),
        capacitance: generateStableValue(prev.capacitance, 85, 8),
        temperature: generateStableValue(prev.temperature, 45, 12),
        emi: generateStableValue(prev.emi, 72, 10)
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, [isMonitoring, generateStableValue]);

  // 趋势数据收集 (30秒滚动窗口)
  useEffect(() => {
    if (!isMonitoring) return;
    const interval = setInterval(() => {
      setTrendData(prev => {
        const newPoint = {
          time: new Date().toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          voltage: displayVoltage, current: displayCurrent, temp: displayTemperature
        };
        return [...prev, newPoint].slice(-30);
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [isMonitoring, displayVoltage, displayCurrent, displayTemperature]);

  // 设备状态模拟（随机闪烁）
  useEffect(() => {
    if (!isMonitoring) return;
    const interval = setInterval(() => {
      setDeviceStatuses(prev => prev.map(d => {
        // 应变片 #4 偶尔恢复
        if (d.name === '应变片 #4') {
          const online = Math.random() > 0.6;
          return { ...d, online, lastSeen: online ? new Date().toLocaleTimeString('zh-CN') : d.lastSeen };
        }
        return { ...d, lastSeen: d.online ? new Date().toLocaleTimeString('zh-CN') : d.lastSeen };
      }));
    }, 5000);
    return () => clearInterval(interval);
  }, [isMonitoring]);

  // 同步到全局 store
  useEffect(() => {
    setMonitorData({ voltage: displayVoltage, current: displayCurrent, capacitance: displayCapacitance, temperature: displayTemperature, emi: displayEmi, timestamp: Date.now() });
  }, [displayVoltage, displayCurrent, displayCapacitance, displayTemperature, displayEmi, setMonitorData]);

  // 检测预警
  useEffect(() => {
    const newAlerts: { id: number; message: string; level: AlertLevel; time: string }[] = [];
    const now = new Date().toLocaleTimeString('zh-CN');
    if (displayVoltage > alertRules.voltageDanger)
      newAlerts.push({ id: Date.now(), message: `电压过高: ${displayVoltage.toFixed(1)}V`, level: 'danger', time: now });
    else if (displayVoltage > alertRules.voltageWarning)
      newAlerts.push({ id: Date.now() + 1, message: `电压警告: ${displayVoltage.toFixed(1)}V`, level: 'warning', time: now });
    if (displayCapacitance < alertRules.capacitanceLow)
      newAlerts.push({ id: Date.now() + 2, message: `电容储能不足: ${displayCapacitance.toFixed(1)}%`, level: 'warning', time: now });
    if (displayTemperature > alertRules.tempDanger)
      newAlerts.push({ id: Date.now() + 3, message: `温度过高: ${displayTemperature.toFixed(1)}°C`, level: 'danger', time: now });
    else if (displayTemperature > alertRules.tempWarning)
      newAlerts.push({ id: Date.now() + 4, message: `温度警告: ${displayTemperature.toFixed(1)}°C`, level: 'warning', time: now });
    if (displayEmi > alertRules.emiDanger)
      newAlerts.push({ id: Date.now() + 5, message: `EMI过高: ${displayEmi.toFixed(1)}dB`, level: 'danger', time: now });
    else if (displayEmi > alertRules.emiWarning)
      newAlerts.push({ id: Date.now() + 6, message: `EMI警告: ${displayEmi.toFixed(1)}dB`, level: 'warning', time: now });
    if (newAlerts.length > 0) setAlerts(prev => [...newAlerts, ...prev].slice(0, 20));
  }, [displayVoltage, displayCurrent, displayCapacitance, displayTemperature, displayEmi, alertRules]);

  const handleEmergencyStop = () => {
    setIsMonitoring(false);
    setTargetValues({ voltage: 0, current: 0, capacitance: 0, temperature: 25, emi: 30 });
    const now = new Date();
    const timestamp = `${now.toLocaleDateString('zh-CN').replace(/\//g, '-')} ${now.toLocaleTimeString('zh-CN', { hour12: false })}`;
    setAlerts(prev => [{ id: Date.now(), message: '紧急停止已触发！所有系统已断电', level: 'danger', time: now.toLocaleTimeString('zh-CN') }, ...prev].slice(0, 20));
    setOperationLogs(prev => [{
      id: Date.now(),
      timestamp,
      event: '紧急停止',
      level: 'danger',
      message: '紧急停止已触发，所有系统已断电',
    }, ...prev].slice(0, 20));
  };

  // 系统状态面板
  const systemStatuses = [
    { name: '放电回路', status: displayVoltage > 0 ? 'connected' : 'disconnected', color: displayVoltage > 0 ? '#10B981' : '#EF4444' },
    { name: '温控系统', status: displayTemperature < alertRules.tempWarning ? 'normal' : displayTemperature < alertRules.tempDanger ? 'warning' : 'danger', color: displayTemperature < alertRules.tempWarning ? '#10B981' : displayTemperature < alertRules.tempDanger ? '#F59E0B' : '#EF4444' },
    { name: 'EMI屏蔽', status: displayEmi < alertRules.emiWarning ? 'effective' : 'degraded', color: displayEmi < alertRules.emiWarning ? '#10B981' : '#F59E0B' },
    { name: '电容储能', status: displayCapacitance > alertRules.capacitanceLow ? 'sufficient' : 'low', color: displayCapacitance > alertRules.capacitanceLow ? '#10B981' : '#F59E0B' },
  ];

  return (
    <div className="min-h-screen pt-24">
      {/* 模块连接指示 */}
      <div className="h-8 bg-[#051020] border-b border-[#00F5FF]/10 flex items-center px-4">
        <ModuleConnectionBadge
          dataTo={[{ module: '虚拟实验室', path: '/lab', hasData: safetyChecklistCompleted }]}
          dataFrom={[
            { module: '虚拟实验室', path: '/lab' },
            { module: '多场耦合', path: '/multifield' },
          ]}
        />
      </div>

      <div className="h-[calc(100vh-128px)] flex">
        {/* 左侧: 安全检查 + 预警中心 */}
        <motion.div
          initial={{ x: -320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="w-[340px] bg-[#051020] border-r border-[#00F5FF]/20 flex flex-col overflow-y-auto"
        >
          <Tabs defaultValue="safety" className="flex-1 flex flex-col">
            <TabsList className="w-full bg-[#0A2540] rounded-none border-b border-[#00F5FF]/10">
              <TabsTrigger value="safety" className="flex-1 data-[state=active]:bg-[#00F5FF]/20">
                <Shield className="w-4 h-4 mr-1" />安全检查
              </TabsTrigger>
              <TabsTrigger value="alerts" className="flex-1 data-[state=active]:bg-[#00F5FF]/20">
                <Bell className="w-4 h-4 mr-1" />预警
                {alerts.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-500/30 text-red-400 rounded-full">{alerts.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="rules" className="flex-1 data-[state=active]:bg-[#00F5FF]/20">
                <Settings2 className="w-4 h-4 mr-1" />阈值
              </TabsTrigger>
            </TabsList>

            <TabsContent value="safety" className="flex-1 overflow-y-auto p-3 mt-0">
              <SafetyChecklist />
            </TabsContent>

            <TabsContent value="alerts" className="flex-1 overflow-y-auto mt-0">
              <div className="p-3 space-y-2">
                <AnimatePresence>
                  {alerts.map((alert) => (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      className={`p-3 rounded-lg border ${
                        alert.level === 'danger' ? 'border-red-500/30 bg-red-500/10' :
                        alert.level === 'warning' ? 'border-yellow-500/30 bg-yellow-500/10' :
                        'border-green-500/30 bg-green-500/10'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {alert.level === 'danger' ? <XCircle className="w-4 h-4 text-red-400 mt-0.5" /> :
                         alert.level === 'warning' ? <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5" /> :
                         <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white">{alert.message}</p>
                          <p className="text-[10px] text-white/40 mt-1">{alert.time}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {alerts.length === 0 && (
                  <div className="text-center text-white/30 py-8">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">暂无预警</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="rules" className="flex-1 overflow-y-auto p-4 space-y-4 mt-0">
              <div className="space-y-3">
                <h4 className="text-xs text-[#00F5FF] font-medium">电压阈值</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">警告</span>
                    <span className="text-yellow-400 font-mono">{alertRules.voltageWarning}V</span>
                  </div>
                  <Slider value={[alertRules.voltageWarning]} onValueChange={([v]) => setAlertRules(r => ({ ...r, voltageWarning: v }))} min={2500} max={4000} step={50} />
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">危险</span>
                    <span className="text-red-400 font-mono">{alertRules.voltageDanger}V</span>
                  </div>
                  <Slider value={[alertRules.voltageDanger]} onValueChange={([v]) => setAlertRules(r => ({ ...r, voltageDanger: v }))} min={3000} max={4500} step={50} />
                </div>

                <h4 className="text-xs text-[#00F5FF] font-medium mt-4">温度阈值</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">警告</span>
                    <span className="text-yellow-400 font-mono">{alertRules.tempWarning}°C</span>
                  </div>
                  <Slider value={[alertRules.tempWarning]} onValueChange={([v]) => setAlertRules(r => ({ ...r, tempWarning: v }))} min={50} max={100} step={5} />
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">危险</span>
                    <span className="text-red-400 font-mono">{alertRules.tempDanger}°C</span>
                  </div>
                  <Slider value={[alertRules.tempDanger]} onValueChange={([v]) => setAlertRules(r => ({ ...r, tempDanger: v }))} min={60} max={120} step={5} />
                </div>

                <h4 className="text-xs text-[#00F5FF] font-medium mt-4">EMI阈值</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">警告</span>
                    <span className="text-yellow-400 font-mono">{alertRules.emiWarning}dB</span>
                  </div>
                  <Slider value={[alertRules.emiWarning]} onValueChange={([v]) => setAlertRules(r => ({ ...r, emiWarning: v }))} min={60} max={100} step={5} />
                </div>

                <h4 className="text-xs text-[#00F5FF] font-medium mt-4">电容低电量</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">低电量警告</span>
                    <span className="text-yellow-400 font-mono">{alertRules.capacitanceLow}%</span>
                  </div>
                  <Slider value={[alertRules.capacitanceLow]} onValueChange={([v]) => setAlertRules(r => ({ ...r, capacitanceLow: v }))} min={10} max={50} step={5} />
                </div>

                {/* AI 阈值显示 */}
                <div className="mt-4 pt-3 border-t border-cyan-500/10">
                  <h4 className={`text-xs font-medium mb-2 ${TITLE_CLASS}`}>AI 安全阈值</h4>
                  <div className="space-y-1.5">
                    {Object.entries(aiThresholds).map(([key, val]) => (
                      <div key={key} className="flex justify-between text-[11px]">
                        <span className="text-white/40">{key === 'voltage' ? '电压' : key === 'current' ? '电流' : key === 'temperature' ? '温度' : '储能'}</span>
                        <span className="text-cyan-400 font-mono">{val}{key === 'voltage' ? 'V' : key === 'current' ? 'A' : key === 'temperature' ? '°C' : '%'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* 主监控区域 */}
        <div className="flex-1 flex flex-col overflow-y-auto bg-gradient-to-b from-[#0A2540] to-[#051020]">
          {/* 顶部控制栏 */}
          <div className="h-14 bg-[#051020] border-b border-[#00F5FF]/10 flex items-center justify-between px-6 flex-shrink-0">
            <div className="flex items-center gap-4">
              <h2 className={`text-lg font-semibold flex items-center gap-2 ${TITLE_CLASS}`}>
                <Activity className="w-5 h-5 text-cyan-400" />
                系统监控
              </h2>
              <Badge className={`${isMonitoring ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-white/10 text-white/50'}`}>
                {isMonitoring ? '● 监控中' : '○ 已暂停'}
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setIsMonitoring(!isMonitoring)}
                variant="outline"
                className={`border-white/20 text-white/70 ${HOVER_CLASS}`}
              >
                {isMonitoring ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                {isMonitoring ? '暂停' : '恢复'}
              </Button>
              <Button data-ai-target="monitor-emergencyStop" onClick={handleEmergencyStop} className="bg-red-600 hover:bg-red-700 text-white">
                <Power className="w-4 h-4 mr-1" />紧急停止
              </Button>
            </div>
          </div>

          <div className="flex-1 p-6 space-y-6">
            {/* 环形仪表盘 - 4个核心指标 */}
            <motion.div
              className="grid grid-cols-4 gap-4"
              initial="hidden"
              animate="visible"
            >
              <motion.div custom={0} variants={cardVariants}>
                <RingGaugeChart
                  value={displayVoltage}
                  threshold={aiThresholds.voltage}
                  title="电压"
                  unit="V"
                  icon={<Zap className="w-3.5 h-3.5 text-cyan-400" />}
                  color="#06B6D4"
                />
              </motion.div>
              <motion.div custom={1} variants={cardVariants}>
                <RingGaugeChart
                  value={displayCurrent / 1000}
                  threshold={aiThresholds.current / 1000}
                  title="电流"
                  unit="kA"
                  icon={<Activity className="w-3.5 h-3.5 text-blue-400" />}
                  color="#3B82F6"
                />
              </motion.div>
              <motion.div custom={2} variants={cardVariants}>
                <RingGaugeChart
                  value={displayTemperature}
                  threshold={aiThresholds.temperature}
                  title="温度"
                  unit="°C"
                  icon={<Thermometer className="w-3.5 h-3.5 text-purple-400" />}
                  color="#A855F7"
                />
              </motion.div>
              <motion.div custom={3} variants={cardVariants}>
                <RingGaugeChart
                  value={displayCapacitance}
                  threshold={aiThresholds.energy}
                  title="储能"
                  unit="%"
                  icon={<Battery className="w-3.5 h-3.5 text-emerald-400" />}
                  color="#10B981"
                  decimals={0}
                />
              </motion.div>
            </motion.div>

            {/* 辅助仪表 (EMI) */}
            <motion.div
              className="grid grid-cols-5 gap-4"
              initial="hidden"
              animate="visible"
            >
              <motion.div custom={4} variants={cardVariants} className={`${CARD_CLASS} p-3`}>
                <GaugeChart value={displayEmi} min={0} max={120} title="EMI强度" unit="dB" warningThreshold={alertRules.emiWarning} dangerThreshold={alertRules.emiDanger} />
              </motion.div>

              {/* 系统状态快速面板 */}
              <motion.div custom={5} variants={cardVariants} className={`col-span-4 ${CARD_CLASS} p-4`}>
                <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${TITLE_CLASS}`}>
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                  子系统状态
                </h3>
                <div className="grid grid-cols-4 gap-2">
                  {systemStatuses.map((s, idx) => (
                    <motion.div
                      key={s.name}
                      className={`flex items-center justify-between p-2.5 rounded-lg bg-white/[0.03] border border-white/5 ${HOVER_CLASS} transition-all duration-300`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <span className="text-xs text-white/70">{s.name}</span>
                      <Badge style={{ backgroundColor: `${s.color}20`, color: s.color, borderColor: `${s.color}50` }} className="text-[10px]">
                        {s.status === 'connected' ? '已连接' : s.status === 'disconnected' ? '已断开' :
                         s.status === 'normal' ? '正常' : s.status === 'warning' ? '警告' :
                         s.status === 'danger' ? '危险' : s.status === 'effective' ? '有效' :
                         s.status === 'degraded' ? '衰减' : s.status === 'sufficient' ? '充足' : '不足'}
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </motion.div>

            {/* 增强趋势图 (30秒滚动窗口 + 异常标红) */}
            <motion.div
              className="grid grid-cols-3 gap-4"
              initial="hidden"
              animate="visible"
            >
              <motion.div custom={6} variants={cardVariants} className={`${CARD_CLASS} p-3 ${HOVER_CLASS} transition-all duration-300`}>
                <EnhancedTrendChart
                  data={trendData} dataKey="voltage" color="#06B6D4" title="电压趋势" unit="V"
                  min={1700} max={2300}
                  dangerThreshold={alertRules.voltageDanger}
                  warningThreshold={alertRules.voltageWarning}
                />
              </motion.div>
              <motion.div custom={7} variants={cardVariants} className={`${CARD_CLASS} p-3 ${HOVER_CLASS} transition-all duration-300`}>
                <EnhancedTrendChart
                  data={trendData} dataKey="current" color="#3B82F6" title="电流趋势" unit="A"
                  min={18000} max={32000}
                  dangerThreshold={55000}
                  warningThreshold={45000}
                />
              </motion.div>
              <motion.div custom={8} variants={cardVariants} className={`${CARD_CLASS} p-3 ${HOVER_CLASS} transition-all duration-300`}>
                <EnhancedTrendChart
                  data={trendData} dataKey="temp" color="#A855F7" title="温度趋势" unit="°C"
                  min={25} max={70}
                  dangerThreshold={alertRules.tempDanger}
                  warningThreshold={alertRules.tempWarning}
                />
              </motion.div>
            </motion.div>

            {/* 设备状态矩阵 + 操作日志时间线 */}
            <div className="grid grid-cols-2 gap-4">
              <DeviceStatusMatrix devices={deviceStatuses} />
              <OperationLogTimeline logs={operationLogs} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
