// src/features/ai-assistant/agent/agentOrchestrator.ts
// Agent 主控编排器 — Phase 2 智能助手 2.0 核心
//
// 职责：
//   1. 接收用户输入，路由到合适的 Agent 角色
//   2. 调度该 Agent 完成多步推理（思考 → 工具调用 → 观察 → 结论）
//   3. 实时记录推理链供 UI 可视化
//   4. 兜底降级（无 LLM 配置时使用启发式路由）

import { chatWithLLM } from '@/services/llmService';
import type { ChatMessage, LLMTool } from '@/services/llmService';
import { buildAgentMeta, AGENT_REGISTRY } from './agents';
import { getToolsForRole, safeCallTool } from './toolRegistry';
import type {
  AgentRole, AgentPlan, AgentResult, AgentThought, AgentContext,
} from './types';
import type { LLMFunctionCall } from '../types';

let _thoughtCounter = 0;
function genThoughtId(): string {
  return `th_${Date.now()}_${++_thoughtCounter}`;
}

// ═══════════════════════════════════════════════
// 路由层：决定由哪个 Agent 处理
// ═══════════════════════════════════════════════

/**
 * 启发式路由 — 基于关键词快速选择 Agent，无需 LLM 调用
 */
function heuristicRoute(userInput: string): AgentPlan {
  const text = userInput.toLowerCase();

  // 安全相关 → safety
  if (/安全|危险|过载|过热|紧急|停[机止]|阈值|告警|警告|风险/.test(text)) {
    return {
      agentRole: 'safety',
      reasoning: '检测到安全相关关键词',
      intentCategory: 'safety_check',
      multiStep: true,
    };
  }

  // 教学/原理类 → educator
  if (/原理|什么是|为什么|怎么(?:理解|学|做)|教(?:我|学)|解释|介绍|新手|入门/.test(text)) {
    return {
      agentRole: 'educator',
      reasoning: '检测到教学/原理类问题',
      intentCategory: 'teaching',
      multiStep: false,
    };
  }

  // 报告/对比/导出 → researcher
  if (/报告|论文|对比|导出|数据集|文献|引用|发表|总结/.test(text)) {
    return {
      agentRole: 'researcher',
      reasoning: '检测到报告/对比/导出意图',
      intentCategory: 'research',
      multiStep: true,
    };
  }

  // 分析/预测/拟合 → scientist
  if (/分析|预测|拟合|j-?c|本构|材料(?:特性|参数|行为)|应力|应变|微观|失效/.test(text)) {
    return {
      agentRole: 'scientist',
      reasoning: '检测到材料科学分析意图',
      intentCategory: 'analysis',
      multiStep: true,
    };
  }

  // 默认 → engineer（操作型）
  return {
    agentRole: 'engineer',
    reasoning: '默认路由到工程师角色处理操作类请求',
    intentCategory: 'operation',
    multiStep: true,
  };
}

/**
 * 主路由函数 — 优先用启发式，未来可扩展为 LLM 路由
 */
export function routeToAgent(userInput: string): AgentPlan {
  return heuristicRoute(userInput);
}

// ═══════════════════════════════════════════════
// Agent 执行层：单 Agent 多步推理
// ═══════════════════════════════════════════════

const MAX_AGENT_STEPS = 4; // 最多 4 轮工具调用，防止无限循环

/**
 * 解析 LLM 响应中的工具调用
 * 兼容两种格式：
 *   1. OpenAI 标准 tool_calls 字段（由 llmService 处理）
 *   2. 文本中的 [ACTION:toolId(k=v,k=v)] 标记（fallback）
 */
function extractToolCallsFromText(text: string): LLMFunctionCall[] {
  const pattern = /\[ACTION:(\w+(?:\.\w+)*)\(([^)]*)\)\]/g;
  const calls: LLMFunctionCall[] = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const params: Record<string, unknown> = {};
    if (match[2].trim()) {
      match[2].split(',').forEach((pair) => {
        const [k, v] = pair.split('=').map((s) => s.trim());
        if (k && v) {
          const num = Number(v);
          params[k] = isNaN(num) ? v.replace(/['"]/g, '') : num;
        }
      });
    }
    calls.push({ name: match[1], arguments: params });
  }
  return calls;
}

function stripActionMarkers(text: string): string {
  return text.replace(/\[ACTION:[^\]]+\]/g, '').trim();
}

/**
 * 执行单个 Agent 的推理回合
 */
async function runAgent(ctx: AgentContext): Promise<AgentResult> {
  const { userInput, meta, callTool, recordThought, imageBase64 } = ctx;

  // 记录第一步：分析阶段
  recordThought({
    phase: 'analyzing',
    content: `${meta.avatar} ${meta.name} 接管：${meta.description}`,
  });

  const tools: LLMTool[] = getToolsForRole(meta.role).map((t) => ({
    type: 'function' as const,
    function: t.function,
  }));

  // 构建消息
  const messages: ChatMessage[] = [
    { role: 'system', content: meta.systemPrompt },
  ];

  // 多模态：用户消息可能附带图片
  if (imageBase64) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: userInput },
        { type: 'image_url', image_url: { url: imageBase64, detail: 'auto' } },
      ],
    });
  } else {
    messages.push({ role: 'user', content: userInput });
  }

  recordThought({
    phase: 'planning',
    content: `规划解决方案，可用工具 ${tools.length} 个`,
  });

  const allToolCalls: LLMFunctionCall[] = [];
  const allToolResults: string[] = [];
  let finalResponse = '';

  for (let step = 0; step < MAX_AGENT_STEPS; step++) {
    let llmResponse: string | null = null;
    try {
      llmResponse = await chatWithLLM(messages, tools);
    } catch (err) {
      recordThought({
        phase: 'observing',
        content: `LLM 调用失败：${err instanceof Error ? err.message : String(err)}`,
      });
      break;
    }

    if (!llmResponse) {
      // 无 LLM 配置时降级
      finalResponse = `${meta.avatar} ${meta.name}: 当前未配置 LLM，已使用启发式响应。请检查 .env 中的 VITE_LLM_API_KEY。`;
      break;
    }

    // 检测工具调用
    const toolCalls = extractToolCallsFromText(llmResponse);
    const cleanText = stripActionMarkers(llmResponse);

    if (toolCalls.length === 0) {
      // 无工具调用 → 终态
      finalResponse = cleanText;
      recordThought({
        phase: 'concluding',
        content: '推理完成，生成最终回复',
      });
      break;
    }

    // 执行工具调用
    for (const call of toolCalls) {
      recordThought({
        phase: 'tool_call',
        content: `调用工具 ${call.name}`,
        toolCall: call,
      });
      const result = await callTool(call.name, call.arguments);
      recordThought({
        phase: 'observing',
        content: result,
        observation: result,
      });
      allToolCalls.push(call);
      allToolResults.push(result);
    }

    // 把工具结果反馈给 LLM 继续推理
    messages.push({
      role: 'assistant',
      content: cleanText || '(执行工具)',
    });
    messages.push({
      role: 'user',
      content: `工具执行结果：\n${allToolResults.slice(-toolCalls.length).join('\n')}\n\n请基于以上结果继续回答用户的原始问题。`,
    });
  }

  // 从思考链中恢复完整 thoughts（外层会从 recordThought 累积）
  const thoughts: AgentThought[] = []; // 由外层管理

  return {
    response: finalResponse || `${meta.avatar} ${meta.name}: 已完成处理。`,
    thoughts,
    toolCalls: allToolCalls,
    toolResults: allToolResults,
    success: !!finalResponse,
    agentRole: meta.role,
  };
}

// ═══════════════════════════════════════════════
// 公共入口
// ═══════════════════════════════════════════════

export interface OrchestratorOptions {
  userInput: string;
  imageBase64?: string;
  /** 强制指定 Agent（跳过路由） */
  forceRole?: AgentRole;
  /** 思考步骤实时回调 */
  onThought?: (thought: AgentThought) => void;
  onStreamChunk?: (chunk: string, accumulated: string) => void;
}

/**
 * 主入口：路由 + 执行
 */
export async function runOrchestrator(opts: OrchestratorOptions): Promise<AgentResult> {
  const plan = opts.forceRole
    ? { agentRole: opts.forceRole, reasoning: '用户手动指定', intentCategory: 'general' as const, multiStep: true }
    : routeToAgent(opts.userInput);

  const meta = buildAgentMeta(plan.agentRole);

  const collected: AgentThought[] = [];
  const recordThought: AgentContext['recordThought'] = (t) => {
    const full: AgentThought = {
      ...t,
      id: genThoughtId(),
      timestamp: Date.now(),
    };
    collected.push(full);
    opts.onThought?.(full);
  };

  // 注入路由理由作为第一步思考
  recordThought({
    phase: 'analyzing',
    content: `路由决策：${plan.reasoning} → ${AGENT_REGISTRY[plan.agentRole].name}`,
  });

  const callTool: AgentContext['callTool'] = async (toolId, params) => {
    const result = await safeCallTool(plan.agentRole, toolId, params);
    return result.message;
  };

  const ctx: AgentContext = {
    userInput: opts.userInput,
    imageBase64: opts.imageBase64,
    meta,
    callTool,
    recordThought,
    onStreamChunk: opts.onStreamChunk,
  };

  const result = await runAgent(ctx);
  return { ...result, thoughts: collected };
}

export { AGENT_REGISTRY };
