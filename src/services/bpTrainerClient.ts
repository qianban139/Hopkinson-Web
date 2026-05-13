/**
 * BP 训练主线程客户端
 *
 * 包装 src/services/bpWorker.ts 的 postMessage 协议为 Promise + epoch
 * 回调形式, API 与原 trainBPForMaterial 一致.
 *
 * 用法:
 *   const result = await trainBPForMaterialInWorker(material, rate, temp, cfg, onEpoch);
 *   const sigma = result.predict(strain, rate, temp);
 *
 * 实现:
 *   - 训练在 Worker (CPU 密集 + 主线程不冻结)
 *   - 训练完通过 snapshot 序列化回主线程, 主线程用 BPNetwork.fromState 重建
 *   - 预测留在主线程 (轻量, 单次 forward 在 µs 级)
 */

import { BPNetwork, type BPConfig, type TrainHistory } from './bpNetwork';
import type { TrainRequest, WorkerOutbound } from './bpWorker';
import type { Material } from '@/types';

export interface BPPredictConfig extends Partial<BPConfig> {
  augmentFactor?: number;
  rateJitter?: number;
  tempJitter?: number;
}

const DEFAULTS = {
  hiddenDim: 12,
  epochs: 120,
  learningRate: 0.15,
  batchSize: 8,
  seed: 42,
  augmentFactor: 3,
  rateJitter: 2.5,
  tempJitter: 50,
};

export interface BPTrainResult {
  network: BPNetwork;
  history: TrainHistory;
  sampleCount: number;
  predict: (strain: number, rate?: number, temp?: number) => number;
  predictCurve: (strains: number[], rate?: number, temp?: number) => { strain: number; stress: number }[];
}

/** 在 Web Worker 内训练 BP 网络, 主线程不阻塞. */
export function trainBPForMaterialInWorker(
  material: Material,
  strainRate: number,
  temperature: number,
  cfg: BPPredictConfig = {},
  onEpoch?: (epoch: number, loss: number, r2: number) => void,
): Promise<BPTrainResult> {
  return new Promise<BPTrainResult>((resolve, reject) => {
    const worker = new Worker(new URL('./bpWorker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (e: MessageEvent<WorkerOutbound>) => {
      const msg = e.data;
      switch (msg.type) {
        case 'epoch':
          onEpoch?.(msg.epoch, msg.loss, msg.r2);
          break;
        case 'done': {
          const network = BPNetwork.fromState(msg.snapshot);
          const predict = (strain: number, rate = strainRate, temp = temperature): number => {
            const [sigma] = network.predict([strain, rate, temp]);
            return Math.max(0, sigma);
          };
          const predictCurve = (strains: number[], rate = strainRate, temp = temperature) =>
            strains.map((s) => ({ strain: s, stress: predict(s, rate, temp) }));
          resolve({
            network,
            history: msg.history,
            sampleCount: msg.sampleCount,
            predict,
            predictCurve,
          });
          worker.terminate();
          break;
        }
        case 'error':
          reject(new Error(`BP worker: ${msg.message}`));
          worker.terminate();
          break;
      }
    };

    worker.onerror = (err) => {
      reject(new Error(`BP worker crash: ${err.message}`));
      worker.terminate();
    };

    const req: TrainRequest = {
      material,
      baseStrainRate: strainRate,
      baseTemperature: temperature,
      augmentFactor: cfg.augmentFactor ?? DEFAULTS.augmentFactor,
      rateJitter: cfg.rateJitter ?? DEFAULTS.rateJitter,
      tempJitter: cfg.tempJitter ?? DEFAULTS.tempJitter,
      config: {
        inputDim: 3,
        outputDim: 1,
        hiddenDim: cfg.hiddenDim ?? DEFAULTS.hiddenDim,
        epochs: cfg.epochs ?? DEFAULTS.epochs,
        learningRate: cfg.learningRate ?? DEFAULTS.learningRate,
        batchSize: cfg.batchSize ?? DEFAULTS.batchSize,
        seed: cfg.seed ?? DEFAULTS.seed,
      },
    };
    worker.postMessage({ type: 'train', payload: req });
  });
}
