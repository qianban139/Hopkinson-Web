/**
 * BP 神经网络(纯 JS 实现)
 *
 * 论文来源: 龙旭 等(2021)"基于人工神经网络的混凝土类材料 SHPB 动态压缩性能预测"
 * 网络结构: 输入层 → 单隐层 (tansig) → 输出层 (purelin)
 *
 * 特点:
 *   - 反向传播 + 小批量梯度下降
 *   - 学习率衰减 (1/√epoch)
 *   - Xavier 初始化
 *   - 输入/输出的 Min-Max 归一化(保存归一化参数,推理时反归一化)
 *
 * 使用场景(本项目):
 *   给定 (应变, 应变率, 温度) → 预测应力(MPa)
 *   替代传统本构方程的拟合,可泛化到未显式拟合的工况。
 */

export interface BPConfig {
  /** 输入维度 */
  inputDim: number;
  /** 隐层神经元数 */
  hiddenDim: number;
  /** 输出维度 */
  outputDim: number;
  /** 训练轮数 */
  epochs: number;
  /** 学习率(初始值) */
  learningRate: number;
  /** 批大小 */
  batchSize: number;
  /** 随机种子 */
  seed?: number;
}

export interface NormParams {
  min: number[];
  max: number[];
}

export interface TrainHistory {
  /** 每个 epoch 的 MSE loss */
  losses: number[];
  /** 每个 epoch 的 R² */
  rSquared: number[];
  /** 总耗时(ms) */
  elapsed: number;
}

interface NetworkState {
  W1: number[][]; // hidden × input
  b1: number[];   // hidden
  W2: number[][]; // output × hidden
  b2: number[];   // output
}

/** 序列化快照 — 用于 Worker postMessage 传输训练成果 */
export interface BPNetworkSnapshot {
  cfg: BPConfig;
  state: NetworkState;
  xNorm: NormParams;
  yNorm: NormParams;
}

/** tanh 激活(等效于 Matlab tansig) */
function tansig(x: number): number { return Math.tanh(x); }
function tansigDeriv(y: number): number { return 1 - y * y; }

export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function xavierInit(rows: number, cols: number, rand: () => number): number[][] {
  const scale = Math.sqrt(2 / (rows + cols));
  const m: number[][] = [];
  for (let i = 0; i < rows; i++) {
    const row: number[] = [];
    for (let j = 0; j < cols; j++) {
      row.push((rand() * 2 - 1) * scale);
    }
    m.push(row);
  }
  return m;
}

/** Min-Max 归一化参数 */
export function fitNorm(matrix: number[][]): NormParams {
  const dim = matrix[0].length;
  const min = new Array(dim).fill(Infinity);
  const max = new Array(dim).fill(-Infinity);
  for (const row of matrix) {
    for (let i = 0; i < dim; i++) {
      if (row[i] < min[i]) min[i] = row[i];
      if (row[i] > max[i]) max[i] = row[i];
    }
  }
  return { min, max };
}

export function applyNorm(row: number[], norm: NormParams): number[] {
  return row.map((v, i) => {
    const range = norm.max[i] - norm.min[i];
    // Audit BP-6: 常数维度返回 0.5 而非 0, 保留中心信息便于反归一化
    return range > 0 ? (v - norm.min[i]) / range : 0.5;
  });
}

export function denorm(row: number[], norm: NormParams): number[] {
  return row.map((v, i) => {
    const range = norm.max[i] - norm.min[i];
    // Audit BP-7: 常数维度反归一化保留原 min, 与 applyNorm 退化一致
    return range > 0 ? v * range + norm.min[i] : norm.min[i];
  });
}

/**
 * BP 神经网络
 */
export class BPNetwork {
  private cfg: BPConfig;
  private state: NetworkState;
  private xNorm: NormParams | null = null;
  private yNorm: NormParams | null = null;

  constructor(cfg: BPConfig) {
    this.cfg = cfg;
    const rand = seededRandom(cfg.seed ?? 42);
    this.state = {
      W1: xavierInit(cfg.hiddenDim, cfg.inputDim, rand),
      b1: new Array(cfg.hiddenDim).fill(0),
      W2: xavierInit(cfg.outputDim, cfg.hiddenDim, rand),
      b2: new Array(cfg.outputDim).fill(0),
    };
  }

  /**
   * 训练
   * @param X  输入矩阵 [N × inputDim]
   * @param Y  输出矩阵 [N × outputDim]
   * @param onEpoch  每个 epoch 结束时的回调(用于更新 UI 训练曲线)
   */
  async train(
    X: number[][],
    Y: number[][],
    onEpoch?: (epoch: number, loss: number, r2: number) => void,
  ): Promise<TrainHistory> {
    const start = performance.now();
    const { epochs, learningRate, batchSize } = this.cfg;

    // 归一化
    this.xNorm = fitNorm(X);
    this.yNorm = fitNorm(Y);
    const Xn = X.map((r) => applyNorm(r, this.xNorm!));
    const Yn = Y.map((r) => applyNorm(r, this.yNorm!));

    const N = Xn.length;
    const losses: number[] = [];
    const rSquared: number[] = [];

    for (let epoch = 0; epoch < epochs; epoch++) {
      const indices = shuffle(N, epoch + 1);
      const lr = learningRate / Math.sqrt(1 + epoch * 0.02);

      // 小批量训练
      for (let b = 0; b < N; b += batchSize) {
        const batchIdx = indices.slice(b, b + batchSize);
        this.trainBatch(Xn, Yn, batchIdx, lr);
      }

      // 计算本轮 loss / R²
      const { mse, r2 } = this.evaluate(Xn, Yn);
      losses.push(mse);
      rSquared.push(r2);
      onEpoch?.(epoch, mse, r2);

      // 让出事件循环 — 在 Worker 内允许 message queue 处理(如 cancel 信号);
      // 在主线程降级时避免 UI 完全冻结. 每 epoch 都让一次代价极低 (~0.5ms / 1000 epoch).
      await new Promise((r) => setTimeout(r, 0));
    }

    return { losses, rSquared, elapsed: performance.now() - start };
  }

  /** 预测(输入/输出均为原始尺度) */
  predict(x: number[]): number[] {
    if (!this.xNorm || !this.yNorm) {
      throw new Error('Network must be trained before predict()');
    }
    const xn = applyNorm(x, this.xNorm);
    const yn = this.forward(xn).output;
    return denorm(yn, this.yNorm);
  }

  /** 批量预测 */
  predictBatch(X: number[][]): number[][] {
    return X.map((x) => this.predict(x));
  }

  /** 导出权重 + 归一化参数 (用于 Worker 训练完后回传主线程) */
  exportState(): BPNetworkSnapshot {
    if (!this.xNorm || !this.yNorm) {
      throw new Error('Network must be trained before exportState()');
    }
    return {
      cfg: { ...this.cfg },
      state: {
        W1: this.state.W1.map((r) => r.slice()),
        b1: this.state.b1.slice(),
        W2: this.state.W2.map((r) => r.slice()),
        b2: this.state.b2.slice(),
      },
      xNorm: { min: this.xNorm.min.slice(), max: this.xNorm.max.slice() },
      yNorm: { min: this.yNorm.min.slice(), max: this.yNorm.max.slice() },
    };
  }

  /** 从快照重建网络 (与 exportState 配对; 用于 Worker → 主线程恢复) */
  static fromState(snapshot: BPNetworkSnapshot): BPNetwork {
    const net = new BPNetwork(snapshot.cfg);
    net.state = {
      W1: snapshot.state.W1.map((r) => r.slice()),
      b1: snapshot.state.b1.slice(),
      W2: snapshot.state.W2.map((r) => r.slice()),
      b2: snapshot.state.b2.slice(),
    };
    net.xNorm = { min: snapshot.xNorm.min.slice(), max: snapshot.xNorm.max.slice() };
    net.yNorm = { min: snapshot.yNorm.min.slice(), max: snapshot.yNorm.max.slice() };
    return net;
  }

  // ——————————————————————————————————————————————
  // 内部: 前向 / 反向
  // ——————————————————————————————————————————————

  private forward(xn: number[]): { hidden: number[]; output: number[] } {
    const { W1, b1, W2, b2 } = this.state;
    const { hiddenDim, outputDim } = this.cfg;

    const hidden = new Array(hiddenDim).fill(0);
    for (let i = 0; i < hiddenDim; i++) {
      let z = b1[i];
      for (let j = 0; j < xn.length; j++) z += W1[i][j] * xn[j];
      hidden[i] = tansig(z);
    }

    const output = new Array(outputDim).fill(0);
    for (let i = 0; i < outputDim; i++) {
      let z = b2[i];
      for (let j = 0; j < hiddenDim; j++) z += W2[i][j] * hidden[j];
      output[i] = z; // purelin
    }
    return { hidden, output };
  }

  private trainBatch(X: number[][], Y: number[][], idx: number[], lr: number): void {
    const { W1, b1, W2, b2 } = this.state;
    const { hiddenDim, outputDim, inputDim } = this.cfg;

    // 梯度累积
    const dW1 = zeroMatrix(hiddenDim, inputDim);
    const db1 = new Array(hiddenDim).fill(0);
    const dW2 = zeroMatrix(outputDim, hiddenDim);
    const db2 = new Array(outputDim).fill(0);

    for (const i of idx) {
      const xn = X[i];
      const yn = Y[i];
      const { hidden, output } = this.forward(xn);

      // 输出层误差(purelin 导数为 1)
      const dOut = new Array(outputDim).fill(0);
      for (let k = 0; k < outputDim; k++) dOut[k] = output[k] - yn[k];

      // W2 梯度
      for (let k = 0; k < outputDim; k++) {
        for (let j = 0; j < hiddenDim; j++) dW2[k][j] += dOut[k] * hidden[j];
        db2[k] += dOut[k];
      }

      // 隐层误差
      const dHidden = new Array(hiddenDim).fill(0);
      for (let j = 0; j < hiddenDim; j++) {
        let sum = 0;
        for (let k = 0; k < outputDim; k++) sum += dOut[k] * W2[k][j];
        dHidden[j] = sum * tansigDeriv(hidden[j]);
      }

      // W1 梯度
      for (let j = 0; j < hiddenDim; j++) {
        for (let k = 0; k < inputDim; k++) dW1[j][k] += dHidden[j] * xn[k];
        db1[j] += dHidden[j];
      }
    }

    const n = idx.length;
    for (let i = 0; i < hiddenDim; i++) {
      b1[i] -= (lr / n) * db1[i];
      for (let j = 0; j < inputDim; j++) W1[i][j] -= (lr / n) * dW1[i][j];
    }
    for (let i = 0; i < outputDim; i++) {
      b2[i] -= (lr / n) * db2[i];
      for (let j = 0; j < hiddenDim; j++) W2[i][j] -= (lr / n) * dW2[i][j];
    }
  }

  private evaluate(Xn: number[][], Yn: number[][]): { mse: number; r2: number } {
    const { outputDim } = this.cfg;
    let sse = 0;
    const meanY = new Array(outputDim).fill(0);
    for (const y of Yn) for (let k = 0; k < outputDim; k++) meanY[k] += y[k];
    for (let k = 0; k < outputDim; k++) meanY[k] /= Yn.length;
    let ssTot = 0;

    for (let i = 0; i < Xn.length; i++) {
      const { output } = this.forward(Xn[i]);
      for (let k = 0; k < outputDim; k++) {
        sse += (output[k] - Yn[i][k]) ** 2;
        ssTot += (Yn[i][k] - meanY[k]) ** 2;
      }
    }
    const n = Xn.length * outputDim;
    return { mse: sse / n, r2: ssTot > 0 ? 1 - sse / ssTot : 0 };
  }
}

// ——————————————————————————————————————————————
// 工具
// ——————————————————————————————————————————————

function zeroMatrix(rows: number, cols: number): number[][] {
  const m: number[][] = [];
  for (let i = 0; i < rows; i++) m.push(new Array(cols).fill(0));
  return m;
}

function shuffle(n: number, seed: number): number[] {
  const rand = seededRandom(seed);
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
