// src/services/api/config.ts
// 后端连接配置

/**
 * 获取后端 base URL（HTTP）
 * 默认 http://localhost:8000
 */
export function getBaseUrl(): string {
  return import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
}

/**
 * 获取后端 WebSocket base URL
 * 自动将 http → ws, https → wss
 */
export function getWsUrl(): string {
  const base = getBaseUrl();
  return base.replace(/^http/, 'ws');
}
