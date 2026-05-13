/**
 * BP 训练 Web Worker
 *
 * 把神经网络训练放到独立线程, 避免主线程 UI 冻结.
 * 主线程通过 src/services/bpTrainerClient.ts 包装的 Promise API 调用本 worker.
 *
 * 协议:
 *   主线程 → Worker:
 *     { type: 'train', payload: TrainRequest }
 *
 *   Worker → 主线程:
 *     { type: 'epoch', epoch, loss, r2 }
 *     { type: 'done', snapshot, history, sampleCount }
 *     { type: 'error', message }
 */

/// <reference lib="webworker" />

import { BPNetwork, type BPConfig, type BPNetworkSnapshot, type TrainHistory } from './bpNetwork';
import { buildTrainingSet } from './bpShpbPredictor';
import type { Material } from '@/types';

export interface TrainRequest {
  material: Material;
  baseStrainRate: number;
  baseTemperature: number;
  augmentFactor: number;
  rateJitter: number;
  tempJitter: number;
  config: BPConfig;
}

export type WorkerInbound = { type: 'train'; payload: TrainRequest };

export type WorkerOutbound =
  | { type: 'epoch'; epoch: number; loss: number; r2: number }
  | { type: 'done'; snapshot: BPNetworkSnapshot; history: TrainHistory; sampleCount: number }
  | { type: 'error'; message: string };

// declare self for TypeScript in module worker
declare const self: DedicatedWorkerGlobalScope;

self.onmessage = async (e: MessageEvent<WorkerInbound>) => {
  if (e.data.type !== 'train') return;
  const req = e.data.payload;
  try {
    const { X, Y } = buildTrainingSet(
      req.material,
      req.baseStrainRate,
      req.baseTemperature,
      req.augmentFactor,
      req.rateJitter,
      req.tempJitter,
      req.config.seed ?? 42,
    );

    const net = new BPNetwork(req.config);
    const history = await net.train(X, Y, (epoch, loss, r2) => {
      const msg: WorkerOutbound = { type: 'epoch', epoch, loss, r2 };
      self.postMessage(msg);
    });

    const snapshot = net.exportState();
    const doneMsg: WorkerOutbound = {
      type: 'done',
      snapshot,
      history,
      sampleCount: X.length,
    };
    self.postMessage(doneMsg);
  } catch (err) {
    const errMsg: WorkerOutbound = {
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(errMsg);
  }
};
