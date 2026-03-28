// src/features/ai-assistant/services/vadService.ts
// VAD (Voice Activity Detection) 语音活动检测服务
// 使用 Web Audio API 的 AudioWorklet + AnalyserNode 实现实时人声检测

export interface VADOptions {
  /** 能量阈值（dB），高于此值视为有语音，默认 -45 */
  energyThreshold?: number;
  /** 静默持续时间（ms）超过此值判定为说完，默认 1500 */
  silenceTimeout?: number;
  /** 语音最短持续时间（ms），过短忽略（噪音），默认 250 */
  minSpeechDuration?: number;
  /** 检测间隔（ms），默认 50 */
  pollInterval?: number;
  /** 回调：检测到语音开始 */
  onSpeechStart?: () => void;
  /** 回调：检测到语音结束（静默超时） */
  onSpeechEnd?: () => void;
  /** 回调：实时能量值（0-1 归一化） */
  onEnergyChange?: (energy: number) => void;
}

export class VADService {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private isSpeaking = false;
  private speechStartTime = 0;
  private lastSpeechTime = 0;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  private opts: Required<VADOptions>;

  constructor(options: VADOptions = {}) {
    this.opts = {
      energyThreshold: options.energyThreshold ?? -45,
      silenceTimeout: options.silenceTimeout ?? 1500,
      minSpeechDuration: options.minSpeechDuration ?? 250,
      pollInterval: options.pollInterval ?? 50,
      onSpeechStart: options.onSpeechStart ?? (() => {}),
      onSpeechEnd: options.onSpeechEnd ?? (() => {}),
      onEnergyChange: options.onEnergyChange ?? (() => {}),
    };
  }

  /** 启动VAD检测 */
  async start(): Promise<boolean> {
    if (this.running) return true;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.8;

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.sourceNode.connect(this.analyser);

      this.running = true;
      this.startPolling();
      return true;
    } catch (err) {
      console.warn('[VAD] 启动失败:', err);
      this.cleanup();
      return false;
    }
  }

  /** 停止VAD检测 */
  stop(): void {
    this.running = false;
    this.cleanup();
  }

  /** 更新配置 */
  updateOptions(opts: Partial<VADOptions>): void {
    Object.assign(this.opts, opts);
  }

  /** 获取当前是否检测到语音 */
  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  private startPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);

    const dataArray = new Float32Array(this.analyser!.fftSize);

    this.pollTimer = setInterval(() => {
      if (!this.analyser || !this.running) return;

      this.analyser.getFloatTimeDomainData(dataArray);

      // 计算 RMS 能量
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const db = rms > 0 ? 20 * Math.log10(rms) : -100;

      // 归一化能量 0-1（-80dB ~ 0dB）
      const normalizedEnergy = Math.max(0, Math.min(1, (db + 80) / 80));
      this.opts.onEnergyChange(normalizedEnergy);

      const isVoice = db > this.opts.energyThreshold;
      const now = Date.now();

      if (isVoice) {
        this.lastSpeechTime = now;

        if (!this.isSpeaking) {
          this.speechStartTime = now;
          this.isSpeaking = true;
          this.opts.onSpeechStart();
        }

        // 清除静默计时器
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }
      } else if (this.isSpeaking) {
        // 开始静默计时
        if (!this.silenceTimer) {
          this.silenceTimer = setTimeout(() => {
            const speechDuration = this.lastSpeechTime - this.speechStartTime;
            if (speechDuration >= this.opts.minSpeechDuration) {
              this.opts.onSpeechEnd();
            }
            this.isSpeaking = false;
            this.silenceTimer = null;
          }, this.opts.silenceTimeout);
        }
      }
    }, this.opts.pollInterval);
  }

  private cleanup(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.analyser) {
      this.analyser = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    this.isSpeaking = false;
  }
}

/** 单例，全局共享 */
let _vadInstance: VADService | null = null;

export function getVADService(options?: VADOptions): VADService {
  if (!_vadInstance) {
    _vadInstance = new VADService(options);
  } else if (options) {
    _vadInstance.updateOptions(options);
  }
  return _vadInstance;
}
