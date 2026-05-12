/**
 * BP-ANN 驱动的 SHPB 应力-应变预测
 *
 * 参考: 龙旭 等(2021)—— ABAQUS 有限元生成 20 组训练样本,BP 网络预测本构响应。
 *
 * 本项目简化方案(面向实时前端训练):
 *   - 输入特征: [ε(应变), ε̇(应变率), T(温度,°C)]
 *   - 输出:     [σ(应力,MPa)]
 *   - 训练样本: 从已知材料的实验应力-应变曲线 + 若干扰动应变率/温度的 J-C 合成样本
 *   - 预测: 生成任意应变率/温度下的平滑应力-应变曲线,与传统本构拟合对比
 */

import { BPNetwork, type BPConfig, type TrainHistory } from './bpNetwork';
import type { Material } from '@/types';

export interface BPPredictConfig extends Partial<BPConfig> {
  /** 合成样本倍数(扩充数据集,默认 3,总样本 ≈ 原始点数 × 倍数) */
  augmentFactor?: number;
  /** 应变率扰动范围 (×/÷ 多少倍) */
  rateJitter?: number;
  /** 温度扰动范围 (±°C) */
  tempJitter?: number;
}

const DEFAULTS: Required<Pick<BPConfig, 'hiddenDim' | 'epochs' | 'learningRate' | 'batchSize' | 'seed'>> = {
  hiddenDim: 12,
  epochs: 120,
  learningRate: 0.15,
  batchSize: 8,
  seed: 42,
};

/**
 * 基于材料 J-C 参数 + 实验曲线生成训练集
 */
function buildTrainingSet(
  material: Material,
  baseStrainRate: number,
  baseTemperature: number,
  augmentFactor: number,
  rateJitter: number,
  tempJitter: number,
): { X: number[][]; Y: number[][] } {
  const X: number[][] = [];
  const Y: number[][] = [];

  const jc = material.johnsonCookParams;
  const baseCurve = material.stressStrainSample;
  const Troom = 25;
  const epsilonDot0 = 1;

  // 原始曲线作为基准样本
  for (const p of baseCurve) {
    X.push([p.strain, baseStrainRate, baseTemperature]);
    Y.push([p.stress]);
  }

  // 合成样本: 同样应变,扰动应变率/温度,用 J-C 计算目标应力
  if (jc) {
    const { A, B, n, C, m, Tm } = jc;
    for (let k = 0; k < augmentFactor; k++) {
      const jitterRate = baseStrainRate * Math.pow(rateJitter, (Math.random() * 2 - 1));
      const jitterTemp = baseTemperature + (Math.random() * 2 - 1) * tempJitter;
      for (const p of baseCurve) {
        const quasi = A + B * Math.pow(Math.max(p.strain, 1e-6), n);
        const rateTerm = 1 + C * Math.log(Math.max(jitterRate / epsilonDot0, 1));
        const tstar = Math.max(0, Math.min(1, (jitterTemp - Troom) / (Tm - Troom)));
        const tempTerm = 1 - Math.pow(tstar, m);
        const sigma = quasi * rateTerm * tempTerm;
        if (isFinite(sigma) && sigma > 0) {
          X.push([p.strain, jitterRate, jitterTemp]);
          Y.push([sigma]);
        }
      }
    }
  }

  return { X, Y };
}

/**
 * 训练并返回 predictor + 训练历史
 */
export async function trainBPForMaterial(
  material: Material,
  strainRate: number,
  temperature: number,
  cfg: BPPredictConfig = {},
  onEpoch?: (epoch: number, loss: number, r2: number) => void,
): Promise<{
  network: BPNetwork;
  history: TrainHistory;
  sampleCount: number;
  predict: (strain: number, rate?: number, temp?: number) => number;
  predictCurve: (strains: number[], rate?: number, temp?: number) => { strain: number; stress: number }[];
}> {
  const augmentFactor = cfg.augmentFactor ?? 3;
  const rateJitter = cfg.rateJitter ?? 2.5;
  const tempJitter = cfg.tempJitter ?? 50;

  const { X, Y } = buildTrainingSet(
    material, strainRate, temperature, augmentFactor, rateJitter, tempJitter,
  );

  const net = new BPNetwork({
    inputDim: 3,
    outputDim: 1,
    hiddenDim: cfg.hiddenDim ?? DEFAULTS.hiddenDim,
    epochs: cfg.epochs ?? DEFAULTS.epochs,
    learningRate: cfg.learningRate ?? DEFAULTS.learningRate,
    batchSize: cfg.batchSize ?? DEFAULTS.batchSize,
    seed: cfg.seed ?? DEFAULTS.seed,
  });

  const history = await net.train(X, Y, onEpoch);

  const predict = (strain: number, rate = strainRate, temp = temperature): number => {
    const [sigma] = net.predict([strain, rate, temp]);
    return Math.max(0, sigma);
  };
  const predictCurve = (strains: number[], rate = strainRate, temp = temperature) =>
    strains.map((s) => ({ strain: s, stress: predict(s, rate, temp) }));

  return {
    network: net,
    history,
    sampleCount: X.length,
    predict,
    predictCurve,
  };
}
