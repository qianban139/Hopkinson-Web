// src/features/experiment-2d/renderers/StrikerBarRenderer.ts
// 撞击杆(子弹)渲染器 - 钢材纹理、加速运动、运动模糊
import {
  COLORS, drawMetalCylinder, colorWithAlpha, createGlowGradient,
  lerp, smoothstep, easeInOut,
} from '../utils/canvasHelpers';
import type { ExperimentStage } from '@/hooks/useExperimentAnimation';

interface StrikerBarProps {
  ctx: CanvasRenderingContext2D;
  /** 初始位置X */
  startX: number;
  /** 撞击目标位置X */
  endX: number;
  cy: number;
  barLength: number;
  barHeight: number;
  stage: ExperimentStage;
  stageProgress: number;
  time: number;
  voltage: number;
}

export function renderStrikerBar({
  ctx, startX, endX, cy, barLength, barHeight, stage, stageProgress, time, voltage,
}: StrikerBarProps) {
  ctx.save();

  // 计算位置
  let currentX = startX;
  let velocity = 0;
  const isLaunching = stage === 'strikerLaunch';
  const hasLaunched = stage === 'wavePropagate' || stage === 'deformation' || stage === 'dataCollect';

  if (isLaunching) {
    // 二次加速运动
    const t = easeInOut(stageProgress);
    currentX = lerp(startX, endX - barLength, t);
    velocity = (endX - startX) * stageProgress * 2; // 速度估算
  } else if (hasLaunched) {
    currentX = endX - barLength;
  }

  const barY = cy - barHeight / 2;

  // 运动模糊拖尾(发射中)
  if (isLaunching && stageProgress > 0.1) {
    const trailLen = Math.min(40, stageProgress * 60);
    const trailGrad = ctx.createLinearGradient(currentX - trailLen, 0, currentX, 0);
    trailGrad.addColorStop(0, 'rgba(100,160,220,0)');
    trailGrad.addColorStop(0.7, colorWithAlpha(COLORS.steel.light, 0.08));
    trailGrad.addColorStop(1, colorWithAlpha(COLORS.steel.light, 0.15));
    ctx.fillStyle = trailGrad;
    ctx.fillRect(currentX - trailLen, barY + 1, trailLen, barHeight - 2);
  }

  // 空气压缩波(前方)
  if (isLaunching && stageProgress > 0.3) {
    const waveX = currentX + barLength;
    const waveIntensity = smoothstep((stageProgress - 0.3) / 0.7);
    for (let i = 0; i < 3; i++) {
      const offset = i * 4 + Math.sin(time * 0.01) * 2;
      ctx.strokeStyle = colorWithAlpha('#fff', 0.05 + waveIntensity * 0.05 - i * 0.015);
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(waveX + offset, cy, barHeight / 2 + 3 + i * 3, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();
    }
  }

  // 撞击杆本体(钢材)
  drawMetalCylinder(ctx, currentX, barY, barLength, barHeight, COLORS.steel, { borderRadius: 1 });

  // 钢材纹理线
  ctx.strokeStyle = colorWithAlpha(COLORS.steel.dark, 0.15);
  ctx.lineWidth = 0.3;
  for (let i = 0; i < 3; i++) {
    const ly = barY + barHeight * (0.3 + i * 0.2);
    ctx.beginPath();
    ctx.moveTo(currentX + 2, ly);
    ctx.lineTo(currentX + barLength - 2, ly);
    ctx.stroke();
  }

  // 端面(左右两侧加工面)
  ctx.fillStyle = colorWithAlpha(COLORS.steel.light, 0.2);
  ctx.fillRect(currentX, barY, 2, barHeight);
  ctx.fillRect(currentX + barLength - 2, barY, 2, barHeight);

  // 撞击闪光效果
  if (isLaunching && stageProgress > 0.9) {
    const flashIntensity = smoothstep((stageProgress - 0.9) / 0.1);
    const flashX = currentX + barLength;
    ctx.fillStyle = createGlowGradient(ctx, flashX, cy, 20, COLORS.safetyYellow, flashIntensity * 0.6);
    ctx.fillRect(flashX - 20, cy - 20, 40, 40);

    // 溅射火花
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI - Math.PI / 2;
      const dist = flashIntensity * 12;
      const sx = flashX + Math.cos(angle) * dist;
      const sy = cy + Math.sin(angle) * dist;
      ctx.fillStyle = colorWithAlpha(COLORS.safetyYellow, 0.8 * (1 - flashIntensity * 0.5));
      ctx.beginPath();
      ctx.arc(sx, sy, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 速度标注(发射中)
  if (isLaunching && stageProgress > 0.05) {
    const bulletV = Math.sqrt(2 * voltage * voltage * 0.0003 * 1000 / 0.5) * stageProgress;
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = colorWithAlpha(COLORS.cyan, 0.8);
    ctx.fillText(`${bulletV.toFixed(0)} m/s`, currentX + barLength / 2, barY - 8);

    // 速度箭头
    ctx.strokeStyle = colorWithAlpha(COLORS.cyan, 0.5);
    ctx.lineWidth = 1;
    const arrX = currentX + barLength + 3;
    ctx.beginPath();
    ctx.moveTo(arrX, cy);
    ctx.lineTo(arrX + 10, cy);
    ctx.moveTo(arrX + 7, cy - 3);
    ctx.lineTo(arrX + 10, cy);
    ctx.lineTo(arrX + 7, cy + 3);
    ctx.stroke();
  }

  ctx.restore();
}
