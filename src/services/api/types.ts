// src/services/api/types.ts
// 后端 API 共享类型定义

/** 设备状态 */
export type DeviceStatus = 'online' | 'offline' | 'busy' | 'error';

/** 设备信息 */
export interface DeviceInfo {
  id: string;
  name: string;
  type: 'daq' | 'em-driver' | 'sensor';
  status: DeviceStatus;
  lastHeartbeat: number;
  metadata: Record<string, unknown>;
}

/** 实验阶段 */
export type ExperimentPhase =
  | 'created'
  | 'safety_check'
  | 'preparation'
  | 'execution'
  | 'completed'
  | 'paused'
  | 'aborted'
  | 'error';

/** 实验详情 */
export interface ExperimentDetail {
  experimentId: string;
  materialId: string;
  params: Record<string, unknown>;
  mode: 'real' | 'simulation';
  phase: ExperimentPhase;
  progress: number;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  result: ExperimentResult | null;
}

/** 实验结果 */
export interface ExperimentResult {
  peakStress_mpa: number;
  maxStrainRate: number;
  absorbedEnergy_j: number;
  equilibrium_ratio: number;
  waveformSamples: number;
}

/** 创建实验请求体 */
export interface CreateExperimentBody {
  materialId: string;
  params: Record<string, unknown>;
  mode?: 'real' | 'simulation';
}

/** 监控 WS 推送消息 */
export interface MonitorMessage {
  type: 'monitor';
  timestamp: number;
  data: {
    voltage: number;
    current: number;
    capacitance: number;
    temperature: number;
    emi: number;
  };
  safe: boolean;
  warning?: string;
}

/** 实验 WS 推送 — 阶段变更 */
export interface ExperimentPhaseMessage {
  type: 'phase';
  phase: ExperimentPhase;
  progress: number;
  timestamp: number;
}

/** 实验 WS 推送 — 波形数据 */
export interface WaveformMessage {
  type: 'waveform';
  channel: 'incident' | 'reflected' | 'transmitted';
  samples: number[];
  sampleRate: number;
  timestamp: number;
}

/** 实验 WS 推送 — 实验结束 */
export interface ExperimentFinishedMessage {
  type: 'finished';
  phase: ExperimentPhase;
  result: ExperimentResult | null;
  timestamp: number;
}

/** 实验 WS 推送联合类型 */
export type ExperimentWSMessage =
  | ExperimentPhaseMessage
  | WaveformMessage
  | ExperimentFinishedMessage;
