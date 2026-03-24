// src/features/ai-assistant/hooks/useAIOrchestrator.ts
// AI核心编排引擎 - 接收自然语言，解析意图，执行动作
import { useState, useCallback, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { quickIntentMatch } from '../services/aiIntentParser';
import { executeAction } from '../services/aiActionRegistry';
import { conversationManager } from '../services/aiConversationManager';
import { chatWithLLM, chatWithLLMStream, isLLMConfigured } from '@/services/llmService';
import type { AIOperation, OrbState, LLMFunctionCall, AIHighlightTarget } from '../types';

// 生成唯一ID
let _opCounter = 0;
function genOpId(): string {
  return `op_${Date.now()}_${++_opCounter}`;
}

interface UseAIOrchestratorReturn {
  // 状态
  orbState: OrbState;
  operations: AIOperation[];
  currentHighlight: AIHighlightTarget | null;
  isProcessing: boolean;

  // 操作
  processUserInput: (text: string) => Promise<string>;
  clearOperations: () => void;
  cancelOperation: () => void;
}

export function useAIOrchestrator(): UseAIOrchestratorReturn {
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [operations, setOperations] = useState<AIOperation[]>([]);
  const [currentHighlight, setCurrentHighlight] = useState<AIHighlightTarget | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const cancelledRef = useRef(false);

  // 添加操作到日志
  const addOperation = useCallback((op: AIOperation) => {
    setOperations((prev) => [...prev.slice(-19), op]); // 保留最近20条
  }, []);

  // 更新操作状态
  const updateOperation = useCallback((id: string, update: Partial<AIOperation>) => {
    setOperations((prev) =>
      prev.map((op) => (op.id === id ? { ...op, ...update } : op))
    );
  }, []);

  // 高亮目标元素
  const highlightTarget = useCallback((actionId: string, label: string) => {
    // 从action ID推断data-ai-target
    const targetId = actionId.replace('.', '-');
    setCurrentHighlight({ targetId, label, duration: 2000 });
    setTimeout(() => setCurrentHighlight(null), 2000);
  }, []);

  // 执行一系列动作
  const executeActions = useCallback(
    async (calls: LLMFunctionCall[]): Promise<string[]> => {
      const results: string[] = [];

      for (const call of calls) {
        if (cancelledRef.current) break;

        const opId = genOpId();
        const op: AIOperation = {
          id: opId,
          actionId: call.name,
          actionName: call.name,
          params: call.arguments,
          status: 'executing',
          timestamp: Date.now(),
        };
        addOperation(op);
        highlightTarget(call.name, `执行: ${call.name}`);

        setOrbState('executing');

        // 显示全局通知
        useAppStore.getState().showAINotification(
          `AI正在: ${call.name.split('.').pop()}...`,
          'info'
        );

        const startTime = Date.now();
        const result = await executeAction(call.name, call.arguments);
        const duration = Date.now() - startTime;

        updateOperation(opId, {
          status: result.success ? 'complete' : 'error',
          message: result.message,
          duration,
        });

        // 显示结果通知
        useAppStore.getState().showAINotification(
          result.message,
          result.success ? 'success' : 'error'
        );

        // 触发操作完成事件（供语音层播报，即使面板关闭）
        window.dispatchEvent(new CustomEvent('ai-action-completed', {
          detail: { actionId: call.name, message: result.message, success: result.success },
        }));

        results.push(result.message);

        // 动作间短暂延迟，让用户看到操作效果
        if (calls.indexOf(call) < calls.length - 1) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }

      return results;
    },
    [addOperation, updateOperation, highlightTarget]
  );

  // 处理用户输入（核心方法）
  const processUserInput = useCallback(
    async (text: string): Promise<string> => {
      if (!text.trim()) return '';

      setIsProcessing(true);
      cancelledRef.current = false;
      conversationManager.addUserMessage(text);

      try {
        // Step 1: 尝试快速正则匹配
        const quickCalls = quickIntentMatch(text);

        if (quickCalls) {
          // 快速匹配成功，直接执行
          setOrbState('executing');
          const results = await executeActions(quickCalls);
          const response = results.join('\n');
          conversationManager.addAssistantMessage(response);
          setOrbState('idle');
          return response;
        }

        // Step 2: 走LLM理解
        setOrbState('thinking');

        // 检查是否配置了LLM
        if (isLLMConfigured()) {
          // 使用LLM处理
          const messages = conversationManager.getMessagesForLLM();
          let response = '';

          try {
            // 先尝试流式
            let streamResult = '';
            await chatWithLLMStream(
              messages.map((m) => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content })),
              (chunk) => {
                streamResult += chunk;
              }
            );
            response = streamResult;
          } catch {
            // 降级到非流式
            try {
              response = await chatWithLLM(
                messages.map((m) => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content }))
              );
            } catch {
              response = getFallbackResponse(text);
            }
          }

          // 检查LLM返回中是否包含动作指令
          const actionCalls = extractActionsFromResponse(response);
          if (actionCalls.length > 0) {
            setOrbState('executing');
            const actionResults = await executeActions(actionCalls);
            // 组合LLM文字回复和动作结果
            const cleanResponse = removeActionMarkersFromResponse(response);
            const fullResponse = cleanResponse + (actionResults.length > 0 ? '\n\n' + actionResults.join('\n') : '');
            conversationManager.addAssistantMessage(fullResponse);
            setOrbState('idle');
            return fullResponse;
          }

          conversationManager.addAssistantMessage(response);
          setOrbState('idle');
          return response;
        } else {
          // 无LLM配置，使用本地知识库
          const response = getFallbackResponse(text);
          conversationManager.addAssistantMessage(response);
          setOrbState('idle');
          return response;
        }
      } catch (err) {
        setOrbState('error');
        const errorMsg = `抱歉，处理出错: ${err instanceof Error ? err.message : '未知错误'}`;
        conversationManager.addAssistantMessage(errorMsg);
        setTimeout(() => setOrbState('idle'), 2000);
        return errorMsg;
      } finally {
        setIsProcessing(false);
      }
    },
    [executeActions]
  );

  const clearOperations = useCallback(() => {
    setOperations([]);
  }, []);

  const cancelOperation = useCallback(() => {
    cancelledRef.current = true;
    setOrbState('idle');
    setIsProcessing(false);
  }, []);

  return {
    orbState,
    operations,
    currentHighlight,
    isProcessing,
    processUserInput,
    clearOperations,
    cancelOperation,
  };
}

// ═══════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════

/**
 * 从LLM回复文本中提取动作调用
 * 支持格式: [ACTION:actionId(param1=value1, param2=value2)]
 */
function extractActionsFromResponse(response: string): LLMFunctionCall[] {
  const actionPattern = /\[ACTION:(\w+(?:\.\w+)*)\(([^)]*)\)\]/g;
  const calls: LLMFunctionCall[] = [];
  let match;

  while ((match = actionPattern.exec(response)) !== null) {
    const actionId = match[1];
    const paramsStr = match[2];
    const params: Record<string, unknown> = {};

    if (paramsStr.trim()) {
      paramsStr.split(',').forEach((pair) => {
        const [key, value] = pair.split('=').map((s) => s.trim());
        if (key && value) {
          // 尝试解析数字
          const num = Number(value);
          params[key] = isNaN(num) ? value.replace(/['"]/g, '') : num;
        }
      });
    }

    calls.push({ name: actionId, arguments: params });
  }

  return calls;
}

/**
 * 从回复中移除动作标记
 */
function removeActionMarkersFromResponse(response: string): string {
  return response.replace(/\[ACTION:[^\]]+\]/g, '').trim();
}

/**
 * 本地知识库兜底回复
 */
function getFallbackResponse(input: string): string {
  const lower = input.toLowerCase();

  // 问候
  if (/你好|hello|hi|嗨/.test(lower)) {
    return '你好！我是小智，数智化霍普金森杆测试系统的AI助手。您可以通过语音或文字告诉我您想做什么，比如"帮我用Q235钢做一个压缩实验"，我会全程为您操作。';
  }

  // 帮助
  if (/帮助|help|能做什么|功能/.test(lower)) {
    return `我可以帮您完成以下操作：
1. **实验操作** — "选择Q235钢"、"设置电压300V"、"开始实验"
2. **AI优化** — "启动AI优化" 自动寻找最优参数
3. **安全检查** — "执行安全检查" 确保系统安全
4. **数据分析** — "分析材料" 查看力学性能
5. **页面导航** — "去实验室"、"去监控页面"
6. **导出报告** — "导出实验报告"

您也可以说"帮我做一个完整的实验"，我会引导您完成全部步骤。`;
  }

  // SHPB相关问题
  if (/什么是|原理|SHPB|霍普金森/.test(lower)) {
    return '霍普金森杆(SHPB)是测量材料高应变率(10²~10⁴/s)动态力学性能的实验装置。本系统使用电磁驱动替代传统气枪，通过三级线圈加速撞击杆撞击入射杆，产生应力波作用于试样，再通过入射波、反射波和透射波信号推算应力-应变关系。我们还集成了三级AI优化(LSTM+WGAN-GP+PPO)和多场耦合(热-力-电磁)功能。';
  }

  // 实验相关
  if (/开始实验|做实验|run experiment/.test(lower)) {
    return '好的，让我们开始准备实验。请告诉我：\n1. 您想测试什么材料？（如Q235钢、花岗岩等）\n2. 需要设置什么电压？（220-350V）\n3. 是否需要启用围压？\n\n或者您可以说"用默认参数开始"，我会使用当前设置。';
  }

  // 默认回复
  const store = useAppStore.getState();
  const material = store.selectedMaterial;
  return `我理解您的问题。当前系统状态：材料${material?.name || '未选择'}，电压${store.experimentParams.voltage}V。您可以告诉我具体想做什么操作，比如"设置电压320V"或"启动AI优化"。`;
}
