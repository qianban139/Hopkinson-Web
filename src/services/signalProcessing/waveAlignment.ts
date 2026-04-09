/**
 * 三波时间对齐
 *
 * SHPB 实验中入射波、反射波、透射波分别由不同位置的应变片采集，
 * 三者存在已知的时间偏移：
 *
 *   Δt_reflected = 2 · L_inc / c0
 *   Δt_transmitted = (L_inc + L_trans) / c0
 *
 * 此外，由于触发抖动、设备延迟，往往还存在未知偏移。
 * 本模块用互相关方法估计未知偏移并对齐三波。
 */

import type { ProcessingResult, ThreeWaveDataset, WaveformData } from './types';

/**
 * 互相关求最佳对齐位移
 *
 * @returns lag 表示需要将 b 向左平移多少个采样点才能与 a 最佳匹配
 */
export function crossCorrelationLag(a: number[], b: number[], maxLag: number): number {
  let bestLag = 0;
  let bestCorr = -Infinity;
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let corr = 0;
    let count = 0;
    for (let i = 0; i < a.length; i++) {
      const j = i + lag;
      if (j >= 0 && j < b.length) {
        corr += a[i] * b[j];
        count++;
      }
    }
    if (count > 0) {
      corr /= count;
      if (corr > bestCorr) {
        bestCorr = corr;
        bestLag = lag;
      }
    }
  }
  return bestLag;
}

/**
 * 按指定采样点数循环平移波形（保持长度不变，边界补 0）
 */
export function shiftWaveform(waveform: WaveformData, samples: number): WaveformData {
  const n = waveform.values.length;
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const src = i + samples;
    if (src >= 0 && src < n) out[i] = waveform.values[src];
  }
  return { ...waveform, values: out };
}

export interface AlignmentParams {
  /** 入射杆长度 (mm) */
  incidentBarLength: number;
  /** 透射杆长度 (mm) */
  transmittedBarLength: number;
  /** 一维波速 (m/s) */
  c0: number;
  /** 互相关搜索范围（采样点） */
  maxSearchSamples?: number;
}

/**
 * 三波对齐
 *
 * 以入射波为基准，对反射波和透射波进行理论 + 互相关联合校正
 */
export function alignThreeWaves(
  dataset: ThreeWaveDataset,
  params: AlignmentParams,
): {
  aligned: ThreeWaveDataset;
  result: ProcessingResult;
  reflectedLagSamples: number;
  transmittedLagSamples: number;
} {
  const t0 = performance.now();

  const fs = dataset.incident.sampleRate;
  // 理论时间差 → 采样点数
  const dtReflectedTheory = (2 * params.incidentBarLength) / 1000 / params.c0;
  const dtTransmittedTheory =
    (params.incidentBarLength + params.transmittedBarLength) / 1000 / params.c0;
  const reflectedSamplesTheory = Math.round(dtReflectedTheory * fs);
  const transmittedSamplesTheory = Math.round(dtTransmittedTheory * fs);

  // 互相关精修
  const maxLag = params.maxSearchSamples ?? 50;
  // 反射波是入射波的反向信号，取负后做互相关
  const negReflected = dataset.reflected.values.map((v) => -v);
  const refinedRefLag =
    reflectedSamplesTheory +
    crossCorrelationLag(dataset.incident.values, negReflected, maxLag);
  const refinedTransLag =
    transmittedSamplesTheory +
    crossCorrelationLag(dataset.incident.values, dataset.transmitted.values, maxLag);

  const alignedReflected = shiftWaveform(dataset.reflected, refinedRefLag);
  const alignedTransmitted = shiftWaveform(dataset.transmitted, refinedTransLag);

  return {
    aligned: {
      incident: dataset.incident,
      reflected: alignedReflected,
      transmitted: alignedTransmitted,
    },
    result: {
      waveform: dataset.incident,
      algorithm: 'wave-alignment',
      params: {
        reflectedLag: refinedRefLag,
        transmittedLag: refinedTransLag,
        theoryReflected: reflectedSamplesTheory,
        theoryTransmitted: transmittedSamplesTheory,
      },
      durationMs: performance.now() - t0,
      notes: `理论 + 互相关对齐，反射 ${refinedRefLag} 点，透射 ${refinedTransLag} 点`,
    },
    reflectedLagSamples: refinedRefLag,
    transmittedLagSamples: refinedTransLag,
  };
}
