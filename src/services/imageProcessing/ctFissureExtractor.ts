/**
 * 煤岩 Micro-CT 裂隙智能提取(前端版)
 *
 * 论文来源: 王登科 等(2024)
 *   "基于深度学习的煤岩 Micro-CT 裂隙智能提取与应用"
 *
 * 论文原方法使用 MCSN(U-Net + VGG16 迁移 + DCAC 空洞卷积),需 GPU 训练。
 * 本项目为前端演示版本,采用工程上经典的"传统+现代"混合 pipeline:
 *   1) Otsu 自适应阈值(无监督二值化)
 *   2) 形态学闭运算(膨胀→腐蚀,连接细小裂隙)
 *   3) 形态学开运算(腐蚀→膨胀,去除孤立噪点)
 *   4) 连通域分析(面积过滤)
 *   5) 计算 Pixel Accuracy / Precision / Recall / MPA / MIoU(如提供 ground truth)
 *
 * 所有操作基于 ImageData,纯 JS,零依赖。
 */

export interface ExtractOptions {
  /** 最小连通域面积(像素),小于此值视为噪点丢弃 */
  minArea?: number;
  /** 形态学 kernel 大小(奇数,默认 3) */
  kernelSize?: number;
  /** 闭运算迭代次数 */
  closeIter?: number;
  /** 开运算迭代次数 */
  openIter?: number;
  /** 是否反转阈值(默认裂隙为暗区,反转后裂隙为亮区) */
  invert?: boolean;
}

export interface ExtractResult {
  /** 二值掩膜(ImageData,裂隙=白 / 背景=黑) */
  mask: ImageData;
  /** 叠加可视化(在原图上用红色半透明标注裂隙) */
  overlay: ImageData;
  /** Otsu 自适应阈值 */
  threshold: number;
  /** 裂隙像素数 */
  fissurePixels: number;
  /** 裂隙像素占比(%) */
  fissureRatio: number;
  /** 连通域数量(去噪后) */
  componentCount: number;
  /** 灰度直方图(用于 UI 展示) */
  histogram: number[];
  /** 处理耗时(ms) */
  elapsed: number;
}

export interface EvalResult {
  /** Pixel Accuracy */
  pixelAccuracy: number;
  /** 类别平均准确率(Mean Pixel Accuracy) */
  mpa: number;
  /** Mean Intersection over Union */
  miou: number;
  /** 裂隙类 Precision */
  precision: number;
  /** 裂隙类 Recall */
  recall: number;
  /** F1 */
  f1: number;
}

/**
 * 主提取函数
 */
export function extractFissures(src: ImageData, opts: ExtractOptions = {}): ExtractResult {
  const start = performance.now();
  const {
    minArea = 20,
    kernelSize = 3,
    closeIter = 1,
    openIter = 1,
    invert = true,
  } = opts;

  const { width: W, height: H } = src;

  // 1. 灰度化 + 直方图
  const gray = toGrayscale(src);
  const histogram = buildHistogram(gray);

  // 2. Otsu 阈值
  const threshold = otsuThreshold(histogram, gray.length);

  // 3. 二值化
  const binary = new Uint8Array(W * H);
  for (let i = 0; i < gray.length; i++) {
    const isForeground = invert ? gray[i] < threshold : gray[i] > threshold;
    binary[i] = isForeground ? 1 : 0;
  }

  // 4. 形态学闭运算(连接细小裂隙)
  let processed: Uint8Array<ArrayBufferLike> = binary;
  for (let k = 0; k < closeIter; k++) {
    processed = dilate(processed, W, H, kernelSize);
    processed = erode(processed, W, H, kernelSize);
  }
  // 5. 形态学开运算(去除噪点)
  for (let k = 0; k < openIter; k++) {
    processed = erode(processed, W, H, kernelSize);
    processed = dilate(processed, W, H, kernelSize);
  }

  // 6. 连通域分析 + 面积过滤
  const { labeled, componentCount } = connectedComponents(processed, W, H, minArea);

  // 7. 构造 mask + overlay
  const mask = new ImageData(W, H);
  const overlay = new ImageData(W, H);
  let fissurePixels = 0;
  for (let i = 0; i < W * H; i++) {
    const isFissure = labeled[i] > 0;
    const j = i * 4;
    // mask: 白/黑
    const m = isFissure ? 255 : 0;
    mask.data[j] = m; mask.data[j + 1] = m; mask.data[j + 2] = m; mask.data[j + 3] = 255;
    // overlay: 原图 + 红色半透明
    const g = gray[i];
    if (isFissure) {
      overlay.data[j] = Math.min(255, g * 0.4 + 255 * 0.6);
      overlay.data[j + 1] = g * 0.4;
      overlay.data[j + 2] = g * 0.4;
      fissurePixels++;
    } else {
      overlay.data[j] = g;
      overlay.data[j + 1] = g;
      overlay.data[j + 2] = g;
    }
    overlay.data[j + 3] = 255;
  }

  return {
    mask,
    overlay,
    threshold,
    fissurePixels,
    fissureRatio: (fissurePixels / (W * H)) * 100,
    componentCount,
    histogram,
    elapsed: performance.now() - start,
  };
}

/**
 * 评价指标(需要二值 ground truth)
 * @param pred  预测二值图(ImageData 或 Uint8Array<W×H>)
 * @param gt    真值二值图(同上)
 */
export function evaluate(pred: ImageData | Uint8Array, gt: ImageData | Uint8Array): EvalResult {
  const p = toBinary(pred);
  const g = toBinary(gt);
  const n = p.length;

  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (let i = 0; i < n; i++) {
    const P = p[i] > 0 ? 1 : 0;
    const G = g[i] > 0 ? 1 : 0;
    if (P === 1 && G === 1) tp++;
    else if (P === 1 && G === 0) fp++;
    else if (P === 0 && G === 1) fn++;
    else tn++;
  }

  const pa = (tp + tn) / Math.max(1, n);
  const precision = tp / Math.max(1, tp + fp);
  const recall = tp / Math.max(1, tp + fn);
  const f1 = (2 * precision * recall) / Math.max(1e-9, precision + recall);

  // Audit CT-2: mPA / mIoU 按"GT 中存在的类"取平均, 不存在的类不参与.
  // 标准 mIoU 做法: 类不存在时跳过, 而非视作 0 拉低均值.
  const fgExists = (tp + fn) > 0; // GT 中有裂隙
  const bgExists = (tn + fp) > 0; // GT 中有背景
  const paForeground = fgExists ? tp / (tp + fn) : NaN;
  const paBackground = bgExists ? tn / (tn + fp) : NaN;
  const paClasses = [paForeground, paBackground].filter((v) => !Number.isNaN(v));
  const mpa = paClasses.length ? paClasses.reduce((a, b) => a + b, 0) / paClasses.length : 0;

  const iouFg = fgExists ? tp / (tp + fp + fn) : NaN;
  const iouBg = bgExists ? tn / (tn + fp + fn) : NaN;
  const iouClasses = [iouFg, iouBg].filter((v) => !Number.isNaN(v));
  const miou = iouClasses.length ? iouClasses.reduce((a, b) => a + b, 0) / iouClasses.length : 0;

  return { pixelAccuracy: pa, mpa, miou, precision, recall, f1 };
}

// ——————————————————————————————————————————————
// 内部工具
// ——————————————————————————————————————————————

function toGrayscale(img: ImageData): Uint8Array {
  const { data, width, height } = img;
  const gray = new Uint8Array(width * height);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    // Rec. 601 亮度
    gray[j] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  return gray;
}

function buildHistogram(gray: Uint8Array): number[] {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  return hist;
}

/** Otsu 自适应阈值(经典类间方差最大化) */
function otsuThreshold(hist: number[], total: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];

  let sumB = 0, wB = 0, maxVar = 0, threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) ** 2;
    if (varBetween > maxVar) {
      maxVar = varBetween;
      threshold = t;
    }
  }
  return threshold;
}

/** 膨胀(max) */
function dilate(src: Uint8Array, W: number, H: number, k: number): Uint8Array {
  const out = new Uint8Array(W * H);
  const r = Math.floor(k / 2);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = 0;
      for (let dy = -r; dy <= r && v === 0; dy++) {
        for (let dx = -r; dx <= r && v === 0; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
          if (src[ny * W + nx]) v = 1;
        }
      }
      out[y * W + x] = v;
    }
  }
  return out;
}

/**
 * 腐蚀(min) — Audit CT-1: 边界越界视为前景 (border-replicate semantics),
 * 避免最外圈像素被多次开/闭运算无意义地腐蚀掉.
 */
function erode(src: Uint8Array, W: number, H: number, k: number): Uint8Array {
  const out = new Uint8Array(W * H);
  const r = Math.floor(k / 2);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = 1;
      for (let dy = -r; dy <= r && v === 1; dy++) {
        for (let dx = -r; dx <= r && v === 1; dx++) {
          const nx = x + dx, ny = y + dy;
          // 越界视为前景 (1), 等价于在边界外扩展 1 像素的前景填充
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
          if (!src[ny * W + nx]) v = 0;
        }
      }
      out[y * W + x] = v;
    }
  }
  return out;
}

/** 4 邻域连通域标记 + 面积过滤 */
function connectedComponents(src: Uint8Array, W: number, H: number, minArea: number):
  { labeled: Int32Array; componentCount: number } {
  const labels = new Int32Array(W * H); // 0 = background
  const areas = new Map<number, number>();
  let nextLabel = 1;

  // Audit CT-3: 入栈前查 labels[neighbor] 与 src[neighbor],
  // 避免栈膨胀至 O(N²) 与同一像素重复入栈.
  // 1000×1000 强连通图最坏情况下栈深度从 ~4N 降到 ~N.
  const stack: number[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (!src[idx] || labels[idx]) continue;

      const lbl = nextLabel++;
      let area = 0;
      labels[idx] = lbl; // 标记起点
      stack.push(idx);
      while (stack.length) {
        const i = stack.pop()!;
        area++;
        const xi = i % W, yi = (i - xi) / W;
        // 4-邻域: 入栈前验证未标记且为前景
        if (xi > 0) {
          const ni = i - 1;
          if (src[ni] && !labels[ni]) { labels[ni] = lbl; stack.push(ni); }
        }
        if (xi < W - 1) {
          const ni = i + 1;
          if (src[ni] && !labels[ni]) { labels[ni] = lbl; stack.push(ni); }
        }
        if (yi > 0) {
          const ni = i - W;
          if (src[ni] && !labels[ni]) { labels[ni] = lbl; stack.push(ni); }
        }
        if (yi < H - 1) {
          const ni = i + W;
          if (src[ni] && !labels[ni]) { labels[ni] = lbl; stack.push(ni); }
        }
      }
      areas.set(lbl, area);
    }
  }

  // 过滤小连通域
  for (let i = 0; i < labels.length; i++) {
    const lbl = labels[i];
    if (lbl === 0) continue;
    if ((areas.get(lbl) ?? 0) < minArea) labels[i] = 0;
  }

  const surviving = new Set<number>();
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] > 0) surviving.add(labels[i]);
  }

  return { labeled: labels, componentCount: surviving.size };
}

function toBinary(img: ImageData | Uint8Array): Uint8Array {
  if (img instanceof Uint8Array) return img;
  const { data, width, height } = img;
  const out = new Uint8Array(width * height);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    out[j] = g > 127 ? 1 : 0;
  }
  return out;
}

/**
 * 合成一张"煤岩 CT"演示图 —— 低对比度背景 + 若干裂隙 + 矸石斑点 + 噪声
 * 用于前端 Demo 展示(无需用户上传真实图像)
 */
export function generateSyntheticCT(W = 320, H = 320, seed = 7): ImageData {
  const img = new ImageData(W, H);
  const rand = seededRand(seed);

  // 背景: 基础灰度 + 低频噪声
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const base = 120 + 20 * Math.sin(x * 0.01) * Math.cos(y * 0.013);
      const noise = (rand() - 0.5) * 25;
      const g = clamp255(base + noise);
      const j = (y * W + x) * 4;
      img.data[j] = g; img.data[j + 1] = g; img.data[j + 2] = g; img.data[j + 3] = 255;
    }
  }

  // 主裂隙: 粗曲线
  drawCurve(img, W, H, [
    [0.1 * W, 0.2 * H], [0.35 * W, 0.4 * H], [0.55 * W, 0.45 * H], [0.85 * W, 0.75 * H],
  ], 5, 40);
  // 次裂隙: 细分支
  drawCurve(img, W, H, [
    [0.35 * W, 0.4 * H], [0.45 * W, 0.5 * H], [0.5 * W, 0.65 * H],
  ], 2, 55);
  drawCurve(img, W, H, [
    [0.55 * W, 0.45 * H], [0.7 * W, 0.3 * H], [0.9 * W, 0.2 * H],
  ], 2, 55);
  drawCurve(img, W, H, [
    [0.2 * W, 0.7 * H], [0.35 * W, 0.78 * H], [0.55 * W, 0.85 * H],
  ], 3, 45);

  // 矸石斑点(亮团,易被误判)
  for (let k = 0; k < 6; k++) {
    const cx = rand() * W, cy = rand() * H, r = 4 + rand() * 6;
    for (let y = Math.max(0, cy - r); y < Math.min(H, cy + r); y++) {
      for (let x = Math.max(0, cx - r); x < Math.min(W, cx + r); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) {
          const j = (Math.floor(y) * W + Math.floor(x)) * 4;
          img.data[j] = 200;
          img.data[j + 1] = 200;
          img.data[j + 2] = 200;
        }
      }
    }
  }

  return img;
}

/** 对应合成图的 ground truth(裂隙 mask) */
export function generateSyntheticGT(W = 320, H = 320): ImageData {
  const gt = new ImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    const j = i * 4;
    gt.data[j + 3] = 255;
  }
  drawCurve(gt, W, H, [
    [0.1 * W, 0.2 * H], [0.35 * W, 0.4 * H], [0.55 * W, 0.45 * H], [0.85 * W, 0.75 * H],
  ], 5, 255);
  drawCurve(gt, W, H, [
    [0.35 * W, 0.4 * H], [0.45 * W, 0.5 * H], [0.5 * W, 0.65 * H],
  ], 2, 255);
  drawCurve(gt, W, H, [
    [0.55 * W, 0.45 * H], [0.7 * W, 0.3 * H], [0.9 * W, 0.2 * H],
  ], 2, 255);
  drawCurve(gt, W, H, [
    [0.2 * W, 0.7 * H], [0.35 * W, 0.78 * H], [0.55 * W, 0.85 * H],
  ], 3, 255);
  return gt;
}

// ————————————————————————————
// 绘图辅助
// ————————————————————————————

function drawCurve(
  img: ImageData, W: number, H: number,
  ctrl: [number, number][], radius: number, gray: number,
): void {
  // Audit CT-6: 移除冗余 isMask 参数 — 旧代码两个分支代码完全相同.
  // Catmull-Rom 采样
  const pts: [number, number][] = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)];
    const p1 = ctrl[i];
    const p2 = ctrl[i + 1];
    const p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    for (let t = 0; t < 1; t += 0.01) {
      const x =
        0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t * t + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t ** 3);
      const y =
        0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t * t + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t ** 3);
      pts.push([x, y]);
    }
  }
  for (const [cx, cy] of pts) {
    for (let y = Math.max(0, cy - radius); y < Math.min(H, cy + radius); y++) {
      for (let x = Math.max(0, cx - radius); x < Math.min(W, cx + radius); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= radius * radius) {
          const j = (Math.floor(y) * W + Math.floor(x)) * 4;
          img.data[j] = gray;
          img.data[j + 1] = gray;
          img.data[j + 2] = gray;
          img.data[j + 3] = 255;
        }
      }
    }
  }
}

function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}
