// src/services/api/index.ts
// 后端 API 客户端统一导出

export { getBaseUrl, getWsUrl } from './config';

// REST
export { listDevices, getDevice, healthCheckDevice } from './deviceClient';
export {
  createExperiment, getExperiment, startExperiment,
  pauseExperiment, emergencyStop, getExperimentResult,
} from './experimentClient';

// WebSocket
export { createMonitorWS } from './monitorWebSocket';
export type { MonitorWSOptions, MonitorWSHandle } from './monitorWebSocket';
export { createExperimentWS } from './experimentWebSocket';
export type { ExperimentWSOptions, ExperimentWSHandle } from './experimentWebSocket';

// Types
export type * from './types';
