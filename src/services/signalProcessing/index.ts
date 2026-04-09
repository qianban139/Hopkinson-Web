/**
 * 信号处理引擎 — 统一导出
 *
 * 本模块提供 SHPB 实验信号的标准处理算法，支持链式管线组合。
 *
 * 标准流程：
 *   原始三波 → 基线校正 → 滤波降噪 → 弥散校正 → 时间对齐 → 应变率补偿 → 应力平衡判据
 */

export * from './types';
export {
  movingAverageFilter,
  lowPassFilter,
  bandPassFilter,
  waveletDenoise,
} from './filters';
export { dispersionCorrection, type DispersionParams } from './dispersionCorrection';
export {
  staticBaselineCorrection,
  polynomialBaselineCorrection,
} from './baselineCorrection';
export {
  alignThreeWaves,
  shiftWaveform,
  crossCorrelationLag,
  type AlignmentParams,
} from './waveAlignment';
export {
  strainRateCompensation,
  type StrainRateCompensationParams,
} from './strainRateCompensation';
export {
  evaluateStressEquilibrium,
  type StressEquilibriumParams,
} from './stressEquilibrium';

import type { PipelineStep, ProcessingResult, WaveformData } from './types';
import {
  bandPassFilter,
  lowPassFilter,
  movingAverageFilter,
  waveletDenoise,
} from './filters';
import { dispersionCorrection } from './dispersionCorrection';
import {
  polynomialBaselineCorrection,
  staticBaselineCorrection,
} from './baselineCorrection';
import { strainRateCompensation } from './strainRateCompensation';

/**
 * 算法注册表 — 用于 UI 渲染算法卡片和动态调度
 */
export const ALGORITHM_REGISTRY: Array<{
  id: string;
  name: string;
  category: 'baseline' | 'filter' | 'dispersion' | 'alignment' | 'compensation' | 'analysis';
  description: string;
  defaultParams: Record<string, number | string | boolean>;
}> = [
  {
    id: 'baseline-static',
    name: '静态基线校正',
    category: 'baseline',
    description: '用触发前稳态段均值消除直流偏置',
    defaultParams: { preTriggerSamples: 100 },
  },
  {
    id: 'baseline-polynomial',
    name: '多项式基线校正',
    category: 'baseline',
    description: '用 2-3 阶多项式拟合基线漂移并扣除',
    defaultParams: { order: 2 },
  },
  {
    id: 'low-pass',
    name: '低通滤波',
    category: 'filter',
    description: '一阶 IIR 双向零相位低通滤波',
    defaultParams: { cutoffHz: 50000 },
  },
  {
    id: 'band-pass',
    name: '带通滤波',
    category: 'filter',
    description: '保留指定频带，抑制工频和高频噪声',
    defaultParams: { lowHz: 100, highHz: 50000 },
  },
  {
    id: 'moving-average',
    name: '移动平均滤波',
    category: 'filter',
    description: '简单时域平滑，适用于随机噪声',
    defaultParams: { windowSize: 5 },
  },
  {
    id: 'wavelet-denoise',
    name: '小波降噪',
    category: 'filter',
    description: 'Haar 小波单层分解 + 软阈值',
    defaultParams: { threshold: 0.05 },
  },
  {
    id: 'dispersion-correction',
    name: '弥散校正',
    category: 'dispersion',
    description: 'Pochhammer-Chree 频散方程相位校正',
    defaultParams: {
      barRadius: 14.5,
      c0: 5172,
      poissonRatio: 0.29,
      propagationDistance: 600,
    },
  },
  {
    id: 'strain-rate-compensation',
    name: '应变率补偿',
    category: 'compensation',
    description: '将主加载段应变率向均值收敛',
    defaultParams: { threshold: 0.3, compensationStrength: 0.5 },
  },
];

/**
 * 单步执行：根据算法 id 调用对应函数
 */
export function executeStep(
  waveform: WaveformData,
  step: PipelineStep,
): ProcessingResult {
  const p = step.params;
  switch (step.algorithm) {
    case 'baseline-static':
      return staticBaselineCorrection(waveform, Number(p.preTriggerSamples ?? 100));
    case 'baseline-polynomial':
      return polynomialBaselineCorrection(waveform, Number(p.order ?? 2));
    case 'low-pass':
      return lowPassFilter(waveform, Number(p.cutoffHz ?? 50000));
    case 'band-pass':
      return bandPassFilter(
        waveform,
        Number(p.lowHz ?? 100),
        Number(p.highHz ?? 50000),
      );
    case 'moving-average':
      return movingAverageFilter(waveform, Number(p.windowSize ?? 5));
    case 'wavelet-denoise':
      return waveletDenoise(waveform, Number(p.threshold ?? 0.05));
    case 'dispersion-correction':
      return dispersionCorrection(waveform, {
        barRadius: Number(p.barRadius ?? 14.5),
        c0: Number(p.c0 ?? 5172),
        poissonRatio: Number(p.poissonRatio ?? 0.29),
        propagationDistance: Number(p.propagationDistance ?? 600),
      });
    case 'strain-rate-compensation':
      return strainRateCompensation(waveform, {
        threshold: Number(p.threshold ?? 0.3),
        compensationStrength: Number(p.compensationStrength ?? 0.5),
      });
    default:
      return {
        waveform,
        algorithm: step.algorithm,
        params: p,
        durationMs: 0,
        notes: `未知算法 ${step.algorithm}，跳过`,
      };
  }
}

/**
 * 链式管线执行：依次应用多个算法步骤
 */
export function runPipeline(
  waveform: WaveformData,
  pipeline: PipelineStep[],
): { final: WaveformData; history: ProcessingResult[] } {
  let current = waveform;
  const history: ProcessingResult[] = [];
  for (const step of pipeline) {
    if (!step.enabled) continue;
    const result = executeStep(current, step);
    history.push(result);
    current = result.waveform;
  }
  return { final: current, history };
}
