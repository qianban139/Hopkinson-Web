// src/features/ai-assistant/AICommandCenter.tsx
// AI中央控制面板 — 语音层与面板UI完全解耦
// 语音交互（唤醒词→命令→TTS回复）不依赖面板打开状态
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Mic, MicOff, X, Trash2,
  ChevronRight, Zap, Brain, Volume2, VolumeX,
  Shield, Beaker, BarChart3, GripVertical, Settings2, ImagePlus,
  Globe, Users, Radio, BookOpen,
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
import LiteraturePanel from './LiteraturePanel';
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
  const isDraggingPanelRef = useRef(false);
  const isResizingRef = useRef(false);
  const panelElRef = useRef<HTMLDivElement>(null);

  // 保存面板位置/大小到localStorage
  useEffect(() => {
    localStorage.setItem('ai-panel-layout', JSON.stringify({ ...panelPos, ...panelSize }));
  }, [panelPos, panelSize]);

  // 面板拖拽 — 拖动中直接操作 DOM，松手同步 state
  const onPanelDragStart = useCallback((e: React.PointerEvent) => {
    isDraggingPanelRef.current = true;
    panelDragRef.current = { startX: e.clientX, startY: e.clientY, left: panelPos.left, top: panelPos.top };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [panelPos]);

  const onPanelDragMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingPanelRef.current) return;
    const dx = e.clientX - panelDragRef.current.startX;
    const dy = e.clientY - panelDragRef.current.startY;
    const maxLeft = window.innerWidth - 200;
    const maxTop = window.innerHeight - 100;
    const newLeft = Math.max(-100, Math.min(maxLeft, panelDragRef.current.left + dx));
    const newTop = Math.max(0, Math.min(maxTop, panelDragRef.current.top + dy));
    if (panelElRef.current) {
      panelElRef.current.style.left = `${newLeft}px`;
      panelElRef.current.style.top = `${newTop}px`;
    }
  }, []);

  const onPanelDragEnd = useCallback((e: React.PointerEvent) => {
    if (!isDraggingPanelRef.current) return;
    isDraggingPanelRef.current = false;
    const dx = e.clientX - panelDragRef.current.startX;
    const dy = e.clientY - panelDragRef.current.startY;
    const maxLeft = window.innerWidth - 200;
    const maxTop = window.innerHeight - 100;
    setPanelPos({
      left: Math.max(-100, Math.min(maxLeft, panelDragRef.current.left + dx)),
      top: Math.max(0, Math.min(maxTop, panelDragRef.current.top + dy)),
    });
  }, []);

  // 面板拉伸（左上角拖拽 → 直接操作 DOM，松手同步 state）
  const resizePosRef = useRef({ left: 0, top: 0 });
  const onResizeStart = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    isResizingRef.current = true;
    panelResizeRef.current = { startX: e.clientX, startY: e.clientY, w: panelSize.w, h: panelSize.h };
    resizePosRef.current = { left: panelPos.left, top: panelPos.top };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [panelSize, panelPos]);

  const onResizeMove = useCallback((e: React.PointerEvent) => {
    if (!isResizingRef.current || !panelElRef.current) return;
    const dw = panelResizeRef.current.startX - e.clientX;
    const dh = panelResizeRef.current.startY - e.clientY;
    const newW = Math.max(320, Math.min(600, panelResizeRef.current.w + dw));
    const newH = Math.max(400, Math.min(800, panelResizeRef.current.h + dh));
    const newLeft = resizePosRef.current.left - (newW - panelResizeRef.current.w);
    const newTop = resizePosRef.current.top - (newH - panelResizeRef.current.h);
    panelElRef.current.style.width = `${newW}px`;
    panelElRef.current.style.height = `${newH}px`;
    panelElRef.current.style.left = `${newLeft}px`;
    panelElRef.current.style.top = `${newTop}px`;
  }, []);

  const onResizeEnd = useCallback((e: React.PointerEvent) => {
    if (!isResizingRef.current) return;
    isResizingRef.current = false;
    const dw = panelResizeRef.current.startX - e.clientX;
    const dh = panelResizeRef.current.startY - e.clientY;
    const newW = Math.max(320, Math.min(600, panelResizeRef.current.w + dw));
    const newH = Math.max(400, Math.min(800, panelResizeRef.current.h + dh));
    setPanelSize({ w: newW, h: newH });
    setPanelPos({
      left: resizePosRef.current.left - (newW - panelResizeRef.current.w),
      top: resizePosRef.current.top - (newH - panelResizeRef.current.h),
    });
  }, []);

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

  // Phase 5: 文献面板
  const [showLiteraturePanel, setShowLiteraturePanel] = useState(false);

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

  // ═══ PTT 状态（提前声明，供唤醒词监听器判断是否启用） ═══
  const [isPushToTalk, setIsPushToTalk] = useState(false);
  const [pttInterimText, setPttInterimText] = useState('');
  const [pttFinalText, setPttFinalText] = useState('');
  const [pttDuration, setPttDuration] = useState(0);
  // 波形动画时钟（drives sine-based bar animation, only ticks when PTT active）
  const [pttClock, setPttClock] = useState(0);
  useEffect(() => {
    if (!isPushToTalk) return;
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      setPttClock((performance.now() - start) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPushToTalk]);

  // ═══ 后台唤醒词监听（"小爱同学"模式） ═══
  const { flowState, interimText: wakeInterimText, micLevel } = useWakeWordListener({
    wakeWord: '小智',
    enabled: !panelListening && !isProcessing && !isTTSCooldown && !isPushToTalk, // PTT时释放麦克风
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

  // ═══ Push-to-Talk（空格键 / 长按悬浮球） ═══
  const pushToTalkRecognitionRef = useRef<SpeechRecognition | null>(null);
  const pttStartTimeRef = useRef(0);
  const pttTimerRef = useRef<ReturnType<typeof setInterval>>();
  const pttFinalTextRef = useRef('');
  const pttInterimTextRef = useRef('');
  // PTT 是否用户主动停止（区分松手 vs 浏览器自动断开）
  const pttUserStoppedRef = useRef(false);
  // 是否已提交（防止 onend 与 handlePushToTalkEnd 重复提交）
  const pttSubmittedRef = useRef(false);
  // PTT 语音活跃度（由识别事件驱动，无需 getUserMedia 避免麦克风冲突）
  const [pttMicLevel, setPttMicLevel] = useState(0);
  const pttLevelTargetRef = useRef(0);
  const pttLevelAnimRef = useRef(0);

  // 启动波形动画循环
  const startPttLevelAnim = useCallback(() => {
    const update = () => {
      const target = pttLevelTargetRef.current;
      setPttMicLevel(prev => {
        // attack 40%, release 15%
        const next = target > prev ? prev + (target - prev) * 0.4 : prev + (target - prev) * 0.15;
        return Math.abs(next) < 0.005 ? 0 : next;
      });
      // 目标值自然衰减
      pttLevelTargetRef.current *= 0.92;
      pttLevelAnimRef.current = requestAnimationFrame(update);
    };
    update();
  }, []);

  const stopPttLevelAnim = useCallback(() => {
    if (pttLevelAnimRef.current) cancelAnimationFrame(pttLevelAnimRef.current);
    pttLevelAnimRef.current = 0;
    pttLevelTargetRef.current = 0;
    setPttMicLevel(0);
  }, []);

  const pttRetryCountRef = useRef(0);

  const launchPttRecognition = useCallback(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    // 已停止则不再启动
    if (pttUserStoppedRef.current) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = pttFinalTextRef.current;
      let newCharCount = 0;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
          pttFinalTextRef.current = final;
        } else {
          interim += transcript;
        }
        newCharCount += transcript.length;
      }
      pttInterimTextRef.current = interim;
      setPttFinalText(final);
      setPttInterimText(interim);
      // 用识别到的字符数量驱动波形目标值
      pttLevelTargetRef.current = Math.min(1, 0.4 + newCharCount * 0.08);
    };

    recognition.onspeechstart = () => {
      pttLevelTargetRef.current = 0.7;
    };
    recognition.onspeechend = () => {
      pttLevelTargetRef.current = 0.1;
    };
    recognition.onsoundstart = () => {
      pttLevelTargetRef.current = Math.max(pttLevelTargetRef.current, 0.5);
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'audio-capture' || e.error === 'not-allowed') {
        // 麦克风冲突或权限问题，重试几次
        console.warn('[PTT] 麦克风冲突，重试中... (第', pttRetryCountRef.current + 1, '次)');
        pttRetryCountRef.current++;
      } else if (e.error !== 'aborted' && e.error !== 'no-speech') {
        console.warn('[PTT] 识别错误:', e.error);
      }
    };
    recognition.onend = () => {
      // 已经在 handlePushToTalkEnd 中提交过 → 仅清理引用
      if (pttSubmittedRef.current) {
        pushToTalkRecognitionRef.current = null;
        return;
      }
      if (!pttUserStoppedRef.current) {
        // 浏览器自动断开（no-speech 超时 / audio-capture 失败 / continuous 死亡）
        // 用户还按着空格 → 退避重启
        pushToTalkRecognitionRef.current = null;
        const retryDelay = pttRetryCountRef.current > 0
          ? Math.min(200 * Math.pow(2, pttRetryCountRef.current - 1), 1500)
          : 50;
        if (pttRetryCountRef.current >= 8) {
          console.error('[PTT] 重试次数过多，取消录音');
          pttUserStoppedRef.current = true;
          setIsPushToTalk(false);
          if (pttTimerRef.current) clearInterval(pttTimerRef.current);
          stopPttLevelAnim();
          sounds.recordCancel();
          return;
        }
        setTimeout(() => launchPttRecognition(), retryDelay);
        return;
      }
      // 用户已松手但 handlePushToTalkEnd 尚未提交（极少数情况）→ 兜底提交
      pushToTalkRecognitionRef.current = null;
    };

    pushToTalkRecognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      console.warn('[PTT] start 抛出异常:', err);
      // 触发 onend 重试逻辑
      if (!pttUserStoppedRef.current) {
        pttRetryCountRef.current++;
        setTimeout(() => launchPttRecognition(), 300);
      }
    }
  }, [handleCommand, stopPttLevelAnim]);

  const handlePushToTalkStart = useCallback(() => {
    cancelSpeech();
    pttUserStoppedRef.current = false;
    pttSubmittedRef.current = false;
    pttRetryCountRef.current = 0;
    setIsPushToTalk(true);
    setPttInterimText('');
    setPttFinalText('');
    pttFinalTextRef.current = '';
    pttInterimTextRef.current = '';
    sounds.recordStart();

    pttStartTimeRef.current = Date.now();
    setPttDuration(0);
    pttTimerRef.current = setInterval(() => {
      setPttDuration(Math.floor((Date.now() - pttStartTimeRef.current) / 1000));
    }, 200);

    // 启动波形动画 + 语音识别（延迟等唤醒词监听器释放麦克风）
    startPttLevelAnim();
    // 400ms 给唤醒词监听器和浏览器音频系统充分的释放时间
    setTimeout(() => {
      launchPttRecognition();
    }, 400);
  }, [cancelSpeech, launchPttRecognition, startPttLevelAnim]);

  const handlePushToTalkEnd = useCallback(() => {
    pttUserStoppedRef.current = true;
    // 立即提交当前已识别文本（final + interim），无需等待 onend，降低延迟
    if (!pttSubmittedRef.current) {
      const text = (pttFinalTextRef.current + pttInterimTextRef.current).trim();
      pttSubmittedRef.current = true;
      if (text) {
        sounds.recordStop();
        handleCommand(text);
      } else {
        sounds.recordCancel();
      }
    }
    // 关闭 UI 状态
    setIsPushToTalk(false);
    setPttInterimText('');
    setPttFinalText('');
    setPttDuration(0);
    if (pttTimerRef.current) { clearInterval(pttTimerRef.current); pttTimerRef.current = undefined; }
    stopPttLevelAnim();
    // 异步停止识别（不阻塞 UI 关闭）
    if (pushToTalkRecognitionRef.current) {
      try { pushToTalkRecognitionRef.current.stop(); } catch { /* ignore */ }
    }
  }, [handleCommand, stopPttLevelAnim]);

  // ═══ 空格键 Push-to-Talk ═══
  const spaceHeldRef = useRef(false);
  // 用 ref 保存最新回调，避免 stale closure 导致 keyup 调用旧 handlePushToTalkEnd
  const handlePttStartRef = useRef(handlePushToTalkStart);
  handlePttStartRef.current = handlePushToTalkStart;
  const handlePttEndRef = useRef(handlePushToTalkEnd);
  handlePttEndRef.current = handlePushToTalkEnd;

  useEffect(() => {
    const isTyping = () => {
      const active = document.activeElement;
      if (!active) return false;
      const tag = active.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || (active as HTMLElement).isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (isTyping()) return;
      // 始终阻止空格默认行为（页面滚动），无论是否启动录音
      e.preventDefault();
      if (e.repeat) return;
      if (isProcessing || panelListening) return;
      if (!spaceHeldRef.current) {
        spaceHeldRef.current = true;
        handlePttStartRef.current();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (isTyping()) return;
      e.preventDefault();
      if (!spaceHeldRef.current) return;
      spaceHeldRef.current = false;
      handlePttEndRef.current();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isProcessing, panelListening]);

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

      {/* ═══ 空格提示（悬浮球旁，非录音时显示） ═══ */}
      {!isPanelOpen && !isPushToTalk && (
        <div className="fixed right-[72px] bottom-8 z-[9986]">
          <span className="text-[10px] text-white/30 select-none">按住空格说话 · 或说"小智"唤醒</span>
        </div>
      )}

      {/* ═══ 底部居中波形指示器（毛玻璃 + 现代化收音条动画 + 底部氛围光） ═══ */}
      <AnimatePresence>
        {isPushToTalk && (
          <>
            {/* 底部氛围光（参考小艺/Celia，全屏宽度发光） */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="fixed left-0 right-0 bottom-0 pointer-events-none z-[9994]"
              style={{ height: 280 }}
            >
              {/* 主光晕：从底部向上扩散的椭圆径向光 */}
              <div
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(ellipse 65% 100% at 50% 110%, rgba(140,220,255,${0.32 + pttMicLevel * 0.38}) 0%, rgba(100,170,255,${0.20 + pttMicLevel * 0.28}) 25%, rgba(120,140,255,${0.10 + pttMicLevel * 0.16}) 50%, transparent 78%)`,
                  filter: 'blur(18px)',
                }}
              />
              {/* 次级光晕：更宽更淡，制造柔和边缘 */}
              <div
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(ellipse 100% 80% at 50% 120%, rgba(180,230,255,${0.12 + pttMicLevel * 0.2}) 0%, rgba(140,180,255,${0.06 + pttMicLevel * 0.1}) 40%, transparent 75%)`,
                  filter: 'blur(30px)',
                }}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[9995] pointer-events-none select-none"
            >
              <div className="relative flex flex-col items-center gap-3">
                {/* 转录文字浮层 */}
                <AnimatePresence>
                  {(pttFinalText || pttInterimText) && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.96 }}
                      className="px-4 py-2 rounded-2xl backdrop-blur-2xl"
                      style={{
                        background: 'linear-gradient(135deg, rgba(15,20,35,0.38), rgba(8,12,25,0.42))',
                        border: '0.5px solid rgba(255,255,255,0.12)',
                        boxShadow: '0 12px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
                        maxWidth: '560px',
                      }}
                    >
                      <p className="text-[13px] leading-snug text-white/90 truncate">
                        <span>{pttFinalText}</span>
                        {pttInterimText && <span className="text-white/45">{pttInterimText}</span>}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 主体药丸（高透明毛玻璃，拉宽至 640px） */}
                <div
                  className="relative flex items-center gap-5 h-[68px] px-8 rounded-full backdrop-blur-2xl overflow-hidden"
                  style={{
                    width: '640px',
                    maxWidth: 'calc(100vw - 48px)',
                    background: 'linear-gradient(135deg, rgba(18,24,40,0.32), rgba(10,14,28,0.38))',
                    border: '0.5px solid rgba(255,255,255,0.14)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 0 0.5px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -1px 0 rgba(0,0,0,0.2)',
                  }}
                >
                {/* 顶部高光线 */}
                <div
                  className="absolute top-0 left-8 right-8 h-px pointer-events-none"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)',
                  }}
                />

                {/* 流动光带（背景动画） */}
                <motion.div
                  className="absolute inset-0 pointer-events-none opacity-40"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(0,245,255,0.10) 30%, rgba(139,92,246,0.10) 60%, transparent 100%)',
                    backgroundSize: '200% 100%',
                  }}
                  animate={{ backgroundPositionX: ['200%', '-200%'] }}
                  transition={{ duration: 4.5, repeat: Infinity, ease: 'linear' }}
                />

                {/* 左：麦克风图标（动态光晕） */}
                <div className="relative flex items-center justify-center w-10 h-10 flex-shrink-0">
                  <motion.div
                    className="absolute inset-[-4px] rounded-full"
                    style={{
                      background: 'radial-gradient(circle, rgba(139,92,246,0.45), rgba(139,92,246,0) 70%)',
                    }}
                    animate={{
                      scale: [1, 1.18, 1],
                      opacity: [0.5, 0.85, 0.5],
                    }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <div
                    className="relative w-9 h-9 rounded-full flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, rgba(139,92,246,0.28), rgba(99,102,241,0.18))',
                      border: '0.5px solid rgba(139,92,246,0.45)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14), 0 4px 12px rgba(139,92,246,0.25)',
                    }}
                  >
                    <Mic className="w-[18px] h-[18px]" style={{ color: '#D8CCFC' }} />
                  </div>
                </div>

                {/* 中：波形条区域，flex-1 自适应填满剩余空间 */}
                <div className="relative flex-1 flex items-center justify-center gap-[3px] h-9">
                  {Array.from({ length: 45 }).map((_, i) => {
                    const BAR_COUNT = 45;
                    const center = (BAR_COUNT - 1) / 2;
                    const distFromCenter = Math.abs(i - center) / center;
                    // 钟形权重（中间高、两边低）
                    const bell = Math.cos(distFromCenter * Math.PI / 2);
                    // 双正弦波叠加，每条带相位偏移 → 平滑波纹
                    const phase = pttClock * 5.5 + i * 0.32;
                    const wave1 = (Math.sin(phase) + 1) / 2;
                    const wave2 = (Math.sin(phase * 1.7 + 1.3) + 1) / 2;
                    const wave = (wave1 + wave2) / 2;

                    const idle = pttMicLevel < 0.04;
                    let h: number;
                    let opacity: number;
                    if (idle) {
                      // 静默：扫描线效果（高光从左到右流动）
                      const scanPos = ((pttClock * 0.7) % 1.6) * (BAR_COUNT + 8) - 4;
                      const distFromScan = Math.abs(i - scanPos);
                      const scan = Math.max(0, 1 - distFromScan / 5);
                      h = 2 + scan * 5;
                      opacity = 0.18 + scan * 0.55;
                    } else {
                      const amp = bell * (0.25 + wave * 0.75) * pttMicLevel;
                      h = Math.max(2, 2 + amp * 32);
                      opacity = 0.55 + amp * 0.45;
                    }

                    return (
                      <div
                        key={i}
                        className="rounded-full"
                        style={{
                          width: '2.5px',
                          height: `${h}px`,
                          background: idle
                            ? `rgba(200,220,255,${opacity})`
                            : `linear-gradient(180deg, rgba(0,245,255,${opacity}), rgba(139,92,246,${opacity}))`,
                          boxShadow: idle ? 'none' : `0 0 6px rgba(139,92,246,${opacity * 0.5})`,
                        }}
                      />
                    );
                  })}
                </div>

                {/* 右：分隔 + 时长 + 提示 */}
                <div className="relative flex items-center gap-3 pl-4 border-l border-white/[0.08] flex-shrink-0">
                  <div className="flex items-center gap-1.5">
                    <motion.div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: '#F87171', boxShadow: '0 0 8px rgba(248,113,113,0.6)' }}
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <span className="text-[12px] font-mono tabular-nums text-white/60 tracking-wider">
                      {Math.floor(pttDuration / 60)}:{(pttDuration % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-white/35">
                    <kbd className="px-1.5 py-px rounded-md bg-white/[0.08] font-mono leading-none border border-white/[0.06]">␣</kbd>
                    <span>松开发送</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
          </>
        )}
      </AnimatePresence>

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

      {/* ═══ 聊天面板（可拖拽/可拉伸） ═══ */}
      <AnimatePresence>
        {isPanelOpen && (
          <motion.div
            ref={panelElRef}
            layoutId="ai-shell"
            initial={{ opacity: 0 }}
            animate={{ opacity: panelOpacity }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
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
                {/* Phase 5: 文献库面板 */}
                <button
                  onClick={() => setShowLiteraturePanel((v) => !v)}
                  className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                    showLiteraturePanel ? 'bg-[#10B981]/20 text-[#10B981]' : 'text-white/40 hover:text-white/60 hover:bg-white/5'
                  }`}
                  title="文献知识库"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleClear}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
                  title="清空对话"
                >
                  <Trash2 className="w-3.5 h-3.5" />
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
      {/* Phase 5: 文献知识库面板 */}
      <LiteraturePanel
        isOpen={showLiteraturePanel}
        onClose={() => setShowLiteraturePanel(false)}
        onCite={(lit) => {
          const citeText = `请参考文献：${lit.authors[0]}${lit.authors.length > 1 ? ' et al.' : ''} (${lit.year}) "${lit.title}"`;
          handleCommand(citeText);
          setShowLiteraturePanel(false);
        }}
      />
    </>
  );
}
