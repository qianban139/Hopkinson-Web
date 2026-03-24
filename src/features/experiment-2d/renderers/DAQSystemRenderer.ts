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

    // 入射波(蓝)
    drawMiniWave(ctx, screenX + 2, screenCy, screenW - 4, amp,
      COLORS.incidentWave, time, 0.1, 1);
    // 反射波(红)
    drawMiniWave(ctx, screenX + 2, screenCy, screenW - 4, amp * 0.35,
      COLORS.reflectedWave, time, 0.15, -0.5);
    // 透射波(绿)
    drawMiniWave(ctx, screenX + 2, screenCy, screenW - 4, amp * 0.6,
      COLORS.transmittedWave, time, 0.12, 0.8);

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
    const sigmaI = (voltage * 0.8).toFixed(0);
    const sigmaR = (voltage * 0.24).toFixed(0);
    const sigmaT = (voltage * 0.56).toFixed(0);

    ctx.fillStyle = COLORS.incidentWave;
    ctx.fillText(`σᵢ=${sigmaI}MPa`, x, valY);
    ctx.fillStyle = COLORS.reflectedWave;
    ctx.fillText(`σᵣ=${sigmaR}`, x + 45, valY);
    ctx.fillStyle = COLORS.transmittedWave;
    ctx.fillText(`σₜ=${sigmaT}`, x + 82, valY);
  }

  ctx.restore();
}

function drawMiniWave(
  ctx: CanvasRenderingContext2D,
  x: number, cy: number, w: number, amp: number,
  color: string, time: number, freq: number, phaseOffset: number
) {
  ctx.beginPath();
  ctx.strokeStyle = colorWithAlpha(color, 0.7);
  ctx.lineWidth = 0.8;

  for (let px = 0; px < w; px++) {
    const t = px / w;
    const envelope = Math.exp(-Math.pow((t - 0.4) / 0.2, 2));
    const wave = Math.sin((px + time * 0.04 + phaseOffset * 50) * freq) * amp * envelope;
    if (px === 0) ctx.moveTo(x + px, cy + wave);
    else ctx.lineTo(x + px, cy + wave);
  }
  ctx.stroke();
}
