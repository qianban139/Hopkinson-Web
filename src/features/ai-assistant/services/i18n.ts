// src/features/ai-assistant/services/i18n.ts
// AI助手多语言支持（i18n）

export type Locale = 'zh-CN' | 'en-US' | 'ja-JP';

export interface LocaleConfig {
  label: string;
  asrLang: string;        // Web Speech API language code
  ttsLang: string;        // TTS language code
  systemPromptSuffix: string;  // 追加到LLM system prompt
}

const LOCALE_CONFIGS: Record<Locale, LocaleConfig> = {
  'zh-CN': {
    label: '中文',
    asrLang: 'zh-CN',
    ttsLang: 'zh-CN',
    systemPromptSuffix: '请用中文回答。',
  },
  'en-US': {
    label: 'English',
    asrLang: 'en-US',
    ttsLang: 'en-US',
    systemPromptSuffix: 'Please respond in English.',
  },
  'ja-JP': {
    label: '日本語',
    asrLang: 'ja-JP',
    ttsLang: 'ja-JP',
    systemPromptSuffix: '日本語で回答してください。',
  },
};

// ═══ 翻译字典 ═══

type TranslationKey =
  | 'assistant.name'
  | 'assistant.greeting'
  | 'assistant.listening'
  | 'assistant.thinking'
  | 'assistant.executing'
  | 'assistant.speaking'
  | 'assistant.error'
  | 'assistant.interrupt'
  | 'assistant.readyPrompt'
  | 'input.placeholder'
  | 'input.listeningPlaceholder'
  | 'input.imagePlaceholder'
  | 'input.send'
  | 'input.voice'
  | 'input.uploadImage'
  | 'panel.title'
  | 'panel.newChat'
  | 'panel.clearHistory'
  | 'panel.settings'
  | 'panel.operationLog'
  | 'panel.copy'
  | 'panel.collapse'
  | 'panel.expand'
  | 'tts.settings'
  | 'tts.voice'
  | 'tts.speed'
  | 'tts.enabled'
  | 'tts.disabled'
  | 'suggestion.dismiss'
  | 'suggestion.execute'
  | 'voice.releaseSend'
  | 'voice.pressHold'
  | 'experiment.confirmStart'
  | 'experiment.cancel'
  | 'experiment.material'
  | 'experiment.voltage'
  | 'experiment.waveform'
  | 'lang.switch'
  | 'collab.userName'
  | 'collab.shareSession';

type Translations = Record<TranslationKey, string>;

const ZH_CN: Translations = {
  'assistant.name': '小智',
  'assistant.greeting': '你好！我是小智，您的AI实验助手。您可以随时说"小智"唤醒我，我会全程为您操作。\n\n试试说"小智，帮我设置电压3000V"',
  'assistant.listening': '聆听中...',
  'assistant.thinking': '思考中...',
  'assistant.executing': '执行中...',
  'assistant.speaking': '播报中...',
  'assistant.error': '出错了',
  'assistant.interrupt': '打断',
  'assistant.readyPrompt': '我在，请说您的指令',
  'input.placeholder': '输入指令或问题...',
  'input.listeningPlaceholder': '正在聆听，直接说话...',
  'input.imagePlaceholder': '添加说明或直接发送...',
  'input.send': '发送',
  'input.voice': '语音输入',
  'input.uploadImage': '上传图片',
  'panel.title': 'AI助手 · 小智',
  'panel.newChat': '新会话',
  'panel.clearHistory': '清空历史',
  'panel.settings': '设置',
  'panel.operationLog': '操作日志',
  'panel.copy': '复制',
  'panel.collapse': '收起',
  'panel.expand': '展开',
  'tts.settings': 'TTS设置',
  'tts.voice': '音色',
  'tts.speed': '语速',
  'tts.enabled': '语音播报已开启',
  'tts.disabled': '语音播报已关闭',
  'suggestion.dismiss': '忽略',
  'suggestion.execute': '执行',
  'voice.releaseSend': '松开发送',
  'voice.pressHold': '长按说话',
  'experiment.confirmStart': '确认开始实验？',
  'experiment.cancel': '取消',
  'experiment.material': '材料',
  'experiment.voltage': '电压',
  'experiment.waveform': '波形',
  'lang.switch': '切换语言',
  'collab.userName': '用户名',
  'collab.shareSession': '共享会话',
};

const EN_US: Translations = {
  'assistant.name': 'Zhi',
  'assistant.greeting': 'Hello! I\'m Zhi, your AI lab assistant. Say "Zhi" anytime to wake me up.\n\nTry: "Zhi, set voltage to 3000V"',
  'assistant.listening': 'Listening...',
  'assistant.thinking': 'Thinking...',
  'assistant.executing': 'Executing...',
  'assistant.speaking': 'Speaking...',
  'assistant.error': 'Error',
  'assistant.interrupt': 'Interrupt',
  'assistant.readyPrompt': 'I\'m here, go ahead',
  'input.placeholder': 'Type a command or question...',
  'input.listeningPlaceholder': 'Listening, speak now...',
  'input.imagePlaceholder': 'Add a caption or send directly...',
  'input.send': 'Send',
  'input.voice': 'Voice input',
  'input.uploadImage': 'Upload image',
  'panel.title': 'AI Assistant · Zhi',
  'panel.newChat': 'New Chat',
  'panel.clearHistory': 'Clear History',
  'panel.settings': 'Settings',
  'panel.operationLog': 'Operation Log',
  'panel.copy': 'Copy',
  'panel.collapse': 'Collapse',
  'panel.expand': 'Expand',
  'tts.settings': 'TTS Settings',
  'tts.voice': 'Voice',
  'tts.speed': 'Speed',
  'tts.enabled': 'Voice enabled',
  'tts.disabled': 'Voice disabled',
  'suggestion.dismiss': 'Dismiss',
  'suggestion.execute': 'Execute',
  'voice.releaseSend': 'Release to send',
  'voice.pressHold': 'Hold to talk',
  'experiment.confirmStart': 'Confirm to start experiment?',
  'experiment.cancel': 'Cancel',
  'experiment.material': 'Material',
  'experiment.voltage': 'Voltage',
  'experiment.waveform': 'Waveform',
  'lang.switch': 'Switch Language',
  'collab.userName': 'Username',
  'collab.shareSession': 'Share Session',
};

const JA_JP: Translations = {
  'assistant.name': 'チー',
  'assistant.greeting': 'こんにちは！AIアシスタントのチーです。「チー」と呼びかけてください。\n\n例：「チー、電圧を3000Vに設定して」',
  'assistant.listening': '聞いています...',
  'assistant.thinking': '考えています...',
  'assistant.executing': '実行中...',
  'assistant.speaking': '読み上げ中...',
  'assistant.error': 'エラー',
  'assistant.interrupt': '中断',
  'assistant.readyPrompt': 'はい、どうぞ',
  'input.placeholder': 'コマンドまたは質問を入力...',
  'input.listeningPlaceholder': '聞いています、話してください...',
  'input.imagePlaceholder': '説明を追加するか直接送信...',
  'input.send': '送信',
  'input.voice': '音声入力',
  'input.uploadImage': '画像アップロード',
  'panel.title': 'AIアシスタント · チー',
  'panel.newChat': '新しいチャット',
  'panel.clearHistory': '履歴をクリア',
  'panel.settings': '設定',
  'panel.operationLog': '操作ログ',
  'panel.copy': 'コピー',
  'panel.collapse': '折りたたむ',
  'panel.expand': '展開',
  'tts.settings': 'TTS設定',
  'tts.voice': '音声',
  'tts.speed': '速度',
  'tts.enabled': '音声再生オン',
  'tts.disabled': '音声再生オフ',
  'suggestion.dismiss': '無視',
  'suggestion.execute': '実行',
  'voice.releaseSend': '離して送信',
  'voice.pressHold': '長押しで話す',
  'experiment.confirmStart': '実験を開始しますか？',
  'experiment.cancel': 'キャンセル',
  'experiment.material': '材料',
  'experiment.voltage': '電圧',
  'experiment.waveform': '波形',
  'lang.switch': '言語切替',
  'collab.userName': 'ユーザー名',
  'collab.shareSession': 'セッション共有',
};

const TRANSLATIONS: Record<Locale, Translations> = {
  'zh-CN': ZH_CN,
  'en-US': EN_US,
  'ja-JP': JA_JP,
};

// ═══ 状态管理 ═══

const I18N_STORAGE_KEY = 'hopkinson_ai_locale';

let currentLocale: Locale = 'zh-CN';

// 启动时加载已保存的语言
try {
  const saved = localStorage.getItem(I18N_STORAGE_KEY);
  if (saved && saved in TRANSLATIONS) {
    currentLocale = saved as Locale;
  }
} catch {}

/** 获取当前语言 */
export function getLocale(): Locale {
  return currentLocale;
}

/** 设置语言 */
export function setLocale(locale: Locale): void {
  currentLocale = locale;
  try {
    localStorage.setItem(I18N_STORAGE_KEY, locale);
  } catch {}
}

/** 获取翻译 */
export function t(key: TranslationKey): string {
  return TRANSLATIONS[currentLocale]?.[key] ?? TRANSLATIONS['zh-CN'][key] ?? key;
}

/** 获取当前语言配置 */
export function getLocaleConfig(): LocaleConfig {
  return LOCALE_CONFIGS[currentLocale];
}

/** 获取所有可用语言列表 */
export function getAvailableLocales(): Array<{ locale: Locale; label: string }> {
  return Object.entries(LOCALE_CONFIGS).map(([locale, config]) => ({
    locale: locale as Locale,
    label: config.label,
  }));
}

/** 根据语言获取ASR语言代码 */
export function getASRLang(): string {
  return LOCALE_CONFIGS[currentLocale].asrLang;
}

/** 获取TTS使用的语言代码 */
export function getTTSLang(): string {
  return LOCALE_CONFIGS[currentLocale].ttsLang;
}

/** 获取追加到System Prompt的语言指示 */
export function getLocalePromptSuffix(): string {
  return LOCALE_CONFIGS[currentLocale].systemPromptSuffix;
}
