// src/features/ai-assistant/AICommandCenter.tsx
// AI中央控制面板 — 语音层与面板UI完全解耦
// 语音交互（唤醒词→命令→TTS回复）不依赖面板打开状态
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Mic, MicOff, X, Minimize2, Maximize2, Trash2,
  ChevronRight, Zap, Brain, Volume2, VolumeX,
  Shield, Beaker, BarChart3, GripVertical,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useAIOrchestrator } from './hooks/useAIOrchestrator';
import { useVoiceInteraction } from './hooks/useVoiceInteraction';
import { useWakeWordListener } from './hooks/useWakeWordListener';
import AIOperationLog from './AIOperationLog';
import AIHighlight from './AIHighlight';
import AIFloatingOrb from './AIFloatingOrb';
import { sounds } from './utils/soundEffects';
import type { OrbState } from './types';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

let msgCounter = 0;

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
      { label: '选择材料', icon: Beaker, command: '帮我选择合适的材料' },
      { label: 'AI推荐参数', icon: Brain, command: '帮我推荐最优参数' },
    ],
    ai: [
      { label: 'AI优化', icon: Brain, command: '启动AI优化' },
      { label: '查看结果', icon: BarChart3, command: '分析优化结果' },
    ],
    multifield: [
      { label: '选择场景', icon: Zap, command: '帮我选择一个耦合场景' },
      { label: '执行耦合', icon: Brain, command: '执行多场耦合分析' },
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

  // 拖拽/拉伸状态
  const [panelPos, setPanelPos] = useState(() => {
    try {
      const saved = localStorage.getItem('ai-panel-layout');
      if (saved) { const p = JSON.parse(saved); return { x: p.x ?? 0, y: p.y ?? 0 }; }
    } catch { /* ignore */ }
    return { x: 0, y: 0 };
  });
  const [panelSize, setPanelSize] = useState(() => {
    try {
      const saved = localStorage.getItem('ai-panel-layout');
      if (saved) { const p = JSON.parse(saved); return { w: p.w ?? 420, h: p.h ?? 560 }; }
    } catch { /* ignore */ }
    return { w: 420, h: 560 };
  });
  const panelDragRef = useRef({ startX: 0, startY: 0, posX: 0, posY: 0 });
  const panelResizeRef = useRef({ startX: 0, startY: 0, w: 420, h: 560 });
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // 保存面板位置/大小到localStorage
  useEffect(() => {
    localStorage.setItem('ai-panel-layout', JSON.stringify({ ...panelPos, ...panelSize }));
  }, [panelPos, panelSize]);

  // 面板拖拽
  const onPanelDragStart = useCallback((e: React.PointerEvent) => {
    setIsDraggingPanel(true);
    panelDragRef.current = { startX: e.clientX, startY: e.clientY, posX: panelPos.x, posY: panelPos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [panelPos]);

  const onPanelDragMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingPanel) return;
    const dx = e.clientX - panelDragRef.current.startX;
    const dy = e.clientY - panelDragRef.current.startY;
    setPanelPos({ x: panelDragRef.current.posX - dx, y: panelDragRef.current.posY - dy });
  }, [isDraggingPanel]);

  const onPanelDragEnd = useCallback(() => {
    setIsDraggingPanel(false);
    // 吸附边缘
    setPanelPos(prev => ({
      x: Math.abs(prev.x) < 20 ? 0 : prev.x,
      y: Math.abs(prev.y) < 20 ? 0 : prev.y,
    }));
  }, []);

  // 面板拉伸
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
    setPanelSize({
      w: Math.max(320, Math.min(600, panelResizeRef.current.w + dw)),
      h: Math.max(400, Math.min(800, panelResizeRef.current.h + dh)),
    });
  }, [isResizing]);

  const onResizeEnd = useCallback(() => { setIsResizing(false); }, []);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: '你好！我是小智，您的AI实验助手。您可以随时说"小智"唤醒我，我会全程为您操作。\n\n试试说"小智，帮我设置电压3000V"',
      timestamp: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [voiceToasts, setVoiceToasts] = useState<VoiceToast[]>([]);
  const [isTTSCooldown, setIsTTSCooldown] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ttsEnabledRef = useRef(ttsEnabled);

  const setAssistantStatus = useAppStore((s) => s.setAssistantStatus);
  const currentPage = useAppStore((s) => s.currentPage);

  useEffect(() => { ttsEnabledRef.current = ttsEnabled; }, [ttsEnabled]);

  // ═══ AI编排引擎 ═══
  const {
    orbState,
    operations,
    currentHighlight,
    isProcessing,
    processUserInput,
    clearOperations,
  } = useAIOrchestrator();

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

  // ═══ 核心命令处理（面板无关） ═══
  const handleCommand = useCallback(async (text: string) => {
    if (!text.trim() || isProcessing) return;

    cancelSpeech();
    sounds.messageSent();

    // 添加到聊天记录（无论面板是否打开）
    const userMsg: ChatMessage = {
      id: `msg_${++msgCounter}`,
      role: 'user',
      text: text.trim(),
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);

    // 显示处理中Toast
    showVoiceToast(`处理: "${text.trim().slice(0, 20)}..."`, 'processing');

    const response = await processUserInput(text.trim());

    if (response) {
      sounds.responseReceived();

      const aiMsg: ChatMessage = {
        id: `msg_${++msgCounter}`,
        role: 'assistant',
        text: response,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, aiMsg]);

      // 语音反馈Toast（面板关闭时显示）
      if (!isPanelOpen) {
        showVoiceToast(response.slice(0, 50) + (response.length > 50 ? '...' : ''), 'result');
      }

      // TTS播报（始终播报，不依赖面板）
      if (ttsEnabledRef.current) {
        speak(response);
      }
    }
  }, [isProcessing, processUserInput, speak, cancelSpeech, showVoiceToast, isPanelOpen]);

  // ═══ 后台唤醒词监听（"小爱同学"模式） ═══
  const { flowState, interimText: wakeInterimText } = useWakeWordListener({
    wakeWord: '小智',
    enabled: !panelListening && !isProcessing && !isSpeaking && !isTTSCooldown, // TTS播放时暂停监听，防止回声识别
    onCommand: (command: string) => {
      // 检测到唤醒词+命令 → 直接执行（不打开面板）
      sounds.wakeWordDetected();
      handleCommand(command);
    },
    onWakeOnly: () => {
      // 只说了"小智" → 语音回复+Toast提示
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
    clearOperations();
  };

  // 面板关闭时停止面板内语音
  useEffect(() => {
    if (!isPanelOpen && panelListening) {
      panelStopListening();
    }
  }, [isPanelOpen, panelListening, panelStopListening]);

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
            style={{ right: 24 - panelPos.x, bottom: 100 - panelPos.y }}
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
              right: 24 - panelPos.x,
              bottom: 100 - panelPos.y,
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

            {/* 消息区域 */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#00F5FF]/15 text-white/90 rounded-br-md'
                        : 'bg-white/5 text-white/80 rounded-bl-md border border-white/5'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                    <div className="text-[10px] text-white/20 mt-1 text-right">
                      {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}

              {isProcessing && (
                <div className="flex justify-start">
                  <div className="bg-white/5 rounded-2xl rounded-bl-md px-4 py-3 border border-white/5">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#00F5FF] animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-[#00F5FF] animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-[#00F5FF] animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs text-[#00F5FF]/60">
                        {orbState === 'thinking' ? '思考中...' : orbState === 'executing' ? '执行操作中...' : '处理中...'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

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

            {/* 输入区域 */}
            <div className="px-3 py-3 border-t border-[#00F5FF]/10 bg-[#051020]/50">
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

                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={panelListening ? '正在聆听，直接说话...' : '输入指令或问题...'}
                  disabled={isProcessing || panelListening}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#00F5FF]/40 disabled:opacity-50 transition-colors"
                />

                <button
                  onClick={() => { handleCommand(inputText); setInputText(''); }}
                  disabled={!inputText.trim() || isProcessing}
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
