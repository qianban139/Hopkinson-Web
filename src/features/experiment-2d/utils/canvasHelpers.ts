// src/features/experiment-2d/utils/canvasHelpers.ts
// Canvas绘图辅助函数 - 金属材质、工程标注、渐变工具

// ═══════════════════════════════════════════════
// 颜色常量
// ═══════════════════════════════════════════════

export const COLORS = {
  // 金属色系
  steel: { base: '#8B9DAF', light: '#B8C8D8', dark: '#5A6B7D', highlight: '#D1DDE8' },
  copper: { base: '#B87333', light: '#D4956A', dark: '#8B5A2B', highlight: '#E8B888' },
  brass: { base: '#C9A94E', light: '#DFC678', dark: '#9A7B2E', highlight: '#EADDA0' },
  aluminum: { base: '#A8B8C8', light: '#C8D6E2', dark: '#7A8E9E', highlight: '#E0EAF2' },

  // 功能色
  safetyYellow: '#F59E0B',
  dangerRed: '#EF4444',
  activeGreen: '#10B981',
  cyan: '#00F5FF',
  purple: '#8B5CF6',

  // 信号色
  incidentWave: '#3B82F6',
  reflectedWave: '#EF4444',
  transmittedWave: '#10B981',

  // 背景
  bg: '#0A2540',
  bgDark: '#051020',
  grid: 'rgba(0,245,255,0.03)',
  gridLine: 'rgba(0,245,255,0.06)',
  annotationLine: 'rgba(255,255,255,0.25)',
  annotationText: 'rgba(255,255,255,0.6)',
};

// ═══════════════════════════════════════════════
// 渐变创建
// ═══════════════════════════════════════════════

/** 创建金属圆柱体水平渐变(模拟3D光照) */
export function createCylinderGradient(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, width: number, height: number,
  color: { base: string; light: string; dark: string; highlight: string }
): CanvasGradient {
  const grad = ctx.createLinearGradient(x, y, x, y + height);
  grad.addColorStop(0, color.dark);
  grad.addColorStop(0.15, color.light);
  grad.addColorStop(0.3, color.highlight);
  grad.addColorStop(0.5, color.light);
  grad.addColorStop(0.7, color.base);
  grad.addColorStop(0.85, color.dark);
  grad.addColorStop(1, color.dark);
  return grad;
}

/** 创建径向发光渐变 */
export function createGlowGradient(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, radius: number,
  color: string, opacity: number = 0.4
): CanvasGradient {
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grad.addColorStop(0, colorWithAlpha(color, opacity));
  grad.addColorStop(0.5, colorWithAlpha(color, opacity * 0.4));
  grad.addColorStop(1, colorWithAlpha(color, 0));
  return grad;
}

// ═══════════════════════════════════════════════
// 基础绘制函数
// ═══════════════════════════════════════════════

/** 绘制圆角矩形 */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

/** 绘制金属圆柱体(水平放置) */
export function drawMetalCylinder(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, width: number, height: number,
  color: { base: string; light: string; dark: string; highlight: string },
  options?: { borderRadius?: number; outline?: boolean; outlineColor?: string }
) {
  const r = options?.borderRadius ?? 2;
  const grad = createCylinderGradient(ctx, x, y, width, height, color);
  roundRect(ctx, x, y, width, height, r);
  ctx.fillStyle = grad;
  ctx.fill();

  if (options?.outline !== false) {
    ctx.strokeStyle = options?.outlineColor ?? colorWithAlpha(color.light, 0.3);
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
}

/** 绘制法兰盘(圆柱端面) */
export function drawFlange(
  ctx: CanvasRenderingContext2D,
  x: number, cy: number, flangeHeight: number, barHeight: number,
  color: { base: string; light: string; dark: string; highlight: string }
) {
  const fW = 4;
  const fH = flangeHeight;
  const fY = cy - fH / 2;
  drawMetalCylinder(ctx, x - fW / 2, fY, fW, fH, color);

  // 螺栓孔
  ctx.fillStyle = colorWithAlpha(color.dark, 0.8);
  const boltCount = 3;
  const spacing = fH / (boltCount + 1);
  for (let i = 1; i <= boltCount; i++) {
    ctx.beginPath();
    ctx.arc(x, fY + spacing * i, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ═══════════════════════════════════════════════
// 工程标注
// ═══════════════════════════════════════════════

/** 绘制尺寸标注(工程制图风格) */
export function drawDimension(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  label: string, offset: number = 20, options?: { color?: string; fontSize?: number }
) {
  const color = options?.color ?? COLORS.annotationLine;
  const fontSize = options?.fontSize ?? 9;
  const isHorizontal = Math.abs(y2 - y1) < Math.abs(x2 - x1);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = options?.color ?? COLORS.annotationText;
  ctx.lineWidth = 0.5;
  ctx.font = `${fontSize}px 'Courier New', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (isHorizontal) {
    const dimY = y1 + offset;
    // 延伸线
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x1, dimY);
    ctx.moveTo(x2, y2); ctx.lineTo(x2, dimY);
    ctx.stroke();
    // 尺寸线
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x1, dimY); ctx.lineTo(x2, dimY);
    ctx.stroke();
    // 箭头
    drawArrowHead(ctx, x1, dimY, 'right', color);
    drawArrowHead(ctx, x2, dimY, 'left', color);
    // 文字
    ctx.fillText(label, (x1 + x2) / 2, dimY - 7);
  } else {
    const dimX = x1 + offset;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(dimX, y1);
    ctx.moveTo(x2, y2); ctx.lineTo(dimX, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(dimX, y1); ctx.lineTo(dimX, y2);
    ctx.stroke();
    drawArrowHead(ctx, dimX, y1, 'down', color);
    drawArrowHead(ctx, dimX, y2, 'up', color);
    ctx.save();
    ctx.translate(dimX + 8, (y1 + y2) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, dir: 'left' | 'right' | 'up' | 'down',
  color: string
) {
  const sz = 4;
  ctx.fillStyle = color;
  ctx.beginPath();
  switch (dir) {
    case 'right': ctx.moveTo(x, y); ctx.lineTo(x + sz, y - sz / 2); ctx.lineTo(x + sz, y + sz / 2); break;
    case 'left': ctx.moveTo(x, y); ctx.lineTo(x - sz, y - sz / 2); ctx.lineTo(x - sz, y + sz / 2); break;
    case 'down': ctx.moveTo(x, y); ctx.lineTo(x - sz / 2, y + sz); ctx.lineTo(x + sz / 2, y + sz); break;
    case 'up': ctx.moveTo(x, y); ctx.lineTo(x - sz / 2, y - sz); ctx.lineTo(x + sz / 2, y - sz); break;
  }
  ctx.closePath();
  ctx.fill();
}

/** 绘制标注文字(带指引线) */
export function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number,
  targetX: number, targetY: number,
  options?: { color?: string; fontSize?: number; bgColor?: string; align?: CanvasTextAlign }
) {
  ctx.save();
  const color = options?.color ?? COLORS.annotationText;
  const fontSize = options?.fontSize ?? 9;

  // 指引线
  ctx.strokeStyle = colorWithAlpha(color, 0.4);
  ctx.lineWidth = 0.5;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(targetX, targetY);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.setLineDash([]);

  // 文字
  ctx.font = `${fontSize}px 'Courier New', monospace`;
  ctx.textAlign = options?.align ?? 'left';
  ctx.textBaseline = 'middle';

  if (options?.bgColor) {
    const metrics = ctx.measureText(text);
    const pad = 3;
    const tw = metrics.width;
    const tx = options?.align === 'right' ? x - tw - pad : options?.align === 'center' ? x - tw / 2 - pad : x - pad;
    ctx.fillStyle = options.bgColor;
    roundRect(ctx, tx, y - fontSize / 2 - pad, tw + pad * 2, fontSize + pad * 2, 2);
    ctx.fill();
  }

  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ═══════════════════════════════════════════════
// 效果绘制
// ═══════════════════════════════════════════════

/** 绘制应变片标记 */
export function drawStrainGauge(
  ctx: CanvasRenderingContext2D,
  x: number, cy: number, barH: number,
  label: string, active: boolean
) {
  const h = 8;
  const w = 4;
  const y = cy - h / 2;

  ctx.save();
  // 应变片本体
  ctx.fillStyle = active ? 'rgba(0,245,255,0.4)' : 'rgba(255,255,255,0.15)';
  ctx.fillRect(x - w / 2, y, w, h);

  // 网格线
  ctx.strokeStyle = active ? '#00F5FF' : 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x - w / 2 + 0.5, y + i * 2 + 1);
    ctx.lineTo(x + w / 2 - 0.5, y + i * 2 + 1);
    ctx.stroke();
  }

  // 引线
  ctx.strokeStyle = active ? '#00F5FF' : 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, cy - barH / 2 - 8);
  ctx.stroke();

  // 标签
  ctx.font = '7px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = active ? '#00F5FF' : 'rgba(255,255,255,0.4)';
  ctx.fillText(label, x, cy - barH / 2 - 11);

  // 活跃时发光
  if (active) {
    ctx.fillStyle = createGlowGradient(ctx, x, cy, 15, '#00F5FF', 0.3);
    ctx.fillRect(x - 15, cy - 15, 30, 30);
  }
  ctx.restore();
}

/** 绘制V型支撑座 */
export function drawVSupport(
  ctx: CanvasRenderingContext2D,
  x: number, barBottom: number, baseY: number
) {
  ctx.save();
  ctx.strokeStyle = COLORS.steel.dark;
  ctx.fillStyle = 'rgba(90,107,125,0.3)';
  ctx.lineWidth = 1;

  const halfW = 8;
  ctx.beginPath();
  ctx.moveTo(x - halfW, baseY);
  ctx.lineTo(x, barBottom + 2);
  ctx.lineTo(x + halfW, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 底座
  ctx.fillStyle = COLORS.steel.dark;
  ctx.fillRect(x - halfW - 2, baseY, halfW * 2 + 4, 3);
  ctx.restore();
}

/** 绘制粒子/火花 */
export function drawSpark(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number, color: string, opacity: number
) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.beginPath();
  // 十字形火花
  ctx.moveTo(x - size, y);
  ctx.lineTo(x, y - size * 0.3);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x, y + size * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size * 0.3, y);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size * 0.3, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** 绘制工程网格背景 */
export function drawGridBackground(
  ctx: CanvasRenderingContext2D, w: number, h: number, gridSize: number = 20
) {
  ctx.save();
  ctx.strokeStyle = COLORS.gridLine;
  ctx.lineWidth = 0.3;
  for (let x = 0; x <= w; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();
}

// ═══════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════

/** 颜色添加透明度 */
export function colorWithAlpha(color: string, alpha: number): string {
  if (color.startsWith('rgba')) return color;
  if (color.startsWith('#')) {
    let hex = color.slice(1);
    // 支持3位短hex (#fff → #ffffff)
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const r = parseInt(hex.slice(0, 2), 16) || 0;
    const g = parseInt(hex.slice(2, 4), 16) || 0;
    const b = parseInt(hex.slice(4, 6), 16) || 0;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

/** 线性插值 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/** 平滑步进 */
export function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/** 缓入缓出 */
export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}
