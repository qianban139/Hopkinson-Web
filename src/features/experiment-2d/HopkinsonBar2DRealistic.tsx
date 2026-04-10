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

const DESIGN_W = 1200;
const DESIGN_H = 480;

// 设备布局(X坐标和尺寸) — 垂直居中于DESIGN_H
const LAYOUT = {
  // 电容器组
  capacitor: { x: 20, y: 80, w: 140, h: 140 },
  // 电磁线圈
  coil: { x: 175, y: 88, w: 130, h: 115 },
  // 撞击杆
  striker: { startX: 315, endX: 435, barLen: 60, barH: 28 },
  // 入射杆
  incidentBar: { x: 435, len: 250, barH: 28 },
  // 试样
  specimen: { w: 16, h: 28 },
  // 透射杆
  transmittedBar: { len: 210, barH: 28 },
  // 围压
  confining: { enabled: false, pressure: 100 },
  // DAQ
  daq: { w: 140, h: 90 },
  // 中心线Y
  centerY: 165,
  // 底座基准线Y
  baseY: 195,
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
  voltage, current, materialName, materialColor, materialCategory,
  stiffnessK, dampingC, currentStage, stageIndex, stageProgress, globalProgress,
  isPlaying, isComplete,
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

    // 背景（深色渐变，顶部略亮）
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#0D2D4D');
    bgGrad.addColorStop(0.4, COLORS.bg);
    bgGrad.addColorStop(1, '#051020');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);
    drawGridBackground(ctx, w, h, 30);

    // 底座基准线（带渐变）
    const baseGrad = ctx.createLinearGradient(30, 0, w - 30, 0);
    baseGrad.addColorStop(0, 'rgba(255,255,255,0)');
    baseGrad.addColorStop(0.1, 'rgba(255,255,255,0.08)');
    baseGrad.addColorStop(0.9, 'rgba(255,255,255,0.08)');
    baseGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = baseGrad;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(30, LAYOUT.baseY);
    ctx.lineTo(w - 30, LAYOUT.baseY);
    ctx.stroke();

    // 中心线(虚线，带渐隐)
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

    // ═══ 数字孪生 - 实时数据HUD ═══
    renderLiveDataHUD(ctx, w, currentStage, stageProgress, voltage, current, stiffnessK, time);

    // ═══ 数字孪生 - 应变片实时读数 ═══
    renderStrainGaugeReadouts(ctx, sgPositions, currentStage, stageProgress, voltage, time);

    // ═══ 数字孪生 - 能量流动路径 ═══
    renderEnergyFlowPath(ctx, LAYOUT.capacitor, LAYOUT.coil, LAYOUT.striker,
      incX, incLen, specCx, transX, transLen, cy, currentStage, stageProgress, time);

    // ═══ 数字孪生 - 阶段信息面板 ═══
    renderStageInfoPanel(ctx, currentStage, stageIndex, stageProgress, globalProgress, isPlaying, isComplete, time);

    // ═══ 标题栏（底部，工程图纸风格） ═══
    // 分隔线
    const titleBarY = h - 22;
    const titleGrad = ctx.createLinearGradient(30, 0, w - 30, 0);
    titleGrad.addColorStop(0, 'rgba(0,245,255,0)');
    titleGrad.addColorStop(0.15, 'rgba(0,245,255,0.1)');
    titleGrad.addColorStop(0.85, 'rgba(0,245,255,0.1)');
    titleGrad.addColorStop(1, 'rgba(0,245,255,0)');
    ctx.strokeStyle = titleGrad;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(30, titleBarY);
    ctx.lineTo(w - 30, titleBarY);
    ctx.stroke();

    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,245,255,0.3)';
    ctx.fillText('电磁驱动分离式霍普金森压杆系统 (EM-SHPB)', 30, h - 8);
    ctx.textAlign = 'right';
    ctx.font = '7px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillText('DIGITAL TWIN · Electromagnetic Split Hopkinson Pressure Bar', w - 30, h - 8);

  }, [currentStage, stageIndex, stageProgress, globalProgress, isPlaying, isComplete,
      voltage, current, materialName, materialColor, materialCategory, stiffnessK, dampingC, positions]);

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

  const previewY = 280; // 波形预览区域起始Y
  const previewH = 80;
  const previewCY = previewY + previewH / 2;
  const totalStartX = incX - 20;
  const totalEndX = transX + transLen + 20;
  const amplitude = 24 + (voltage / 4000) * 12;

  ctx.save();

  // 背景区域（圆角 + 毛玻璃效果）
  roundRect(ctx, totalStartX - 5, previewY - 18, totalEndX - totalStartX + 10, previewH + 38, 6);
  ctx.fillStyle = 'rgba(5,12,28,0.75)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,245,255,0.12)';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // 细网格（示波器风格）
  ctx.strokeStyle = 'rgba(0,245,255,0.04)';
  ctx.lineWidth = 0.3;
  const gridStep = 10;
  for (let gx = totalStartX; gx < totalEndX; gx += gridStep) {
    ctx.beginPath();
    ctx.moveTo(gx, previewY - 2);
    ctx.lineTo(gx, previewY + previewH + 2);
    ctx.stroke();
  }
  for (let gy = previewY; gy <= previewY + previewH; gy += gridStep) {
    ctx.beginPath();
    ctx.moveTo(totalStartX, gy);
    ctx.lineTo(totalEndX, gy);
    ctx.stroke();
  }

  // 零线（加强）
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 0.5;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(totalStartX, previewCY);
  ctx.lineTo(totalEndX, previewCY);
  ctx.stroke();
  ctx.setLineDash([]);

  // 试样位置标记（垂直高亮带）
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fillRect(specCx - 4, previewY - 2, 8, previewH + 4);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 0.8;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(specCx, previewY - 3);
  ctx.lineTo(specCx, previewY + previewH + 8);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = 'bold 6px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('Specimen', specCx, previewY + previewH + 16);

  // 标题
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#00F5FF';
  ctx.fillText('STRESS DISTRIBUTION σ(x)', totalStartX + 5, previewY - 8);
  ctx.font = '6px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillText('One-dimensional wave propagation', totalStartX + 180, previewY - 8);

  const waveProg = stage === 'dataCollect' ? 1 : progress;
  // 脉冲宽度（匹配实验数据：脉冲长约 80% 杆长）
  const pulseWidth = incLen * 0.35;

  // 入射波 — 入射杆上从左向右（钟形半正弦脉冲）
  const incProgress = Math.min(1, waveProg * 1.5);
  if (incProgress > 0) {
    const headX = incX + incLen * incProgress;
    const tailX = Math.max(incX, headX - pulseWidth);
    drawPreviewPulse(ctx, tailX, headX, previewCY, amplitude, COLORS.incidentWave, time);
  }

  // 反射波 — 入射杆上从右向左（幅度 ~87% of 入射波）
  if (waveProg > 0.45) {
    const refProg = (waveProg - 0.45) / 0.55;
    const headX = incX + incLen - incLen * refProg;
    const tailX = Math.min(incX + incLen, headX + pulseWidth * 0.8);
    drawPreviewPulse(ctx, headX, tailX, previewCY, -amplitude * 0.87, COLORS.reflectedWave, time);
  }

  // 透射波 — 透射杆上从左向右（幅度 ~78% of 入射波）
  if (waveProg > 0.45) {
    const transProg = (waveProg - 0.45) / 0.55;
    const headX = transX + transLen * Math.min(1, transProg * 1.3);
    const tailX = Math.max(transX, headX - pulseWidth * 0.7);
    drawPreviewPulse(ctx, tailX, headX, previewCY, amplitude * 0.78, COLORS.transmittedWave, time);
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

/** 在预览区域绘制真实 SHPB 钟形脉冲（匹配实验数据半正弦形状） */
function drawPreviewPulse(
  ctx: CanvasRenderingContext2D,
  startX: number, endX: number, cy: number,
  amplitude: number, color: string, time: number
) {
  if (endX - startX < 2) return;
  const pts: { x: number; y: number }[] = [];
  const step = 1.2;
  const len = endX - startX;
  const riseEnd = 0.42;

  for (let px = startX; px <= endX; px += step) {
    const t = (px - startX) / len;
    let env: number;
    if (t < riseEnd) {
      const r = t / riseEnd;
      env = Math.sin(r * Math.PI / 2);
      env = env * env * (1 + 0.08 * r * r);
    } else {
      const d = (t - riseEnd) / (1 - riseEnd);
      const cosDecay = Math.cos(d * Math.PI / 2);
      const expTail = Math.exp(-2.2 * d * d);
      env = Math.max(0, cosDecay * 0.7 + expTail * 0.3);
    }
    const ripple = 1 + 0.02 * Math.sin(px * 0.6 + time * 0.002);
    pts.push({ x: px, y: cy - amplitude * env * ripple });
  }

  if (pts.length < 2) return;

  // 渐变填充
  const dir = amplitude > 0 ? -1 : 1;
  const grad = ctx.createLinearGradient(0, cy, 0, cy + dir * Math.abs(amplitude));
  grad.addColorStop(0, colorWithAlpha(color, 0));
  grad.addColorStop(1, colorWithAlpha(color, 0.12));
  ctx.beginPath();
  ctx.moveTo(pts[0].x, cy);
  for (const p of pts) ctx.lineTo(p.x, p.y);
  ctx.lineTo(pts[pts.length - 1].x, cy);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // 双层描边
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.strokeStyle = colorWithAlpha(color, 0.3);
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.strokeStyle = colorWithAlpha(color, 0.8);
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

// ═══════════════════════════════════════════════
// 数字孪生增强渲染
// ═══════════════════════════════════════════════

const STAGE_NAMES: Record<string, string> = {
  idle: '待机',
  charging: '电容充电',
  coilAccel: '电磁加速',
  strikerLaunch: '撞击杆发射',
  wavePropagate: '应力波传播',
  deformation: '试样变形',
  dataCollect: '数据采集',
};

const STAGE_PHYSICS: Record<string, string[]> = {
  idle: ['系统就绪', '等待启动信号'],
  charging: ['RLC充电回路', 'U(t) = U₀(1-e^(-t/RC))'],
  coilAccel: ['三级线圈顺序激励', 'F = μ₀NI²A/2δ²'],
  strikerLaunch: ['弹丸脱离磁场', 'v = √(2E/m)'],
  wavePropagate: ['一维应力波理论', 'σ = ρcv, ε̇ = v/L'],
  deformation: ['Johnson-Cook本构', 'σ = (A+Bεⁿ)(1+Clnε̇*)'],
  dataCollect: ['应变片惠斯通电桥', 'ΔV/V = GF·ε'],
};

/** 实时数据HUD - 右上角 */
function renderLiveDataHUD(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  stage: ExperimentStage,
  progress: number,
  voltage: number,
  current: number,
  stiffnessK: number,
  time: number
) {
  if (stage === 'idle') return;

  ctx.save();
  const hudX = canvasW - 165;
  const hudY = 8;
  const hudW = 155;
  const hudH = 110;

  // 背景
  roundRect(ctx, hudX, hudY, hudW, hudH, 4);
  ctx.fillStyle = 'rgba(5,16,32,0.85)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,245,255,0.25)';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // 标题栏
  ctx.fillStyle = 'rgba(0,245,255,0.08)';
  ctx.fillRect(hudX + 1, hudY + 1, hudW - 2, 14);
  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#00F5FF';
  ctx.fillText('REAL-TIME TELEMETRY', hudX + 6, hudY + 10);

  // 状态指示灯(闪烁)
  const blink = Math.sin(time * 0.008) > 0;
  ctx.fillStyle = blink ? '#10B981' : 'rgba(16,185,129,0.3)';
  ctx.beginPath();
  ctx.arc(hudX + hudW - 10, hudY + 8, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // 数据行
  const rows = computeHUDData(stage, progress, voltage, current, stiffnessK, time);
  const rowY = hudY + 22;
  const rowH = 14;

  rows.forEach((row, i) => {
    const ry = rowY + i * rowH;

    // 标签
    ctx.font = '7px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(row.label, hudX + 6, ry + 4);

    // 值
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = row.color;
    ctx.fillText(row.value, hudX + hudW - 30, ry + 4);

    // 单位
    ctx.font = '6px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.textAlign = 'left';
    ctx.fillText(row.unit, hudX + hudW - 28, ry + 4);

    // 条形图(微型)
    if (row.bar !== undefined) {
      const barX = hudX + 6;
      const barW = hudW - 12;
      const barY2 = ry + 8;
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(barX, barY2, barW, 2);
      ctx.fillStyle = colorWithAlpha(row.color, 0.5);
      ctx.fillRect(barX, barY2, barW * Math.min(1, row.bar), 2);
    }
  });

  ctx.restore();
}

function computeHUDData(
  stage: ExperimentStage, progress: number,
  voltage: number, current: number, stiffnessK: number, _time: number
): { label: string; value: string; unit: string; color: string; bar?: number }[] {
  const energy = voltage * voltage * 0.000003;
  const velocity = Math.sqrt(2 * energy * 1000 / 0.5);

  switch (stage) {
    case 'charging': {
      const chargedV = voltage * progress;
      const chargedE = chargedV * chargedV * 0.000003;
      return [
        { label: '充电电压', value: Math.round(chargedV).toString(), unit: 'V', color: '#00F5FF', bar: progress },
        { label: '储能', value: chargedE.toFixed(2), unit: 'kJ', color: '#FFD700', bar: chargedE / 36 },
        { label: '充电电流', value: (current / 1000 * (1 - progress)).toFixed(1), unit: 'kA', color: '#1DD1A1' },
        { label: '温度', value: (25 + progress * 3).toFixed(1), unit: '°C', color: '#FF9F43' },
        { label: '绝缘电阻', value: '>500', unit: 'MΩ', color: '#10B981' },
        { label: '充电进度', value: (progress * 100).toFixed(0), unit: '%', color: '#8B5CF6', bar: progress },
      ];
    }
    case 'coilAccel': {
      const coilStage = Math.floor(progress * 3) + 1;
      const accelForce = 8 + progress * 42;
      return [
        { label: '线圈级数', value: `${Math.min(coilStage, 3)}/3`, unit: '', color: '#00F5FF' },
        { label: '驱动力', value: accelForce.toFixed(1), unit: 'kN', color: '#FF9F43', bar: progress },
        { label: '峰值电流', value: (current / 1000 * (0.5 + progress * 0.5)).toFixed(1), unit: 'kA', color: '#EF4444' },
        { label: '磁场强度', value: (0.5 + progress * 2.5).toFixed(2), unit: 'T', color: '#8B5CF6', bar: progress },
        { label: '弹丸位移', value: (progress * 120).toFixed(0), unit: 'mm', color: '#1DD1A1' },
        { label: '弹丸速度', value: (velocity * progress).toFixed(1), unit: 'm/s', color: '#FFD700', bar: progress },
      ];
    }
    case 'strikerLaunch': {
      const v = velocity * (0.8 + progress * 0.2);
      return [
        { label: '弹丸速度', value: v.toFixed(1), unit: 'm/s', color: '#FFD700', bar: v / 50 },
        { label: '动能', value: (0.5 * 0.5 * v * v / 1000).toFixed(2), unit: 'kJ', color: '#00F5FF' },
        { label: '飞行距离', value: (progress * 80).toFixed(0), unit: 'mm', color: '#1DD1A1', bar: progress },
        { label: '气垫间隙', value: (5 - progress * 4.8).toFixed(1), unit: 'mm', color: '#FF9F43' },
        { label: '撞击倒计时', value: ((1 - progress) * 1.5).toFixed(2), unit: 's', color: '#EF4444' },
        { label: '对准偏差', value: '<0.02', unit: 'mm', color: '#10B981' },
      ];
    }
    case 'wavePropagate': {
      // 基于实验数据：峰值应力 ~72MPa，应变率 ~5856/s，波速 5170m/s
      const peakStress = 72 * (voltage / 3000);
      const stress = peakStress * Math.min(1, progress * 2);
      const strainRate = 3200 + progress * 2656;  // → peak ~5856/s
      return [
        { label: '入射应力', value: stress.toFixed(1), unit: 'MPa', color: '#3B82F6', bar: progress },
        { label: '应变率', value: Math.round(strainRate).toString(), unit: '/s', color: '#FF9F43' },
        { label: '波速', value: '5170', unit: 'm/s', color: '#00F5FF' },
        { label: '反射系数', value: progress > 0.45 ? '0.874' : '---', unit: '', color: '#EF4444' },
        { label: '透射系数', value: progress > 0.45 ? '0.782' : '---', unit: '', color: '#10B981' },
        { label: '波程', value: (progress * 1500).toFixed(0), unit: 'mm', color: '#8B5CF6', bar: progress },
      ];
    }
    case 'deformation': {
      // 基于实验数据：最终应变 ~0.86%，峰值应力 ~72MPa
      const peakStress = 72 * (voltage / 3000);
      const strain = progress * 0.0086;  // 最终应变 0.86%
      return [
        { label: '峰值应力', value: peakStress.toFixed(1), unit: 'MPa', color: '#EF4444' },
        { label: '工程应变', value: (strain * 100).toFixed(3), unit: '%', color: '#FFD700', bar: progress },
        { label: '真应力', value: (peakStress * (1 + strain)).toFixed(1), unit: 'MPa', color: '#FF9F43' },
        { label: '真应变', value: Math.log(1 + strain).toFixed(5), unit: '', color: '#8B5CF6' },
        { label: '温升', value: (progress * 8.5).toFixed(1), unit: '°C', color: '#EF4444', bar: progress },
        { label: '吸收能', value: (peakStress * strain * 0.5).toFixed(3), unit: 'MJ/m³', color: '#1DD1A1' },
      ];
    }
    case 'dataCollect': {
      return [
        { label: '采样率', value: '10', unit: 'MSa/s', color: '#00F5FF' },
        { label: '通道数', value: '4', unit: 'ch', color: '#1DD1A1' },
        { label: '信噪比', value: '>60', unit: 'dB', color: '#10B981' },
        { label: '触发电平', value: '50', unit: 'mV', color: '#FFD700' },
        { label: '记录长度', value: '8192', unit: 'pts', color: '#8B5CF6' },
        { label: '数据质量', value: 'OK', unit: '', color: '#10B981' },
      ];
    }
    default:
      return [];
  }
}

/** 应变片实时读数气泡 */
function renderStrainGaugeReadouts(
  ctx: CanvasRenderingContext2D,
  sgPositions: { x: number; y: number }[],
  stage: ExperimentStage,
  progress: number,
  voltage: number,
  time: number
) {
  if (stage !== 'wavePropagate' && stage !== 'deformation' && stage !== 'dataCollect') return;

  ctx.save();
  // 基于实验数据：入射波峰值 ~697mV，反射 ~610mV，透射 ~545mV
  const peakIncidentMv = 697 * (voltage / 3000);
  const peakReflectedMv = 610 * (voltage / 3000);
  const peakTransmittedMv = 545 * (voltage / 3000);

  // 各应变片的信号值（基于波传播位置和实验数据电压幅度）
  const sgValues = sgPositions.map((sg, i) => {
    const isIncident = i < 2;
    const relPos = isIncident ? (i === 0 ? 0.3 : 0.6) : (i === 2 ? 0.4 : 0.7);

    let signalMv = 0;
    if (stage === 'dataCollect') {
      // 数据采集阶段显示最终值（带微小波动模拟真实读数）
      signalMv = isIncident
        ? peakIncidentMv * 0.8 * (1 - relPos * 0.15) + Math.sin(time * 0.005 + i) * 2
        : peakTransmittedMv * 0.75 * (1 - relPos * 0.1) + Math.sin(time * 0.005 + i + 2) * 1.5;
    } else {
      // 波传播阶段：钟形脉冲经过各应变片位置
      const waveFront = progress * 1.5;
      if (isIncident) {
        // 入射波经过
        if (waveFront > relPos) {
          const localProg = Math.min(1, (waveFront - relPos) / 0.35);
          // 钟形包络（sin²上升 + cos下降）
          const env = localProg < 0.42
            ? Math.pow(Math.sin(localProg / 0.42 * Math.PI / 2), 2)
            : Math.max(0, Math.cos((localProg - 0.42) / 0.58 * Math.PI / 2));
          signalMv = peakIncidentMv * env;
        }
        // 反射波叠加
        if (progress > 0.45) {
          const refFront = 1 - (progress - 0.45) / 0.55;
          if (refFront < relPos) {
            const localProg = Math.min(1, (relPos - refFront) / 0.3);
            signalMv += peakReflectedMv * localProg * Math.exp(-0.5 * localProg) * 0.6;
          }
        }
      } else {
        // 透射杆
        if (progress > 0.45) {
          const transFront = (progress - 0.45) / 0.55 * 1.3;
          if (transFront > relPos) {
            const localProg = Math.min(1, (transFront - relPos) / 0.35);
            const env = localProg < 0.42
              ? Math.pow(Math.sin(localProg / 0.42 * Math.PI / 2), 2)
              : Math.max(0, Math.cos((localProg - 0.42) / 0.58 * Math.PI / 2));
            signalMv = peakTransmittedMv * env;
          }
        }
      }
    }

    return { x: sg.x, y: sg.y, value: signalMv, label: `SG${i + 1}` };
  });

  // 绘制读数气泡
  sgValues.forEach((sg) => {
    if (Math.abs(sg.value) < 0.1) return;

    const bubbleW = 52;
    const bubbleH = 18;
    const bx = sg.x - bubbleW / 2;
    const by = sg.y - bubbleH - 6;

    // 气泡背景
    roundRect(ctx, bx, by, bubbleW, bubbleH, 3);
    ctx.fillStyle = 'rgba(5,16,32,0.9)';
    ctx.fill();
    ctx.strokeStyle = sg.value > 0 ? 'rgba(0,245,255,0.4)' : 'rgba(239,68,68,0.4)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // 小三角指向应变片
    ctx.fillStyle = 'rgba(5,16,32,0.9)';
    ctx.beginPath();
    ctx.moveTo(sg.x - 3, by + bubbleH);
    ctx.lineTo(sg.x, by + bubbleH + 4);
    ctx.lineTo(sg.x + 3, by + bubbleH);
    ctx.closePath();
    ctx.fill();

    // 数值（实验电压量级 mV，保留整数）
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = sg.value > 0 ? '#00F5FF' : '#EF4444';
    const displayMv = Math.abs(sg.value) >= 100
      ? `${(sg.value / 1000).toFixed(2)}V`
      : `${sg.value.toFixed(0)}mV`;
    ctx.fillText(displayMv, sg.x, by + 11);
  });

  ctx.restore();
}

/** 能量流动路径可视化 */
function renderEnergyFlowPath(
  ctx: CanvasRenderingContext2D,
  cap: { x: number; w: number },
  coil: { x: number; w: number },
  striker: { startX: number; endX: number },
  incX: number, incLen: number,
  specCx: number,
  transX: number, transLen: number,
  cy: number,
  stage: ExperimentStage,
  progress: number,
  time: number
) {
  if (stage === 'idle') return;

  ctx.save();

  // 能量流标记点（沿着系统从左到右）
  const flowY = LAYOUT.baseY + 25;
  const nodes = [
    { x: cap.x + cap.w / 2, label: 'E_电', active: stage === 'charging' || stage === 'coilAccel' },
    { x: coil.x + coil.w / 2, label: 'E_磁', active: stage === 'coilAccel' },
    { x: (striker.startX + striker.endX) / 2, label: 'E_动', active: stage === 'strikerLaunch' || stage === 'coilAccel' },
    { x: incX + incLen / 2, label: 'E_波', active: stage === 'wavePropagate' || stage === 'deformation' },
    { x: specCx, label: 'E_形变', active: stage === 'deformation' },
    { x: transX + transLen / 2, label: 'E_透射', active: stage === 'wavePropagate' || stage === 'deformation' },
  ];

  // 连接线
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 5]);
  ctx.beginPath();
  ctx.moveTo(nodes[0].x, flowY);
  ctx.lineTo(nodes[nodes.length - 1].x, flowY);
  ctx.stroke();
  ctx.setLineDash([]);

  // 能量流动粒子（沿路径移动）
  const activeStart = nodes.findIndex(n => n.active);
  const activeEnd = nodes.length - 1 - [...nodes].reverse().findIndex(n => n.active);
  if (activeStart >= 0 && activeEnd >= activeStart) {
    const startX = nodes[activeStart].x;
    const endX = nodes[activeEnd].x;
    const particleCount = 5;
    for (let i = 0; i < particleCount; i++) {
      const t = ((time * 0.002 + i / particleCount) % 1);
      const px = startX + (endX - startX) * t;
      const py = flowY + Math.sin(t * Math.PI * 4 + time * 0.005) * 2;
      const alpha = Math.sin(t * Math.PI) * 0.6;
      ctx.fillStyle = colorWithAlpha('#FFD700', alpha);
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 节点标记
  nodes.forEach((node) => {
    // 节点圆点
    ctx.fillStyle = node.active
      ? colorWithAlpha('#FFD700', 0.6 + 0.3 * Math.sin(time * 0.006))
      : 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.arc(node.x, flowY, node.active ? 3.5 : 2, 0, Math.PI * 2);
    ctx.fill();

    // 活跃节点发光
    if (node.active) {
      ctx.fillStyle = colorWithAlpha('#FFD700', 0.1);
      ctx.beginPath();
      ctx.arc(node.x, flowY, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 标签
    ctx.font = '6px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = node.active ? 'rgba(255,215,0,0.7)' : 'rgba(255,255,255,0.2)';
    ctx.fillText(node.label, node.x, flowY + 12);
  });

  ctx.restore();
}

/** 阶段信息面板 - 左下角 */
function renderStageInfoPanel(
  ctx: CanvasRenderingContext2D,
  stage: ExperimentStage,
  stageIdx: number,
  stageProgress: number,
  globalProgress: number,
  playing: boolean,
  complete: boolean,
  time: number
) {
  ctx.save();

  const px = 15;
  const py = DESIGN_H - 90;
  const pw = 185;
  const ph = 72;

  // 背景
  roundRect(ctx, px, py, pw, ph, 4);
  ctx.fillStyle = 'rgba(5,16,32,0.85)';
  ctx.fill();
  ctx.strokeStyle = complete
    ? 'rgba(255,215,0,0.3)'
    : playing
      ? 'rgba(0,245,255,0.25)'
      : 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // 状态指示
  const statusColor = complete ? '#FFD700' : playing ? '#10B981' : '#6B7280';
  const statusText = complete ? 'COMPLETE' : playing ? 'RUNNING' : 'STANDBY';
  ctx.fillStyle = colorWithAlpha(statusColor, 0.15);
  ctx.fillRect(px + 1, py + 1, pw - 2, 12);

  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = statusColor;
  ctx.fillText(`● ${statusText}`, px + 5, py + 9);

  // 总进度
  ctx.font = '7px monospace';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText(`${(globalProgress * 100).toFixed(0)}%`, px + pw - 5, py + 9);

  // 当前阶段
  const stageName = STAGE_NAMES[stage] || stage;
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(`${stageIdx >= 0 ? stageIdx + 1 : 0}/6 ${stageName}`, px + 5, py + 24);

  // 阶段进度条
  const barX = px + 5;
  const barW = pw - 10;
  const barY = py + 28;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(barX, barY, barW, 3);
  if (stage !== 'idle') {
    const grad = ctx.createLinearGradient(barX, 0, barX + barW * stageProgress, 0);
    grad.addColorStop(0, '#00F5FF');
    grad.addColorStop(1, '#1DD1A1');
    ctx.fillStyle = grad;
    ctx.fillRect(barX, barY, barW * stageProgress, 3);
  }

  // 物理公式
  const physics = STAGE_PHYSICS[stage] || ['---'];
  ctx.font = '6.5px monospace';
  ctx.fillStyle = 'rgba(0,245,255,0.5)';
  ctx.textAlign = 'left';
  physics.forEach((line, i) => {
    ctx.fillText(line, px + 5, py + 40 + i * 10);
  });

  ctx.restore();
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
