// src/features/experiment-2d/renderers/CapacitorBankRenderer.ts
// 电容器组渲染器 - 8个圆柱形电容单元(2x4排列)
import {
  COLORS, drawMetalCylinder, roundRect, colorWithAlpha,
  createGlowGradient, drawLabel, drawDimension, lerp, smoothstep,
} from '../utils/canvasHelpers';
import type { ExperimentStage } from '@/hooks/useExperimentAnimation';

interface CapacitorBankProps {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  width: number;
  height: number;
  stage: ExperimentStage;
  stageProgress: number;
  voltage: number;
  time: number;
}

export function renderCapacitorBank({
  ctx, x, y, width, height, stage, stageProgress, voltage, time,
}: CapacitorBankProps) {
  const cx = x + width / 2;
  const cy = y + height / 2;

  // 充电状态
  const chargeLevel = stage === 'charging'
    ? smoothstep(stageProgress)
    : stage === 'idle' ? 0 : 1;

  // 外壳(安全黄边框)
  ctx.save();
  roundRect(ctx, x + 2, y + 2, width - 4, height - 4, 4);
  ctx.fillStyle = 'rgba(5,16,32,0.8)';
  ctx.fill();
  ctx.strokeStyle = chargeLevel > 0.5 ? colorWithAlpha(COLORS.safetyYellow, 0.5) : 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 高压警告标志
  if (chargeLevel > 0) {
    ctx.font = 'bold 7px sans-serif';
    ctx.fillStyle = colorWithAlpha(COLORS.safetyYellow, 0.5 + chargeLevel * 0.5);
    ctx.textAlign = 'center';
    ctx.fillText('⚡ HV', cx, y + 11);
  }

  // 8个电容单元 (2行4列)
  const cols = 4;
  const rows = 2;
  const cellW = (width - 24) / cols;
  const cellH = (height - 40) / rows;
  const startX = x + 12;
  const startY = y + 18;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cellX = startX + col * cellW;
      const cellY = startY + row * cellH;
      const cellCx = cellX + cellW / 2;
      const cellCy = cellY + cellH / 2;
      const unitW = cellW - 3;
      const unitH = cellH - 4;

      // 电容壳体(铝制)
      drawMetalCylinder(ctx, cellX + 1.5, cellY + 2, unitW, unitH, COLORS.aluminum, { borderRadius: 3 });

      // 充电液位(从下到上填充)
      if (chargeLevel > 0) {
        const fillH = unitH * chargeLevel;
        const fillY = cellY + 2 + unitH - fillH;
        ctx.save();
        roundRect(ctx, cellX + 1.5, cellY + 2, unitW, unitH, 3);
        ctx.clip();

        const fillGrad = ctx.createLinearGradient(cellX, fillY, cellX, cellY + 2 + unitH);
        fillGrad.addColorStop(0, colorWithAlpha(COLORS.cyan, 0.15));
        fillGrad.addColorStop(0.5, colorWithAlpha(COLORS.cyan, 0.25 + chargeLevel * 0.15));
        fillGrad.addColorStop(1, colorWithAlpha(COLORS.cyan, 0.05));
        ctx.fillStyle = fillGrad;
        ctx.fillRect(cellX + 1.5, fillY, unitW, fillH);

        // 液面波动
        if (stage === 'charging') {
          ctx.strokeStyle = colorWithAlpha(COLORS.cyan, 0.4);
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          for (let px = 0; px < unitW; px++) {
            const wx = cellX + 1.5 + px;
            const wy = fillY + Math.sin((px + time * 0.003) * 0.5) * 1;
            if (px === 0) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
          }
          ctx.stroke();
        }
        ctx.restore();
      }

      // 端子(顶部正负极)
      ctx.fillStyle = COLORS.copper.base;
      ctx.fillRect(cellCx - 4, cellY, 3, 3);
      ctx.fillStyle = COLORS.brass.base;
      ctx.fillRect(cellCx + 1, cellY, 3, 3);

      // +/- 标记
      ctx.font = 'bold 5px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('+', cellCx - 2.5, cellY - 1);
      ctx.fillStyle = '#3B82F6';
      ctx.fillText('−', cellCx + 2.5, cellY - 1);
    }
  }

  // 母线连接(铜)
  const busY = startY - 3;
  ctx.strokeStyle = COLORS.copper.base;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(startX + cellW / 2, busY);
  ctx.lineTo(startX + (cols - 0.5) * cellW, busY);
  ctx.stroke();

  // 充电发光效果
  if (chargeLevel > 0.3 && stage === 'charging') {
    ctx.fillStyle = createGlowGradient(ctx, cx, cy, width * 0.6, COLORS.cyan, chargeLevel * 0.15);
    ctx.fillRect(x, y, width, height);

    // 火花粒子
    const sparkCount = Math.floor(chargeLevel * 6);
    for (let i = 0; i < sparkCount; i++) {
      const angle = (time * 0.005 + i * 1.1) % (Math.PI * 2);
      const dist = 5 + Math.sin(time * 0.008 + i) * 10;
      const sx = cx + Math.cos(angle) * dist;
      const sy = cy + Math.sin(angle) * dist;
      const sparkSize = 1 + Math.random() * 1.5;
      ctx.fillStyle = colorWithAlpha(COLORS.safetyYellow, 0.5 + Math.random() * 0.5);
      ctx.beginPath();
      ctx.arc(sx, sy, sparkSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 电压读数
  const displayVoltage = lerp(0, voltage, chargeLevel);
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = chargeLevel > 0.8 ? COLORS.safetyYellow : '#fff';
  ctx.fillText(`${Math.round(displayVoltage)}V`, cx, y + height - 5);

  // 储能读数
  const energy = (voltage * voltage * 0.0003 * chargeLevel).toFixed(1);
  ctx.font = '7px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText(`${energy} kJ`, cx, y + height + 6);

  ctx.restore();
}
