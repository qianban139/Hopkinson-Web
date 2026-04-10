// src/features/ai-assistant/hooks/useAIOrchestrator.ts
// AI核心编排引擎 - 接收自然语言，解析意图，执行动作
// 包含实验引导对话流：开始实验 → 确认材料 → 确认参数 → 确认围压 → 执行
import { useState, useCallback, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { quickIntentMatch } from '../services/aiIntentParser';
import { executeAction } from '../services/aiActionRegistry';
import { conversationManager } from '../services/aiConversationManager';
import { chatWithLLM, chatWithLLMStream, isLLMConfigured } from '@/services/llmService';
import type { LLMTool } from '@/services/llmService';
import { getLLMTools } from '../services/aiIntentParser';
import { addExperimentMemory, setPreference, getRecentExperiments } from '../services/memoryService';
import { runOrchestrator } from '../agent';
import type { AgentThought, AgentRole } from '../agent/types';
import { retrieve, buildAugmentedQuery, extractUsedCitations } from '@/services/rag';
import type { Citation } from '@/services/rag';
import type { AIOperation, OrbState, LLMFunctionCall, AIHighlightTarget } from '../types';

// ═══════════════════════════════════════════════
// 实验引导对话流状态机
// ═══════════════════════════════════════════════
type ExperimentFlowStep = 'idle' | 'ask_material' | 'ask_voltage' | 'ask_waveform' | 'confirm';

interface ExperimentFlowState {
  step: ExperimentFlowStep;
  material?: string;
  voltage?: number;
  current?: number;
  pulseWidth?: number;
  waveform?: string;
}

const INITIAL_FLOW: ExperimentFlowState = { step: 'idle' };

/** 检测用户是否表达"开始/做实验"的意图（非默认模式） */
function isStartExperimentIntent(text: string): boolean {
  return /(?:启动|开始|运行|做|帮我做)(?:一[个次场]?)?(?:实验|测试|SHPB)/i.test(text)
    && !/默认|快速/.test(text);
}

/** 尝试从文本中提取材料名 */
function extractMaterial(text: string, materials: { name: string }[]): string | null {
  for (const m of materials) {
    if (text.includes(m.name)) return m.name;
  }
  // 模糊匹配：去掉空格后匹配
  const clean = text.replace(/\s/g, '');
  for (const m of materials) {
    if (clean.includes(m.name.replace(/\s/g, ''))) return m.name;
  }
  return null;
}

/** 尝试从文本中提取电压值 */
function extractVoltage(text: string): number | null {
  const m = text.match(/(\d{3,4})\s*[vV伏]/);
  if (m) return Math.max(1000, Math.min(4000, Number(m[1])));
  // 纯数字且在合理范围
  const nums = text.match(/\d{3,4}/);
  if (nums) {
    const n = Number(nums[0]);
    if (n >= 1000 && n <= 4000) return n;
  }
  return null;
}

/** 尝试从文本中提取波形类型 */
function extractWaveform(text: string): string | null {
  if (/正弦|sine/i.test(text)) return 'sine';
  if (/方波|square/i.test(text)) return 'square';
  if (/三角|triangle/i.test(text)) return 'triangle';
  if (/脉冲|pulse/i.test(text)) return 'pulse';
  return null;
}

/** 判断用户是否表示肯定/确认 */
function isConfirm(text: string): boolean {
  return /^(好|行|是|对|确[认定]|没问题|可以|ok|yes|开始|启动|冲|走)/i.test(text.trim());
}

/** 判断用户是否表示否定/取消 */
function isCancel(text: string): boolean {
  return /^(不|取消|算了|退出|cancel|no)/i.test(text.trim());
}

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
  /** Agent 推理链（最近一次 Agent 模式调用产生的思考步骤） */
  lastThoughts: AgentThought[];
  /** 最近一次激活的 Agent 角色 */
  lastAgentRole: AgentRole | null;
  /** RAG 模式开关 */
  ragEnabled: boolean;
  setRagEnabled: (v: boolean) => void;
  /** 最近一次回复关联的引用 */
  lastCitations: Citation[];

  // 操作
  processUserInput: (
    text: string,
    onStreamChunk?: (chunk: string, accumulated: string) => void,
    imageBase64?: string,
    options?: { useAgentMode?: boolean; forceRole?: AgentRole },
  ) => Promise<string>;
  clearOperations: () => void;
  cancelOperation: () => void;
}

export function useAIOrchestrator(): UseAIOrchestratorReturn {
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [operations, setOperations] = useState<AIOperation[]>([]);
  const [currentHighlight, setCurrentHighlight] = useState<AIHighlightTarget | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastThoughts, setLastThoughts] = useState<AgentThought[]>([]);
  const [lastAgentRole, setLastAgentRole] = useState<AgentRole | null>(null);
  const [ragEnabled, setRagEnabled] = useState(true);
  const [lastCitations, setLastCitations] = useState<Citation[]>([]);
  const cancelledRef = useRef(false);

  // 实验引导对话流
  const experimentFlowRef = useRef<ExperimentFlowState>(INITIAL_FLOW);

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

  // 实验引导对话流处理（返回 string 表示继续流程，null 表示流程结束）
  const handleExperimentFlow = useCallback(
    async (text: string, flow: ExperimentFlowState): Promise<string | null> => {
      const store = useAppStore.getState();
      const materials = store.materials;

      // 用户取消
      if (isCancel(text)) {
        experimentFlowRef.current = INITIAL_FLOW;
        return '已取消实验引导。如需重新开始，请说"开始实验"。';
      }

      switch (flow.step) {
        case 'ask_material': {
          // 用户保持当前材料
          let matName: string | null = null;
          if (/当前|现有|保持|不[变换]/.test(text)) {
            matName = store.selectedMaterial?.name || '5A06铝合金';
          } else {
            matName = extractMaterial(text, materials);
          }

          if (!matName) {
            return `抱歉，未能识别该材料名。系统支持以下材料：\n${materials.slice(0, 8).map(m => `• ${m.name}`).join('\n')}\n${materials.length > 8 ? `...等共${materials.length}种` : ''}\n\n请重新输入材料名称，或说"用当前材料"。`;
          }

          // Execute material selection
          await executeAction('lab.selectMaterial', { materialName: matName });
          flow.material = matName;

          // Also check if voltage/waveform provided in same sentence
          const extraVoltage = extractVoltage(text);
          const extraWaveform = extractWaveform(text);
          if (extraVoltage) {
            flow.voltage = extraVoltage;
            await executeAction('lab.setVoltage', { voltage: extraVoltage });
          }
          if (extraWaveform) flow.waveform = extraWaveform;

          // Skip already-answered steps
          if (flow.voltage && flow.waveform) {
            flow.step = 'confirm';
            experimentFlowRef.current = flow;
            const waveLabels: Record<string, string> = { sine: '正弦波', square: '方波', triangle: '三角波', pulse: '脉冲波' };
            const cur = store.experimentParams.current;
            const pw = store.experimentParams.pulseWidth;
            return `材料已选择：**${matName}** ✓\n电压：**${flow.voltage}V** ✓\n波形：**${waveLabels[flow.waveform] || flow.waveform}** ✓\n\n**实验参数确认：**\n━━━━━━━━━━━━━━\n📋 材料：${matName}\n⚡ 电压：${flow.voltage}V\n🔌 电流：${(cur / 1000).toFixed(1)}kA\n📐 脉宽：${pw}μs\n〰️ 波形：${waveLabels[flow.waveform] || flow.waveform}\n━━━━━━━━━━━━━━\n\n确认无误请回复"**确认开始**"，或说"取消"退出。`;
          } else if (flow.voltage) {
            flow.step = 'ask_waveform';
            experimentFlowRef.current = flow;
            return `材料已选择：**${matName}** ✓\n电压：**${flow.voltage}V** ✓\n\n**选择波形类型**\n• 正弦波 — 适用于常规测试\n• 方波 — 适用于冲击测试\n• 三角波 — 适用于疲劳测试\n• 脉冲波 — 适用于高应变率测试\n\n请选择波形类型，或回复"用当前波形"。`;
          } else {
            flow.step = 'ask_voltage';
            experimentFlowRef.current = flow;
            const params = store.experimentParams;
            return `材料已选择：**${matName}** ✓\n\n**第2步：设置电压**\n当前电压：${params.voltage}V\n可选范围：1000V ~ 4000V\n\n请输入目标电压（如"3000V"），或回复"用当前电压"保持现有设置。`;
          }
        }

        case 'ask_voltage': {
          let voltage: number | null = null;
          if (/当前|现有|保持|不[变换]/.test(text)) {
            voltage = store.experimentParams.voltage;
          } else {
            voltage = extractVoltage(text);
          }

          if (!voltage) {
            return '请输入有效的电压值（1000~4000V），例如"2500V"或"3000"。';
          }

          await executeAction('lab.setVoltage', { voltage });
          flow.voltage = voltage;

          // Also check if waveform provided in same sentence
          const extraWaveform = extractWaveform(text);
          if (extraWaveform) flow.waveform = extraWaveform;

          if (flow.waveform) {
            flow.step = 'confirm';
            experimentFlowRef.current = flow;
            const waveLabels: Record<string, string> = { sine: '正弦波', square: '方波', triangle: '三角波', pulse: '脉冲波' };
            const mat = flow.material || store.selectedMaterial?.name || '未知';
            const cur = store.experimentParams.current;
            const pw = store.experimentParams.pulseWidth;
            return `电压已设置：**${voltage}V** ✓\n波形：**${waveLabels[flow.waveform] || flow.waveform}** ✓\n\n**实验参数确认：**\n━━━━━━━━━━━━━━\n📋 材料：${mat}\n⚡ 电压：${voltage}V\n🔌 电流：${(cur / 1000).toFixed(1)}kA\n📐 脉宽：${pw}μs\n〰️ 波形：${waveLabels[flow.waveform] || flow.waveform}\n━━━━━━━━━━━━━━\n\n确认无误请回复"**确认开始**"，或说"取消"退出。`;
          } else {
            flow.step = 'ask_waveform';
            experimentFlowRef.current = flow;
            return `电压已设置：**${voltage}V** ✓\n\n**第3步：选择波形类型**\n• 正弦波 — 标准正弦波形，适用于常规测试\n• 方波 — 快速上升沿，适用于冲击测试\n• 三角波 — 线性变化，适用于疲劳测试\n• 脉冲波 — 单脉冲波形，适用于高应变率测试\n\n请选择波形类型，或回复"用当前波形"。`;
          }
        }

        case 'ask_waveform': {
          let waveform = extractWaveform(text);
          if (/当前|现有|保持|不[变换]/.test(text)) {
            waveform = store.experimentParams.waveform || 'sine';
          }
          if (waveform) {
            experimentFlowRef.current = { ...flow, step: 'confirm', waveform };
            const waveLabels: Record<string, string> = { sine: '正弦波', square: '方波', triangle: '三角波', pulse: '脉冲波' };
            // 汇总所有参数
            const mat = flow.material || store.selectedMaterial?.name || '未知';
            const v = flow.voltage || store.experimentParams.voltage;
            const cur = store.experimentParams.current;
            const pw = store.experimentParams.pulseWidth;
            return `波形已选择：**${waveLabels[waveform] || waveform}** ✓\n\n**实验参数确认：**\n━━━━━━━━━━━━━━\n📋 材料：${mat}\n⚡ 电压：${v}V\n🔌 电流：${(cur / 1000).toFixed(1)}kA\n📐 脉宽：${pw}μs\n〰️ 波形：${waveLabels[waveform] || waveform}\n━━━━━━━━━━━━━━\n\n确认无误请回复"**确认开始**"，或说"取消"退出。`;
          }
          return '请选择波形类型：正弦波、方波、三角波 或 脉冲波。';
        }

        case 'confirm': {
          if (isConfirm(text)) {
            experimentFlowRef.current = INITIAL_FLOW;
            // 执行实验
            setOrbState('executing');
            const result = await executeAction('lab.startExperiment', {});
            setOrbState('idle');

            const opId = genOpId();
            addOperation({
              id: opId,
              actionId: 'lab.startExperiment',
              actionName: '启动实验',
              params: {},
              status: result.success ? 'complete' : 'error',
              message: result.message,
              timestamp: Date.now(),
            });

            // Save to long-term memory
            addExperimentMemory({
              materialName: flow.material || '未知',
              voltage: flow.voltage || store.experimentParams.voltage,
              waveform: flow.waveform || store.experimentParams.waveform || 'sine',
              peakStress: (flow.voltage || store.experimentParams.voltage) * 0.025,
              strainRate: 2500,
            });
            setPreference('last_material', flow.material || '');
            setPreference('last_voltage', String(flow.voltage || store.experimentParams.voltage));

            return `🚀 ${result.message}\n\n实验正在进行中，您可以在2D/3D视图中观察实验过程。实验完成后我会通知您。`;
          }
          if (isCancel(text)) {
            experimentFlowRef.current = INITIAL_FLOW;
            return '已取消实验。所设参数保留，如需重新开始，请说"开始实验"。';
          }
          return '请回复"确认"开始实验，或"取消"退出。您也可以说"修改材料"或"修改电压"返回上一步。';
        }

        default:
          experimentFlowRef.current = INITIAL_FLOW;
          return null;
      }
    },
    [addOperation, setOrbState]
  );

  // 处理用户输入（核心方法）
  const processUserInput = useCallback(
    async (
      text: string,
      onStreamChunk?: (chunk: string, accumulated: string) => void,
      imageBase64?: string,
      options?: { useAgentMode?: boolean; forceRole?: AgentRole },
    ): Promise<string> => {
      if (!text.trim() && !imageBase64) return '';

      setIsProcessing(true);
      cancelledRef.current = false;
      conversationManager.addUserMessage(text);

      // Agent 深度模式：跳过快速通道，走多步推理
      if (options?.useAgentMode) {
        try {
          setOrbState('thinking');
          setLastThoughts([]);
          const result = await runOrchestrator({
            userInput: text,
            imageBase64,
            forceRole: options.forceRole,
            onThought: (t) => {
              setLastThoughts((prev) => [...prev, t]);
              onStreamChunk?.('', `${t.content}\n`);
            },
          });
          setLastAgentRole(result.agentRole);
          conversationManager.addAssistantMessage(result.response);
          setOrbState('idle');
          setIsProcessing(false);
          return result.response;
        } catch (err) {
          setOrbState('error');
          const errorMsg = `Agent 模式异常：${err instanceof Error ? err.message : '未知错误'}`;
          setIsProcessing(false);
          setTimeout(() => setOrbState('idle'), 2000);
          return errorMsg;
        }
      }

      try {
        // Step 0: 实验引导对话流
        const flow = experimentFlowRef.current;

        // 0-快速: 检测"默认/快速开始实验"意图 → 直接用当前参数启动
        if (flow.step === 'idle' && /(?:默认|快速).*(?:实验|测试|开始)|用默认参数/.test(text)) {
          setOrbState('executing');
          const result = await executeAction('lab.startExperiment', {});
          setOrbState('idle');
          const store = useAppStore.getState();
          const matName = store.selectedMaterial?.name || '默认材料';
          const v = store.experimentParams.voltage;
          const response = result.success
            ? `快速实验已启动 ⚡\n- 材料: ${matName}\n- 电压: ${v}V\n- 电流: ${(store.experimentParams.current / 1000).toFixed(1)}kA\n- 脉宽: ${store.experimentParams.pulseWidth}μs`
            : result.message;
          conversationManager.addAssistantMessage(response);
          setIsProcessing(false);
          return response;
        }

        // 0a: 检测"开始实验"意图 → 进入引导流程（智能提取已有参数）
        if (flow.step === 'idle' && isStartExperimentIntent(text)) {
          const store = useAppStore.getState();
          const materials = store.materials;

          // Try to extract all params from the initial request
          const material = extractMaterial(text, materials);
          const voltage = extractVoltage(text);
          const waveform = extractWaveform(text);

          // Build the flow state with whatever was provided
          const newFlow: ExperimentFlowState = { step: 'idle' };
          if (material) newFlow.material = material;
          if (voltage) newFlow.voltage = voltage;
          if (waveform) newFlow.waveform = waveform;

          // Determine what's still missing
          const missing: string[] = [];
          if (!material && !store.selectedMaterial) missing.push('材料');
          if (!voltage) missing.push('电压');
          if (!waveform) missing.push('波形');

          if (missing.length === 0) {
            // Everything provided, go straight to confirm
            newFlow.step = 'confirm';
            experimentFlowRef.current = newFlow;
            // Apply material selection
            if (material) await executeAction('lab.selectMaterial', { materialName: material });
            if (voltage) await executeAction('lab.setVoltage', { voltage });
            const waveLabels: Record<string, string> = { sine: '正弦波', square: '方波', triangle: '三角波', pulse: '脉冲波' };
            const matName = material || store.selectedMaterial?.name || '当前材料';
            const v = voltage || store.experimentParams.voltage;
            const w = waveform || store.experimentParams.waveform || 'sine';
            const response = `参数确认：\n- 材料: ${matName}\n- 电压: ${v}V\n- 波形: ${waveLabels[w] || w}\n\n确认开始实验？（"确认"/"取消"）`;
            conversationManager.addAssistantMessage(response);
            setIsProcessing(false);
            return response;
          } else {
            // Ask for the FIRST missing param only
            if (!material && !store.selectedMaterial) {
              newFlow.step = 'ask_material';
            } else if (!voltage) {
              newFlow.material = material || store.selectedMaterial?.name;
              newFlow.step = 'ask_voltage';
            } else {
              newFlow.material = material || store.selectedMaterial?.name;
              newFlow.voltage = voltage;
              newFlow.step = 'ask_waveform';
            }
            experimentFlowRef.current = newFlow;

            // Build a smart response acknowledging what was already provided
            let response = `好的，让我设置实验参数。`;
            if (material) response += `\n✓ 材料: ${material}`;
            if (voltage) response += `\n✓ 电压: ${voltage}V`;
            if (waveform) {
              const waveLabels: Record<string, string> = { sine: '正弦波', square: '方波', triangle: '三角波', pulse: '脉冲波' };
              response += `\n✓ 波形: ${waveLabels[waveform] || waveform}`;
            }
            response += `\n\n还需要确认: ${missing.join('、')}`;

            if (newFlow.step === 'ask_material') {
              response += `\n\n请告诉我测试材料？（如"Q235钢"、"5A06铝合金"）\n💡 回复"用当前材料"保持现有选择。`;
            } else if (newFlow.step === 'ask_voltage') {
              // Apply material if extracted
              if (material) await executeAction('lab.selectMaterial', { materialName: material });
              response += `\n\n请设置电压？（1000-4000V）`;
            } else {
              // Apply material and voltage if extracted
              if (material) await executeAction('lab.selectMaterial', { materialName: material });
              if (voltage) await executeAction('lab.setVoltage', { voltage });
              response += `\n\n请选择波形？（正弦波/方波/三角波/脉冲波）`;
            }

            conversationManager.addAssistantMessage(response);
            setIsProcessing(false);
            return response;
          }
        }

        // 0b: 处理引导流程中的用户输入
        if (flow.step !== 'idle') {
          const flowResponse = await handleExperimentFlow(text, flow);
          if (flowResponse) {
            conversationManager.addAssistantMessage(flowResponse);
            setIsProcessing(false);
            return flowResponse;
          }
          // flowResponse 为 null → 流程结束或取消，继续正常处理
        }

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

        // RAG 检索增强：在发送给 LLM 之前，检索相关文献
        let ragCitations: Citation[] = [];
        let augmentedText = text;
        if (ragEnabled) {
          try {
            const ragContext = retrieve(text, { topK: 4, minScore: 0.05 });
            if (ragContext.retrievedChunks.length > 0) {
              augmentedText = buildAugmentedQuery(text, ragContext);
              ragCitations = ragContext.citations;
            }
          } catch {
            // RAG 失败不影响主流程
          }
        }

        // 检查是否配置了LLM
        if (isLLMConfigured()) {
          // 使用LLM处理
          const messages = conversationManager.getMessagesForLLM();
          // 将最后一条用户消息替换为 RAG 增强版本
          if (ragCitations.length > 0 && messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg.role === 'user') {
              lastMsg.content = augmentedText;
            }
          }
          let response = '';

          // Build native tool definitions for LLM function calling
          const tools: LLMTool[] = getLLMTools().map(t => ({
            type: 'function' as const,
            function: t.function,
          }));

          // Transform messages, injecting multimodal content for images
          const llmMessages = messages.map((m, i) => {
            const msg = { role: m.role as 'user' | 'assistant' | 'system', content: m.content };
            // If this is the last user message and we have an image, make it multimodal
            if (imageBase64 && i === messages.length - 1 && m.role === 'user') {
              return {
                ...msg,
                content: [
                  { type: 'text' as const, text: typeof m.content === 'string' ? m.content : '' },
                  { type: 'image_url' as const, image_url: { url: imageBase64, detail: 'auto' as const } },
                ],
              };
            }
            return msg;
          });

          try {
            // 先尝试流式
            let streamResult = '';
            await chatWithLLMStream(
              llmMessages,
              (chunk, accumulated) => {
                streamResult = accumulated;
                onStreamChunk?.(chunk, accumulated);
              },
              tools,
            );
            response = streamResult;
          } catch {
            // 降级到非流式
            try {
              response = await chatWithLLM(
                llmMessages,
                tools,
              );
            } catch {
              response = getFallbackResponse(text);
            }
          }

          // 提取 RAG 引用
          if (ragCitations.length > 0) {
            const usedCitations = extractUsedCitations(response, ragCitations);
            setLastCitations(usedCitations.length > 0 ? usedCitations : ragCitations);
          } else {
            setLastCitations([]);
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
          // 无LLM配置，使用本地知识库 + RAG 文献
          let response = getFallbackResponse(text);
          if (ragCitations.length > 0) {
            response += '\n\n---\n📚 **相关文献参考**：\n' +
              ragCitations.map(c => `[${c.index}] ${c.shortLabel} — ${c.fullTitle}${c.doi ? ` (${c.doi})` : ''}`).join('\n');
            setLastCitations(ragCitations);
          } else {
            setLastCitations([]);
          }
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
    lastThoughts,
    lastAgentRole,
    ragEnabled,
    setRagEnabled,
    lastCitations,
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

  // 自然对话应答
  if (/^(嗯|哦|好的|明白|知道了|了解)$/i.test(input.trim())) {
    return '好的，还有什么需要我帮忙的吗？';
  }
  if (/^(谢谢|感谢|辛苦了)$/i.test(input.trim())) {
    return '不客气！有任何问题随时问我。';
  }

  // 实验历史查询
  if (/(?:实验|测试)历史|做过.*(?:实验|测试)/i.test(input)) {
    const history = getRecentExperiments(5);
    if (history.length === 0) return '暂无实验历史记录。';
    let response = `最近${history.length}次实验记录:\n\n`;
    history.forEach((exp, i) => {
      const date = new Date(exp.timestamp).toLocaleDateString('zh-CN');
      response += `${i + 1}. ${date} - ${exp.materialName}, ${exp.voltage}V, 峰值应力${exp.peakStress.toFixed(1)}MPa\n`;
    });
    return response;
  }

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

  // 实验相关（一般不会走到这里，因为已被流程拦截）
  if (/开始实验|做实验|run experiment/.test(lower)) {
    return '好的，让我们一步步设置实验。请直接说"开始实验"，我会引导您选择材料和参数。\n\n💡 如需使用当前参数直接实验，请说"用默认参数开始实验"。';
  }

  // 默认回复
  const store = useAppStore.getState();
  const material = store.selectedMaterial;
  return `我理解您的问题。当前系统状态：材料${material?.name || '未选择'}，电压${store.experimentParams.voltage}V。您可以告诉我具体想做什么操作，比如"设置电压320V"或"启动AI优化"。`;
}
