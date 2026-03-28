// src/features/ai-assistant/services/realtimeVoicePipeline.ts
// 实时语音对话管线 - 低延迟 ASR→LLM→TTS 流水线
// 支持全双工模式：AI说话时用户可随时打断

import { VADService } from './vadService';

export type PipelineState =
  | 'idle'          // 空闲
  | 'listening'     // 正在听用户说话
  | 'processing'    // ASR结果送往LLM
  | 'speaking'      // AI正在播报回复
  | 'interrupted';  // 用户打断AI

export interface PipelineCallbacks {
  /** ASR识别到最终文本 */
  onTranscript: (text: string) => void;
  /** ASR中间结果（实时更新） */
  onInterimTranscript: (text: string) => void;
  /** 管线状态变化 */
  onStateChange: (state: PipelineState) => void;
  /** VAD检测到用户开始说话（用于打断AI） */
  onUserSpeechDetected: () => void;
  /** 实时音频能量（0-1，用于波形可视化） */
  onEnergyLevel: (energy: number) => void;
}

export interface RealtimePipelineOptions {
  /** 语言，默认 zh-CN */
  lang?: string;
  /** VAD 能量阈值 dB，默认 -45 */
  vadThreshold?: number;
  /** VAD 静默超时 ms，默认 1200（比独立VAD短，更灵敏） */
  vadSilenceTimeout?: number;
  /** 是否启用全双工（AI说话时可打断），默认 true */
  duplexMode?: boolean;
}

/**
 * 实时语音对话管线
 *
 * 架构:
 *   麦克风 → VAD(检测人声) → ASR(语音转文字) → [外部LLM] → TTS(文字转语音) → 扬声器
 *                                ↑ 全双工：AI播报期间VAD持续监听，检测到人声立即打断
 *
 * 使用方式:
 *   const pipeline = new RealtimeVoicePipeline({ ... }, callbacks);
 *   await pipeline.start();  // 开始监听
 *   pipeline.stop();         // 停止
 */
export class RealtimeVoicePipeline {
  private vad: VADService;
  private recognition: SpeechRecognition | null = null;
  private callbacks: PipelineCallbacks;
  private opts: Required<RealtimePipelineOptions>;
  private state: PipelineState = 'idle';
  private running = false;
  private isAISpeaking = false;

  private SpeechRecognitionAPI = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;

  constructor(options: RealtimePipelineOptions, callbacks: PipelineCallbacks) {
    this.callbacks = callbacks;
    this.opts = {
      lang: options.lang ?? 'zh-CN',
      vadThreshold: options.vadThreshold ?? -45,
      vadSilenceTimeout: options.vadSilenceTimeout ?? 1200,
      duplexMode: options.duplexMode ?? true,
    };

    this.vad = new VADService({
      energyThreshold: this.opts.vadThreshold,
      silenceTimeout: this.opts.vadSilenceTimeout,
      minSpeechDuration: 200,
      onSpeechStart: () => this.handleVADSpeechStart(),
      onSpeechEnd: () => this.handleVADSpeechEnd(),
      onEnergyChange: (e) => this.callbacks.onEnergyLevel(e),
    });
  }

  /** 启动管线 */
  async start(): Promise<boolean> {
    if (this.running) return true;

    const vadOk = await this.vad.start();
    if (!vadOk) return false;

    this.running = true;
    this.setState('listening');
    this.startASR();
    return true;
  }

  /** 停止管线 */
  stop(): void {
    this.running = false;
    this.vad.stop();
    this.stopASR();
    this.setState('idle');
  }

  /** 通知管线：AI开始播报（启用打断检测） */
  notifyAISpeaking(): void {
    this.isAISpeaking = true;
    if (this.opts.duplexMode) {
      this.setState('speaking');
    }
  }

  /** 通知管线：AI播报结束 */
  notifyAIDoneSpeaking(): void {
    this.isAISpeaking = false;
    if (this.running) {
      this.setState('listening');
    }
  }

  /** 获取当前状态 */
  getState(): PipelineState {
    return this.state;
  }

  private setState(state: PipelineState): void {
    if (this.state !== state) {
      this.state = state;
      this.callbacks.onStateChange(state);
    }
  }

  // ═══ VAD 回调 ═══

  private handleVADSpeechStart(): void {
    if (!this.running) return;

    // 全双工打断：AI说话时检测到用户说话
    if (this.isAISpeaking && this.opts.duplexMode) {
      this.setState('interrupted');
      this.callbacks.onUserSpeechDetected();
      this.isAISpeaking = false;
    }
  }

  private handleVADSpeechEnd(): void {
    // VAD检测到用户说完 → ASR自动提交最终结果
    // 不需要额外处理，ASR的onresult会触发回调
  }

  // ═══ ASR 管理 ═══

  private startASR(): void {
    if (!this.SpeechRecognitionAPI) return;

    this.stopASR();

    const recognition = new this.SpeechRecognitionAPI();
    recognition.lang = this.opts.lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final_ = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final_ += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (interim) {
        this.callbacks.onInterimTranscript(interim);
      }

      if (final_) {
        this.callbacks.onTranscript(final_.trim());
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        console.warn('[RealtimePipeline] ASR error:', event.error);
      }
    };

    recognition.onend = () => {
      // 自动重启 ASR（保持持续监听）
      if (this.running) {
        setTimeout(() => {
          if (this.running) this.startASR();
        }, 100);
      }
    };

    try {
      recognition.start();
      this.recognition = recognition;
    } catch (err) {
      console.warn('[RealtimePipeline] ASR start failed:', err);
    }
  }

  private stopASR(): void {
    if (this.recognition) {
      try { this.recognition.abort(); } catch {}
      this.recognition = null;
    }
  }
}
