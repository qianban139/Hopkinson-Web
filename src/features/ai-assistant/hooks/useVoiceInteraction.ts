// src/features/ai-assistant/hooks/useVoiceInteraction.ts
// 语音交互Hook - 连续监听、唤醒词、高质量TTS队列
// TTS优先级: 火山引擎(豆包音色) > Web Speech API(微软神经语音)
import { useState, useCallback, useRef, useEffect } from 'react';
import { isVolcanoTTSConfigured, synthesizeSpeech, playBase64Audio } from '../services/volcanoTTS';

interface UseVoiceInteractionOptions {
  wakeWord?: string;           // 唤醒词，默认"小智"
  onTranscript: (text: string) => void;
  continuousMode?: boolean;    // 连续监听模式
  lang?: string;
}

interface UseVoiceInteractionReturn {
  isListening: boolean;
  isSpeaking: boolean;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  speak: (text: string) => void;
  cancelSpeech: () => void;
  isSupported: boolean;
  transcript: string;          // 当前识别到的文字
}

// ═══════════════════════════════════════════════════════
// Web Speech API 语音选择器（降级方案）
// ═══════════════════════════════════════════════════════

let cachedVoice: SpeechSynthesisVoice | null = null;
let voiceSearchDone = false;

function getBestChineseVoice(): SpeechSynthesisVoice | null {
  if (voiceSearchDone && cachedVoice) return cachedVoice;

  const voices = window.speechSynthesis?.getVoices() || [];
  if (voices.length === 0) return null;

  const chineseVoices = voices.filter(v =>
    v.lang.startsWith('zh') || v.lang.startsWith('cmn')
  );
  if (chineseVoices.length === 0) return null;

  // Tier 1: Microsoft Online Natural
  const naturalOnline = chineseVoices.find(v =>
    v.name.includes('Online') && v.name.includes('Natural')
  );
  if (naturalOnline) { cachedVoice = naturalOnline; voiceSearchDone = true; return naturalOnline; }

  // Tier 2: Microsoft Online
  const online = chineseVoices.find(v =>
    v.name.includes('Online') && v.name.includes('Microsoft')
  );
  if (online) { cachedVoice = online; voiceSearchDone = true; return online; }

  // Tier 3: Microsoft 本地
  const msLocal = chineseVoices.find(v =>
    v.name.includes('Microsoft') && (
      v.name.includes('Xiaoxiao') || v.name.includes('Yunxi') ||
      v.name.includes('Huihui') || v.name.includes('Yaoyao') ||
      v.name.includes('Kangkang')
    )
  );
  if (msLocal) { cachedVoice = msLocal; voiceSearchDone = true; return msLocal; }

  // Tier 4-6: 其他
  const msAny = chineseVoices.find(v => v.name.includes('Microsoft'));
  if (msAny) { cachedVoice = msAny; voiceSearchDone = true; return msAny; }
  const google = chineseVoices.find(v => v.name.includes('Google'));
  if (google) { cachedVoice = google; voiceSearchDone = true; return google; }
  cachedVoice = chineseVoices[0];
  voiceSearchDone = true;
  return cachedVoice;
}

// ═══════════════════════════════════════════════════════

export function useVoiceInteraction({
  wakeWord = '小智',
  onTranscript,
  continuousMode = false,
  lang = 'zh-CN',
}: UseVoiceInteractionOptions): UseVoiceInteractionReturn {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const isListeningRef = useRef(false); // ref mirror for closures

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthQueueRef = useRef<string[]>([]);
  const isProcessingTTSRef = useRef(false);
  const ttsPauseTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const cancelledRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // 检查是否使用火山引擎TTS
  const useVolcanoRef = useRef(isVolcanoTTSConfigured());

  const SpeechRecognitionAPI = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;

  const isSupported = !!SpeechRecognitionAPI && !!window.speechSynthesis;

  // 监听语音列表加载（Web Speech API降级方案）
  useEffect(() => {
    if (useVolcanoRef.current) {
      console.info('[TTS] 使用火山引擎TTS（豆包音色）');
      return;
    }
    if (!window.speechSynthesis) return;

    const loadVoice = () => {
      const voice = getBestChineseVoice();
      if (voice) {
        selectedVoiceRef.current = voice;
        console.info(`[TTS] 降级使用Web Speech API: ${voice.name} (${voice.lang})`);
      }
    };

    loadVoice();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoice);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoice);
    };
  }, []);

  // 面板语音：累积文本 + 静默超时提交（防止被中途打断）
  const accumulatedTextRef = useRef('');
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const SILENCE_TIMEOUT = 3500; // 3.5秒无新内容才提交

  // 用 ref 持有最新回调，避免闭包陈旧
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  const wakeWordRef = useRef(wakeWord);
  useEffect(() => { wakeWordRef.current = wakeWord; }, [wakeWord]);

  const flushAccumulatedText = useCallback(() => {
    const text = accumulatedTextRef.current.trim();
    accumulatedTextRef.current = '';
    if (text) {
      const wk = wakeWordRef.current;
      const cleaned = wk && text.startsWith(wk)
        ? text.slice(wk.length).trim()
        : text;
      if (cleaned) {
        onTranscriptRef.current(cleaned);
      }
    }
    setTranscript('');
  }, []); // 无依赖 — 通过 ref 读取最新值

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      flushAccumulatedText();
    }, SILENCE_TIMEOUT);
  }, [flushAccumulatedText]);

  // 初始化语音识别
  const createRecognition = useCallback(() => {
    if (!SpeechRecognitionAPI) return null;

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = lang;
    recognition.continuous = continuousMode;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      if (continuousMode) {
        // 面板内语音：累积模式，不立即发送
        if (finalTranscript) {
          accumulatedTextRef.current += finalTranscript;
          setTranscript(accumulatedTextRef.current);
        } else if (interimTranscript) {
          setTranscript(accumulatedTextRef.current + interimTranscript);
        }
        // 每次有识别结果都重置静默计时器
        resetSilenceTimer();
      } else {
        // 非连续模式：保持原行为
        setTranscript(finalTranscript || interimTranscript);
        if (finalTranscript) {
          const text = finalTranscript.trim();
          if (text) {
            const wk = wakeWordRef.current;
            const cleaned = wk && text.startsWith(wk)
              ? text.slice(wk.length).trim()
              : text;
            if (cleaned) onTranscriptRef.current(cleaned);
          }
          setTranscript('');
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        console.warn('语音识别错误:', event.error);
      }
      if (!continuousMode) {
        isListeningRef.current = false;
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      if (continuousMode && isListeningRef.current) {
        // 连续模式断开时：重启识别继续累积（带重试）
        const retryStart = (attempt: number) => {
          try {
            recognition.start();
          } catch {
            if (attempt < 3) {
              setTimeout(() => retryStart(attempt + 1), 200);
            } else {
              // 重试3次仍失败，提交已有文本
              if (accumulatedTextRef.current.trim()) {
                flushAccumulatedText();
              }
              isListeningRef.current = false;
              setIsListening(false);
            }
          }
        };
        retryStart(1);
      } else {
        // 非连续模式结束时提交累积文本
        if (accumulatedTextRef.current.trim()) {
          flushAccumulatedText();
        }
        isListeningRef.current = false;
        setIsListening(false);
      }
    };

    return recognition;
  }, [SpeechRecognitionAPI, lang, continuousMode, resetSilenceTimer, flushAccumulatedText]);

  // 开始监听
  const startListening = useCallback(() => {
    if (!SpeechRecognitionAPI) return;

    // 停止已有的识别实例
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }

    // 完整停止正在播放的语音
    synthQueueRef.current = [];
    cancelledRef.current = true;
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    window.speechSynthesis?.cancel();
    isProcessingTTSRef.current = false;
    setIsSpeaking(false);
    if (ttsPauseTimerRef.current) clearTimeout(ttsPauseTimerRef.current);

    // 清空累积文本
    accumulatedTextRef.current = '';
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    // 延迟启动 — 等其他识别实例释放麦克风
    const tryStart = (attempt: number) => {
      const recognition = createRecognition();
      if (!recognition) return;
      recognitionRef.current = recognition;

      try {
        recognition.start();
        isListeningRef.current = true;
        setIsListening(true);
        setTranscript('');
        console.info('[面板语音] 识别已启动');
      } catch (err) {
        console.warn(`[面板语音] 启动失败(尝试${attempt}):`, err);
        if (attempt < 3) {
          setTimeout(() => tryStart(attempt + 1), 150);
        }
      }
    };

    // 第一次尝试延迟100ms，给唤醒词监听停止的时间
    setTimeout(() => tryStart(1), 100);
  }, [SpeechRecognitionAPI, createRecognition]);

  // 停止监听 — 提交已累积的文本
  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    // 停止时提交累积的文本
    if (accumulatedTextRef.current.trim()) {
      flushAccumulatedText();
    }
    isListeningRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setTranscript('');
  }, [flushAccumulatedText]);

  // 切换监听
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // ═══════════════════════════════════════════════════════
  // TTS队列处理 - 火山引擎优先，Web Speech API降级
  // ═══════════════════════════════════════════════════════

  const processQueueVolcano = useCallback(async () => {
    if (isProcessingTTSRef.current || synthQueueRef.current.length === 0) return;

    isProcessingTTSRef.current = true;
    cancelledRef.current = false;
    setIsSpeaking(true);

    while (synthQueueRef.current.length > 0 && !cancelledRef.current) {
      const text = synthQueueRef.current.shift()!;

      try {
        const audioData = await synthesizeSpeech(text);
        if (cancelledRef.current) break;

        if (audioData) {
          // 火山引擎返回音频，直接播放
          const audio = new Audio(`data:audio/mp3;base64,${audioData}`);
          currentAudioRef.current = audio;

          await new Promise<void>((resolve, reject) => {
            audio.onended = () => resolve();
            audio.onerror = () => reject();
            audio.play().catch(reject);
          });

          currentAudioRef.current = null;

          // 句间短暂停顿
          if (synthQueueRef.current.length > 0 && !cancelledRef.current) {
            await new Promise(r => setTimeout(r, 50));
          }
        } else {
          // 火山引擎失败，此句降级到Web Speech API
          await playWithWebSpeech(text);
        }
      } catch {
        // 播放失败，继续下一句
      }
    }

    isProcessingTTSRef.current = false;
    currentAudioRef.current = null;
    if (!cancelledRef.current) {
      setIsSpeaking(false);
    }
  }, []);

  // Web Speech API播报单句
  const playWithWebSpeech = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) { resolve(); return; }

      const utterance = new SpeechSynthesisUtterance(text);
      const voice = selectedVoiceRef.current || getBestChineseVoice();
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = lang;
      }

      const isNeuralVoice = voice?.name?.includes('Online') || voice?.name?.includes('Natural');
      utterance.rate = isNeuralVoice ? 1.0 : 0.92;
      utterance.pitch = isNeuralVoice ? 1.0 : 1.05;
      utterance.volume = 1.0;

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      window.speechSynthesis.speak(utterance);
    });
  }, [lang]);

  // Web Speech API队列处理（降级方案）
  const processQueueWebSpeech = useCallback(() => {
    if (isProcessingTTSRef.current || synthQueueRef.current.length === 0) return;
    if (!window.speechSynthesis) return;

    isProcessingTTSRef.current = true;
    const text = synthQueueRef.current.shift()!;

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = selectedVoiceRef.current || getBestChineseVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = lang;
    }

    const isNeuralVoice = voice?.name?.includes('Online') || voice?.name?.includes('Natural');
    utterance.rate = isNeuralVoice ? 1.0 : 0.92;
    utterance.pitch = isNeuralVoice ? 1.0 : 1.05;
    utterance.volume = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      isProcessingTTSRef.current = false;
      if (synthQueueRef.current.length > 0) {
        const pause = isNeuralVoice ? 80 : 150;
        ttsPauseTimerRef.current = setTimeout(() => processQueueWebSpeech(), pause);
      } else {
        setIsSpeaking(false);
      }
    };
    utterance.onerror = () => {
      isProcessingTTSRef.current = false;
      if (synthQueueRef.current.length > 0) {
        processQueueWebSpeech();
      } else {
        setIsSpeaking(false);
      }
    };

    window.speechSynthesis.speak(utterance);
  }, [lang]);

  // 统一processQueue入口
  const processQueue = useCallback(() => {
    if (useVolcanoRef.current) {
      processQueueVolcano();
    } else {
      processQueueWebSpeech();
    }
  }, [processQueueVolcano, processQueueWebSpeech]);

  // 语音播报（智能分句后入队）
  const speak = useCallback((text: string) => {
    if (!text.trim()) return;

    // 清理markdown标记和特殊字符
    const cleaned = text
      .replace(/[*#`\[\]()]/g, '')
      .replace(/\n+/g, '。')
      .replace(/\.{3,}/g, '…')
      .replace(/—+/g, '，')
      .replace(/\s{2,}/g, ' ');

    // 按句子边界拆分
    const sentences = cleaned
      .split(/(?<=[。！？；!?;])\s*/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // 对过长的句子二次拆分
    const chunks: string[] = [];
    for (const sentence of (sentences.length > 0 ? sentences : [cleaned])) {
      if (sentence.length > 60) {
        const parts = sentence
          .split(/(?<=[，,、])\s*/)
          .filter(s => s.trim().length > 0);
        let current = '';
        for (const part of parts) {
          if (current.length + part.length < 40) {
            current += part;
          } else {
            if (current) chunks.push(current);
            current = part;
          }
        }
        if (current) chunks.push(current);
      } else {
        chunks.push(sentence);
      }
    }

    for (const chunk of chunks) {
      synthQueueRef.current.push(chunk);
    }

    processQueue();
  }, [processQueue]);

  // 取消播报
  const cancelSpeech = useCallback(() => {
    synthQueueRef.current = [];
    cancelledRef.current = true;
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    window.speechSynthesis?.cancel();
    isProcessingTTSRef.current = false;
    setIsSpeaking(false);
    if (ttsPauseTimerRef.current) clearTimeout(ttsPauseTimerRef.current);
  }, []);

  // 清理
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      cancelledRef.current = true;
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      window.speechSynthesis?.cancel();
      if (ttsPauseTimerRef.current) clearTimeout(ttsPauseTimerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []);

  return {
    isListening,
    isSpeaking,
    startListening,
    stopListening,
    toggleListening,
    speak,
    cancelSpeech,
    isSupported,
    transcript,
  };
}
