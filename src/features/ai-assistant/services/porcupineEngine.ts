// src/features/ai-assistant/services/porcupineEngine.ts
// Picovoice Porcupine 本地唤醒词引擎
// WebAssembly 在浏览器本地运行，无需网络，延迟 < 100ms
//
// 配置步骤：
// 1. 注册 https://console.picovoice.ai (免费)
// 2. 复制 AccessKey → .env 的 VITE_PORCUPINE_ACCESS_KEY
// 3. 在 Console 训练"小智"唤醒词 → 下载 .ppn 文件 → 放入 public/models/
// 4. 下载中文语言模型 porcupine_params_zh.pv → 放入 public/models/
//    https://github.com/Picovoice/porcupine/tree/master/lib/common

type DetectionCallback = () => void;

/**
 * 检查 Porcupine 是否已配置（环境变量 + 模型文件）
 */
export function isPorcupineConfigured(): boolean {
  return !!import.meta.env.VITE_PORCUPINE_ACCESS_KEY;
}

/**
 * Porcupine 本地唤醒词引擎封装
 * 通过 Web Worker 运行 WASM，不阻塞主线程
 */
export class PorcupineEngine {
  private porcupine: any = null;
  private isActive = false;
  private isPaused = false;
  private onDetected: DetectionCallback | null = null;

  /**
   * 初始化引擎（动态加载 WASM，约 200KB）
   */
  async init(onDetected: DetectionCallback): Promise<boolean> {
    const accessKey = import.meta.env.VITE_PORCUPINE_ACCESS_KEY;
    if (!accessKey) return false;

    this.onDetected = onDetected;
    const keywordPath = import.meta.env.VITE_PORCUPINE_KEYWORD_PATH || '/models/xiaozhi_zh.ppn';
    const modelPath = import.meta.env.VITE_PORCUPINE_MODEL_PATH || '/models/porcupine_params_zh.pv';
    const sensitivity = parseFloat(import.meta.env.VITE_PORCUPINE_SENSITIVITY || '0.65');

    try {
      const { PorcupineWorker } = await import('@picovoice/porcupine-web');

      this.porcupine = await PorcupineWorker.create(
        accessKey,
        [{
          publicPath: keywordPath,
          label: '小智',
          sensitivity: Math.max(0, Math.min(1, sensitivity)),
        }],
        (detection: { label: string }) => {
          if (!this.isPaused) {
            console.info(`[Porcupine] 唤醒词命中: "${detection.label}"`);
            this.onDetected?.();
          }
        },
        { publicPath: modelPath },
      );

      console.info('[Porcupine] 本地唤醒词引擎就绪');
      return true;
    } catch (err) {
      console.warn('[Porcupine] 初始化失败，将降级到 Web Speech API:', err);
      return false;
    }
  }

  /** 开始监听麦克风 */
  async start(): Promise<void> {
    if (!this.porcupine || this.isActive) return;
    try {
      const { WebVoiceProcessor } = await import('@picovoice/web-voice-processor');
      await WebVoiceProcessor.subscribe(this.porcupine);
      this.isActive = true;
      this.isPaused = false;
    } catch (err) {
      console.warn('[Porcupine] 启动监听失败:', err);
    }
  }

  /**
   * 暂停唤醒检测（保持麦克风流和订阅，仅忽略检测结果）
   * 比 stop/start 更快，无需重新获取麦克风
   */
  pause(): void {
    this.isPaused = true;
  }

  /** 恢复唤醒检测（从暂停状态恢复） */
  resume(): void {
    this.isPaused = false;
  }

  /** 暂停监听（释放麦克风给 SpeechRecognition） */
  async stop(): Promise<void> {
    if (!this.porcupine || !this.isActive) return;
    try {
      const { WebVoiceProcessor } = await import('@picovoice/web-voice-processor');
      await WebVoiceProcessor.unsubscribe(this.porcupine);
      this.isActive = false;
      this.isPaused = false;
    } catch (err) {
      console.warn('[Porcupine] 停止监听失败:', err);
    }
  }

  /** 释放所有资源 */
  async release(): Promise<void> {
    await this.stop();
    if (this.porcupine) {
      try { await this.porcupine.release(); } catch { /* ignore */ }
      this.porcupine = null;
    }
    this.onDetected = null;
  }

  /** 检查引擎是否健康运行 */
  isHealthy(): boolean {
    return !!this.porcupine && this.isActive && !this.isPaused;
  }

  get ready(): boolean { return !!this.porcupine; }
  get listening(): boolean { return this.isActive && !this.isPaused; }
  get paused(): boolean { return this.isPaused; }
}
