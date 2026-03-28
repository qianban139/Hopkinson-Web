// src/features/ai-assistant/services/ttsSettings.ts
// TTS语音设置 - 音色选择与语速控制

const TTS_SETTINGS_KEY = 'hopkinson_tts_settings';

export interface TTSSettings {
  voiceType: string;
  speedRatio: number;
  volumeRatio: number;
}

export const VOICE_OPTIONS = [
  { id: 'zh_male_jieshuoxiaoming_moon_bigtts', label: '小明（男·解说）', gender: 'male' },
  { id: 'zh_female_meilinvyou_moon_bigtts', label: '美林（女·温柔）', gender: 'female' },
  { id: 'zh_male_wennuanahu_moon_bigtts', label: '温暖（男·磁性）', gender: 'male' },
  { id: 'zh_female_shuangkuaisisi_moon_bigtts', label: '思思（女·活泼）', gender: 'female' },
  { id: 'zh_male_aojiaobazong_moon_bigtts', label: '霸总（男·成熟）', gender: 'male' },
] as const;

export const SPEED_OPTIONS = [
  { value: 0.8, label: '0.8x 慢速' },
  { value: 0.9, label: '0.9x' },
  { value: 1.0, label: '1.0x 正常' },
  { value: 1.1, label: '1.1x' },
  { value: 1.2, label: '1.2x' },
  { value: 1.5, label: '1.5x 快速' },
] as const;

const DEFAULT_SETTINGS: TTSSettings = {
  voiceType: import.meta.env.VITE_VOLCANO_VOICE_TYPE || 'zh_male_jieshuoxiaoming_moon_bigtts',
  speedRatio: 1.0,
  volumeRatio: 1.0,
};

export function loadTTSSettings(): TTSSettings {
  try {
    const saved = localStorage.getItem(TTS_SETTINGS_KEY);
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

export function saveTTSSettings(settings: Partial<TTSSettings>): TTSSettings {
  const current = loadTTSSettings();
  const updated = { ...current, ...settings };
  try {
    localStorage.setItem(TTS_SETTINGS_KEY, JSON.stringify(updated));
  } catch {}
  return updated;
}
