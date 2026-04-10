// src/features/experiment-2d/renderers/DAQSystemRenderer.ts
// 数据采集系统渲染器 - 示波器/DAQ设备 + 信号电缆 + 实时波形
import {
  COLORS, colorWithAlpha, roundRect, drawMetalCylinder, lerp,
} from '../utils/canvasHelpers';
import type { ExperimentStage } from '@/hooks/useExperimentAnimation';

interface DAQProps {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  width: number;
  height: number;
  stage: ExperimentStage;
  stageProgress: number;
  time: number;
  voltage: number;
  // 信号线连接点
  sgPositions: { x: number; y: number }[];
}

export function renderDAQSystem({
  ctx, x, y, width, height, stage, stageProgress, time, voltage, sgPositions,
}: DAQProps) {
  ctx.save();
  const isCollecting = stage === 'dataCollect';
  const hasData = stage === 'wavePropagate' || stage === 'deformation' || isCollecting;

  // DAQ主体(暗色金属机箱)
  const daqColor = { base: '#2A3544', light: '#3A4A5C', dark: '#1A2534', highlight: '#4A5A6C' };
  drawMetalCylinder(ctx, x, y, width, height, daqColor, { borderRadius: 4 });

  // 前面板
  roundRect(ctx, x + 3, y + 3, width - 6, height - 6, 3);
  ctx.fillStyle = 'rgba(5,16,32,0.8)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,245,255,0.15)';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // 品牌/型号标签
  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = colorWithAlpha(COLORS.cyan, 0.5);
  ctx.fillText('DAQ-8CH', x + 8, y + 13);

  ctx.font = '6px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillText('100kHz · 16bit', x + 8, y + 21);

  // 采样率显示
  ctx.font = 'bold 8px monospace';
  ctx.fillStyle = hasData ? COLORS.cyan : 'rgba(255,255,255,0.2)';
  ctx.textAlign = 'right';
  ctx.fillText('100,000 fps', x + width - 8, y + 13);

  // 状态指示灯
  const ledX = x + width - 12;
  const ledY = y + 20;
  ctx.beginPath();
  ctx.arc(ledX, ledY, 2.5, 0, Math.PI * 2);
  if (isCollecting) {
    ctx.fillStyle = COLORS.activeGreen;
    // 闪烁
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 0.01);
  } else if (hasData) {
    ctx.fillStyle = COLORS.safetyYellow;
    ctx.globalAlpha = 0.7;
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
  }
  ctx.fill();
  ctx.globalAlpha = 1;

  // 迷你波形显示(底部)
  const screenX = x + 8;
  const screenY = y + 28;
  const screenW = width - 16;
  const screenH = height - 38;

  // 屏幕背景
  roundRect(ctx, screenX, screenY, screenW, screenH, 2);
  ctx.fillStyle = 'rgba(0,10,20,0.9)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,245,255,0.1)';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // 网格线
  ctx.strokeStyle = 'rgba(0,245,255,0.05)';
  ctx.lineWidth = 0.3;
  for (let i = 1; i < 4; i++) {
    const gy = screenY + (screenH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(screenX + 1, gy);
    ctx.lineTo(screenX + screenW - 1, gy);
    ctx.stroke();
  }
  for (let i = 1; i < 5; i++) {
    const gx = screenX + (screenW / 5) * i;
    ctx.beginPath();
    ctx.moveTo(gx, screenY + 1);
    ctx.lineTo(gx, screenY + screenH - 1);
    ctx.stroke();
  }

  // 波形数据显示
  if (hasData) {
    const screenCy = screenY + screenH / 2;
    const amp = screenH * 0.3;

    // 入射波(蓝) — 幅度比例基于实验数据
    drawMiniWave(ctx, screenX + 2, screenCy, screenW - 4, amp,
      COLORS.incidentWave, time, 0.42, 0);
    // 反射波(红) — 87% of 入射波, 反相
    drawMiniWave(ctx, screenX + 2, screenCy, screenW - 4, -amp * 0.87,
      COLORS.reflectedWave, time, 0.42, 0.35);
    // 透射波(绿) — 78% of 入射波
    drawMiniWave(ctx, screenX + 2, screenCy, screenW - 4, amp * 0.78,
      COLORS.transmittedWave, time, 0.42, 0.3);

    // "Recording" 标志
    if (isCollecting) {
      const recAlpha = 0.5 + 0.5 * Math.sin(time * 0.008);
      ctx.fillStyle = colorWithAlpha('#EF4444', recAlpha);
      ctx.beginPath();
      ctx.arc(screenX + screenW - 6, screenY + 6, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '5px monospace';
      ctx.fillStyle = colorWithAlpha('#EF4444', recAlpha);
      ctx.textAlign = 'right';
      ctx.fillText('REC', screenX + screenW - 10, screenY + 7);
    }
  }

  // 信号电缆连接(从应变片到DAQ)
  if (sgPositions.length > 0) {
    const cableColors = [COLORS.incidentWave, COLORS.incidentWave, COLORS.transmittedWave, COLORS.transmittedWave];
    const daqTopY = y;

    sgPositions.forEach((sg, i) => {
      const color = cableColors[i] || COLORS.cyan;
      const cableActive = hasData;

      ctx.strokeStyle = colorWithAlpha(color, cableActive ? 0.4 : 0.1);
      ctx.lineWidth = 0.8;
      ctx.setLineDash(cableActive ? [] : [2, 3]);

      // 贝塞尔曲线连接
      const inputX = x + 8 + i * 12;
      ctx.beginPath();
      ctx.moveTo(sg.x, sg.y);
      ctx.bezierCurveTo(
        sg.x, sg.y + 20,
        inputX, daqTopY - 15,
        inputX, daqTopY
      );
      ctx.stroke();
      ctx.setLineDash([]);

      // 数据流动画(活跃时)
      if (cableActive) {
        const dotPos = (time * 0.003 + i * 0.25) % 1;
        const dotX = lerp(sg.x, inputX, dotPos);
        const dotY = lerp(sg.y, daqTopY, dotPos);
        ctx.fillStyle = colorWithAlpha(color, 0.8);
        ctx.beginPath();
        ctx.arc(dotX, dotY, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // 输入端口标记
      ctx.fillStyle = colorWithAlpha(color, 0.5);
      ctx.fillRect(inputX - 1.5, daqTopY - 2, 3, 3);
    });
  }

  // 数值显示(底部)
  if (hasData) {
    const valY = y + height + 8;
    ctx.font = '7px monospace';
    ctx.textAlign = 'left';
    // 基于实验数据：峰值应力 ~72MPa @ 3000V，各波比例匹配实测
    const peakStress = 72 * (voltage / 3000);
    const sigmaI = peakStress.toFixed(1);
    const sigmaR = (peakStress * 0.87).toFixed(1);  // 反射波 87%
    const sigmaT = (peakStress * 0.78).toFixed(1);  // 透射波 78%

    ctx.fillStyle = COLORS.incidentWave;
    ctx.fillText(`σᵢ=${sigmaI}MPa`, x, valY);
    ctx.fillStyle = COLORS.reflectedWave;
    ctx.fillText(`σᵣ=${sigmaR}`, x + 45, valY);
    ctx.fillStyle = COLORS.transmittedWave;
    ctx.fillText(`σₜ=${sigmaT}`, x + 82, valY);
  }

  ctx.restore();
}

/** 迷你波形 — 使用真实 SHPB 钟形脉冲包络 */
function drawMiniWave(
  ctx: CanvasRenderingContext2D,
  x: number, cy: number, w: number, amp: number,
  color: string, time: number, peakPos: number, delay: number
) {
  ctx.beginPath();
  ctx.strokeStyle = colorWithAlpha(color, 0.8);
  ctx.lineWidth = 0.8;

  // 时间轴滚动 + 延迟偏移
  const scroll = (time * 0.0015 + delay) % 2;

  for (let px = 0; px < w; px++) {
    const t = (px / w + scroll) % 2;
    // 钟形脉冲包络（匹配实验数据 sin² 上升 + cos 下降）
    let envelope = 0;
    if (t > 0.15 && t < 0.85) {
      const pt = (t - 0.15) / 0.7; // 0→1 within pulse
      if (pt < peakPos) {
        const r = pt / peakPos;
        envelope = Math.sin(r * Math.PI / 2);
        envelope = envelope * envelope;
      } else {
        const d = (pt - peakPos) / (1 - peakPos);
        envelope = Math.max(0, Math.cos(d * Math.PI / 2) * 0.7 + Math.exp(-2.2 * d * d) * 0.3);
      }
    }
    const y = cy - amp * envelope;
    if (px === 0) ctx.moveTo(x + px, y);
    else ctx.lineTo(x + px, y);
  }
  ctx.stroke();
}
