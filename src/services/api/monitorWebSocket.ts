// src/services/api/monitorWebSocket.ts
// 实时监控 WebSocket 客户端
//
// 封装 WebSocket 连接生命周期，提供指数退避重连策略。
// 使用方式：
//   const ws = createMonitorWS({ onData, onDisconnect });
//   ws.connect();
//   ws.disconnect();

import { getWsUrl } from './config';
import { getAuthToken } from './httpClient';
import type { MonitorMessage } from './types';

export interface MonitorWSOptions {
  /** 收到数据回调 */
  onData: (msg: MonitorMessage) => void;
  /** 断开连接回调 */
  onDisconnect?: () => void;
  /** 成功连接回调 */
  onConnect?: () => void;
  /** 错误回调 */
  onError?: (err: Event) => void;
  /** 只订阅部分指标（空 = 全部） */
  subscribeMetrics?: string[];
}

export interface MonitorWSHandle {
  connect: () => void;
  disconnect: () => void;
  isConnected: () => boolean;
}

const MAX_RETRIES = 10;
const INITIAL_RETRY_MS = 500;

export function createMonitorWS(options: MonitorWSOptions): MonitorWSHandle {
  let ws: WebSocket | null = null;
  let retryCount = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let intentionalClose = false;

  function connect() {
    intentionalClose = false;
    const token = getAuthToken();
    const qs = token ? `?token=${encodeURIComponent(token)}` : '';
    const url = `${getWsUrl()}/ws/monitor${qs}`;
    ws = new WebSocket(url);

    ws.onopen = () => {
      retryCount = 0;
      options.onConnect?.();
      // 发送订阅消息
      if (options.subscribeMetrics?.length) {
        ws?.send(JSON.stringify({ type: 'subscribe', metrics: options.subscribeMetrics }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as MonitorMessage;
        if (msg.type === 'monitor') {
          options.onData(msg);
        }
      } catch {
        // 忽略非法帧
      }
    };

    ws.onerror = (err) => {
      options.onError?.(err);
    };

    ws.onclose = () => {
      options.onDisconnect?.();
      if (!intentionalClose && retryCount < MAX_RETRIES) {
        const delay = INITIAL_RETRY_MS * Math.pow(2, retryCount);
        retryCount++;
        retryTimer = setTimeout(connect, delay);
      }
    };
  }

  function disconnect() {
    intentionalClose = true;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    if (ws) {
      ws.close();
      ws = null;
    }
  }

  function isConnected() {
    return ws?.readyState === WebSocket.OPEN;
  }

  return { connect, disconnect, isConnected };
}
