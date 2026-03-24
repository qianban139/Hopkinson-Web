// src/features/experiment-2d/renderers/ConfiningDeviceRenderer.ts
// 围压装置渲染器 - 液压缸+压力表+油路
import {
  COLORS, colorWithAlpha, drawMetalCylinder, roundRect,
} from '../utils/canvasHelpers';

interface ConfiningProps {
  ctx: CanvasRenderingContext2D;
  cx: number;
  cy: number;
  specimenWidth: number;
  specimenHeight: number;
  enabled: boolean;
  pressure: number; // MPa
  time: number;
}

export function renderConfiningDevice({
  ctx, cx, cy, specimenWidth, specimenHeight, enabled, pressure, time,
}: ConfiningProps) {
  if (!enabled) return;

  ctx.save();
  const halfW = specimenWidth / 2 + 8;
  const halfH = specimenHeight / 2 + 6;

  // 液压缸外壳(上下两侧)
  const cylColor = { base: '#4A6B8A', light: '#6A8BA8', dark: '#2A4B6A', highlight: '#8AABCA' };
  const cylH = 8;

  // 上液压缸
  drawMetalCylinder(ctx, cx - halfW, cy - halfH - cylH, halfW * 2, cylH, cylColor, { borderRadius: 2 });
  // 下液压缸
  drawMetalCylinder(ctx, cx - halfW, cy + halfH, halfW * 2, cylH, cylColor, { borderRadius: 2 });

  // 压力箭头(指向试样)
  const arrColor = colorWithAlpha(COLORS.activeGreen, 0.5 + 0.3 * Math.sin(time * 0.005));
  ctx.strokeStyle = arrColor;
  ctx.fillStyle = arrColor;
  ctx.lineWidth = 1;

  // 上方压力箭头
  ctx.beginPath();
  ctx.moveTo(cx, cy - halfH - cylH);
  ctx.lineTo(cx, cy - halfH + 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 3, cy - halfH + 2 - 4);
  ctx.lineTo(cx, cy - halfH + 2);
  ctx.lineTo(cx + 3, cy - halfH + 2 - 4);
  ctx.fill();

  // 下方压力箭头
  ctx.beginPath();
  ctx.moveTo(cx, cy + halfH + cylH);
  ctx.lineTo(cx, cy + halfH - 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 3, cy + halfH - 2 + 4);
  ctx.lineTo(cx, cy + halfH - 2);
  ctx.lineTo(cx + 3, cy + halfH - 2 + 4);
  ctx.fill();

  // 油路(侧面连接)
  ctx.strokeStyle = colorWithAlpha('#F59E0B', 0.3);
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 2]);
  // 左侧油路
  ctx.beginPath();
  ctx.moveTo(cx - halfW, cy - halfH - cylH / 2);
  ctx.lineTo(cx - halfW - 10, cy - halfH - cylH / 2);
  ctx.lineTo(cx - halfW - 10, cy + halfH + cylH / 2);
  ctx.lineTo(cx - halfW, cy + halfH + cylH / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // 压力表(小圆形)
  const gaugeX = cx - halfW - 10;
  const gaugeY = cy;
  const gaugeR = 6;

  ctx.beginPath();
  ctx.arc(gaugeX, gaugeY, gaugeR, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(5,16,32,0.9)';
  ctx.fill();
  ctx.strokeStyle = colorWithAlpha(COLORS.steel.light, 0.4);
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // 压力读数
  ctx.font = 'bold 5px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.activeGreen;
  ctx.fillText(`${pressure}`, gaugeX, gaugeY + 1);
  ctx.font = '4px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('MPa', gaugeX, gaugeY + 6);

  ctx.restore();
}
