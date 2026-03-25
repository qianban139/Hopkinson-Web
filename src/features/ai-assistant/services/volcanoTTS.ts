// src/features/ai-assistant/services/volcanoTTS.ts
// 火山引擎语音合成大模型 - V3 HTTP Chunked接口
// 开发环境通过Vite代理解决CORS，生产环境需后端代理

interface VolcanoTTSConfig {
  appId: string;
  accessToken: string;
  voiceType: string;
  cluster: string;
  speedRatio: number;
}

function getConfig(): VolcanoTTSConfig | null {
  const appId = import.meta.env.VITE_VOLCANO_APP_ID || '';
  const accessToken = import.meta.env.VITE_VOLCANO_ACCESS_TOKEN || '';
  if (!appId || !accessToken) return null;
  return {
    appId,
    accessToken,
    voiceType: import.meta.env.VITE_VOLCANO_VOICE_TYPE || 'zh_female_meilinvyou_moon_bigtts',
    cluster: import.meta.env.VITE_VOLCANO_CLUSTER || 'volcano_mega_tts',
    speedRatio: 1.0,
  };
}

/**
 * 检查火山引擎TTS是否已配置
 */
export function isVolcanoTTSConfigured(): boolean {
  return getConfig() !== null;
}

/**
 * 调用火山引擎TTS V3 HTTP Chunked接口合成语音
 * 公共音色resource_id: volc.service_type.10029
 */
export async function synthesizeSpeech(text: string): Promise<string | null> {
  const config = getConfig();
  if (!config) return null;

  const apiUrl = import.meta.env.DEV
    ? '/api/tts/v3'   // Vite dev proxy
    : '/api/tts';      // Vercel serverless function proxy

  const reqid = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    // V3 请求体格式
    const requestBody = {
      user: {
        uid: 'hopkinson-web-user',
      },
      req_params: {
        text,
        speaker: config.voiceType,
        audio_params: {
          format: 'mp3',
          sample_rate: 24000,
          speed_ratio: config.speedRatio,
          volume_ratio: 1.0,
          pitch_ratio: 1.0,
        },
      },
    };

    console.info(`[VolcanoTTS] V3合成: "${text.slice(0, 20)}..." → ${apiUrl}`);

    // 生产环境通过 serverless 代理，不需要自定义 header（避免 CORS preflight）
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (import.meta.env.DEV) {
      headers['Authorization'] = `Bearer;${config.accessToken}`;
      headers['Resource-Id'] = config.voiceType.startsWith('ICL_') ? 'volc.megatts.voiceclone' : 'volc.service_type.10029';
      headers['X-Api-Resource-Id'] = config.voiceType.startsWith('ICL_') ? 'volc.megatts.voiceclone' : 'volc.service_type.10029';
      headers['X-Api-App-Key'] = config.appId;
      headers['X-Api-Access-Key'] = config.accessToken;
      headers['X-Api-Request-Id'] = reqid;
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.warn(`[VolcanoTTS] HTTP错误: ${response.status} ${response.statusText}`);
      console.warn(`[VolcanoTTS] 错误详情:`, errorBody);
      return null;
    }

    // V3 Chunked响应: 收集所有音频数据
    const reader = response.body?.getReader();
    if (!reader) {
      console.warn('[VolcanoTTS] 无法读取响应流');
      return null;
    }

    const audioChunks: Uint8Array[] = [];
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        processChunk(trimmed, audioChunks);
      }
    }

    if (buffer.trim()) {
      processChunk(buffer.trim(), audioChunks);
    }

    if (audioChunks.length === 0) {
      console.warn('[VolcanoTTS] 未收到音频数据');
      return null;
    }

    // 合并所有音频块为单个base64
    const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of audioChunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    let binary = '';
    for (let i = 0; i < combined.length; i++) {
      binary += String.fromCharCode(combined[i]);
    }
    const base64Audio = btoa(binary);

    console.info(`[VolcanoTTS] V3合成成功，收到${audioChunks.length}个音频块`);
    return base64Audio;
  } catch (error) {
    console.warn('[VolcanoTTS] 请求失败，将降级到Web Speech API:', error);
    return null;
  }
}

function processChunk(jsonStr: string, audioChunks: Uint8Array[]) {
  try {
    const chunk = JSON.parse(jsonStr);

    // 检查错误 - V3格式: header.code 或顶级 code
    const code = chunk.header?.code || chunk.code;
    if (code && code !== 3000 && code !== 0) {
      const msg = chunk.header?.message || chunk.message;
      console.warn(`[VolcanoTTS] 块错误: code=${code}, msg=${msg}`);
      return;
    }

    // V3返回的音频数据可能在多个位置
    const audioData = chunk.payload?.data || chunk.data || chunk.audio;
    if (audioData) {
      const binaryStr = atob(audioData);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      audioChunks.push(bytes);
    }
  } catch {
    // 非JSON内容，跳过
  }
}

/**
 * 播放base64编码的音频
 */
export function playBase64Audio(base64Data: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(`data:audio/mp3;base64,${base64Data}`);
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error('Audio playback failed'));
    audio.play().catch(reject);
  });
}
