// src/features/experiment-2d/renderers/SpecimenRenderer.ts
// 试样渲染器 - 材料特定颜色/纹理、变形动画、温度色图
import {
  COLORS, colorWithAlpha, createGlowGradient, roundRect, lerp, smoothstep,
} from '../utils/canvasHelpers';
import type { ExperimentStage } from '@/hooks/useExperimentAnimation';

type MaterialCategory = 'metal' | 'polymer' | 'foam' | 'rock' | 'concrete' | 'ceramic';

interface SpecimenProps {
  ctx: CanvasRenderingContext2D;
  cx: number;
  cy: number;
  width: number;
  height: number;
  stage: ExperimentStage;
  stageProgress: number;
  time: number;
  materialName: string;
  materialColor: string;
  materialCategory: MaterialCategory;
  stiffnessK: number;
}

// 材料类别颜色映射
const CATEGORY_COLORS: Record<MaterialCategory, { fill: string; stroke: string }> = {
  metal: { fill: '#9CA3AF', stroke: '#6B7280' },
  polymer: { fill: '#60A5FA', stroke: '#3B82F6' },
  foam: { fill: '#FCD34D', stroke: '#F59E0B' },
  rock: { fill: '#A78BFA', stroke: '#7C3AED' },
  concrete: { fill: '#9CA3AF', stroke: '#6B7280' },
  ceramic: { fill: '#F9A8D4', stroke: '#EC4899' },
};

export function renderSpecimen({
  ctx, cx, cy, width, height, stage, stageProgress, time,
  materialName, materialColor, materialCategory, stiffnessK,
}: SpecimenProps) {
  ctx.save();

  const isDeforming = stage === 'deformation';
  const hasDeformed = stage === 'dataCollect';
  const isImpacting = stage === 'wavePropagate';
  const deformProgress = isDeforming ? smoothstep(stageProgress) : hasDeformed ? 1 : 0;

  // 刚度因子(高刚度=小变形)
  const stiffFactor = Math.max(0.2, Math.min(1, 1 - stiffnessK / 400));
  const deformAmount = deformProgress * stiffFactor;

  // 变形后尺寸
  const deformedW = width * (1 - deformAmount * 0.3); // 轴向压缩
  const deformedH = height * (1 + deformAmount * 0.25); // 径向膨胀(泊松)
  const sx = cx - deformedW / 2;
  const sy = cy - deformedH / 2;

  const colors = CATEGORY_COLORS[materialCategory] || CATEGORY_COLORS.metal;
  const fillColor = materialColor || colors.fill;

  // 根据材料类别绘制不同变形
  if (materialCategory === 'rock' || materialCategory === 'concrete' || materialCategory === 'ceramic') {
    // 脆性材料 — 裂纹
    renderBrittleSpecimen(ctx, cx, cy, deformedW, deformedH, fillColor, colors.stroke, deformAmount, time);
  } else if (materialCategory === 'foam') {
    // 泡沫材料 — 压溃
    renderFoamSpecimen(ctx, cx, cy, deformedW, deformedH, fillColor, colors.stroke, deformAmount, time);
  } else {
    // 韧性材料(金属/聚合物) — 鼓胀
    renderDuctileSpecimen(ctx, cx, cy, deformedW, deformedH, fillColor, colors.stroke, deformAmount, time);
  }

  // 撞击时闪光
  if (isImpacting && stageProgress > 0.3 && stageProgress < 0.7) {
    const flashT = (stageProgress - 0.3) / 0.4;
    const flashIntensity = Math.sin(flashT * Math.PI);
    ctx.fillStyle = createGlowGradient(ctx, cx, cy, 25, COLORS.safetyYellow, flashIntensity * 0.3);
    ctx.fillRect(cx - 25, cy - 25, 50, 50);
  }

  // 温度色图叠加(变形时)
  if (deformAmount > 0.2) {
    const tempGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(deformedW, deformedH));
    tempGrad.addColorStop(0, colorWithAlpha('#EF4444', deformAmount * 0.2));
    tempGrad.addColorStop(0.4, colorWithAlpha('#F59E0B', deformAmount * 0.1));
    tempGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = tempGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, deformedW / 2 + 2, deformedH / 2 + 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 材料名称标注
  ctx.font = '7px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText(materialName || '试样', cx, cy + deformedH / 2 + 12);

  // 尺寸标注
  ctx.font = '6px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillText(`Φ${width.toFixed(0)}×${height.toFixed(0)}mm`, cx, cy + deformedH / 2 + 20);

  ctx.restore();
}

function renderDuctileSpecimen(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, w: number, h: number,
  fillColor: string, strokeColor: string,
  deform: number, time: number
) {
  // 鼓胀形状(中间粗两端细)
  const bulge = deform * h * 0.15;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy - h / 2);
  // 左侧曲线
  ctx.bezierCurveTo(
    cx - w / 2 - bulge, cy - h / 4,
    cx - w / 2 - bulge, cy + h / 4,
    cx - w / 2, cy + h / 2
  );
  ctx.lineTo(cx + w / 2, cy + h / 2);
  // 右侧曲线
  ctx.bezierCurveTo(
    cx + w / 2 + bulge, cy + h / 4,
    cx + w / 2 + bulge, cy - h / 4,
    cx + w / 2, cy - h / 2
  );
  ctx.closePath();

  // 金属渐变
  const grad = ctx.createLinearGradient(cx, cy - h / 2, cx, cy + h / 2);
  grad.addColorStop(0, colorWithAlpha(fillColor, 0.7));
  grad.addColorStop(0.3, colorWithAlpha(fillColor, 1));
  grad.addColorStop(0.5, colorWithAlpha('#fff', 0.15));
  grad.addColorStop(0.7, colorWithAlpha(fillColor, 0.9));
  grad.addColorStop(1, colorWithAlpha(fillColor, 0.6));
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 0.8;
  ctx.stroke();
}

function renderBrittleSpecimen(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, w: number, h: number,
  fillColor: string, strokeColor: string,
  deform: number, time: number
) {
  // 基础矩形
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 0.8;
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, 1);
  ctx.fill();
  ctx.stroke();

  // 裂纹(变形时出现)
  if (deform > 0.15) {
    const crackIntensity = (deform - 0.15) / 0.85;
    ctx.strokeStyle = colorWithAlpha('#000', 0.4 + crackIntensity * 0.4);
    ctx.lineWidth = 0.5 + crackIntensity * 0.8;

    // 主裂纹
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 + 1, cy - 2);
    ctx.lineTo(cx - w * 0.1, cy - 1 - crackIntensity * 3);
    ctx.lineTo(cx + w * 0.05, cy + crackIntensity * 2);
    ctx.lineTo(cx + w / 2 - 1, cy + 1);
    ctx.stroke();

    // 分支裂纹
    if (crackIntensity > 0.4) {
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx - 3, cy - h / 3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 2, cy + 1);
      ctx.lineTo(cx + 4, cy + h / 3);
      ctx.stroke();
    }

    // 碎片飞溅
    if (crackIntensity > 0.7) {
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + time * 0.002;
        const dist = (crackIntensity - 0.7) * 30;
        const fx = cx + Math.cos(angle) * dist;
        const fy = cy + Math.sin(angle) * dist;
        ctx.fillStyle = colorWithAlpha(fillColor, 0.4);
        ctx.fillRect(fx - 1, fy - 1, 2, 2);
      }
    }
  }
}

function renderFoamSpecimen(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, w: number, h: number,
  fillColor: string, strokeColor: string,
  deform: number, _time: number
) {
  // 压溃后高度减小
  const crushH = h * (1 - deform * 0.5);
  const crushY = cy - crushH / 2 + deform * h * 0.15;

  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 0.8;
  roundRect(ctx, cx - w / 2, crushY, w, crushH, 1);
  ctx.fill();
  ctx.stroke();

  // 泡沫气孔
  ctx.fillStyle = colorWithAlpha('#000', 0.15);
  const poreCount = 6;
  for (let i = 0; i < poreCount; i++) {
    const px = cx - w / 3 + (i % 3) * (w / 4);
    const py = crushY + crushH * 0.2 + Math.floor(i / 3) * (crushH * 0.4);
    const pr = 1.5 * (1 - deform * 0.5); // 气孔被压扁
    ctx.beginPath();
    ctx.ellipse(px, py, pr, pr * (1 - deform * 0.3), 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
