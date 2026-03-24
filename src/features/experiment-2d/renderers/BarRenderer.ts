// src/features/experiment-2d/renderers/BarRenderer.ts
// 入射杆 + 透射杆渲染器 - 长圆柱体、应变片、应力波可视化
import {
  COLORS, drawMetalCylinder, drawStrainGauge, drawVSupport,
  drawFlange, drawDimension, colorWithAlpha, lerp,
} from '../utils/canvasHelpers';
import type { ExperimentStage } from '@/hooks/useExperimentAnimation';

interface BarRendererProps {
  ctx: CanvasRenderingContext2D;
  x: number;
  cy: number;
  length: number;
  barHeight: number;
  type: 'incident' | 'transmitted';
  stage: ExperimentStage;
  stageProgress: number;
  time: number;
  voltage: number;
  baseY: number; // 底座基准线
}

export function renderBar({
  ctx, x, cy, length, barHeight, type, stage, stageProgress, time, voltage, baseY,
}: BarRendererProps) {
  ctx.save();
  const barY = cy - barHeight / 2;
  const isIncident = type === 'incident';
  const barColor = isIncident ? COLORS.steel : {
    ...COLORS.steel,
    base: '#7DA09E',
    light: '#A4C4C2',
    dark: '#5A7A78',
    highlight: '#C4E0DE',
  };

  // 杆体
  drawMetalCylinder(ctx, x, barY, length, barHeight, barColor, { borderRadius: 1 });

  // 加工线纹(轴向)
  ctx.strokeStyle = colorWithAlpha(barColor.dark, 0.08);
  ctx.lineWidth = 0.3;
  for (let i = 0; i < 4; i++) {
    const ly = barY + barHeight * (0.2 + i * 0.2);
    ctx.beginPath();
    ctx.moveTo(x + 1, ly);
    ctx.lineTo(x + length - 1, ly);
    ctx.stroke();
  }

  // 法兰盘
  const flangeH = barHeight + 8;
  drawFlange(ctx, x, cy, flangeH, barHeight, barColor);
  drawFlange(ctx, x + length, cy, flangeH, barHeight, barColor);

  // V型支撑座(2个)
  const sup1X = x + length * 0.25;
  const sup2X = x + length * 0.75;
  drawVSupport(ctx, sup1X, barY + barHeight, baseY);
  drawVSupport(ctx, sup2X, barY + barHeight, baseY);

  // 应变片
  const sgActive = stage === 'wavePropagate' || stage === 'deformation' || stage === 'dataCollect';
  if (isIncident) {
    drawStrainGauge(ctx, x + length * 0.3, cy, barHeight, 'SG1', sgActive);
    drawStrainGauge(ctx, x + length * 0.6, cy, barHeight, 'SG2', sgActive);
  } else {
    drawStrainGauge(ctx, x + length * 0.4, cy, barHeight, 'SG3', sgActive);
    drawStrainGauge(ctx, x + length * 0.7, cy, barHeight, 'SG4', sgActive);
  }

  // 应力波可视化
  if (stage === 'wavePropagate' || stage === 'deformation') {
    renderStressWave(ctx, x, barY, length, barHeight, type, stage, stageProgress, time, voltage);
  }

  // 尺寸标注
  const dimLabel = isIncident ? 'L=1500mm' : 'L=1200mm';
  drawDimension(ctx, x + 5, barY + barHeight + 2, x + length - 5, barY + barHeight + 2, dimLabel, 18, {
    color: 'rgba(255,255,255,0.2)', fontSize: 7,
  });

  // 直径标注
  drawDimension(ctx, x + length + 3, barY, x + length + 3, barY + barHeight, 'Φ20mm', 14, {
    color: 'rgba(255,255,255,0.2)', fontSize: 7,
  });

  ctx.restore();
}

function renderStressWave(
  ctx: CanvasRenderingContext2D,
  x: number, barY: number, length: number, barH: number,
  type: 'incident' | 'transmitted',
  stage: ExperimentStage, progress: number, time: number, voltage: number
) {
  const cy = barY + barH / 2;
  // 波形绘制在杆的上方/下方
  const waveAmplitude = 12 + (voltage / 4000) * 8;
  const pulseWidth = length * 0.25; // 脉冲宽度

  ctx.save();

  if (type === 'incident') {
    // ── 入射波(蓝色脉冲，从左向右) ──
    const incidentProgress = Math.min(1, progress * 1.6);
    const waveHeadX = x + length * incidentProgress;
    const waveTailX = Math.max(x, waveHeadX - pulseWidth);

    if (incidentProgress > 0) {
      drawPulseWave(ctx, waveTailX, waveHeadX, barY, barH, waveAmplitude,
        COLORS.incidentWave, 'above', time);
      // 波前发光
      drawWaveFrontGlow(ctx, waveHeadX, cy, waveAmplitude, COLORS.incidentWave);
      // 杆内颜色带
      drawBarStressColor(ctx, x, barY, waveTailX - x, waveHeadX - waveTailX, barH,
        COLORS.incidentWave, 0.08);
    }

    // ── 反射波(红色脉冲，从试样向左返回) ──
    if (progress > 0.5) {
      const refProgress = (progress - 0.5) / 0.5;
      const refHeadX = x + length - length * refProgress;
      const refTailX = Math.min(x + length, refHeadX + pulseWidth * 0.7);

      drawPulseWave(ctx, refHeadX, refTailX, barY, barH, waveAmplitude * 0.4,
        COLORS.reflectedWave, 'below', time);
      drawWaveFrontGlow(ctx, refHeadX, cy, waveAmplitude * 0.4, COLORS.reflectedWave);
      drawBarStressColor(ctx, x, barY, refHeadX - x, refTailX - refHeadX, barH,
        COLORS.reflectedWave, 0.06);
    }
  } else {
    // ── 透射波(绿色脉冲，从试样向右传播) ──
    if (progress > 0.5) {
      const transProgress = (progress - 0.5) / 0.5;
      const waveHeadX = x + length * Math.min(1, transProgress * 1.3);
      const waveTailX = Math.max(x, waveHeadX - pulseWidth * 0.6);

      drawPulseWave(ctx, waveTailX, waveHeadX, barY, barH, waveAmplitude * 0.65,
        COLORS.transmittedWave, 'above', time);
      drawWaveFrontGlow(ctx, waveHeadX, cy, waveAmplitude * 0.6, COLORS.transmittedWave);
      drawBarStressColor(ctx, x, barY, waveTailX - x, waveHeadX - waveTailX, barH,
        COLORS.transmittedWave, 0.06);
    }
  }

  ctx.restore();
}

/** 绘制脉冲形波形（在杆上方或下方） */
function drawPulseWave(
  ctx: CanvasRenderingContext2D,
  startX: number, endX: number,
  barY: number, barH: number, amplitude: number,
  color: string, side: 'above' | 'below', time: number
) {
  if (endX - startX < 3) return;

  const baseY = side === 'above' ? barY - 2 : barY + barH + 2;
  const dir = side === 'above' ? -1 : 1;
  const pts: { x: number; y: number }[] = [];
  const step = 1.5;
  const pulseLen = endX - startX;

  for (let px = startX; px <= endX; px += step) {
    const t = (px - startX) / pulseLen;
    // 非对称高斯脉冲（前沿陡后沿缓）
    let envelope: number;
    if (t < 0.3) {
      // 上升沿（陡）
      envelope = Math.pow(t / 0.3, 2);
    } else if (t < 0.5) {
      // 峰值平台
      envelope = 1.0;
    } else {
      // 下降沿（缓）
      envelope = Math.exp(-3 * Math.pow((t - 0.5) / 0.5, 2));
    }
    // 微小波纹叠加
    const ripple = 1 + 0.05 * Math.sin(px * 0.3 + time * 0.003);
    const y = baseY + dir * amplitude * envelope * ripple;
    pts.push({ x: px, y });
  }

  if (pts.length < 2) return;

  // 填充区域
  ctx.beginPath();
  ctx.moveTo(pts[0].x, baseY);
  for (const p of pts) ctx.lineTo(p.x, p.y);
  ctx.lineTo(pts[pts.length - 1].x, baseY);
  ctx.closePath();
  ctx.fillStyle = colorWithAlpha(color, 0.1);
  ctx.fill();

  // 描边
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.strokeStyle = colorWithAlpha(color, 0.8);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 顶部高亮线
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.strokeStyle = colorWithAlpha(color, 0.3);
  ctx.lineWidth = 3;
  ctx.stroke();
}

/** 波前发光效果 */
function drawWaveFrontGlow(
  ctx: CanvasRenderingContext2D,
  x: number, cy: number, size: number, color: string
) {
  const grad = ctx.createRadialGradient(x, cy, 0, x, cy, size + 5);
  grad.addColorStop(0, colorWithAlpha(color, 0.4));
  grad.addColorStop(0.4, colorWithAlpha(color, 0.15));
  grad.addColorStop(1, colorWithAlpha(color, 0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, cy, size + 5, 0, Math.PI * 2);
  ctx.fill();
}

/** 杆内应力颜色带 */
function drawBarStressColor(
  ctx: CanvasRenderingContext2D,
  barX: number, barY: number,
  offsetX: number, width: number, barH: number,
  color: string, opacity: number
) {
  if (width <= 0) return;
  const grad = ctx.createLinearGradient(barX + offsetX, 0, barX + offsetX + width, 0);
  grad.addColorStop(0, colorWithAlpha(color, 0));
  grad.addColorStop(0.3, colorWithAlpha(color, opacity));
  grad.addColorStop(0.7, colorWithAlpha(color, opacity));
  grad.addColorStop(1, colorWithAlpha(color, 0));
  ctx.fillStyle = grad;
  ctx.fillRect(barX + offsetX, barY, width, barH);
}
