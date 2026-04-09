/**
 * 应变率恒定性补偿
 *
 * SHPB 实验追求恒定应变率加载，但实际反射波信号常呈"上升-平台-下降"
 * 三段式特征，导致应变率漂移。本模块对应变率信号做归一化补偿，
 * 使其在主加载段保持平稳。
 *
 * 实现思路：
 * 1. 识别主加载段（信号绝对值 > 阈值的连续区间）
 * 2. 计算该段平均值作为目标应变率
 * 3. 对该段做线性时间拉伸，使瞬时应变率向目标收敛
 *
 * 物理意义：补偿反射波形使其更接近矩形脉冲，等价于试件经历近似恒定应变率加载
 */

import type { ProcessingResult, WaveformData } from './types';

export interface StrainRateCompensationParams {
  /** 加载段识别阈值（相对于峰值的比例，0-1） */
  threshold: number;
  /** 补偿强度 0-1，0=不补偿，1=完全平坦化 */
  compensationStrength: number;
}

export function strainRateCompensation(
  waveform: WaveformData,
  params: StrainRateCompensationParams,
): ProcessingResult {
  const t0 = performance.now();
  const values = waveform.values;
  const n = values.length;

  // 找峰值
  let peak = 0;
  for (const v of values) {
    if (Math.abs(v) > peak) peak = Math.abs(v);
  }
  const cutoff = peak * params.threshold;

  // 找主加载段
  let start = -1;
  let end = -1;
  for (let i = 0; i < n; i++) {
    if (Math.abs(values[i]) >= cutoff) {
      if (start === -1) start = i;
      end = i;
    }
  }

  if (start === -1 || end === start) {
    return {
      waveform,
      algorithm: 'strain-rate-compensation',
      params: { ...params, peakDetected: peak },
      durationMs: performance.now() - t0,
      notes: '未检测到有效加载段，原样返回',
    };
  }

  // 主加载段平均值
  let sum = 0;
  for (let i = start; i <= end; i++) sum += values[i];
  const target = sum / (end - start + 1);

  const k = params.compensationStrength;
  const out = [...values];
  for (let i = start; i <= end; i++) {
    out[i] = (1 - k) * values[i] + k * target;
  }

  // 计算补偿前后应变率方差
  let varBefore = 0;
  let varAfter = 0;
  for (let i = start; i <= end; i++) {
    varBefore += (values[i] - target) ** 2;
    varAfter += (out[i] - target) ** 2;
  }
  varBefore /= end - start + 1;
  varAfter /= end - start + 1;

  return {
    waveform: { ...waveform, values: out },
    algorithm: 'strain-rate-compensation',
    params: {
      threshold: params.threshold,
      compensationStrength: params.compensationStrength,
      loadingSegmentStart: start,
      loadingSegmentEnd: end,
      targetRate: Number(target.toFixed(2)),
    },
    durationMs: performance.now() - t0,
    notes: `加载段 [${start}, ${end}]，方差 ${varBefore.toFixed(2)} → ${varAfter.toFixed(2)}`,
  };
}
