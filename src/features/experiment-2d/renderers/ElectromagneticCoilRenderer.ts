// src/features/experiment-2d/renderers/ElectromagneticCoilRenderer.ts
// 三级电磁线圈渲染器 - 截面图+磁场线+依次激活
import {
  COLORS, colorWithAlpha, createGlowGradient, drawMetalCylinder,
  roundRect, lerp, smoothstep,
} from '../utils/canvasHelpers';
import type { ExperimentStage } from '@/hooks/useExperimentAnimation';

interface CoilRendererProps {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  width: number;
  height: number;
  stage: ExperimentStage;
  stageProgress: number;
  time: number;
}

export function renderElectromagneticCoil({
  ctx, x, y, width, height, stage, stageProgress, time,
}: CoilRendererProps) {
  const cy = y + height / 2;
  const coilCount = 3;
  const coilW = (width - 10) / coilCount;
  const coilGap = 3;

  // 激活状态
  const isCoilStage = stage === 'coilAccel';
  const coilActivations = [0, 0, 0];
  if (isCoilStage) {
    // 三级依次激活: 0-33% -> I级, 33-66% -> II级, 66-100% -> III级
    coilActivations[0] = smoothstep(stageProgress * 3);
    coilActivations[1] = smoothstep(stageProgress * 3 - 1);
    coilActivations[2] = smoothstep(stageProgress * 3 - 2);
  } else if (stage !== 'idle' && stage !== 'charging') {
    coilActivations[0] = 1;
    coilActivations[1] = 1;
    coilActivations[2] = 1;
  }

  // 弹丸通道(中心线)
  const channelH = 12;
  const channelY = cy - channelH / 2;
  ctx.fillStyle = 'rgba(5,16,32,0.9)';
  ctx.fillRect(x, channelY, width, channelH);
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x, channelY, width, channelH);

  for (let i = 0; i < coilCount; i++) {
    const coilX = x + 5 + i * (coilW + coilGap);
    const activation = coilActivations[i];
    const label = `${['I', 'II', 'III'][i]}级`;

    // 外壳(截面)
    const shellH = height - 8;
    const shellY = y + 4;
    roundRect(ctx, coilX, shellY, coilW - coilGap, shellH, 3);
    ctx.fillStyle = colorWithAlpha(COLORS.steel.dark, 0.6);
    ctx.fill();
    ctx.strokeStyle = activation > 0
      ? colorWithAlpha(COLORS.cyan, 0.3 + activation * 0.5)
      : 'rgba(255,255,255,0.1)';
    ctx.lineWidth = activation > 0 ? 1 : 0.5;
    ctx.stroke();

    // 绕组(铜线截面 — 一排小圈)
    const windingRows = 2;
    const windingsPerRow = 5;
    const wStartX = coilX + 3;
    const wSpacing = (coilW - coilGap - 6) / windingsPerRow;

    for (let wr = 0; wr < windingRows; wr++) {
      const wBaseY = wr === 0
        ? shellY + 4
        : shellY + shellH - 8;

      for (let wc = 0; wc < windingsPerRow; wc++) {
        const wx = wStartX + wc * wSpacing + wSpacing / 2;
        const wy = wBaseY + 2;
        const wr2 = 2;

        ctx.beginPath();
        ctx.arc(wx, wy, wr2, 0, Math.PI * 2);

        if (activation > 0) {
          const glow = activation * (0.5 + 0.5 * Math.sin(time * 0.006 + wc * 0.5));
          ctx.fillStyle = colorWithAlpha(COLORS.copper.light, 0.5 + glow * 0.5);
        } else {
          ctx.fillStyle = COLORS.copper.dark;
        }
        ctx.fill();
        ctx.strokeStyle = COLORS.copper.base;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }

    // 磁场线(激活时)
    if (activation > 0.1) {
      ctx.save();
      ctx.globalAlpha = activation * 0.6;
      const fieldCx = coilX + (coilW - coilGap) / 2;

      // 内部横向磁场线(贝塞尔曲线)
      for (let fl = 0; fl < 3; fl++) {
        const offset = (fl - 1) * 3;
        ctx.strokeStyle = colorWithAlpha(COLORS.purple, 0.4 + activation * 0.3);
        ctx.lineWidth = 0.8;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(coilX + 3, cy + offset);
        ctx.bezierCurveTo(
          fieldCx, cy + offset - 5 * Math.sin(time * 0.004 + fl),
          fieldCx, cy + offset + 5 * Math.sin(time * 0.004 + fl + 1),
          coilX + coilW - coilGap - 3, cy + offset
        );
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 外部磁场环
      const envR = (coilW - coilGap) / 2 + 6;
      ctx.strokeStyle = colorWithAlpha(COLORS.purple, 0.15 + activation * 0.15);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.ellipse(fieldCx, cy, envR, shellH / 2 + 4, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    // 发光效果
    if (activation > 0.3) {
      const glowCx = coilX + (coilW - coilGap) / 2;
      ctx.fillStyle = createGlowGradient(ctx, glowCx, cy, coilW, COLORS.cyan, activation * 0.12);
      ctx.fillRect(coilX, shellY, coilW - coilGap, shellH);
    }

    // 级别标签
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = activation > 0.5
      ? colorWithAlpha(COLORS.cyan, 0.9)
      : 'rgba(255,255,255,0.35)';
    ctx.fillText(label, coilX + (coilW - coilGap) / 2, shellY + shellH + 10);

    // 电流箭头(激活时)
    if (activation > 0.5) {
      const arrowX = coilX + (coilW - coilGap) / 2;
      const arrowPhase = (time * 0.008 + i * 2) % 1;
      const arrowY = shellY + shellH * arrowPhase;
      ctx.fillStyle = colorWithAlpha(COLORS.cyan, activation * 0.7);
      ctx.beginPath();
      ctx.moveTo(arrowX - 2, arrowY);
      ctx.lineTo(arrowX, arrowY - 3);
      ctx.lineTo(arrowX + 2, arrowY);
      ctx.closePath();
      ctx.fill();
    }
  }
}
