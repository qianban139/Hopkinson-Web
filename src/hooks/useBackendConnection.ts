// src/hooks/useBackendConnection.ts
// 后端连接管理 Hook — Phase 3
//
// 一键 connect / disconnect，自动管理 WS 生命周期，
// 将监控数据注入到 useAppStore.monitorData

import { useCallback, useRef, useEffect } from 'react';
import { useConnectionStore } from '@/store/useConnectionStore';
import { useAppStore } from '@/store/useAppStore';
import { createMonitorWS, type MonitorWSHandle } from '@/services/api/monitorWebSocket';
import { listDevices } from '@/services/api/deviceClient';
import { getBaseUrl } from '@/services/api/config';

export function useBackendConnection() {
  const {
    status,
    setStatus,
    setDevices,
    setBackendVersion,
    updateHeartbeat,
    reset,
  } = useConnectionStore();

  const wsRef = useRef<MonitorWSHandle | null>(null);

  const connect = useCallback(async () => {
    setStatus('connecting');

    // 1. 先测试 HTTP 健康检查
    try {
      const res = await fetch(`${getBaseUrl()}/api/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBackendVersion(data.version || 'unknown');
    } catch (err) {
      console.warn('后端健康检查失败:', err);
      setStatus('disconnected');
      return false;
    }

    // 2. 加载设备列表
    try {
      const devices = await listDevices();
      setDevices(devices);
    } catch {
      // 允许继续，设备列表非关键
    }

    // 3. 建立 WebSocket
    const ws = createMonitorWS({
      onConnect: () => {
        setStatus('connected');
        updateHeartbeat();
      },
      onData: (msg) => {
        updateHeartbeat();
        // 注入到全局 appStore
        const store = useAppStore.getState();
        store.setMonitorData({
          voltage: msg.data.voltage ?? store.monitorData.voltage,
          current: msg.data.current ?? store.monitorData.current,
          capacitance: msg.data.capacitance ?? store.monitorData.capacitance,
          temperature: msg.data.temperature ?? store.monitorData.temperature,
          emi: msg.data.emi ?? store.monitorData.emi,
        });
      },
      onDisconnect: () => {
        // 如果不是主动断开 → reconnecting
        if (useConnectionStore.getState().status === 'connected') {
          setStatus('reconnecting');
        }
      },
      onError: () => {
        // ws onerror → onclose 会自动触发
      },
    });

    ws.connect();
    wsRef.current = ws;
    return true;
  }, [setStatus, setDevices, setBackendVersion, updateHeartbeat]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.disconnect();
      wsRef.current = null;
    }
    reset();
  }, [reset]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      wsRef.current?.disconnect();
    };
  }, []);

  return { status, connect, disconnect };
}
