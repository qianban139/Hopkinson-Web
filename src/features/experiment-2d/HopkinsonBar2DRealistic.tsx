// src/features/experiment-2d/HopkinsonBar2DRealistic.tsx
// 全新Canvas 2D真实模型 - 工业级渲染品质
import { useRef, useCallback, useMemo } from 'react';
import { useCanvasResize } from './hooks/useCanvasResize';
import { useRenderLoop } from './hooks/useRenderLoop';
import { drawGridBackground, COLORS, drawLabel, colorWithAlpha, roundRect } from './utils/canvasHelpers';
import { renderCapacitorBank } from './renderers/CapacitorBankRenderer';
import { renderElectromagneticCoil } from './renderers/ElectromagneticCoilRenderer';
import { renderStrikerBar } from './renderers/StrikerBarRenderer';
import { renderBar } from './renderers/BarRenderer';
import { renderSpecimen } from './renderers/SpecimenRenderer';
import { renderDAQSystem } from './renderers/DAQSystemRenderer';
import { renderConfiningDevice } from './renderers/ConfiningDeviceRenderer';
import type { ExperimentStage } from '@/hooks/useExperimentAnimation';

// ═══════════════════════════════════════════════
// 设计参数
// ═══════════════════════════════════════════════

const DESIGN_W = 1100;
const DESIGN_H = 420;

// 设备布局(X坐标和尺寸)
const LAYOUT = {
  // 电容器组
  capacitor: { x: 20, y: 50, w: 100, h: 120 },
  // 电磁线圈
  coil: { x: 135, y: 60, w: 105, h: 100 },
  // 撞击杆
  striker: { startX: 250, endX: 370, barLen: 50, barH: 16 },
  // 入射杆
  incidentBar: { x: 370, len: 240, barH: 16 },
  // 试样
  specimen: { w: 10, h: 16 },
  // 透射杆
  transmittedBar: { len: 200, barH: 16 },
  // 围压
  confining: { enabled: false, pressure: 100 },
  // DAQ
  daq: { w: 120, h: 80 },
  // 中心线Y
  centerY: 140,
  // 底座基准线Y
  baseY: 175,
};

interface HopkinsonBar2DRealisticProps {
  voltage: number;
  current: number;
  pulseWidth: number;
  waveform: string;
  materialName: string;
  materialColor: string;
  materialCategory: 'metal' | 'polymer' | 'foam' | 'rock' | 'concrete' | 'ceramic';
  stiffnessK: number;
  dampingC: number;
  // 动画状态
  currentStage: ExperimentStage;
  stageIndex: number;
  stageProgress: number;
  globalProgress: number;
  isPlaying: boolean;
  isComplete: boolean;
}

export default function HopkinsonBar2DRealistic({
  voltage, materialName, materialColor, materialCategory,
  stiffnessK, currentStage, stageProgress,
}: HopkinsonBar2DRealisticProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Canvas自适应
  useCanvasResize(canvasRef, containerRef, {
    designWidth: DESIGN_W,
    designHeight: DESIGN_H,
    minScale: 0.4,
  });

  // 计算关键布局坐标(memo化)
  const positions = useMemo(() => {
    const cy = LAYOUT.centerY;
    const incX = LAYOUT.incidentBar.x;
    const incLen = LAYOUT.incidentBar.len;
    const specCx = incX + incLen + LAYOUT.specimen.w / 2;
    const transX = specCx + LAYOUT.specimen.w / 2;
    const transLen = LAYOUT.transmittedBar.len;
    const daqX = transX + transLen + 30;

    // 应变片位置(供DAQ连线)
    const sgPositions = [
      { x: incX + incLen * 0.3, y: cy - LAYOUT.incidentBar.barH / 2 - 8 },
      { x: incX + incLen * 0.6, y: cy - LAYOUT.incidentBar.barH / 2 - 8 },
      { x: transX + transLen * 0.4, y: cy - LAYOUT.transmittedBar.barH / 2 - 8 },
      { x: transX + transLen * 0.7, y: cy - LAYOUT.transmittedBar.barH / 2 - 8 },
    ];

    return { cy, incX, incLen, specCx, transX, transLen, daqX, sgPositions };
  }, []);

  // 主渲染函数
  const render = useCallback((ctx: CanvasRenderingContext2D, time: number, _dt: number, w: number, h: number) => {
    const { cy, incX, incLen, specCx, transX, transLen, daqX, sgPositions } = positions;

    // 背景
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);
    drawGridBackground(ctx, w, h, 30);

    // 底座基准线
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, LAYOUT.baseY);
    ctx.lineTo(w, LAYOUT.baseY);
    ctx.stroke();

    // 中心线(虚线)
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.moveTo(LAYOUT.capacitor.x, cy);
    ctx.lineTo(daqX + LAYOUT.daq.w, cy);
    ctx.stroke();
    ctx.setLineDash([]);

    // ═══ 1. 电容器组 ═══
    renderCapacitorBank({
      ctx,
      x: LAYOUT.capacitor.x,
      y: LAYOUT.capacitor.y,
      width: LAYOUT.capacitor.w,
      height: LAYOUT.capacitor.h,
      stage: currentStage,
      stageProgress,
      voltage,
      time,
    });

    // 母线连接(电容→线圈)
    const busStartX = LAYOUT.capacitor.x + LAYOUT.capacitor.w;
    const busEndX = LAYOUT.coil.x;
    const busActive = currentStage !== 'idle';
    ctx.strokeStyle = colorWithAlpha(COLORS.copper.base, busActive ? 0.5 : 0.2);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(busStartX, cy - 5);
    ctx.lineTo(busEndX, cy - 5);
    ctx.moveTo(busStartX, cy + 5);
    ctx.lineTo(busEndX, cy + 5);
    ctx.stroke();

    // 电流流动动画
    if (busActive && (currentStage === 'charging' || currentStage === 'coilAccel')) {
      const dotCount = 3;
      for (let i = 0; i < dotCount; i++) {
        const t = ((time * 0.004 + i / dotCount) % 1);
        const dx = busStartX + (busEndX - busStartX) * t;
        ctx.fillStyle = colorWithAlpha(COLORS.cyan, 0.6);
        ctx.beginPath();
        ctx.arc(dx, cy - 5, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ═══ 2. 电磁线圈 ═══
    renderElectromagneticCoil({
      ctx,
      x: LAYOUT.coil.x,
      y: LAYOUT.coil.y,
      width: LAYOUT.coil.w,
      height: LAYOUT.coil.h,
      stage: currentStage,
      stageProgress,
      time,
    });

    // ═══ 3. 撞击杆 ═══
    renderStrikerBar({
      ctx,
      startX: LAYOUT.striker.startX,
      endX: LAYOUT.striker.endX,
      cy,
      barLength: LAYOUT.striker.barLen,
      barHeight: LAYOUT.striker.barH,
      stage: currentStage,
      stageProgress,
      time,
      voltage,
    });

    // ═══ 4. 入射杆 ═══
    renderBar({
      ctx, x: incX, cy, length: incLen,
      barHeight: LAYOUT.incidentBar.barH,
      type: 'incident',
      stage: currentStage, stageProgress, time, voltage,
      baseY: LAYOUT.baseY,
    });

    // ═══ 5. 试样 ═══
    renderSpecimen({
      ctx, cx: specCx, cy,
      width: LAYOUT.specimen.w,
      height: LAYOUT.specimen.h,
      stage: currentStage, stageProgress, time,
      materialName, materialColor, materialCategory, stiffnessK,
    });

    // ═══ 5.5 围压装置(可选) ═══
    renderConfiningDevice({
      ctx, cx: specCx, cy,
      specimenWidth: LAYOUT.specimen.w,
      specimenHeight: LAYOUT.specimen.h,
      enabled: LAYOUT.confining.enabled,
      pressure: LAYOUT.confining.pressure,
      time,
    });

    // ═══ 6. 透射杆 ═══
    renderBar({
      ctx, x: transX, cy, length: transLen,
      barHeight: LAYOUT.transmittedBar.barH,
      type: 'transmitted',
      stage: currentStage, stageProgress, time, voltage,
      baseY: LAYOUT.baseY,
    });

    // ═══ 7. 动量阱(透射杆末端) ═══
    renderMomentumTrap(ctx, transX + transLen, cy, LAYOUT.transmittedBar.barH, currentStage, time);

    // ═══ 8. DAQ系统 ═══
    renderDAQSystem({
      ctx,
      x: daqX,
      y: LAYOUT.baseY + 10,
      width: LAYOUT.daq.w,
      height: LAYOUT.daq.h,
      stage: currentStage,
      stageProgress,
      time,
      voltage,
      sgPositions,
    });

    // ═══ 标注 ═══
    renderAnnotations(ctx, cy, incX, incLen, specCx, transX, transLen, daqX, time);

    // ═══ 底部波形预览 ═══
    renderBottomWaveformPreview(ctx, incX, incLen, specCx, transX, transLen, currentStage, stageProgress, time, voltage);

    // ═══ 标题 ═══
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillText('电磁驱动分离式霍普金森压杆系统 (EM-SHPB)', 20, h - 10);
    ctx.textAlign = 'right';
    ctx.font = '8px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillText('Electromagnetic Split Hopkinson Pressure Bar', w - 20, h - 10);

  }, [currentStage, stageProgress, voltage, materialName, materialColor, materialCategory, stiffnessK, positions]);

  // 渲染循环
  useRenderLoop({
    canvasRef,
    render,
    continuous: true,
    targetFps: 60,
  });

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-[#0A2540]">
      <canvas
        ref={canvasRef}
        className="mx-auto block"
        style={{ imageRendering: 'auto' }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════
// 辅助渲染函数
// ═══════════════════════════════════════════════

function renderMomentumTrap(
  ctx: CanvasRenderingContext2D,
  x: number, cy: number, barH: number,
  stage: ExperimentStage, time: number
) {
  ctx.save();
  const trapW = 20;
  const trapH = barH + 10;
  const ty = cy - trapH / 2;

  // 阻尼器外壳
  const trapColor = { base: '#5A4A3A', light: '#8A7A6A', dark: '#3A2A1A', highlight: '#AA9A8A' };
  ctx.fillStyle = trapColor.base;
  roundRect(ctx, x + 2, ty, trapW, trapH, 3);
  ctx.fill();
  ctx.strokeStyle = colorWithAlpha(trapColor.light, 0.3);
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // 弹簧(锯齿线)
  ctx.strokeStyle = colorWithAlpha(COLORS.steel.light, 0.4);
  ctx.lineWidth = 1;
  ctx.beginPath();
  const springX = x + 5;
  const springSegs = 5;
  const segH = trapH / springSegs;
  for (let i = 0; i <= springSegs; i++) {
    const sx = springX + (i % 2 === 0 ? 0 : 8);
    const sy = ty + 3 + i * (segH - 1);
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  // 吸收能量发光
  const absorbing = stage === 'wavePropagate' || stage === 'deformation';
  if (absorbing) {
    const glow = 0.3 + 0.2 * Math.sin(time * 0.006);
    ctx.fillStyle = colorWithAlpha(COLORS.activeGreen, glow * 0.15);
    ctx.fillRect(x, ty - 3, trapW + 5, trapH + 6);
  }

  // 标签
  ctx.font = '6px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillText('动量阱', x + trapW / 2 + 2, ty + trapH + 10);

  ctx.restore();
}

/** 底部波形预览 - 与杆物理位置对齐 */
function renderBottomWaveformPreview(
  ctx: CanvasRenderingContext2D,
  incX: number, incLen: number, specCx: number,
  transX: number, transLen: number,
  stage: ExperimentStage, progress: number, time: number, voltage: number
) {
  if (stage !== 'wavePropagate' && stage !== 'deformation' && stage !== 'dataCollect') return;

  const previewY = 250; // 波形预览区域起始Y
  const previewH = 60;
  const previewCY = previewY + previewH / 2;
  const totalStartX = incX;
  const totalEndX = transX + transLen;
  const amplitude = 20 + (voltage / 4000) * 10;

  ctx.save();

  // 背景区域
  ctx.fillStyle = 'rgba(5,16,32,0.6)';
  ctx.fillRect(totalStartX - 10, previewY - 5, totalEndX - totalStartX + 20, previewH + 15);
  ctx.strokeStyle = 'rgba(0,245,255,0.1)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(totalStartX - 10, previewY - 5, totalEndX - totalStartX + 20, previewH + 15);

  // 零线
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 0.5;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(totalStartX - 5, previewCY);
  ctx.lineTo(totalEndX + 5, previewCY);
  ctx.stroke();
  ctx.setLineDash([]);

  // 试样位置标记
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(specCx, previewY - 3);
  ctx.lineTo(specCx, previewY + previewH + 8);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = '6px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillText('试样', specCx, previewY + previewH + 14);

  // 标题
  ctx.font = '7px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText('应力分布预览 σ(x)', totalStartX - 5, previewY - 8);

  const waveProg = stage === 'dataCollect' ? 1 : progress;
  const pulseWidth = incLen * 0.25;

  // 入射波 — 入射杆上从左向右
  const incProgress = Math.min(1, waveProg * 1.6);
  if (incProgress > 0) {
    const headX = incX + incLen * incProgress;
    const tailX = Math.max(incX, headX - pulseWidth);
    drawPreviewPulse(ctx, tailX, headX, previewCY, amplitude, COLORS.incidentWave, time);
  }

  // 反射波 — 入射杆上从右向左
  if (waveProg > 0.5) {
    const refProg = (waveProg - 0.5) / 0.5;
    const headX = incX + incLen - incLen * refProg;
    const tailX = Math.min(incX + incLen, headX + pulseWidth * 0.7);
    drawPreviewPulse(ctx, headX, tailX, previewCY, -amplitude * 0.35, COLORS.reflectedWave, time);
  }

  // 透射波 — 透射杆上从左向右
  if (waveProg > 0.5) {
    const transProg = (waveProg - 0.5) / 0.5;
    const headX = transX + transLen * Math.min(1, transProg * 1.3);
    const tailX = Math.max(transX, headX - pulseWidth * 0.6);
    drawPreviewPulse(ctx, tailX, headX, previewCY, amplitude * 0.65, COLORS.transmittedWave, time);
  }

  // 图例
  const legX = totalEndX - 100;
  const legY = previewY - 3;
  ctx.font = '6px sans-serif';
  const legs = [
    { label: '入射σᵢ', color: COLORS.incidentWave },
    { label: '反射σᵣ', color: COLORS.reflectedWave },
    { label: '透射σₜ', color: COLORS.transmittedWave },
  ];
  legs.forEach((l, i) => {
    const lx = legX + i * 38;
    ctx.strokeStyle = l.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(lx, legY);
    ctx.lineTo(lx + 10, legY);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'left';
    ctx.fillText(l.label, lx + 12, legY + 3);
  });

  ctx.restore();
}

/** 在预览区域绘制一个脉冲 */
function drawPreviewPulse(
  ctx: CanvasRenderingContext2D,
  startX: number, endX: number, cy: number,
  amplitude: number, color: string, time: number
) {
  if (endX - startX < 2) return;
  const pts: { x: number; y: number }[] = [];
  const step = 1.5;
  const len = endX - startX;

  for (let px = startX; px <= endX; px += step) {
    const t = (px - startX) / len;
    let env: number;
    if (t < 0.25) env = Math.pow(t / 0.25, 2);
    else if (t < 0.45) env = 1.0;
    else env = Math.exp(-3 * Math.pow((t - 0.45) / 0.55, 2));
    const ripple = 1 + 0.03 * Math.sin(px * 0.4 + time * 0.003);
    pts.push({ x: px, y: cy - amplitude * env * ripple });
  }

  // Fill
  ctx.beginPath();
  ctx.moveTo(pts[0].x, cy);
  for (const p of pts) ctx.lineTo(p.x, p.y);
  ctx.lineTo(pts[pts.length - 1].x, cy);
  ctx.closePath();
  ctx.fillStyle = colorWithAlpha(color, 0.08);
  ctx.fill();

  // Stroke
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.strokeStyle = colorWithAlpha(color, 0.7);
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function renderAnnotations(
  ctx: CanvasRenderingContext2D,
  cy: number,
  incX: number, incLen: number,
  specCx: number,
  transX: number, transLen: number,
  daqX: number,
  _time: number
) {
  // 组件标签
  const labelY = 30;

  drawLabel(ctx, '电容器组', 65, labelY, 70, 50, {
    color: 'rgba(255,255,255,0.4)', fontSize: 8,
    bgColor: 'rgba(5,16,32,0.7)', align: 'center',
  });
  drawLabel(ctx, '三级电磁线圈', 187, labelY, 187, 60, {
    color: 'rgba(255,255,255,0.4)', fontSize: 8,
    bgColor: 'rgba(5,16,32,0.7)', align: 'center',
  });
  drawLabel(ctx, '撞击杆', 290, labelY, 290, cy - 15, {
    color: 'rgba(255,255,255,0.4)', fontSize: 8,
    bgColor: 'rgba(5,16,32,0.7)', align: 'center',
  });
  drawLabel(ctx, '入射杆 (Incident Bar)', incX + incLen / 2, labelY, incX + incLen / 2, cy - 15, {
    color: 'rgba(255,255,255,0.35)', fontSize: 7,
    bgColor: 'rgba(5,16,32,0.7)', align: 'center',
  });
  drawLabel(ctx, '试样', specCx, labelY + 12, specCx, cy - 15, {
    color: 'rgba(255,255,255,0.4)', fontSize: 8,
    bgColor: 'rgba(5,16,32,0.7)', align: 'center',
  });
  drawLabel(ctx, '透射杆 (Transmitted Bar)', transX + transLen / 2, labelY, transX + transLen / 2, cy - 15, {
    color: 'rgba(255,255,255,0.35)', fontSize: 7,
    bgColor: 'rgba(5,16,32,0.7)', align: 'center',
  });
  drawLabel(ctx, '数据采集 (DAQ)', daqX + 60, LAYOUT.baseY + 4, daqX + 60, LAYOUT.baseY + 10, {
    color: 'rgba(255,255,255,0.35)', fontSize: 7,
    bgColor: 'rgba(5,16,32,0.7)', align: 'center',
  });

  // 波形图例(右上角)
  const legendX = DESIGN_W - 130;
  const legendY = 20;
  ctx.font = '7px sans-serif';
  ctx.textAlign = 'left';

  const legends = [
    { label: '入射波 σᵢ', color: COLORS.incidentWave },
    { label: '反射波 σᵣ', color: COLORS.reflectedWave },
    { label: '透射波 σₜ', color: COLORS.transmittedWave },
  ];
  legends.forEach((leg, i) => {
    const ly = legendY + i * 13;
    ctx.strokeStyle = leg.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(legendX, ly);
    ctx.lineTo(legendX + 15, ly);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText(leg.label, legendX + 20, ly + 3);
  });
}
