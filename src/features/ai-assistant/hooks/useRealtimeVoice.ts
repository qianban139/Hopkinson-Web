// src/features/ai-assistant/hooks/useRealtimeVoice.ts
// 实时语音对话 Hook - 整合 VAD + ASR + 全双工管线
// P3: 4.1 实时语音对话

import { useState, useCallback, useRef, useEffect } from 'react';
import { RealtimeVoicePipeline, type PipelineState } from '../services/realtimeVoicePipeline';
import { getASRLang } from '../services/i18n';

interface UseRealtimeVoiceOptions {
  /** 全双工模式（AI说话时可打断） */
  duplexMode?: boolean;
  /** 当ASR识别到最终文本 */
  onTranscript: (text: string) => void;
  /** 当用户打断AI */
  onInterrupt?: () => void;
  /** 是否启用 */
  enabled?: boolean;
}

interface UseRealtimeVoiceReturn {
  /** 管线当前状态 */
  pipelineState: PipelineState;
  /** 实时中间识别文本 */
  interimText: string;
  /** 实时音频能量 (0-1) */
  energyLevel: number;
  /** 启动实时语音管线 */
  startPipeline: () => Promise<boolean>;
  /** 停止管线 */
  stopPipeline: () => void;
  /** 通知管线AI开始说话 */
  notifyAISpeaking: () => void;
  /** 通知管线AI说完 */
  notifyAIDoneSpeaking: () => void;
  /** 管线是否正在运行 */
  isRunning: boolean;
}

export function useRealtimeVoice({
  duplexMode = true,
  onTranscript,
  onInterrupt,
  enabled = true,
}: UseRealtimeVoiceOptions): UseRealtimeVoiceReturn {
  const [pipelineState, setPipelineState] = useState<PipelineState>('idle');
  const [interimText, setInterimText] = useState('');
  const [energyLevel, setEnergyLevel] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  const pipelineRef = useRef<RealtimeVoicePipeline | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const onInterruptRef = useRef(onInterrupt);

  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => { onInterruptRef.current = onInterrupt; }, [onInterrupt]);

  const startPipeline = useCallback(async () => {
    if (!enabled) return false;
    if (pipelineRef.current) {
      pipelineRef.current.stop();
    }

    const pipeline = new RealtimeVoicePipeline(
      {
        lang: getASRLang(),
        duplexMode,
      },
      {
        onTranscript: (text) => {
          setInterimText('');
          onTranscriptRef.current(text);
        },
        onInterimTranscript: (text) => {
          setInterimText(text);
        },
        onStateChange: (state) => {
          setPipelineState(state);
        },
        onUserSpeechDetected: () => {
          onInterruptRef.current?.();
        },
        onEnergyLevel: (energy) => {
          setEnergyLevel(energy);
        },
      },
    );

    const ok = await pipeline.start();
    if (ok) {
      pipelineRef.current = pipeline;
      setIsRunning(true);
    }
    return ok;
  }, [enabled, duplexMode]);

  const stopPipeline = useCallback(() => {
    pipelineRef.current?.stop();
    pipelineRef.current = null;
    setIsRunning(false);
    setPipelineState('idle');
    setInterimText('');
    setEnergyLevel(0);
  }, []);

  const notifyAISpeaking = useCallback(() => {
    pipelineRef.current?.notifyAISpeaking();
  }, []);

  const notifyAIDoneSpeaking = useCallback(() => {
    pipelineRef.current?.notifyAIDoneSpeaking();
  }, []);

  // 清理
  useEffect(() => {
    return () => {
      pipelineRef.current?.stop();
      pipelineRef.current = null;
    };
  }, []);

  return {
    pipelineState,
    interimText,
    energyLevel,
    startPipeline,
    stopPipeline,
    notifyAISpeaking,
    notifyAIDoneSpeaking,
    isRunning,
  };
}
