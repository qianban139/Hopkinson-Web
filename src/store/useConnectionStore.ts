// src/store/useConnectionStore.ts
// 后端连接状态管理 — Phase 3
//
// 职责：
//   - 追踪后端 WS 连接状态（connected / disconnected / reconnecting）
//   - 管理设备列表
//   - 管理当前运行的实验 ID
//   - 管理仿真/连接模式切换

import { create } from 'zustand';
import type { DeviceInfo } from '@/services/api/types';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
export type LabMode = 'simulation' | 'connected';

interface ConnectionState {
  /** 后端 WS 连接状态 */
  status: ConnectionStatus;
  /** 当前实验室模式 */
  labMode: LabMode;
  /** 已注册设备列表 */
  devices: DeviceInfo[];
  /** 后端版本号（连接后获取） */
  backendVersion: string | null;
  /** 最近一次心跳时间 */
  lastHeartbeat: number | null;
  /** 当前活跃实验 ID（连接模式下使用） */
  activeExperimentId: string | null;

  // Mutations
  setStatus: (status: ConnectionStatus) => void;
  setLabMode: (mode: LabMode) => void;
  setDevices: (devices: DeviceInfo[]) => void;
  setBackendVersion: (version: string) => void;
  updateHeartbeat: () => void;
  setActiveExperimentId: (id: string | null) => void;
  reset: () => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'disconnected',
  labMode: 'simulation',
  devices: [],
  backendVersion: null,
  lastHeartbeat: null,
  activeExperimentId: null,

  setStatus: (status) => set({ status }),
  setLabMode: (labMode) => set({ labMode }),
  setDevices: (devices) => set({ devices }),
  setBackendVersion: (backendVersion) => set({ backendVersion }),
  updateHeartbeat: () => set({ lastHeartbeat: Date.now() }),
  setActiveExperimentId: (activeExperimentId) => set({ activeExperimentId }),
  reset: () =>
    set({
      status: 'disconnected',
      devices: [],
      backendVersion: null,
      lastHeartbeat: null,
      activeExperimentId: null,
    }),
}));
