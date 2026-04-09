// src/features/ai-assistant/agent/types.ts
// Agent 系统类型定义 — Phase 2 智能助手 2.0
//
// 设计理念：
//   将 AI 助手从「单轮指令解析器」升级为「多角色 Agent 协作系统」
//   每个 Agent 拥有专属角色提示词、工具子集和决策风格
//   主控 Orchestrator 负责路由用户请求到合适的 Agent

import type { LLMFunctionCall } from '../types';

/**
 * Agent 角色枚举
 * - scientist: 材料科学家 — 专注材料力学行为分析、本构模型解读
 * - engineer:  实验工程师 — 专注参数设置、设备操作、实验执行
 * - safety:    安全员    — 专注安全检查、风险评估、阈值监控
 * - educator:  教学助理   — 专注原理讲解、引导式教学、知识图谱
 * - researcher:研究员    — 专注文献调研、对比分析、科研报告
 */
export type AgentRole = 'scientist' | 'engineer' | 'safety' | 'educator' | 'researcher';

/**
 * Agent 元信息
 */
export interface AgentMeta {
  role: AgentRole;
  /** 显示名称（中文） */
  name: string;
  /** 一句话角色描述 */
  description: string;
  /** 角色头像 emoji 或图标标识 */
  avatar: string;
  /** 主题色（用于 UI 高亮） */
  color: string;
  /** 该 Agent 可调用的工具 ID 列表（白名单） */
  allowedTools: string[];
  /** 角色专属系统提示词 */
  systemPrompt: string;
}

/**
 * Agent 思考步骤 — 用于推理链可视化
 */
export interface AgentThought {
  id: string;
  /** 推理阶段 */
  phase: 'analyzing' | 'planning' | 'tool_call' | 'observing' | 'concluding';
  /** 该步骤的内容描述 */
  content: string;
  /** 关联的工具调用（仅 tool_call 阶段） */
  toolCall?: LLMFunctionCall;
  /** 工具调用结果（仅 observing 阶段） */
  observation?: string;
  timestamp: number;
}

/**
 * Agent 执行计划 — 由 Orchestrator 路由前生成
 */
export interface AgentPlan {
  /** 选定的 Agent 角色 */
  agentRole: AgentRole;
  /** 路由理由 */
  reasoning: string;
  /** 用户意图分类 */
  intentCategory: 'analysis' | 'operation' | 'safety_check' | 'teaching' | 'research' | 'general';
  /** 是否需要多步推理（True 表示走 Agent 链路，False 走快速通道） */
  multiStep: boolean;
}

/**
 * Agent 执行结果
 */
export interface AgentResult {
  /** 最终回复文本 */
  response: string;
  /** 执行的思考步骤链 */
  thoughts: AgentThought[];
  /** 执行的工具调用 */
  toolCalls: LLMFunctionCall[];
  /** 工具调用结果 */
  toolResults: string[];
  /** 是否成功 */
  success: boolean;
  /** Agent 角色（用于 UI 展示） */
  agentRole: AgentRole;
}

/**
 * Agent 上下文 — 传给 Agent 执行函数的完整环境
 */
export interface AgentContext {
  /** 用户原始输入 */
  userInput: string;
  /** 可选：上传的图片（base64） */
  imageBase64?: string;
  /** Agent 元信息 */
  meta: AgentMeta;
  /** 工具调用器 — 由 Orchestrator 注入 */
  callTool: (toolId: string, params: Record<string, unknown>) => Promise<string>;
  /** 思考步骤记录器 — 由 Orchestrator 注入，UI 实时更新 */
  recordThought: (thought: Omit<AgentThought, 'id' | 'timestamp'>) => void;
  /** 流式输出回调 */
  onStreamChunk?: (chunk: string, accumulated: string) => void;
}
