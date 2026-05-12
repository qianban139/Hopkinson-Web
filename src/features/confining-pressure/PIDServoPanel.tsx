/**
 * PID 闭环伺服调控面板(围压专用)
 *
 * 基于图片《大白话讲 PID 闭环精准伺服调控(围压用)》实现:
 *   - 伺服 = 油缸/电机跟指令
 *   - PID  = 自动纠错(P 当前偏差 + I 累积偏差 + D 偏差变化率)
 *   - 闭环 = 测量—对比—修正
 *
 * 面板功能:
 *   1. Kp/Ki/Kd 三个滑块,实时可调
 *   2. 目标围压、扰动时刻可配置
 *   3. 开环 vs PID 闭环的响应曲线对比(ECharts)
 *   4. 性能指标(超调、稳态误差、调节时间、RMSE)
 *   5. 预设按钮: Ziegler-Nichols 经典整定 / 保守整定 / 激进整定
 */

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import * as echarts from 'echarts';
import { Activity, Cpu, RotateCcw, Zap } from 'lucide-react';
import SliderInputCombo from '@/shared/components/SliderInputCombo';
import { Button } from '@/components/ui/button';
import {
  simulateClosedLoop,
  simulateOpenLoop,
  buildDemoProfile,
  evalResponse,
  DEFAULT_PLANT,
} from '@/services/confiningPressureSimulator';

interface Gains { kp: number; ki: number; kd: number; }

// Audit PID-3: 重新整定后的预设. PID 输出现在直接是归一化伺服开度 [0,1],
// 增益相对旧版 (单位 MPa) 缩小约 1/K = 1/200 倍.
// 物理含义: Kp=0.015 表示误差 50 MPa 时 P 项贡献 0.75 开度 (75%).
const PRESETS: { label: string; gains: Gains; color: string; desc: string }[] = [
  { label: '保守 (Conservative)', gains: { kp: 0.005, ki: 0.008, kd: 0.0003 }, color: '#10B981', desc: '无超调,响应慢' },
  { label: '经典 ZN (Classic)',   gains: { kp: 0.015, ki: 0.025, kd: 0.0008 }, color: '#00F5FF', desc: '响应快,轻微超调' },
  { label: '激进 (Aggressive)',   gains: { kp: 0.030, ki: 0.050, kd: 0.0015 }, color: '#F472B6', desc: '极快,明显超调震荡' },
];

export default function PIDServoPanel({ target = 50 }: { target?: number }) {
  const [kp, setKp] = useState(0.015);
  const [ki, setKi] = useState(0.025);
  const [kd, setKd] = useState(0.0008);
  const [duration] = useState(6);           // 仿真时长 6s
  const [dt] = useState(0.01);              // 10ms 采样
  const [withDisturb, setWithDisturb] = useState(true);

  // 生成设定值
  const profile = useMemo(
    () => buildDemoProfile(duration, dt, target, 0.2, withDisturb ? 3.5 : 999),
    [duration, dt, target, withDisturb],
  );

  // 双仿真: 开环 + 闭环 (PID 输出为归一化开度 [0,1], 不再用 MPa 量纲)
  const { closed, open, closedMetrics, openMetrics } = useMemo(() => {
    const closedT = simulateClosedLoop(profile, dt, {
      kp, ki, kd,
      outMin: 0, outMax: 1,
    });
    const openT = simulateOpenLoop(profile, dt);
    return {
      closed: closedT,
      open: openT,
      closedMetrics: evalResponse(closedT, target),
      openMetrics: evalResponse(openT, target),
    };
  }, [profile, dt, kp, ki, kd, target]);

  const applyPreset = useCallback((g: Gains) => {
    setKp(g.kp);
    setKi(g.ki);
    setKd(g.kd);
  }, []);

  return (
    <div className="rounded-lg border border-[#F472B6]/20 overflow-hidden">
      {/* 标题 */}
      <div className="px-3 py-2 bg-gradient-to-r from-[#F472B6]/10 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-[#F472B6]" />
          <span className="text-[11px] text-[#F472B6] font-medium">PID 闭环伺服调控</span>
          <span className="text-[9px] text-white/30 ml-1">目标 {target} MPa</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => applyPreset({ kp: 0.015, ki: 0.025, kd: 0.0008 })}
        >
          <RotateCcw className="w-3 h-3 text-white/50" />
        </Button>
      </div>

      <div className="p-3 space-y-3">
        {/* 预设 */}
        <div className="grid grid-cols-3 gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p.gains)}
              className="text-left px-2 py-1.5 rounded border bg-[#051020]/60 hover:bg-[#051020] transition-all"
              style={{ borderColor: `${p.color}40` }}
            >
              <div className="text-[9px] font-semibold" style={{ color: p.color }}>{p.label}</div>
              <div className="text-[8px] text-white/40 mt-0.5">{p.desc}</div>
            </button>
          ))}
        </div>

        {/* PID 滑块 (归一化输出: 误差 MPa → 开度 0-1) */}
        <div className="space-y-1.5">
          <SliderInputCombo
            label="Kp (比例)" unit="" value={kp} onChange={setKp}
            min={0} max={0.05} step={0.0005} color="#F472B6"
          />
          <SliderInputCombo
            label="Ki (积分)" unit="/s" value={ki} onChange={setKi}
            min={0} max={0.1} step={0.001} color="#F472B6"
          />
          <SliderInputCombo
            label="Kd (微分)" unit="s" value={kd} onChange={setKd}
            min={0} max={0.005} step={0.0001} color="#F472B6"
          />
        </div>

        {/* 扰动开关 */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={withDisturb}
            onChange={(e) => setWithDisturb(e.target.checked)}
            className="w-3 h-3 accent-[#F472B6]"
          />
          <span className="text-[10px] text-white/60">注入 t=3.5s 扰动(-10 MPa)</span>
        </label>

        {/* 响应曲线 */}
        <ResponseChart
          t={closed.t}
          setpoint={closed.setpoint}
          closed={closed.measured}
          open={open.measured}
        />

        {/* 指标对比 */}
        <div className="grid grid-cols-4 gap-1.5 text-[10px]">
          <MetricCell label="超调" unit="%"
            closedVal={closedMetrics.overshoot} openVal={openMetrics.overshoot} betterLower />
          <MetricCell label="稳态误差" unit=" MPa"
            closedVal={Math.abs(closedMetrics.steadyError)} openVal={Math.abs(openMetrics.steadyError)} betterLower />
          <MetricCell label="调节时间" unit=" s"
            closedVal={closedMetrics.settlingTime} openVal={openMetrics.settlingTime} betterLower />
          <MetricCell label="跟踪 RMSE" unit=""
            closedVal={closedMetrics.rmse} openVal={openMetrics.rmse} betterLower />
        </div>

        {/* 控制律公式 */}
        <div className="rounded bg-[#051020]/60 border border-white/5 p-2">
          <div className="text-[9px] text-white/30 mb-0.5">控制律 (u ∈ [0,1] 伺服开度)</div>
          <div className="text-[10px] font-mono text-[#F472B6]">
            u(t) = {kp.toFixed(4)}·e(t) + {ki.toFixed(4)}·∫e(τ)dτ + {kd.toFixed(5)}·de(t)/dt
          </div>
          <div className="text-[9px] text-white/40 mt-1 flex items-center gap-1">
            <Zap className="w-2.5 h-2.5 text-[#F472B6]" />
            e(t) = 目标围压 − 当前围压 (MPa) · 被控对象: K={DEFAULT_PLANT.K} MPa, τ={DEFAULT_PLANT.tau}s, ζ={DEFAULT_PLANT.zeta}
          </div>
        </div>
      </div>
    </div>
  );
}

// ——————————————————————————————————————————————
// 指标对比格
// ——————————————————————————————————————————————
function MetricCell({
  label, unit, closedVal, openVal, betterLower = true,
}: {
  label: string; unit: string;
  closedVal: number; openVal: number; betterLower?: boolean;
}) {
  const closedBetter = betterLower ? closedVal < openVal : closedVal > openVal;
  return (
    <div className="rounded bg-[#051020]/60 border border-white/5 p-1.5">
      <div className="text-[9px] text-white/40">{label}</div>
      <div className="mt-0.5">
        <div className="flex items-center justify-between">
          <span className="text-[8px] text-white/40">开环</span>
          <span className="text-[10px] font-mono text-white/70">{openVal.toFixed(2)}{unit}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[8px] text-[#F472B6]">闭环</span>
          <span className="text-[10px] font-mono font-bold" style={{ color: closedBetter ? '#10B981' : '#F472B6' }}>
            {closedVal.toFixed(2)}{unit}
          </span>
        </div>
      </div>
    </div>
  );
}

// ——————————————————————————————————————————————
// 响应曲线
// ——————————————————————————————————————————————
function ResponseChart({
  t, setpoint, closed, open,
}: {
  t: number[]; setpoint: number[]; closed: number[]; open: number[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    chart.current?.dispose();
    chart.current = echarts.init(ref.current);
    const ro = new ResizeObserver(() => chart.current?.resize());
    ro.observe(ref.current);
    return () => { ro.disconnect(); chart.current?.dispose(); chart.current = null; };
  }, []);

  useEffect(() => {
    if (!chart.current) return;
    const series = (name: string, data: number[], color: string, dashed = false) => ({
      name,
      type: 'line' as const,
      smooth: !dashed,
      symbol: 'none' as const,
      lineStyle: { color, width: dashed ? 1 : 2, type: dashed ? 'dashed' as const : 'solid' as const },
      data: data.map((v, i) => [+t[i].toFixed(2), +v.toFixed(2)]),
      animation: false,
    });

    chart.current.setOption({
      animation: false,
      backgroundColor: 'transparent',
      grid: { left: 40, right: 12, top: 26, bottom: 28 },
      legend: {
        data: ['设定值', 'PID 闭环', '开环'],
        top: 0, textStyle: { color: 'rgba(255,255,255,0.6)', fontSize: 9 },
        itemWidth: 12, itemHeight: 2,
      },
      tooltip: {
        trigger: 'axis', backgroundColor: 'rgba(10,37,64,0.95)',
        textStyle: { color: '#fff', fontSize: 10 },
        valueFormatter: (v: number) => `${v.toFixed(2)} MPa`,
      },
      xAxis: {
        type: 'value', name: 't (s)', nameLocation: 'middle', nameGap: 18,
        nameTextStyle: { color: 'rgba(255,255,255,0.4)', fontSize: 9 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } },
        axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      yAxis: {
        type: 'value', name: '围压 (MPa)', nameLocation: 'middle', nameGap: 30,
        nameTextStyle: { color: 'rgba(255,255,255,0.4)', fontSize: 9 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } },
        axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      series: [
        series('设定值', setpoint, '#FFD700', true),
        series('PID 闭环', closed, '#F472B6'),
        series('开环', open, '#6B7280'),
      ],
    }, true);
  }, [t, setpoint, closed, open]);

  return (
    <div className="rounded bg-[#051020]/40 border border-white/5">
      <div className="px-2 pt-1.5 flex items-center gap-1">
        <Activity className="w-3 h-3 text-[#F472B6]" />
        <span className="text-[9px] text-white/50">响应曲线对比</span>
      </div>
      <div ref={ref} className="w-full h-[160px]" />
    </div>
  );
}
