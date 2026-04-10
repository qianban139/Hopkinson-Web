// src/features/ai-assistant/utils/soundEffects.ts
// 轻量音效反馈 - 使用 Web Audio API 生成提示音

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (!audioContext && typeof window !== 'undefined' && window.AudioContext) {
    try {
      audioContext = new AudioContext();
    } catch {
      return null;
    }
  }
  return audioContext;
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.08) {
  const ctx = getAudioContext();
  if (!ctx) return;

  // 确保AudioContext已resume（浏览器自动暂停策略）
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + duration);
}

export const sounds = {
  /** 唤醒词检测 - 双音阶上升 */
  wakeWordDetected: () => {
    playTone(880, 0.12);
    setTimeout(() => playTone(1100, 0.12), 120);
  },

  /** 消息发送 - 短促发送音 */
  messageSent: () => {
    playTone(600, 0.08, 'sine', 0.05);
  },

  /** 收到回复 - 柔和提示音 */
  responseReceived: () => {
    playTone(800, 0.1, 'sine', 0.06);
  },

  /** 错误提示 */
  error: () => {
    playTone(300, 0.25, 'square', 0.04);
  },

  /** 开始录音 - 清脆上升双音 */
  recordStart: () => {
    playTone(660, 0.08, 'sine', 0.1);
    setTimeout(() => playTone(880, 0.1, 'sine', 0.1), 80);
  },

  /** 结束录音 - 柔和下降音 */
  recordStop: () => {
    playTone(880, 0.08, 'sine', 0.08);
    setTimeout(() => playTone(660, 0.12, 'sine', 0.06), 80);
  },

  /** 录音取消 - 低沉短促 */
  recordCancel: () => {
    playTone(330, 0.15, 'triangle', 0.06);
  },
};
