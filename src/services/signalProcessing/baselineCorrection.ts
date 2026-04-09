/**
 * 基线校正
 *
 * 应变片信号常包含直流偏置和缓慢漂移。本模块提供两种校正方式：
 * 1. 静态零点校正：用触发前的稳态段均值作为基线
 * 2. 多项式拟合校正：用低阶多项式拟合整体趋势再扣除（适用于温度漂移）
 */

import type { ProcessingResult, WaveformData } from './types';

/**
 * 静态零点校正
 *
 * @param waveform 原始波形
 * @param preTriggerSamples 触发前用作基线的采样点数（默认前 100 点）
 */
export function staticBaselineCorrection(
  waveform: WaveformData,
  preTriggerSamples = 100,
): ProcessingResult {
  const t0 = performance.now();
  const n = Math.min(preTriggerSamples, waveform.values.length);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += waveform.values[i];
  const baseline = sum / n;

  const out = waveform.values.map((v) => v - baseline);

  return {
    waveform: { ...waveform, values: out },
    algorithm: 'baseline-static',
    params: { preTriggerSamples: n, baseline: Number(baseline.toFixed(4)) },
    durationMs: performance.now() - t0,
    notes: `前 ${n} 点均值 ${baseline.toFixed(4)} 作为基线`,
  };
}

/**
 * 多项式拟合基线校正
 *
 * 用最小二乘拟合 m 阶多项式作为趋势线，从原信号中扣除
 *
 * @param waveform 原始波形
 * @param order 多项式阶数（推荐 1-3）
 */
export function polynomialBaselineCorrection(
  waveform: WaveformData,
  order = 2,
): ProcessingResult {
  const t0 = performance.now();
  const n = waveform.values.length;
  const m = order + 1;

  // 构建 Vandermonde 矩阵 X (n × m)
  // 用归一化时间索引 [0, 1] 避免数值溢出
  const x = new Array<number>(n);
  for (let i = 0; i < n; i++) x[i] = i / (n - 1);

  // 法方程 (X^T·X)·a = X^T·y
  const A = new Array<number[]>(m).fill(null).map(() => new Array<number>(m).fill(0));
  const b = new Array<number>(m).fill(0);
  for (let i = 0; i < n; i++) {
    const yi = waveform.values[i];
    for (let r = 0; r < m; r++) {
      for (let c = 0; c < m; c++) {
        A[r][c] += Math.pow(x[i], r + c);
      }
      b[r] += yi * Math.pow(x[i], r);
    }
  }

  // 高斯消元解 m×m 线性方程组
  const coeffs = solveLinearSystem(A, b);

  // 计算拟合基线并扣除
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let trend = 0;
    for (let r = 0; r < m; r++) trend += coeffs[r] * Math.pow(x[i], r);
    out[i] = waveform.values[i] - trend;
  }

  return {
    waveform: { ...waveform, values: out },
    algorithm: 'baseline-polynomial',
    params: { order, coeffs: coeffs.map((c) => Number(c.toFixed(4))).join(',') },
    durationMs: performance.now() - t0,
    notes: `${order} 阶多项式拟合基线`,
  };
}

/** 解线性方程组 Ax = b（高斯消元 + 部分主元） */
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  // 增广矩阵
  const M = A.map((row, i) => [...row, b[i]]);

  // 前向消元
  for (let i = 0; i < n; i++) {
    // 部分主元
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
    }
    [M[i], M[maxRow]] = [M[maxRow], M[i]];

    if (Math.abs(M[i][i]) < 1e-12) continue;

    for (let k = i + 1; k < n; k++) {
      const factor = M[k][i] / M[i][i];
      for (let j = i; j <= n; j++) {
        M[k][j] -= factor * M[i][j];
      }
    }
  }

  // 回代
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) sum -= M[i][j] * x[j];
    x[i] = M[i][i] !== 0 ? sum / M[i][i] : 0;
  }
  return x;
}
