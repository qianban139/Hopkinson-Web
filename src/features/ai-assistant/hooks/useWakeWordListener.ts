// src/features/ai-assistant/hooks/useWakeWordListener.ts
// 统一语音流 — 单一SpeechRecognition实例实现：唤醒词监听 → 命令捕获 → 处理 → 循环
// 类似"小爱同学"体验：常驻后台监听，检测到唤醒词后自动捕获命令
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
  const restartDelayRef = useRef(100);
  const consecutiveFailsRef = useRef(0);

  // 保持ref同步
  useEffect(() => { onCommandRef.current = onCommand; }, [onCommand]);
  useEffect(() => { onWakeOnlyRef.current = onWakeOnly; }, [onWakeOnly]);
  useEffect(() => { onStateChangeRef.current = onStateChange; }, [onStateChange]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  const SpeechRecognitionAPI = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;

  // 唤醒词模糊匹配（语音识别常见误识别变体）
  const wakeWordVariants = useRef<string[]>([]);
  useEffect(() => {
    // "小智"的常见语音识别误识别
    wakeWordVariants.current = [
      wakeWord,
      '小志', '小知', '小指', '小之', '小枝', '小质', '小致', '小治',
      '小智能', '小制', '小芝', '小支', '小值',
      '肖智', '晓智', '晓志', '筱智', '笑智',
    ];
  }, [wakeWord]);

  // 检测文本中是否包含唤醒词（含模糊匹配）
  const findWakeWord = useCallback((text: string): { found: boolean; afterWake: string } => {
    for (const variant of wakeWordVariants.current) {
      const idx = text.lastIndexOf(variant);
      if (idx !== -1) {
        const after = text.slice(idx + variant.length)
          .replace(new RegExp(`^(${wakeWordVariants.current.join('|')})+`, 'g'), '')
          .trim();
        return { found: true, afterWake: after };
      }
    }
    return { found: false, afterWake: '' };
  }, []);

  // 更新状态
  const updateFlowState = useCallback((newState: VoiceFlowState) => {
    flowStateRef.current = newState;
    setFlowState(newState);
    onStateChangeRef.current?.(newState);
  }, []);

  // 语音识别纠错 — 修正常见误识别
  const correctTranscript = useCallback((raw: string): string => {
    let text = raw;
    // 常见数字误识别
    const numFixes: [RegExp, string][] = [
      [/一千/g, '1000'], [/两千/g, '2000'], [/三千/g, '3000'], [/四千/g, '4000'],
      [/两百/g, '200'], [/三百/g, '300'], [/五百/g, '500'],
      [/一万/g, '10000'], [/两万/g, '20000'], [/三万/g, '30000'], [/五万/g, '50000'],
    ];
    for (const [pat, rep] of numFixes) {
      text = text.replace(pat, rep);
    }
    // 专业术语纠错
    const termFixes: [RegExp, string][] = [
      [/电压/g, '电压'], // 确保不误识别
      [/殿呀|电鸭|电牙|垫压/g, '电压'],
      [/电流/g, '电流'],
      [/电留|电六|殿留/g, '电流'],
      [/实验/g, '实验'],
      [/试验|是验|事验/g, '实验'],
      [/实验室/g, '实验室'],
      [/脉冲|麦冲/g, '脉冲'],
      [/围压|微压|位压/g, '围压'],
      [/虚拟/g, '虚拟'],
      [/安全检查/g, '安全检查'],
      [/优化/g, '优化'],
      [/材料/g, '材料'],
      [/监控/g, '监控'],
      [/耦合|偶合|藕合/g, '耦合'],
      [/仿真|防真/g, '仿真'],
      [/应变率|应变力/g, '应变率'],
      [/应力|应立/g, '应力'],
      // 材料名称纠错
      [/五A零六/g, '5A06'], [/五零六/g, '5A06'],
      [/求235/g, 'Q235'], [/丘235/g, 'Q235'],
      [/踢C四/g, 'TC4'], [/TC思/g, 'TC4'],
      [/七零七五/g, '7075'],
      [/花刚岩/g, '花岗岩'],
      [/大力石/g, '大理石'],
      [/混泥土/g, '混凝土'],
      // 霍普金森实验术语
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

  // 提交捕获到的命令
  const submitCapturedCommand = useCallback(() => {
    const raw = capturedTextRef.current.trim();
    const command = correctTranscript(raw);
    capturedTextRef.current = '';
    setInterimText('');

    if (command) {
      updateFlowState('processing');
      onCommandRef.current(command);
      // 处理完后回到监听状态（短暂延迟让操作完成）
      setTimeout(() => {
        if (enabledRef.current) {
          updateFlowState('monitoring');
        }
      }, 500);
    } else {
      // 只说了唤醒词没有后续命令
      onWakeOnlyRef.current?.();
      updateFlowState('monitoring');
    }
  }, [updateFlowState, correctTranscript]);

  // 重置捕获超时（每次有新识别结果时重置）
  const resetCaptureTimeout = useCallback(() => {
    if (captureTimeoutRef.current) {
      clearTimeout(captureTimeoutRef.current);
    }
    captureTimeoutRef.current = setTimeout(() => {
      if (flowStateRef.current === 'capturing') {
        submitCapturedCommand();
      }
    }, 4000); // 4秒无新输入则提交（给用户更多思考时间）
  }, [submitCapturedCommand]);

  // 启动识别
  const startRecognition = useCallback(() => {
    if (!SpeechRecognitionAPI || !enabledRef.current || isRunningRef.current) return;

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = 'zh-CN';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3; // 增加候选数量，提高唤醒词匹配率

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          // 跳过低置信度结果（confidence为0时表示浏览器不支持，不过滤）
          const confidence = result[0].confidence;
          if (confidence > 0 && confidence < 0.3) continue;
          // 检查所有候选结果，提高唤醒词匹配率
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
            // 监听模式：检测唤醒词（含模糊匹配）
            // 同时检查interim和final结果，提高唤醒词成功率
            const wakeCheck = findWakeWord(text);
            if (wakeCheck.found) {
              // 成功识别，重置退避计数
              consecutiveFailsRef.current = 0;
              restartDelayRef.current = 100;

              if (wakeCheck.afterWake && result.isFinal) {
                // 唤醒词后面直接带了命令（如"小智设置电压3000V"）
                capturedTextRef.current = wakeCheck.afterWake;
                updateFlowState('capturing');
                setInterimText(wakeCheck.afterWake);
                resetCaptureTimeout();
              } else {
                // 唤醒词检测到即进入捕获模式（interim也触发，提高唤醒灵敏度）
                updateFlowState('capturing');
                setInterimText('');
                resetCaptureTimeout();
              }
            }
          } else if (flowStateRef.current === 'capturing') {
            // 捕获模式：积累命令文字
            // 过滤掉所有唤醒词变体
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
          console.info('[语音流] 麦克风权限未授予，已禁用');
          isRunningRef.current = false;
          updateFlowState('stopped');
          return;
        }
        if (event.error === 'network') {
          // 网络错误，加长重启等待
          consecutiveFailsRef.current++;
          restartDelayRef.current = Math.min(restartDelayRef.current * 2, 1500);
          console.warn('[语音流] 网络错误，将在', restartDelayRef.current, 'ms后重试');
        } else if (event.error === 'no-speech') {
          // no-speech 是正常行为（静默超时），不计入失败次数，快速重启
        } else if (event.error !== 'aborted') {
          consecutiveFailsRef.current++;
          console.warn('[语音流] 错误:', event.error);
        }
      };

      recognition.onend = () => {
        isRunningRef.current = false;

        // 如果在捕获中断开，不立即提交 — 让 captureTimeout 处理
        // 只在 enabled=false 时才强制提交
        if (!enabledRef.current && flowStateRef.current === 'capturing' && capturedTextRef.current.trim()) {
          submitCapturedCommand();
        }

        // 自动重启（指数退避）
        if (enabledRef.current) {
          // 连续失败5次以上，暂停5秒再尝试
          const delay = consecutiveFailsRef.current >= 5 ? 5000 : restartDelayRef.current;
          if (consecutiveFailsRef.current >= 5) {
            console.info('[语音流] 连续失败过多，暂停5秒');
            consecutiveFailsRef.current = 0;
            restartDelayRef.current = 100;
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
      // 成功启动，重置退避延迟
      restartDelayRef.current = 100;
      if (flowStateRef.current !== 'capturing' && flowStateRef.current !== 'processing') {
        updateFlowState('monitoring');
      }
    } catch (err) {
      console.warn('[语音流] 启动失败:', err);
      isRunningRef.current = false;
      consecutiveFailsRef.current++;
      restartDelayRef.current = Math.min(restartDelayRef.current * 2, 1500);
    }
  }, [SpeechRecognitionAPI, wakeWord, updateFlowState, resetCaptureTimeout, submitCapturedCommand]);

  // 停止识别
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
  }, []);

  // 根据enabled启停
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

  // 页面可见性
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        stopRecognition();
      } else if (enabledRef.current) {
        restartTimerRef.current = setTimeout(() => {
          if (enabledRef.current) startRecognition();
        }, 200);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [startRecognition, stopRecognition]);

  // 组件卸载
  useEffect(() => {
    return () => {
      stopRecognition();
    };
  }, [stopRecognition]);

  return { flowState, interimText };
}
