// src/features/ai-assistant/agent/index.ts
// Agent 系统统一导出

export { runOrchestrator, routeToAgent, AGENT_REGISTRY } from './agentOrchestrator';
export type { OrchestratorOptions } from './agentOrchestrator';
export { buildAgentMeta, getAllAgents } from './agents';
export {
  getToolsForRole, getToolRisk, isToolAllowedForRole, safeCallTool, getToolListSummary,
} from './toolRegistry';
export type { ToolRiskLevel } from './toolRegistry';
export type {
  AgentRole, AgentMeta, AgentThought, AgentPlan, AgentResult, AgentContext,
} from './types';
export {
  runMultiAgent,
  decomposeTask,
  shouldUseMultiAgent,
} from './multiAgentCoordinator';
export type {
  MultiAgentPlan,
  MultiAgentResult,
  MultiAgentOptions,
  SubTask,
  SubTaskResult,
} from './multiAgentCoordinator';
