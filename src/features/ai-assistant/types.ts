// src/features/ai-assistant/types.ts
// AI中央控制系统类型定义

export type AIActionCategory = 'navigation' | 'parameter' | 'experiment' | 'analysis' | 'monitor' | 'multifield' | 'ai' | 'autonomous' | 'general';

export interface AIActionResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface AIAction {
  id: string;
  category: AIActionCategory;
  name: string;
  description: string;
  targetPage?: string;
  parameters: AIActionParameter[];
  execute: (params: Record<string, unknown>) => Promise<AIActionResult>;
  validate?: (params: Record<string, unknown>) => ValidationResult;
}

export interface AIActionParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  description: string;
  required: boolean;
  options?: string[];
  range?: [number, number];
}

// AI操作队列项
export type AIOperationStatus = 'pending' | 'executing' | 'complete' | 'error';

export interface AIOperation {
  id: string;
  actionId: string;
  actionName: string;
  params: Record<string, unknown>;
  status: AIOperationStatus;
  message?: string;
  timestamp: number;
  duration?: number;
}

// LLM Function Calling 格式
export interface LLMFunctionCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, {
        type: string;
        description: string;
        enum?: string[];
        minimum?: number;
        maximum?: number;
      }>;
      required: string[];
    };
  };
}

// 对话消息
export interface AIConversationMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: LLMFunctionCall[];
  toolCallId?: string;
  timestamp: number;
}

// AI助手状态
export type OrbState = 'idle' | 'listening' | 'thinking' | 'executing' | 'speaking' | 'error';

// 高亮指示
export interface AIHighlightTarget {
  targetId: string;
  label: string;
  duration: number;
}
