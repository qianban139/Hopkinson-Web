// src/features/ai-assistant/AICommandCenter.tsx
// AI中央控制面板 — 语音层与面板UI完全解耦
// 语音交互（唤醒词→命令→TTS回复）不依赖面板打开状态
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Mic, MicOff, X, Minimize2, Maximize2, Trash2,
  ChevronRight, Zap, Brain, Volume2, VolumeX,
  Shield, Beaker, BarChart3, GripVertical, Settings2, ImagePlus,
  Globe, Users, Radio,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { loadTTSSettings, saveTTSSettings, VOICE_OPTIONS, SPEED_OPTIONS, type TTSSettings } from './services/ttsSettings';
import { useAIOrchestrator } from './hooks/useAIOrchestrator';
import { useVoiceInteraction } from './hooks/useVoiceInteraction';
import { useWakeWordListener } from './hooks/useWakeWordListener';
import { useRealtimeVoice } from './hooks/useRealtimeVoice';
import AIOperationLog from './AIOperationLog';
import AIHighlight from './AIHighlight';
import AIFloatingOrb from './AIFloatingOrb';
import { sounds } from './utils/soundEffects';
import { conversationManager } from './services/aiConversationManager';
import MarkdownMessage from './MarkdownMessage';
import AIReasoningChain from './AIReasoningChain';
import { AGENT_REGISTRY } from './agent';
import { getProactiveSuggestions, type ProactiveSuggestion } from './services/proactiveAssistant';
import { t, getLocale, setLocale, getAvailableLocales, type Locale } from './services/i18n';
import { getCurrentUser, getAllUsers, createUser, switchUser, type UserProfile } from './services/collaborationService';
import type { OrbState } from './types';

const CHAT_UI_STORAGE_KEY = 'hopkinson_ai_chat_ui';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  image?: string; // base64 data URL
}

let msgCounter = Date.now();

// 语音反馈Toast消息
interface VoiceToast {
  id: string;
  text: string;
  type: 'listening' | 'processing' | 'result';
  timestamp: number;
}

function getContextualCommands(currentPage: string) {
  const pageCommands: Record<string, { label: string; icon: typeof Zap; command: string }[]> = {
    home: [
      { label: '系统介绍', icon: Brain, command: '给我介绍一下这个系统' },
      { label: '去实验室', icon: ChevronRight, command: '去虚拟实验室' },
      { label: '安全检查', icon: Shield, command: '执行安全检查' },
    ],
    lab: [
      { label: '开始实验', icon: Zap, command: '帮我开始一个实验' },
      { label: '快速实验', icon: Zap, command: '用默认参数开始实验' },
      { label: 'AI三级优化', icon: Brain, command: '启动AI三级优化' },
      { label: '多场耦合', icon: Zap, command: '开启多场耦合' },
    ],
    analysis: [
      { label: 'AI预测', icon: Brain, command: '运行AI预测' },
      { label: '导出报告', icon: BarChart3, command: '导出分析报告' },
    ],
    monitor: [
      { label: '安全检查', icon: Shield, command: '执行安全检查' },
      { label: '查看状态', icon: Brain, command: '当前系统状态如何' },
    ],
  };
  return pageCommands[currentPage] || [
    { label: '开始实验', icon: Zap, command: '帮我开始一个实验' },
    { label: '安全检查', icon: Shield, command: '执行安全检查' },
    { label: '去实验室', icon: ChevronRight, command: '去虚拟实验室' },
  ];
}

export default function AICommandCenter() {
  // ═══ 面板状态（默认关闭） ═══
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [panelOpacity, setPanelOpacity] = useState(1);

  // 拖拽/拉伸状态 — 使用 left/top 绝对定位
  const [panelPos, setPanelPos] = useState(() => {
    try {
      const saved = localStorage.getItem('ai-panel-layout');
      if (saved) {
        const p = JSON.parse(saved);
        // 兼容旧格式(right/bottom offset) → 转换为 left/top
        if (p.left != null && p.top != null) return { left: p.left, top: p.top };
      }
    } catch { /* ignore */ }
    const w = typeof window !== 'undefined' ? window.innerWidth : 1400;
    const h = typeof window !== 'undefined' ? window.innerHeight : 900;
    return { left: w - 444, top: h - 660 };
  });
  const [panelSize, setPanelSize] = useState(() => {
    try {
      const saved = localStorage.getItem('ai-panel-layout');
      if (saved) { const p = JSON.parse(saved); if (p.w && p.h) return { w: p.w, h: p.h }; }
    } catch { /* ignore */ }
    return { w: 420, h: 560 };
  });
  const panelDragRef = useRef({ startX: 0, startY: 0, left: 0, top: 0 });
  const panelResizeRef = useRef({ startX: 0, startY: 0, w: 420, h: 560 });
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // 保存面板位置/大小到localStorage
  useEffect(() => {
    localStorage.setItem('ai-panel-layout', JSON.stringify({ ...panelPos, ...panelSize }));
  }, [panelPos, panelSize]);

  // 面板拖拽 — left/top 直接偏移
  const onPanelDragStart = useCallback((e: React.PointerEvent) => {
    setIsDraggingPanel(true);
    panelDragRef.current = { startX: e.clientX, startY: e.clientY, left: panelPos.left, top: panelPos.top };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [panelPos]);

  const onPanelDragMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingPanel) return;
    const dx = e.clientX - panelDragRef.current.startX;
    const dy = e.clientY - panelDragRef.current.startY;
    const maxLeft = window.innerWidth - 200;
    const maxTop = window.innerHeight - 100;
    setPanelPos({
      left: Math.max(-100, Math.min(maxLeft, panelDragRef.current.left + dx)),
      top: Math.max(0, Math.min(maxTop, panelDragRef.current.top + dy)),
    });
  }, [isDraggingPanel]);

  const onPanelDragEnd = useCallback(() => {
    setIsDraggingPanel(false);
  }, []);

  // 面板拉伸（左上角拖拽 → 改变宽高 + 同步移动位置）
  const onResizeStart = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    panelResizeRef.current = { startX: e.clientX, startY: e.clientY, w: panelSize.w, h: panelSize.h };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [panelSize]);

  const onResizeMove = useCallback((e: React.PointerEvent) => {
    if (!isResizing) return;
    const dw = panelResizeRef.current.startX - e.clientX;
    const dh = panelResizeRef.current.startY - e.clientY;
    const newW = Math.max(320, Math.min(600, panelResizeRef.current.w + dw));
    const newH = Math.max(400, Math.min(800, panelResizeRef.current.h + dh));
    setPanelSize({ w: newW, h: newH });
    // 左上角拉伸时同步移动位置，保持右下角不动
    setPanelPos(prev => ({
      left: prev.left - (newW - panelSize.w),
      top: prev.top - (newH - panelSize.h),
    }));
  }, [isResizing, panelSize]);

  const onResizeEnd = useCallback(() => { setIsResizing(false); }, []);

  // Load initial messages from localStorage
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(CHAT_UI_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.slice(-50);
      }
    } catch {}
    return [{
      id: 'welcome',
      role: 'assistant',
      text: '你好！我是小智，您的AI实验助手。您可以随时说"小智"唤醒我，我会全程为您操作。\n\n试试说"小智，帮我设置电压3000V"',
      timestamp: Date.now(),
    }];
  });
  const [inputText, setInputText] = useState('');
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [showTTSSettings, setShowTTSSettings] = useState(false);
  const [ttsSettings, setTTSSettings] = useState<TTSSettings>(loadTTSSettings);
  const [voiceToasts, setVoiceToasts] = useState<VoiceToast[]>([]);
  const [isTTSCooldown, setIsTTSCooldown] = useState(false);
  const [suggestions, setSuggestions] = useState<ProactiveSuggestion[]>([]);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // P3: 多语言 + 协作 + 实时语音
  const [currentLang, setCurrentLang] = useState<Locale>(getLocale);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getCurrentUser());
  const [realtimeMode, setRealtimeMode] = useState(false);
  const [newUserName, setNewUserName] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ttsEnabledRef = useRef(ttsEnabled);

  // Filler phrases for natural conversation flow during processing
  const fillerPhrases = useRef(['让我想想...', '正在分析...', '思考中...', '处理中...']);
  const [fillerIndex, setFillerIndex] = useState(0);

  const setAssistantStatus = useAppStore((s) => s.setAssistantStatus);
  const currentPage = useAppStore((s) => s.currentPage);

  useEffect(() => { ttsEnabledRef.current = ttsEnabled; }, [ttsEnabled]);

  // Persist messages to localStorage whenever they change (strip images to avoid quota issues)
  useEffect(() => {
    try {
      const toSave = messages.slice(-50).map(m => m.image ? { ...m, image: undefined } : m);
      localStorage.setItem(CHAT_UI_STORAGE_KEY, JSON.stringify(toSave));
    } catch {}
  }, [messages]);

  // ═══ AI编排引擎 ═══
  const {
    orbState,
    operations,
    currentHighlight,
    isProcessing,
    lastThoughts,
    lastAgentRole,
    ragEnabled,
    setRagEnabled,
    lastCitations,
    processUserInput,
    clearOperations,
  } = useAIOrchestrator();

  // Phase 2: 深度模式（Agent 多步推理） - 按消息附带推理链
  const [agentMode, setAgentMode] = useState(false);
  const agentModeRef = useRef(agentMode);
  useEffect(() => { agentModeRef.current = agentMode; }, [agentMode]);

  // Rotate filler phrases during processing
  useEffect(() => {
    if (!isProcessing) return;
    const timer = setInterval(() => {
      setFillerIndex(i => (i + 1) % fillerPhrases.current.length);
    }, 2000);
    return () => clearInterval(timer);
  }, [isProcessing]);

  // ═══ TTS — 独立于面板使用 ═══
  const {
    isSpeaking,
    speak,
    cancelSpeech,
    isSupported: _voiceSupported,
  } = useVoiceInteraction({
    onTranscript: () => {}, // 面板内语音单独处理
    continuousMode: false,
    lang: 'zh-CN',
  });

  // TTS结束后冷却期 — 防止AI回答的声音被麦克风再次识别
  const prevSpeakingRef = useRef(false);
  useEffect(() => {
    if (prevSpeakingRef.current && !isSpeaking) {
      // TTS刚结束，启动冷却
      setIsTTSCooldown(true);
      const timer = setTimeout(() => setIsTTSCooldown(false), 800);
      return () => clearTimeout(timer);
    }
    prevSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  // ═══ 面板内语音识别（无唤醒词） ═══
  const {
    isListening: panelListening,
    toggleListening: panelToggleListening,
    stopListening: panelStopListening,
    transcript: panelTranscript,
    isSupported: panelVoiceSupported,
  } = useVoiceInteraction({
    onTranscript: (text) => {
      // 面板内语音直接发送，不需要唤醒词
      handleCommand(text);
    },
    continuousMode: true,
    lang: 'zh-CN',
  });

  // ═══ P3: 实时语音管线（全双工） ═══
  const {
    pipelineState,
    interimText: realtimeInterimText,
    energyLevel,
    startPipeline,
    stopPipeline,
    notifyAISpeaking,
    notifyAIDoneSpeaking,
    isRunning: isRealtimeRunning,
  } = useRealtimeVoice({
    duplexMode: true,
    onTranscript: (text) => {
      handleCommand(text);
    },
    onInterrupt: () => {
      cancelSpeech();
    },
    enabled: realtimeMode,
  });

  // Sync TTS state with realtime pipeline
  useEffect(() => {
    if (!realtimeMode || !isRealtimeRunning) return;
    if (isSpeaking) {
      notifyAISpeaking();
    } else {
      notifyAIDoneSpeaking();
    }
  }, [isSpeaking, realtimeMode, isRealtimeRunning, notifyAISpeaking, notifyAIDoneSpeaking]);

  // ═══ 语音反馈Toast ═══
  const showVoiceToast = useCallback((text: string, type: VoiceToast['type'] = 'result') => {
    const toast: VoiceToast = {
      id: `toast_${Date.now()}`,
      text,
      type,
      timestamp: Date.now(),
    };
    setVoiceToasts(prev => [...prev.slice(-2), toast]);
    // 自动消失
    setTimeout(() => {
      setVoiceToasts(prev => prev.filter(t => t.id !== toast.id));
    }, type === 'listening' ? 5000 : 3000);
  }, []);

  // ═══ 图片处理 ═══
  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) {
      showVoiceToast('图片大小不能超过5MB', 'result');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPendingImage(reader.result as string);
    reader.readAsDataURL(file);
    if (imageInputRef.current) imageInputRef.current.value = '';
  }, [showVoiceToast]);

  // ═══ 核心命令处理（面板无关） ═══
  const handleCommand = useCallback(async (text: string) => {
    if ((!text.trim() && !pendingImage) || isProcessing) return;

    cancelSpeech();
    sounds.messageSent();

    // 添加到聊天记录（无论面板是否打开）
    const currentImage = pendingImage;
    const userMsg: ChatMessage = {
      id: `msg_${++msgCounter}`,
      role: 'user',
      text: text.trim() || (currentImage ? '[图片]' : ''),
      timestamp: Date.now(),
      image: currentImage || undefined,
    };
    setMessages(prev => [...prev, userMsg]);
    setPendingImage(null);

    // 显示处理中Toast
    const displayText = text.trim() || '图片分析';
    showVoiceToast(`处理: "${displayText.slice(0, 20)}..."`, 'processing');

    // Create a placeholder AI message ID for streaming
    const aiMsgId = `msg_${++msgCounter}`;
    let isStreaming = false;

    const response = await processUserInput(text.trim() || '请分析这张图片', (chunk, accumulated) => {
      // First chunk: add the AI message bubble
      if (!isStreaming) {
        isStreaming = true;
        setStreamingMsgId(aiMsgId);
        setMessages(prev => [...prev, {
          id: aiMsgId,
          role: 'assistant' as const,
          text: accumulated,
          timestamp: Date.now(),
        }]);
      } else {
        // Update the existing AI message with accumulated text
        setMessages(prev => prev.map(m =>
          m.id === aiMsgId ? { ...m, text: accumulated } : m
        ));
      }
    }, currentImage || undefined, agentModeRef.current ? { useAgentMode: true } : undefined);

    setStreamingMsgId(null);

    if (response) {
      sounds.responseReceived();

      if (isStreaming) {
        // Finalize the streaming message with the complete response
        setMessages(prev => prev.map(m =>
          m.id === aiMsgId ? { ...m, text: response } : m
        ));
      } else {
        // Non-streaming response (quick match, experiment flow, etc.)
        const aiMsg: ChatMessage = {
          id: aiMsgId,
          role: 'assistant',
          text: response,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, aiMsg]);
      }

      // 语音反馈Toast（面板关闭时显示）
      if (!isPanelOpen) {
        showVoiceToast(response.slice(0, 50) + (response.length > 50 ? '...' : ''), 'result');
      }

      // TTS播报（始终播报，不依赖面板）
      if (ttsEnabledRef.current) {
        speak(response);
      }
    }
  }, [isProcessing, processUserInput, speak, cancelSpeech, showVoiceToast, isPanelOpen, pendingImage]);

  // 监听跨页面 AI 建议条触发的命令
  useEffect(() => {
    const onSuggestion = (e: Event) => {
      const ce = e as CustomEvent<{ command: string }>;
      if (ce.detail?.command) {
        // 自动展开面板，让用户看到执行过程
        setIsPanelOpen(true);
        handleCommand(ce.detail.command);
      }
    };
    window.addEventListener('ai-suggestion-trigger', onSuggestion);
    return () => window.removeEventListener('ai-suggestion-trigger', onSuggestion);
  }, [handleCommand]);

  // ═══ 后台唤醒词监听（"小爱同学"模式） ═══
  const { flowState, interimText: wakeInterimText } = useWakeWordListener({
    wakeWord: '小智',
    enabled: !panelListening && !isProcessing && !isTTSCooldown, // 允许TTS播放时唤醒打断
    onCommand: (command: string) => {
      // 检测到唤醒词+命令 → 打断TTS并直接执行（不打开面板）
      if (isSpeaking) cancelSpeech();
      sounds.wakeWordDetected();
      handleCommand(command);
    },
    onWakeOnly: () => {
      // 只说了"小智" → 打断TTS，语音回复+Toast提示
      if (isSpeaking) cancelSpeech();
      sounds.wakeWordDetected();
      const greeting = '我在，请说您的指令';
      showVoiceToast(greeting, 'listening');
      if (ttsEnabledRef.current) {
        speak(greeting);
      }
    },
    onStateChange: (state) => {
      if (state === 'capturing') {
        showVoiceToast('正在聆听...', 'listening');
      }
    },
  });

  // ═══ Orb状态计算 ═══
  const displayOrbState: OrbState =
    panelListening ? 'listening' :
    flowState === 'capturing' ? 'listening' :
    isSpeaking ? 'speaking' :
    orbState;

  useEffect(() => {
    setAssistantStatus(displayOrbState === 'idle' ? 'idle' : 'thinking');
  }, [displayOrbState, setAssistantStatus]);

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 键盘提交
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputText.trim()) {
        handleCommand(inputText);
        setInputText('');
      }
    }
  };

  // 清空对话
  const handleClear = () => {
    cancelSpeech();
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      text: '对话已清空。随时说"小智"唤醒我。',
      timestamp: Date.now(),
    }]);
    conversationManager.clear();
    clearOperations();
  };

  // 面板关闭时停止面板内语音
  useEffect(() => {
    if (!isPanelOpen && panelListening) {
      panelStopListening();
    }
  }, [isPanelOpen, panelListening, panelStopListening]);

  // 主动建议 — 面板打开或页面切换时更新
  useEffect(() => {
    if (isPanelOpen) {
      const newSuggestions = getProactiveSuggestions()
        .filter(s => !dismissedSuggestions.has(s.id));
      setSuggestions(newSuggestions);
    }
  }, [isPanelOpen, currentPage, dismissedSuggestions]);

  const quickCommands = getContextualCommands(currentPage);

  // ═══ Push-to-Talk（长按悬浮球录音） ═══
  const [isPushToTalk, setIsPushToTalk] = useState(false);
  const pushToTalkRecognitionRef = useRef<SpeechRecognition | null>(null);

  const handlePushToTalkStart = useCallback(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    cancelSpeech();
    setIsPushToTalk(true);
    sounds.wakeWordDetected();

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const text = event.results[0]?.[0]?.transcript?.trim();
      if (text) {
        handleCommand(text);
      }
    };
    recognition.onerror = () => { setIsPushToTalk(false); };
    recognition.onend = () => { setIsPushToTalk(false); pushToTalkRecognitionRef.current = null; };

    pushToTalkRecognitionRef.current = recognition;
    try { recognition.start(); } catch { setIsPushToTalk(false); }
  }, [cancelSpeech, handleCommand]);

  const handlePushToTalkEnd = useCallback(() => {
    if (pushToTalkRecognitionRef.current) {
      try { pushToTalkRecognitionRef.current.stop(); } catch { /* ignore */ }
    }
  }, []);

  return (
    <>
      {/* 高亮覆盖层 */}
      <AIHighlight target={currentHighlight} />

      {/* 悬浮球 */}
      <AIFloatingOrb
        orbState={isPushToTalk ? 'listening' : displayOrbState}
        onTogglePanel={() => setIsPanelOpen(v => !v)}
        isPanelOpen={isPanelOpen}
        onPushToTalkStart={handlePushToTalkStart}
        onPushToTalkEnd={handlePushToTalkEnd}
        isPushToTalk={isPushToTalk}
      />

      {/* ═══ 语音反馈Toast（悬浮球附近，面板无关） ═══ */}
      <AnimatePresence>
        {!isPanelOpen && voiceToasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            className="fixed right-6 bottom-24 z-[9988] max-w-[300px]"
          >
            <div
              className={`px-4 py-2.5 rounded-xl text-sm backdrop-blur-md border ${
                toast.type === 'listening'
                  ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]/30 text-[#8B5CF6]'
                  : toast.type === 'processing'
                    ? 'bg-[#F59E0B]/20 border-[#F59E0B]/30 text-[#F59E0B]'
                    : 'bg-[#00F5FF]/20 border-[#00F5FF]/30 text-[#00F5FF]'
              }`}
            >
              <div className="flex items-center gap-2">
                {toast.type === 'listening' && (
                  <div className="w-2 h-2 rounded-full bg-[#8B5CF6] animate-pulse" />
                )}
                {toast.type === 'processing' && (
                  <div className="w-2 h-2 rounded-full bg-[#F59E0B] animate-spin" />
                )}
                <span className="leading-relaxed">{toast.text}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* ═══ 唤醒词捕获状态指示（悬浮球上方） ═══ */}
      <AnimatePresence>
        {flowState === 'capturing' && wakeInterimText && !isPanelOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed right-6 bottom-24 z-[9987] max-w-[280px]"
          >
            <div className="px-3 py-2 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/25 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-pulse" />
                <span className="text-xs text-[#8B5CF6]/90 truncate">{wakeInterimText}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ 最小化药丸 ═══ */}
      <AnimatePresence>
        {isPanelOpen && isMinimized && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => setIsMinimized(false)}
            className="fixed z-[9989] cursor-pointer"
            style={{ left: panelPos.left, top: panelPos.top }}
          >
            <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-[#051020]/95 border border-[#00F5FF]/20 backdrop-blur-md hover:border-[#00F5FF]/40 transition-colors">
              <div className="w-2 h-2 rounded-full bg-[#00F5FF] animate-pulse" />
              <span className="text-xs text-white/70 max-w-[120px] truncate">
                {messages[messages.length - 1]?.text.slice(0, 20) || '小智'}
              </span>
              <Maximize2 className="w-3 h-3 text-white/40" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ 聊天面板（可拖拽/可拉伸） ═══ */}
      <AnimatePresence>
        {isPanelOpen && !isMinimized && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: panelOpacity, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed z-[9989] flex flex-col rounded-2xl overflow-hidden"
            style={{
              left: panelPos.left,
              top: panelPos.top,
              width: panelSize.w,
              height: panelSize.h,
              background: 'linear-gradient(135deg, rgba(5,16,32,0.97), rgba(10,37,64,0.97))',
              border: '1px solid rgba(0,245,255,0.2)',
              boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 40px rgba(0,245,255,0.08)',
              backdropFilter: 'blur(20px)',
            }}
          >
            {/* 拉伸把手（左上角） */}
            <div
              className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-10"
              onPointerDown={onResizeStart}
              onPointerMove={onResizeMove}
              onPointerUp={onResizeEnd}
            />

            {/* 头部（拖拽把手） */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b border-[#00F5FF]/10 bg-[#00F5FF]/5 cursor-move select-none"
              onPointerDown={onPanelDragStart}
              onPointerMove={onPanelDragMove}
              onPointerUp={onPanelDragEnd}
            >
              <div className="flex items-center gap-2" onPointerDown={e => e.stopPropagation()}>
                <GripVertical className="w-3 h-3 text-white/20" />
                <div className={`w-2.5 h-2.5 rounded-full ${
                  flowState === 'monitoring' ? 'bg-[#10B981] animate-pulse' :
                  flowState === 'capturing' ? 'bg-[#8B5CF6] animate-pulse' :
                  'bg-[#00F5FF] animate-pulse'
                }`} />
                <span className="text-sm font-semibold text-white">小智 · AI控制中心</span>
                <span className="text-[10px] text-white/30">
                  {flowState === 'monitoring' ? '待命中' :
                   flowState === 'capturing' ? '聆听中...' :
                   flowState === 'processing' ? '处理中' : ''}
                </span>
              </div>
              <div className="flex items-center gap-1" onPointerDown={e => e.stopPropagation()}>
                {/* 透明度控制 */}
                <input
                  type="range"
                  min="0.4"
                  max="1"
                  step="0.1"
                  value={panelOpacity}
                  onChange={(e) => setPanelOpacity(Number(e.target.value))}
                  className="w-12 h-1 accent-[#00F5FF] opacity-50 hover:opacity-100 transition-opacity"
                  title="面板透明度"
                />
                <button
                  onClick={() => { setTtsEnabled(v => !v); if (isSpeaking) cancelSpeech(); }}
                  className={`p-1.5 rounded-lg transition-colors ${ttsEnabled ? 'text-[#00F5FF]/70 hover:text-[#00F5FF]' : 'text-white/30 hover:text-white/50'}`}
                  title={ttsEnabled ? '关闭语音播报' : '开启语音播报'}
                >
                  {ttsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>
                {/* P3: 实时语音切换 */}
                <button
                  onClick={async () => {
                    if (realtimeMode) {
                      stopPipeline();
                      setRealtimeMode(false);
                    } else {
                      setRealtimeMode(true);
                      await startPipeline();
                    }
                  }}
                  className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                    realtimeMode ? 'bg-green-500/20 text-green-400' : 'text-white/40 hover:text-white/60 hover:bg-white/5'
                  }`}
                  title={realtimeMode ? '关闭实时语音（全双工）' : '开启实时语音（全双工）'}
                >
                  <Radio className="w-3.5 h-3.5" />
                </button>
                {/* P3: 用户切换 */}
                <button
                  onClick={() => { setShowUserPanel(v => !v); setShowLangPicker(false); }}
                  className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                    showUserPanel ? 'bg-[#8B5CF6]/20 text-[#8B5CF6]' : 'text-white/40 hover:text-white/60 hover:bg-white/5'
                  }`}
                  title={currentUser ? currentUser.name : t('collab.userName')}
                >
                  <Users className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleClear}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
                  title="清空对话"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsMinimized(true)}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
                  title="最小化"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsPanelOpen(false)}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
                  title="关闭"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* AI操作日志 */}
            {operations.length > 0 && (
              <div className="px-3 pt-2">
                <AIOperationLog operations={operations} onClear={clearOperations} />
              </div>
            )}


            {/* P3: 用户/协作面板 */}
            {showUserPanel && (
              <div className="px-3 py-2.5 border-b border-[#8B5CF6]/10 bg-[#0A2540]/50 space-y-2">
                <div className="text-xs text-white/50 font-medium">用户切换</div>
                {/* 已有用户列表 */}
                <div className="flex flex-wrap gap-1.5">
                  {getAllUsers().map(user => (
                    <button
                      key={user.id}
                      onClick={() => {
                        switchUser(user.id);
                        setCurrentUser(getCurrentUser());
                        setShowUserPanel(false);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs transition-colors flex items-center gap-1 ${
                        currentUser?.id === user.id
                          ? 'bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/30'
                          : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <span>{user.avatar || '👤'}</span>
                      <span>{user.name}</span>
                      <span className="text-[9px] text-white/30">
                        {user.role === 'student' ? '学生' : user.role === 'researcher' ? '科研' : user.role === 'admin' ? '管理' : '操作员'}
                      </span>
                    </button>
                  ))}
                </div>
                {/* 创建新用户 */}
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="新用户名..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#8B5CF6]/40"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newUserName.trim()) {
                        createUser(newUserName.trim());
                        setCurrentUser(getCurrentUser());
                        setNewUserName('');
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (newUserName.trim()) {
                        createUser(newUserName.trim());
                        setCurrentUser(getCurrentUser());
                        setNewUserName('');
                      }
                    }}
                    disabled={!newUserName.trim()}
                    className="px-2 py-1 rounded-lg text-xs bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/30 disabled:opacity-30 hover:bg-[#8B5CF6]/30 transition-colors"
                  >
                    创建
                  </button>
                </div>
              </div>
            )}

            {/* P3: 实时语音状态条 */}
            {realtimeMode && isRealtimeRunning && (
              <div className="px-3 py-1.5 border-b border-green-500/10 bg-green-500/5 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] text-green-400/70">
                  全双工实时语音{pipelineState === 'listening' ? ' · 聆听中' : pipelineState === 'speaking' ? ' · AI播报中（可随时打断）' : ''}
                </span>
                {realtimeInterimText && (
                  <span className="text-[10px] text-white/40 truncate flex-1">{realtimeInterimText}</span>
                )}
                {/* 能量条 */}
                <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-400/60 rounded-full transition-all duration-75"
                    style={{ width: `${energyLevel * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* 消息区域 */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group`}
                >
                  <div
                    className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed relative ${
                      msg.role === 'user'
                        ? 'bg-[#00F5FF]/15 text-white/90 rounded-br-md'
                        : 'bg-white/5 text-white/80 rounded-bl-md border border-white/5'
                    }`}
                  >
                    <div>
                      {msg.role === 'assistant' ? (
                        <>
                          <MarkdownMessage content={msg.text} />
                          {streamingMsgId === msg.id && (
                            <span className="inline-block w-1.5 h-4 bg-[#00F5FF] ml-0.5 animate-pulse align-text-bottom" />
                          )}
                        </>
                      ) : (
                        <>
                          {msg.image && (
                            <img src={msg.image} alt="用户上传" className="max-w-full max-h-40 rounded-lg mb-1.5" />
                          )}
                          <div className="whitespace-pre-wrap">{msg.text}</div>
                        </>
                      )}
                    </div>
                    <div className="text-[10px] text-white/20 mt-1 text-right">
                      {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {/* Action buttons - show on hover for AI messages */}
                    {msg.role === 'assistant' && (
                      <div className="absolute -bottom-5 left-0 hidden group-hover:flex items-center gap-1">
                        <button
                          onClick={() => navigator.clipboard.writeText(msg.text)}
                          className="text-[10px] text-white/30 hover:text-white/60 px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 transition-colors"
                        >
                          复制
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Phase 5: RAG 引用列表 */}
              {lastCitations.length > 0 && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && (
                <div className="mx-1 p-3 rounded-xl bg-[#10B981]/5 border border-[#10B981]/15">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-xs">📚</span>
                    <span className="text-[11px] font-medium text-[#10B981]/90">参考文献 ({lastCitations.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {lastCitations.map((c) => (
                      <div key={c.literatureId} className="text-[11px] text-white/60 leading-snug">
                        <span className="text-[#10B981]/80 font-medium">[{c.index}]</span>{' '}
                        <span className="text-white/70">{c.shortLabel}</span>{' '}
                        <span className="text-white/40">— {c.fullTitle}</span>
                        {c.doi && (
                          <span className="text-[#10B981]/50 ml-1 text-[10px]">DOI: {c.doi}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Phase 2: Agent 推理链可视化 */}
              {lastThoughts.length > 0 && lastAgentRole && (
                <AIReasoningChain
                  thoughts={lastThoughts}
                  defaultExpanded={isProcessing}
                  accentColor={AGENT_REGISTRY[lastAgentRole].color}
                />
              )}

              {isProcessing && !streamingMsgId && (
                <div className="flex justify-start">
                  <div className="bg-white/5 rounded-2xl rounded-bl-md px-4 py-3 border border-white/5">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#00F5FF] animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-[#00F5FF] animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-[#00F5FF] animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs text-[#00F5FF]/60">
                        {agentMode ? '🤖 Agent 推理中...' : (orbState === 'executing' ? '执行操作中...' : fillerPhrases.current[fillerIndex])}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* 主动建议 */}
            {suggestions.length > 0 && (
              <div className="px-4 pb-2 space-y-1.5">
                {suggestions.slice(0, 2).map(suggestion => (
                  <div
                    key={suggestion.id}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs border transition-colors ${
                      suggestion.priority === 'high'
                        ? 'bg-[#F59E0B]/10 border-[#F59E0B]/20 text-[#F59E0B]/90'
                        : 'bg-[#00F5FF]/5 border-[#00F5FF]/15 text-white/70'
                    }`}
                  >
                    <span className="flex-1 mr-2">{suggestion.text}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {suggestion.action && (
                        <button
                          onClick={() => {
                            handleCommand(suggestion.action!);
                            setDismissedSuggestions(prev => new Set(prev).add(suggestion.id));
                          }}
                          className="px-2 py-0.5 rounded-full bg-[#00F5FF]/15 text-[#00F5FF] hover:bg-[#00F5FF]/25 transition-colors text-[10px]"
                        >
                          执行
                        </button>
                      )}
                      {suggestion.dismissable && (
                        <button
                          onClick={() => setDismissedSuggestions(prev => new Set(prev).add(suggestion.id))}
                          className="px-1.5 py-0.5 text-white/30 hover:text-white/60 transition-colors"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 快捷指令 */}
            {messages.length <= 2 && (
              <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                {quickCommands.map((cmd) => (
                  <button
                    key={cmd.label}
                    onClick={() => handleCommand(cmd.command)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#00F5FF]/5 border border-[#00F5FF]/20 text-xs text-[#00F5FF]/80 hover:bg-[#00F5FF]/15 transition-colors"
                  >
                    <cmd.icon className="w-3 h-3" />
                    {cmd.label}
                  </button>
                ))}
              </div>
            )}

            {/* 面板内语音实时转写 */}
            {panelListening && panelTranscript && (
              <div className="px-4 py-1.5 bg-[#8B5CF6]/10 border-t border-[#8B5CF6]/20">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#8B5CF6] animate-pulse" />
                  <span className="text-xs text-[#8B5CF6]/80 truncate">{panelTranscript}</span>
                </div>
              </div>
            )}

            {/* AI播报中提示 — 可打断 */}
            {isSpeaking && (
              <div className="px-4 py-2 bg-[#00F5FF]/5 border-t border-[#00F5FF]/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {[0, 1, 2, 3, 4].map(i => (
                        <div
                          key={i}
                          className="w-0.5 bg-[#00F5FF] rounded-full animate-pulse"
                          style={{
                            height: `${8 + Math.sin(i * 1.2) * 6}px`,
                            animationDelay: `${i * 100}ms`,
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-[#00F5FF]/60">AI正在播报</span>
                  </div>
                  <button
                    onClick={() => { cancelSpeech(); }}
                    className="flex items-center gap-1 text-xs text-white/40 hover:text-[#00F5FF] transition-colors px-2.5 py-1 rounded-lg bg-white/5 hover:bg-[#00F5FF]/10 border border-white/10 hover:border-[#00F5FF]/20"
                  >
                    <X className="w-3 h-3" />
                    打断
                  </button>
                </div>
              </div>
            )}

            {/* 输入区域 */}
            <div className="px-3 py-3 border-t border-[#00F5FF]/10 bg-[#051020]/50">
              {/* 图片预览 */}
              {pendingImage && (
                <div className="mb-2 relative inline-block">
                  <img src={pendingImage} alt="待发送" className="max-h-24 rounded-lg border border-[#00F5FF]/30" />
                  <button
                    onClick={() => setPendingImage(null)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500/80 text-white flex items-center justify-center text-xs hover:bg-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                {/* 面板内语音按钮（不需要唤醒词） */}
                <button
                  onClick={panelToggleListening}
                  disabled={!panelVoiceSupported}
                  className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    panelListening
                      ? 'bg-[#8B5CF6] text-white shadow-[0_0_12px_rgba(139,92,246,0.5)]'
                      : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 disabled:opacity-30'
                  }`}
                  title={!panelVoiceSupported ? '浏览器不支持语音' : panelListening ? '停止录音' : '语音输入（直接说话，无需唤醒词）'}
                >
                  {panelListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                {/* 图片上传按钮 */}
                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isProcessing}
                  className="flex-shrink-0 w-9 h-9 rounded-full bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 flex items-center justify-center transition-all disabled:opacity-30"
                  title="上传图片"
                >
                  <ImagePlus className="w-4 h-4" />
                </button>

                {/* Phase 2: 深度模式（Agent 多步推理）切换 */}
                <button
                  onClick={() => setAgentMode((v) => !v)}
                  disabled={isProcessing}
                  className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-30 ${
                    agentMode
                      ? 'bg-gradient-to-br from-[#A78BFA] to-[#00F5FF] text-white shadow-[0_0_12px_rgba(167,139,250,0.5)]'
                      : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70'
                  }`}
                  title={agentMode ? '深度模式（Agent 多步推理） · 点击关闭' : '开启深度模式 · 多 Agent 协作推理'}
                >
                  <Brain className="w-4 h-4" />
                </button>

                {/* Phase 5: RAG 文献检索模式切换 */}
                <button
                  onClick={() => setRagEnabled((v) => !v)}
                  disabled={isProcessing}
                  className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-30 text-xs font-bold ${
                    ragEnabled
                      ? 'bg-gradient-to-br from-[#10B981] to-[#059669] text-white shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                      : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70'
                  }`}
                  title={ragEnabled ? '文献检索增强已开启 · 回答将引用专业文献' : '开启 RAG 模式 · 使 AI 引用文献回答'}
                >
                  📚
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                />

                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={panelListening ? '正在聆听，直接说话...' : pendingImage ? '添加说明或直接发送...' : '输入指令或问题...'}
                  disabled={isProcessing || panelListening}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#00F5FF]/40 disabled:opacity-50 transition-colors"
                />

                <button
                  onClick={() => { handleCommand(inputText); setInputText(''); }}
                  disabled={(!inputText.trim() && !pendingImage) || isProcessing}
                  className="flex-shrink-0 w-9 h-9 rounded-full bg-[#00F5FF] text-[#0A2540] flex items-center justify-center disabled:opacity-30 hover:bg-[#00F5FF]/90 transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
