// src/services/api/experimentWebSocket.ts
// 实验执行 WebSocket 客户端

import { getWsUrl } from './config';
import { getAuthToken } from './httpClient';
import type { ExperimentWSMessage } from './types';

export interface ExperimentWSOptions {
  experimentId: string;
  /** 收到数据回调 */
  onMessage: (msg: ExperimentWSMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (err: Event) => void;
}

export interface ExperimentWSHandle {
  connect: () => void;
  disconnect: () => void;
  /** 发送控制命令 */
  sendCommand: (action: 'pause' | 'resume' | 'stop') => void;
  isConnected: () => boolean;
}

export function createExperimentWS(options: ExperimentWSOptions): ExperimentWSHandle {
  let ws: WebSocket | null = null;

  function connect() {
    const token = getAuthToken();
    // WebSocket 不支持自定义 header,token 只能走 query string
    const qs = token ? `?token=${encodeURIComponent(token)}` : '';
    const url = `${getWsUrl()}/ws/experiment/${options.experimentId}${qs}`;
    ws = new WebSocket(url);

    ws.onopen = () => options.onConnect?.();

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ExperimentWSMessage;
        options.onMessage(msg);
      } catch {
        // 忽略
      }
    };

    ws.onerror = (err) => options.onError?.(err);
    ws.onclose = () => options.onDisconnect?.();
  }

  function disconnect() {
    if (ws) {
      ws.close();
      ws = null;
    }
  }

  function sendCommand(action: 'pause' | 'resume' | 'stop') {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'command', action }));
    }
  }

  function isConnected() {
    return ws?.readyState === WebSocket.OPEN;
  }

  return { connect, disconnect, sendCommand, isConnected };
}
