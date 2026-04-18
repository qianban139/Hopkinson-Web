// src/services/api/index.ts
// 后端 API 客户端统一导出

export { getBaseUrl, getWsUrl } from './config';

// 统一 HTTP 客户端
export {
  request,
  getAuthToken,
  ApiError,
  AUTH_TOKEN_KEY,
  AUTH_UNAUTHORIZED_EVENT,
} from './httpClient';
export type { RequestOptions } from './httpClient';

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
