/**
 * 信号处理模块 - 共享类型定义
 *
 * 所有算法均基于 SHPB 三波形（入射 / 反射 / 透射）数据
 */

/** 单通道波形数据 */
export interface WaveformData {
  /** 时间序列（单位：μs） */
  time: number[];
  /** 信号幅值（单位：MPa 应力 / mε 应变） */
  values: number[];
  /** 采样率（Hz） */
  sampleRate: number;
  /** 通道标识 */
  channel: 'incident' | 'reflected' | 'transmitted';
}

/** 三波形数据集 */
export interface ThreeWaveDataset {
  incident: WaveformData;
  reflected: WaveformData;
  transmitted: WaveformData;
}

/** 算法处理结果（含调试信息） */
export interface ProcessingResult {
  /** 处理后波形 */
  waveform: WaveformData;
  /** 算法名称 */
  algorithm: string;
  /** 处理参数 */
  params: Record<string, number | string | boolean>;
  /** 处理耗时（ms） */
  durationMs: number;
  /** 信噪比改善（dB） */
  snrImprovement?: number;
  /** 备注 */
  notes?: string;
}

/** 算法在管线中的执行配置 */
export interface PipelineStep {
  id: string;
  algorithm: string;
  enabled: boolean;
  params: Record<string, number | string | boolean>;
}

/** 应力平衡判据结果 */
export interface StressEquilibriumResult {
  /** 平衡度 R = |σ1 - σ2| / max(σ1, σ2) */
  ratio: number;
  /** 是否满足平衡（R < 0.05 为优良） */
  isBalanced: boolean;
  /** 评级 */
  grade: 'excellent' | 'good' | 'acceptable' | 'poor';
  /** 详细描述 */
  description: string;
}
