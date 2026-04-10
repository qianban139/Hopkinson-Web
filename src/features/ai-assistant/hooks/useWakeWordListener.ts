// src/features/ai-assistant/hooks/useWakeWordListener.ts
// 统一语音流 — Web Audio API 音量检测 + SpeechRecognition 唤醒词监听
// 解决方案：用短周期识别会话（非continuous）快速循环，避免 continuous 模式下的各种浏览器 bug
import { useEffect, useRef, useCallback, useState } from 'react';

type VoiceFlowState = 'monitoring' | 'capturing' | 'processing' | 'stopped';

interface UseWakeWordListenerOptions {
  wakeWord?: string;
  enabled: boolean;
  onCommand: (command: string) => void;    // 捕获到完整命令
  onWakeOnly?: () => void;                 // 仅唤醒无命令
  onStateChange?: (state: VoiceFlowState) => void;
}

interface UseWakeWordListenerReturn {
  flowState: VoiceFlowState;
  interimText: string;  // 实时转写文字（捕获阶段）
  micLevel: number;     // 麦克风音量 0-1（保留接口，但不再实际监测以避免冲突）
}

export function useWakeWordListener({
  wakeWord = '小智',
  enabled,
  onCommand,
  onWakeOnly,
  onStateChange,
}: UseWakeWordListenerOptions): UseWakeWordListenerReturn {
  const [flowState, setFlowState] = useState<VoiceFlowState>('stopped');
  const [interimText, setInterimText] = useState('');
  // micLevel 保留接口但不再使用 getUserMedia（避免与 PTT 竞争麦克风）
  const micLevel = 0;

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const enabledRef = useRef(enabled);
  const onCommandRef = useRef(onCommand);
  const onWakeOnlyRef = useRef(onWakeOnly);
  const onStateChangeRef = useRef(onStateChange);
  const flowStateRef = useRef<VoiceFlowState>('stopped');
  const restartTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const captureTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const capturedTextRef = useRef('');
  const isRunningRef = useRef(false);
  // 指数退避重启
  const restartDelayRef = useRef(50);
  const consecutiveFailsRef = useRef(0);
  // 记录启动日志（只打印一次）
  const hasLoggedStartRef = useRef(false);

  // 保持ref同步
  useEffect(() => { onCommandRef.current = onCommand; }, [onCommand]);
  useEffect(() => { onWakeOnlyRef.current = onWakeOnly; }, [onWakeOnly]);
  useEffect(() => { onStateChangeRef.current = onStateChange; }, [onStateChange]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  const SpeechRecognitionAPI = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;

  // ═══ 唤醒词模糊匹配变体 ═══
  const wakeWordVariants = useRef<string[]>([]);
  useEffect(() => {
    // "小智"的常见语音识别误识别变体（覆盖主流语音引擎的误差）
    wakeWordVariants.current = [
      wakeWord,
      // 常见同音字
      '小志', '小知', '小指', '小之', '小枝', '小质', '小致', '小治',
      '小智能', '小制', '小芝', '小支', '小值',
      // 姓氏误识别
      '肖智', '晓智', '晓志', '筱智', '笑智',
      // 叠词形式（用户可能说"小智小智"）
      '小智小智', '小志小志',
      // 连续识别中可能出现的额外空格或标点
    ];
  }, [wakeWord]);

  // ═══ 检测文本中是否包含唤醒词 ═══
  const findWakeWord = useCallback((text: string): { found: boolean; afterWake: string } => {
    // 预处理：去除标点符号和多余空格，提高匹配率
    const cleaned = text.replace(/[，。！？、；：""''（）《》【】\s,.!?;:'"()\[\]{}]/g, '');
    for (const variant of wakeWordVariants.current) {
      const idx = cleaned.lastIndexOf(variant);
      if (idx !== -1) {
        const after = cleaned.slice(idx + variant.length)
          .replace(new RegExp(`^(${wakeWordVariants.current.join('|')})+`, 'g'), '')
          .trim();
        return { found: true, afterWake: after };
      }
    }
    return { found: false, afterWake: '' };
  }, []);

  // ═══ 更新状态 ═══
  const updateFlowState = useCallback((newState: VoiceFlowState) => {
    flowStateRef.current = newState;
    setFlowState(newState);
    onStateChangeRef.current?.(newState);
  }, []);

  // ═══ 语音识别纠错 ═══
  const correctTranscript = useCallback((raw: string): string => {
    let text = raw;
    const numFixes: [RegExp, string][] = [
      [/一千/g, '1000'], [/两千/g, '2000'], [/三千/g, '3000'], [/四千/g, '4000'],
      [/两百/g, '200'], [/三百/g, '300'], [/五百/g, '500'],
      [/一万/g, '10000'], [/两万/g, '20000'], [/三万/g, '30000'], [/五万/g, '50000'],
    ];
    for (const [pat, rep] of numFixes) {
      text = text.replace(pat, rep);
    }
    const termFixes: [RegExp, string][] = [
      [/殿呀|电鸭|电牙|垫压/g, '电压'],
      [/电留|电六|殿留/g, '电流'],
      [/试验|是验|事验/g, '实验'],
      [/脉冲|麦冲/g, '脉冲'],
      [/围压|微压|位压/g, '围压'],
      [/耦合|偶合|藕合/g, '耦合'],
      [/仿真|防真/g, '仿真'],
      [/应变率|应变力/g, '应变率'],
      [/应力|应立/g, '应力'],
      [/五A零六/g, '5A06'], [/五零六/g, '5A06'],
      [/求235/g, 'Q235'], [/丘235/g, 'Q235'],
      [/踢C四/g, 'TC4'], [/TC思/g, 'TC4'],
      [/七零七五/g, '7075'],
      [/花刚岩/g, '花岗岩'],
      [/大力石/g, '大理石'],
      [/混泥土/g, '混凝土'],
      [/和普金森/g, '霍普金森'], [/霍普金生/g, '霍普金森'],
      [/约翰逊库克/g, '约翰逊-库克'],
      [/奔驰模型/g, '本构模型'],
      [/应辩|应便/g, '应变'],
      [/透视/g, '透射'],
      [/入社|入色/g, '入射'],
      [/反色/g, '反射'],
      [/是样/g, '试样'],
      [/伯行|波型/g, '波形'],
      [/电次|殿磁/g, '电磁'],
      [/出能/g, '储能'],
      [/殿容|电蓉/g, '电容'],
      [/迈宽/g, '脉宽'],
    ];
    for (const [pat, rep] of termFixes) {
      text = text.replace(pat, rep);
    }
    return text;
  }, []);

  // ═══ 提交捕获到的命令 ═══
  const submitCapturedCommand = useCallback(() => {
    const raw = capturedTextRef.current.trim();
    const command = correctTranscript(raw);
    capturedTextRef.current = '';
    setInterimText('');

    if (command) {
      updateFlowState('processing');
      onCommandRef.current(command);
      setTimeout(() => {
        if (enabledRef.current) {
          updateFlowState('monitoring');
        }
      }, 500);
    } else {
      onWakeOnlyRef.current?.();
      updateFlowState('monitoring');
    }
  }, [updateFlowState, correctTranscript]);

  // ═══ 重置捕获超时 ═══
  const resetCaptureTimeout = useCallback(() => {
    if (captureTimeoutRef.current) {
      clearTimeout(captureTimeoutRef.current);
    }
    captureTimeoutRef.current = setTimeout(() => {
      if (flowStateRef.current === 'capturing') {
        submitCapturedCommand();
      }
    }, 4000);
  }, [submitCapturedCommand]);

  // 注意：原先的 getUserMedia 音量监测已移除，因为它会与 PTT 的 SpeechRecognition 竞争麦克风
  // 唤醒词监听器现在仅使用 SpeechRecognition，单一通道避免冲突

  // ═══ 启动 SpeechRecognition ═══
  // 关键改进：使用非 continuous 模式 + 快速循环重启
  // 这比 continuous 模式更可靠，因为：
  // 1. continuous 模式在很多浏览器中会无声死亡
  // 2. 非 continuous 模式每次结束后立即重启，间隔极短
  // 3. 在捕获阶段临时切换到 continuous 模式以获得完整命令
  const startRecognition = useCallback(() => {
    if (!SpeechRecognitionAPI || !enabledRef.current || isRunningRef.current) return;

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = 'zh-CN';
      // 关键：捕获阶段用 continuous，监听阶段用短周期
      const isCapturing = flowStateRef.current === 'capturing';
      recognition.continuous = isCapturing;
      recognition.interimResults = true;
      recognition.maxAlternatives = 5; // 增加到5个候选，大幅提高唤醒词匹配率

      if (!hasLoggedStartRef.current) {
        console.info('[语音流] 唤醒词监听已启动，说"小智小智"或"小智"唤醒');
        hasLoggedStartRef.current = true;
      }

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        // 每次收到结果都重置失败计数（证明识别在工作）
        consecutiveFailsRef.current = 0;
        restartDelayRef.current = 50;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          // 低置信度过滤（但保留 confidence=0 的情况）
          const confidence = result[0].confidence;
          if (confidence > 0 && confidence < 0.2) continue;

          // 在监听模式下，检查所有候选结果寻找唤醒词
          let text = result[0].transcript.trim();
          if (flowStateRef.current === 'monitoring') {
            for (let alt = 0; alt < result.length; alt++) {
              const altText = result[alt].transcript.trim();
              if (findWakeWord(altText).found) {
                text = altText;
                break;
              }
            }
          }

          if (flowStateRef.current === 'monitoring') {
            // 监听模式：检测唤醒词
            // 对 interim 和 final 结果都进行唤醒词检测
            const wakeCheck = findWakeWord(text);
            if (wakeCheck.found) {
              console.info('[语音流] 唤醒词检测成功! 识别文本:', text);

              if (wakeCheck.afterWake && result.isFinal) {
                // "小智设置电压3000V" — 唤醒词后面直接带了命令
                capturedTextRef.current = wakeCheck.afterWake;
                updateFlowState('capturing');
                setInterimText(wakeCheck.afterWake);
                resetCaptureTimeout();
              } else {
                // 仅唤醒词 — 进入命令捕获模式
                updateFlowState('capturing');
                setInterimText('');
                resetCaptureTimeout();
              }

              // 停掉当前非 continuous 会话，立即用 continuous 模式重启来捕获命令
              try { recognition.abort(); } catch { /* ignore */ }
              return;
            }
          } else if (flowStateRef.current === 'capturing') {
            // 捕获模式：积累命令文字
            const wakePattern = new RegExp(`(${wakeWordVariants.current.join('|')})`, 'g');
            if (result.isFinal) {
              const cleaned = text.replace(wakePattern, '').trim();
              if (cleaned) {
                capturedTextRef.current += cleaned;
                setInterimText(capturedTextRef.current);
              }
              resetCaptureTimeout();
            } else {
              const cleaned = text.replace(wakePattern, '').trim();
              if (cleaned) {
                setInterimText(capturedTextRef.current + cleaned);
              }
              resetCaptureTimeout();
            }
          }
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          console.error('[语音流] 麦克风权限被拒绝，唤醒词功能已禁用');
          isRunningRef.current = false;
          updateFlowState('stopped');
          return;
        }
        if (event.error === 'network') {
          consecutiveFailsRef.current++;
          restartDelayRef.current = Math.min(restartDelayRef.current * 2, 3000);
          console.warn('[语音流] 网络错误，', restartDelayRef.current, 'ms后重试');
        } else if (event.error === 'no-speech') {
          // no-speech 是正常的（用户没说话），快速重启即可
          // 不增加失败计数，使用最短延迟
        } else if (event.error !== 'aborted') {
          consecutiveFailsRef.current++;
          console.warn('[语音流] 识别错误:', event.error);
        }
      };

      recognition.onend = () => {
        isRunningRef.current = false;

        // 如果被禁用了，强制提交未完成的捕获
        if (!enabledRef.current && flowStateRef.current === 'capturing' && capturedTextRef.current.trim()) {
          submitCapturedCommand();
        }

        // 自动重启循环
        if (enabledRef.current) {
          // 连续失败太多次，暂停后再试
          let delay: number;
          if (consecutiveFailsRef.current >= 8) {
            delay = 5000;
            console.info('[语音流] 连续失败过多，暂停5秒后恢复');
            consecutiveFailsRef.current = 0;
            restartDelayRef.current = 50;
          } else {
            // 核心改进：极短的重启间隔，减少监听盲区
            delay = flowStateRef.current === 'capturing' ? 30 : restartDelayRef.current;
          }
          restartTimerRef.current = setTimeout(() => {
            if (enabledRef.current) {
              startRecognition();
            }
          }, delay);
        } else {
          updateFlowState('stopped');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      isRunningRef.current = true;
      restartDelayRef.current = 50;
      if (flowStateRef.current !== 'capturing' && flowStateRef.current !== 'processing') {
        updateFlowState('monitoring');
      }
    } catch (err) {
      console.warn('[语音流] 启动失败:', err);
      isRunningRef.current = false;
      consecutiveFailsRef.current++;
      restartDelayRef.current = Math.min(restartDelayRef.current * 2, 3000);
      // 启动失败也要尝试重启
      if (enabledRef.current) {
        restartTimerRef.current = setTimeout(() => {
          if (enabledRef.current) startRecognition();
        }, restartDelayRef.current);
      }
    }
  }, [SpeechRecognitionAPI, findWakeWord, updateFlowState, resetCaptureTimeout, submitCapturedCommand]);

  // ═══ 停止识别 ═══
  const stopRecognition = useCallback(() => {
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    if (captureTimeoutRef.current) clearTimeout(captureTimeoutRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    isRunningRef.current = false;
    capturedTextRef.current = '';
    setInterimText('');
    hasLoggedStartRef.current = false;
  }, []);

  // ═══ 根据 enabled 启停 ═══
  useEffect(() => {
    if (!SpeechRecognitionAPI) return;

    if (enabled) {
      startRecognition();
    } else {
      stopRecognition();
      updateFlowState('stopped');
    }

    return () => {
      stopRecognition();
    };
  }, [enabled, SpeechRecognitionAPI, startRecognition, stopRecognition, updateFlowState]);

  // ═══ 页面可见性处理 ═══
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        stopRecognition();
      } else if (enabledRef.current) {
        restartTimerRef.current = setTimeout(() => {
          if (enabledRef.current) startRecognition();
        }, 150);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [startRecognition, stopRecognition]);

  // ═══ 组件卸载清理 ═══
  useEffect(() => {
    return () => {
      stopRecognition();
    };
  }, [stopRecognition]);

  return { flowState, interimText, micLevel };
}
