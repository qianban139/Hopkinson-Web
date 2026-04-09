/**
 * 应力平衡判据
 *
 * SHPB 实验有效性的核心前提是试件两端达到应力平衡：
 *
 *   σ1(t) = E·(εi(t) + εr(t))   ← 入射端
 *   σ2(t) = E·εt(t)              ← 透射端
 *
 *   平衡度 R(t) = |σ1(t) - σ2(t)| / max(|σ1(t)|, |σ2(t)|)
 *
 * 评级标准（参考 ISO 国际惯例）：
 *   R < 0.05  优秀（excellent）
 *   R < 0.10  良好（good）
 *   R < 0.20  可接受（acceptable）
 *   R ≥ 0.20  不合格（poor）
 */

import type { StressEquilibriumResult, ThreeWaveDataset } from './types';

export interface StressEquilibriumParams {
  /** 杆材弹性模量 (GPa) */
  youngModulus: number;
  /** 评估窗口起点（采样点索引） */
  windowStart?: number;
  /** 评估窗口终点（采样点索引） */
  windowEnd?: number;
}

export function evaluateStressEquilibrium(
  dataset: ThreeWaveDataset,
  params: StressEquilibriumParams,
): StressEquilibriumResult {
  const E = params.youngModulus * 1e9; // GPa → Pa

  const n = Math.min(
    dataset.incident.values.length,
    dataset.reflected.values.length,
    dataset.transmitted.values.length,
  );
  const start = Math.max(0, params.windowStart ?? 0);
  const end = Math.min(n - 1, params.windowEnd ?? n - 1);

  let maxRatio = 0;
  let sumRatio = 0;
  let count = 0;

  for (let i = start; i <= end; i++) {
    // 应变片信号一般以 mε 计，统一按相对值计算（消去 E 量纲）
    const epsI = dataset.incident.values[i];
    const epsR = dataset.reflected.values[i];
    const epsT = dataset.transmitted.values[i];

    const sigma1 = E * (epsI + epsR);
    const sigma2 = E * epsT;

    const denom = Math.max(Math.abs(sigma1), Math.abs(sigma2));
    if (denom < 1e-6) continue;

    const r = Math.abs(sigma1 - sigma2) / denom;
    sumRatio += r;
    count++;
    if (r > maxRatio) maxRatio = r;
  }

  const avgRatio = count > 0 ? sumRatio / count : 1;

  let grade: StressEquilibriumResult['grade'];
  let description: string;
  if (avgRatio < 0.05) {
    grade = 'excellent';
    description = '试件两端应力平衡极佳，实验结果可信度高';
  } else if (avgRatio < 0.1) {
    grade = 'good';
    description = '试件应力平衡良好，符合 SHPB 标准要求';
  } else if (avgRatio < 0.2) {
    grade = 'acceptable';
    description = '试件应力平衡勉强可接受，建议复核';
  } else {
    grade = 'poor';
    description = '试件应力平衡较差，实验结果不可信，建议重做';
  }

  return {
    ratio: Number(avgRatio.toFixed(4)),
    isBalanced: avgRatio < 0.1,
    grade,
    description: `${description}（平均 R=${avgRatio.toFixed(3)}，峰值 R=${maxRatio.toFixed(3)}）`,
  };
}
