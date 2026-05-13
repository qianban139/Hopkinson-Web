import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [inspectAttr(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // 备案期间硬编码鉴权短路: import.meta.env.VITE_AUTH_DISABLED === 'true'
  // 后端备案完成 + 可达后, 删除此 define 块即可恢复鉴权流程.
  define: {
    'import.meta.env.VITE_AUTH_DISABLED': JSON.stringify('true'),
  },
  server: {
    proxy: {
      // 火山引擎TTS V3 API代理（大模型语音合成推荐接口）
      '/api/tts/v3': {
        target: 'https://openspeech.bytedance.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/tts\/v3/, '/api/v3/tts/unidirectional'),
      },
    },
  },
});
