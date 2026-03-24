// src/components/StressWaveCanvas.tsx
// 应力波传播Canvas动画 - 渲染入射波(蓝)、反射波(红)、透射波(绿)
import { useRef, useEffect, useCallback } from 'react';

interface StressWaveCanvasProps {
  isActive: boolean;
  progress: number; // 0~1 当前阶段进度
  voltage: number;  // 影响波的振幅
}

// 波形颜色定义
const WAVE_COLORS = {
  incident:    { stroke: '#3B82F6', fill: 'rgba(59,130,246,0.15)' },   // 蓝色 入射波
  reflected:   { stroke: '#EF4444', fill: 'rgba(239,68,68,0.12)' },    // 红色 反射波
  transmitted: { stroke: '#10B981', fill: 'rgba(16,185,129,0.12)' },   // 绿色 透射波
};

// 杆件布局常量 (与ExperimentProcess2D的SVG viewBox对应)
const LAYOUT = {
  incidentBarStart: 0.30,   // 入射杆起点 (占canvas宽度比例)
  incidentBarEnd:   0.52,   // 入射杆终点
  specimenStart:    0.52,
  specimenEnd:      0.56,
  transBarStart:    0.56,
  transBarEnd:      0.74,   // 透射杆终点
  waveY:            0.42,   // 波形中心Y位置
};

export default function StressWaveCanvas({ isActive, progress, voltage }: StressWaveCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  // 振幅与电压正相关
  const amplitude = Math.min(30, 10 + (voltage / 4000) * 20);

  // 绘制单段波形
  const drawWave = useCallback((
    ctx: CanvasRenderingContext2D,
    startX: number,
    endX: number,
    centerY: number,
    amp: number,
    color: { stroke: string; fill: string },
    waveProgress: number, // 0~1 该波已走过的比例
    direction: 1 | -1,    // 1=向右, -1=向左
    timeOffset: number,
  ) => {
    if (waveProgress <= 0) return;

    const visibleEnd = direction === 1
      ? startX + (endX - startX) * waveProgress
      : endX - (endX - startX) * waveProgress;

    const from = direction === 1 ? startX : visibleEnd;
    const to = direction === 1 ? visibleEnd : endX;

    if (to - from < 2) return;

    const freq = 0.06;

    // 填充区域
    ctx.beginPath();
    ctx.moveTo(from, centerY);
    for (let x = from; x <= to; x += 1) {
      const phase = (x - startX) * freq + timeOffset;
      // 高斯包络 + 正弦波
      const dist = (x - (from + to) / 2) / ((to - from) / 2);
      const envelope = Math.exp(-dist * dist * 2);
      const y = centerY - Math.sin(phase) * amp * envelope;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(to, centerY);
    ctx.closePath();
    ctx.fillStyle = color.fill;
    ctx.fill();

    // 描边
    ctx.beginPath();
    for (let x = from; x <= to; x += 1) {
      const phase = (x - startX) * freq + timeOffset;
      const dist = (x - (from + to) / 2) / ((to - from) / 2);
      const envelope = Math.exp(-dist * dist * 2);
      const y = centerY - Math.sin(phase) * amp * envelope;
      if (x === from) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color.stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }, []);

  // 绘制标签
  const drawLabel = useCallback((
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    color: string,
  ) => {
    ctx.font = '11px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
  }, []);

  // 动画帧
  const render = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 自适应canvas尺寸
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    }

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    if (!isActive) return;

    if (!startTimeRef.current) startTimeRef.current = timestamp;
    const elapsed = (timestamp - startTimeRef.current) / 1000;
    const timeOffset = elapsed * 4; // 波形滚动速度

    const centerY = h * LAYOUT.waveY;
    const incStart = w * LAYOUT.incidentBarStart;
    const incEnd = w * LAYOUT.incidentBarEnd;
    const specStart = w * LAYOUT.specimenStart;
    const specEnd = w * LAYOUT.specimenEnd;
    const transStart = w * LAYOUT.transBarStart;
    const transEnd = w * LAYOUT.transBarEnd;

    // 阶段分解：
    // progress 0~0.4: 入射波从左向右传播到试样
    // progress 0.4~0.6: 撞击试样，产生反射波+透射波
    // progress 0.6~1.0: 反射波向左传播，透射波向右传播

    // 入射波 (蓝色, 向右)
    const incidentProgress = Math.min(1, progress / 0.5);
    drawWave(ctx, incStart, incEnd, centerY, amplitude, WAVE_COLORS.incident, incidentProgress, 1, timeOffset);

    if (incidentProgress > 0.3) {
      drawLabel(ctx, '入射波 σᵢ', (incStart + incEnd) / 2, centerY - amplitude - 8, WAVE_COLORS.incident.stroke);
    }

    // 反射波 (红色, 向左) - progress > 0.4 后出现
    if (progress > 0.4) {
      const reflectedProgress = Math.min(1, (progress - 0.4) / 0.5);
      drawWave(ctx, incStart, specStart, centerY + 8, amplitude * 0.3, WAVE_COLORS.reflected, reflectedProgress, -1, -timeOffset);

      if (reflectedProgress > 0.2) {
        drawLabel(ctx, '反射波 σᵣ', (incStart + specStart) / 2, centerY + amplitude + 24, WAVE_COLORS.reflected.stroke);
      }
    }

    // 透射波 (绿色, 向右) - progress > 0.4 后出现
    if (progress > 0.4) {
      const transmittedProgress = Math.min(1, (progress - 0.4) / 0.5);
      drawWave(ctx, transStart, transEnd, centerY, amplitude * 0.7, WAVE_COLORS.transmitted, transmittedProgress, 1, timeOffset * 0.8);

      if (transmittedProgress > 0.2) {
        drawLabel(ctx, '透射波 σₜ', (transStart + transEnd) / 2, centerY - amplitude * 0.7 - 8, WAVE_COLORS.transmitted.stroke);
      }
    }

    // 试样处的碰撞闪光
    if (progress > 0.35 && progress < 0.65) {
      const flashIntensity = 1 - Math.abs(progress - 0.5) / 0.15;
      const flashRadius = 8 + flashIntensity * 12;
      const gradient = ctx.createRadialGradient(
        (specStart + specEnd) / 2, centerY, 0,
        (specStart + specEnd) / 2, centerY, flashRadius
      );
      gradient.addColorStop(0, `rgba(255,215,0,${0.8 * flashIntensity})`);
      gradient.addColorStop(0.5, `rgba(255,165,0,${0.4 * flashIntensity})`);
      gradient.addColorStop(1, 'rgba(255,165,0,0)');
      ctx.beginPath();
      ctx.arc((specStart + specEnd) / 2, centerY, flashRadius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    rafRef.current = requestAnimationFrame(render);
  }, [isActive, progress, amplitude, drawWave, drawLabel]);

  useEffect(() => {
    if (isActive) {
      startTimeRef.current = 0;
      rafRef.current = requestAnimationFrame(render);
    } else {
      cancelAnimationFrame(rafRef.current);
      // 清除画布
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    return () => cancelAnimationFrame(rafRef.current);
  }, [isActive, render]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ pointerEvents: 'none' }}
    />
  );
}
