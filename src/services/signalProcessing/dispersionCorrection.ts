/**
 * Pochhammer-Chree 应力波弥散校正
 *
 * 在 SHPB 实验中，弹性波在杆中传播时存在频散效应（不同频率分量传播速度不同），
 * 使得应力波在到达试件之前发生波形畸变。Pochhammer-Chree 频散方程描述了
 * 圆柱杆中弹性波的相速度 c(ω) 随频率的变化关系。
 *
 * 工程上常用的简化公式（Tyas & Watson 2001）：
 *
 *   c(ω) / c0 ≈ 1 - α·(ω·a/c0)² - β·(ω·a/c0)⁴
 *
 * 其中 a = 杆半径，c0 = 一维波速 = sqrt(E/ρ)
 * α, β 取决于泊松比 ν，对于钢杆 ν=0.29 时 α≈0.1185, β≈0.0089
 *
 * 校正流程：
 *   1. 对原始信号做 DFT
 *   2. 对每个频率分量乘以相位修正因子 e^(jωΔt(ω))
 *   3. IDFT 还原时域信号
 *
 * 由于完整 DFT 在 N=2000 点时仍可接受（O(N²) ≈ 4M 操作），
 * 此处采用直接 DFT 实现，避免引入额外依赖
 */

import type { ProcessingResult, WaveformData } from './types';

export interface DispersionParams {
  /** 杆半径 (mm) */
  barRadius: number;
  /** 一维波速 (m/s)，钢杆默认 5172 */
  c0: number;
  /** 泊松比，钢杆默认 0.29 */
  poissonRatio: number;
  /** 校正传播距离 (mm)，应变片到试件端面的距离 */
  propagationDistance: number;
}

/** 根据泊松比插值出 Pochhammer-Chree 简化系数 α */
function getAlphaCoeff(nu: number): number {
  // 经验插值表（Tyas & Watson 2001 + Davies 1948）
  if (nu <= 0.25) return 0.0998;
  if (nu <= 0.29) return 0.1185;
  if (nu <= 0.33) return 0.1290;
  return 0.1395;
}

/** 直接 DFT */
function dft(x: number[]): { re: number[]; im: number[] } {
  const n = x.length;
  const re = new Array<number>(n).fill(0);
  const im = new Array<number>(n).fill(0);
  for (let k = 0; k < n; k++) {
    for (let t = 0; t < n; t++) {
      const angle = (-2 * Math.PI * k * t) / n;
      re[k] += x[t] * Math.cos(angle);
      im[k] += x[t] * Math.sin(angle);
    }
  }
  return { re, im };
}

/** 直接 IDFT */
function idft(re: number[], im: number[]): number[] {
  const n = re.length;
  const out = new Array<number>(n).fill(0);
  for (let t = 0; t < n; t++) {
    let acc = 0;
    for (let k = 0; k < n; k++) {
      const angle = (2 * Math.PI * k * t) / n;
      acc += re[k] * Math.cos(angle) - im[k] * Math.sin(angle);
    }
    out[t] = acc / n;
  }
  return out;
}

/**
 * Pochhammer-Chree 弥散校正
 *
 * @param waveform 原始波形
 * @param params 弥散参数
 * @returns 校正后的波形
 */
export function dispersionCorrection(
  waveform: WaveformData,
  params: DispersionParams,
): ProcessingResult {
  const t0 = performance.now();

  const a = params.barRadius / 1000; // mm → m
  const c0 = params.c0;
  const L = params.propagationDistance / 1000; // mm → m
  const alpha = getAlphaCoeff(params.poissonRatio);

  // 为了控制 DFT 计算量，对长度大于 1024 的波形先降采样
  const maxN = 1024;
  let work = waveform.values;
  let strideFactor = 1;
  if (work.length > maxN) {
    strideFactor = Math.ceil(work.length / maxN);
    const ds: number[] = [];
    for (let i = 0; i < work.length; i += strideFactor) ds.push(work[i]);
    work = ds;
  }

  const n = work.length;
  const fs = waveform.sampleRate / strideFactor;

  // DFT
  const { re, im } = dft(work);

  // 频率轴 ω = 2π·f
  for (let k = 0; k < n; k++) {
    const f = k <= n / 2 ? (k * fs) / n : ((k - n) * fs) / n;
    const omega = 2 * Math.PI * f;
    const x = (omega * a) / c0;
    // c(ω) / c0 ≈ 1 - α·x²
    const cRatio = 1 - alpha * x * x;
    if (cRatio <= 0) continue;
    // 传播时间差 Δt = L/c - L/c0 = (L/c0)·(1/cRatio - 1)
    const dt = (L / c0) * (1 / cRatio - 1);
    // 相位修正：H(ω) = e^(jω·Δt)
    const phase = omega * dt;
    const cos = Math.cos(phase);
    const sin = Math.sin(phase);
    const newRe = re[k] * cos - im[k] * sin;
    const newIm = re[k] * sin + im[k] * cos;
    re[k] = newRe;
    im[k] = newIm;
  }

  // IDFT
  const corrected = idft(re, im);

  // 上采样回原始长度（线性插值）
  let outValues: number[];
  if (strideFactor === 1) {
    outValues = corrected;
  } else {
    outValues = new Array<number>(waveform.values.length);
    for (let i = 0; i < waveform.values.length; i++) {
      const pos = i / strideFactor;
      const lo = Math.floor(pos);
      const hi = Math.min(lo + 1, corrected.length - 1);
      const frac = pos - lo;
      outValues[i] = corrected[lo] * (1 - frac) + corrected[hi] * frac;
    }
  }

  return {
    waveform: { ...waveform, values: outValues },
    algorithm: 'dispersion-correction',
    params: {
      barRadius: params.barRadius,
      c0: params.c0,
      poissonRatio: params.poissonRatio,
      propagationDistance: params.propagationDistance,
      alphaCoeff: alpha,
    },
    durationMs: performance.now() - t0,
    notes: `Pochhammer-Chree 简化模型，α=${alpha}，传播距离 ${params.propagationDistance} mm`,
  };
}
