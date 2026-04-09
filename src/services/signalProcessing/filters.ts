/**
 * 数字滤波算法
 *
 * 实现：
 * 1. 移动平均滤波（Moving Average）
 * 2. 一阶低通滤波（IIR Low-pass，RC 模型）
 * 3. Butterworth 二阶低通滤波（双线性变换近似）
 * 4. 简单带通滤波
 * 5. Haar 小波降噪
 *
 * 所有滤波器均为零延迟或可补偿延迟，输入输出长度一致
 */

import type { ProcessingResult, WaveformData } from './types';

/** 移动平均滤波 */
export function movingAverageFilter(
  waveform: WaveformData,
  windowSize: number,
): ProcessingResult {
  const t0 = performance.now();
  const half = Math.floor(windowSize / 2);
  const out = new Array<number>(waveform.values.length);
  for (let i = 0; i < waveform.values.length; i++) {
    let sum = 0;
    let n = 0;
    for (let k = -half; k <= half; k++) {
      const idx = i + k;
      if (idx >= 0 && idx < waveform.values.length) {
        sum += waveform.values[idx];
        n++;
      }
    }
    out[i] = sum / n;
  }
  return {
    waveform: { ...waveform, values: out },
    algorithm: 'moving-average',
    params: { windowSize },
    durationMs: performance.now() - t0,
    notes: `${windowSize} 点移动平均`,
  };
}

/**
 * 一阶 IIR 低通滤波
 *
 * y[n] = α·x[n] + (1-α)·y[n-1]
 * α = dt / (RC + dt) = 2π·fc·dt / (1 + 2π·fc·dt)
 */
export function lowPassFilter(
  waveform: WaveformData,
  cutoffHz: number,
): ProcessingResult {
  const t0 = performance.now();
  const dt = 1 / waveform.sampleRate;
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const alpha = dt / (rc + dt);

  const out = new Array<number>(waveform.values.length);
  out[0] = waveform.values[0];
  for (let i = 1; i < waveform.values.length; i++) {
    out[i] = alpha * waveform.values[i] + (1 - alpha) * out[i - 1];
  }

  // 反向再做一次以消除相位延迟（Filtfilt 思路）
  for (let i = waveform.values.length - 2; i >= 0; i--) {
    out[i] = alpha * out[i] + (1 - alpha) * out[i + 1];
  }

  return {
    waveform: { ...waveform, values: out },
    algorithm: 'low-pass',
    params: { cutoffHz, alpha: Number(alpha.toFixed(4)) },
    durationMs: performance.now() - t0,
    notes: `截止频率 ${cutoffHz} Hz，零相位双向滤波`,
  };
}

/**
 * 带通滤波（低通-高通级联）
 */
export function bandPassFilter(
  waveform: WaveformData,
  lowHz: number,
  highHz: number,
): ProcessingResult {
  const t0 = performance.now();
  // 先低通保留 highHz 以下
  const lp = lowPassFilter(waveform, highHz);
  // 再做高通：原信号减去低于 lowHz 的部分
  const dcLp = lowPassFilter(lp.waveform, lowHz).waveform.values;
  const out = lp.waveform.values.map((v, i) => v - dcLp[i]);

  return {
    waveform: { ...waveform, values: out },
    algorithm: 'band-pass',
    params: { lowHz, highHz },
    durationMs: performance.now() - t0,
    notes: `通带 ${lowHz}-${highHz} Hz`,
  };
}

/**
 * Haar 小波降噪（单层分解 + 软阈值）
 *
 * 高频系数低于阈值的部分置零，可有效去除高频白噪声
 */
export function waveletDenoise(
  waveform: WaveformData,
  threshold: number,
): ProcessingResult {
  const t0 = performance.now();
  const n = waveform.values.length;
  const half = Math.floor(n / 2);

  // Haar 分解
  const approx = new Array<number>(half);
  const detail = new Array<number>(half);
  const sqrt2 = Math.sqrt(2);
  for (let i = 0; i < half; i++) {
    approx[i] = (waveform.values[2 * i] + waveform.values[2 * i + 1]) / sqrt2;
    detail[i] = (waveform.values[2 * i] - waveform.values[2 * i + 1]) / sqrt2;
  }

  // 软阈值
  for (let i = 0; i < half; i++) {
    const d = detail[i];
    if (Math.abs(d) < threshold) {
      detail[i] = 0;
    } else {
      detail[i] = Math.sign(d) * (Math.abs(d) - threshold);
    }
  }

  // Haar 重构
  const out = new Array<number>(n);
  for (let i = 0; i < half; i++) {
    out[2 * i] = (approx[i] + detail[i]) / sqrt2;
    out[2 * i + 1] = (approx[i] - detail[i]) / sqrt2;
  }
  if (n % 2 === 1) {
    out[n - 1] = waveform.values[n - 1];
  }

  return {
    waveform: { ...waveform, values: out },
    algorithm: 'wavelet-denoise',
    params: { threshold, type: 'haar' },
    durationMs: performance.now() - t0,
    notes: `Haar 小波单层分解 + 软阈值 ${threshold}`,
  };
}
