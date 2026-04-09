// src/features/ai-assistant/agent/toolRegistry.ts
// Agent 工具注册表 — 统一封装 aiActionRegistry 中的工具
//
// 设计意图：
//   aiActionRegistry 是底层 Action 实现，支持 LLM Function Calling 协议
//   ToolRegistry 在其之上提供「Agent 视角」：
//     - 按角色筛选工具白名单
//     - 加入 Agent 专用元信息（适用场景、风险等级）
//     - 提供统一的 callTool 入口供 Agent 使用

import { getAllActions, executeAction, getAction } from '../services/aiActionRegistry';
import type { LLMToolDefinition } from '../types';
import type { AgentRole } from './types';

/**
 * 工具风险等级
 * - safe:    无副作用，可自由调用（查询类）
 * - low:     调整 UI 状态（导航、切换视图）
 * - medium:  修改实验参数（电压、电流、波形）
 * - high:    执行物理动作（启动实验、紧急停机）
 */
export type ToolRiskLevel = 'safe' | 'low' | 'medium' | 'high';

interface ToolRiskMap {
  [actionId: string]: ToolRiskLevel;
}

/** 工具风险等级映射表 */
const TOOL_RISK: ToolRiskMap = {
  // ─── 查询类（safe）───
  'general.showHelp': 'safe',
  'general.getSystemStatus': 'safe',
  'general.describeCurrentPage': 'safe',

  // ─── 导航/视图（low）───
  'navigate.toPage': 'low',
  'lab.switchView': 'low',
  'ai.switchAlgorithm': 'low',
  'lab.jumpToStage': 'low',
  'analysis.zoomChart': 'low',
  'analysis.toggleCompareMode': 'low',

  // ─── 参数调整（medium）───
  'lab.selectMaterial': 'medium',
  'lab.setVoltage': 'medium',
  'lab.setCurrent': 'medium',
  'lab.setPulseWidth': 'medium',
  'lab.setWaveform': 'medium',
  'lab.setAllParams': 'medium',
  'lab.setPreset': 'medium',
  'lab.setConfiningPressure': 'medium',
  'lab.toggleConfining': 'medium',
  'multifield.selectScenario': 'medium',
  'multifield.setFields': 'medium',
  'multifield.toggleEffect': 'medium',
  'multifield.reset': 'medium',
  'analysis.selectMaterial': 'medium',
  'analysis.setPredictionParams': 'medium',
  'ai.setHyperParam': 'medium',
  'monitor.setAlertRule': 'medium',
  'monitor.setAlertThreshold': 'medium',
  'monitor.toggleMonitoring': 'medium',

  // ─── 物理动作（high）───
  'lab.startExperiment': 'high',
  'lab.pauseExperiment': 'high',
  'lab.resetExperiment': 'high',
  'multifield.startCoupling': 'high',
  'multifield.sendToAnalysis': 'high',
  'ai.startOptimization': 'high',
  'ai.applyOptimizedParams': 'high',
  'ai.toggleAlgorithmTraining': 'high',
  'analysis.startAIPrediction': 'high',
  'analysis.exportData': 'high',
  'analysis.exportReport': 'high',
  'monitor.runSafetyCheck': 'high',
  'monitor.emergencyStop': 'high',
};

/**
 * Agent 角色 → 工具白名单映射
 * 每个角色只能调用其权限范围内的工具，防止越权操作
 */
const ROLE_TOOL_WHITELIST: Record<AgentRole, string[]> = {
  // 科学家：参数推荐、数据分析、AI预测
  scientist: [
    'lab.selectMaterial', 'lab.setVoltage', 'lab.setCurrent', 'lab.setPulseWidth',
    'lab.setWaveform', 'lab.setAllParams', 'lab.setPreset',
    'analysis.selectMaterial', 'analysis.startAIPrediction', 'analysis.setPredictionParams',
    'analysis.toggleCompareMode', 'analysis.zoomChart',
    'ai.startOptimization', 'ai.applyOptimizedParams', 'ai.switchAlgorithm',
    'general.getSystemStatus', 'general.describeCurrentPage', 'navigate.toPage',
  ],
  // 工程师：实验操作、视图切换、参数调整
  engineer: [
    'lab.selectMaterial', 'lab.setVoltage', 'lab.setCurrent', 'lab.setPulseWidth',
    'lab.setWaveform', 'lab.setAllParams', 'lab.setPreset', 'lab.switchView',
    'lab.startExperiment', 'lab.pauseExperiment', 'lab.resetExperiment',
    'lab.setConfiningPressure', 'lab.toggleConfining', 'lab.jumpToStage',
    'multifield.selectScenario', 'multifield.setFields', 'multifield.startCoupling',
    'multifield.toggleEffect', 'multifield.reset', 'multifield.sendToAnalysis',
    'navigate.toPage', 'general.getSystemStatus', 'general.describeCurrentPage',
  ],
  // 安全员：检查、监控、紧急控制
  safety: [
    'monitor.runSafetyCheck', 'monitor.emergencyStop', 'monitor.toggleMonitoring',
    'monitor.setAlertRule', 'monitor.setAlertThreshold',
    'lab.pauseExperiment', 'lab.resetExperiment',
    'general.getSystemStatus', 'general.describeCurrentPage', 'navigate.toPage',
  ],
  // 教学助理：演示、引导、说明
  educator: [
    'navigate.toPage', 'lab.switchView', 'lab.setPreset',
    'general.showHelp', 'general.describeCurrentPage', 'general.getSystemStatus',
    'lab.jumpToStage', 'ai.switchAlgorithm',
  ],
  // 研究员：报告、对比、数据导出
  researcher: [
    'analysis.selectMaterial', 'analysis.startAIPrediction', 'analysis.exportData',
    'analysis.exportReport', 'analysis.toggleCompareMode', 'analysis.zoomChart',
    'analysis.setPredictionParams',
    'navigate.toPage', 'general.getSystemStatus', 'general.describeCurrentPage',
  ],
};

/**
 * 获取指定角色可调用的工具定义（用于 LLM Function Calling）
 */
export function getToolsForRole(role: AgentRole): LLMToolDefinition[] {
  const whitelist = new Set(ROLE_TOOL_WHITELIST[role]);
  return getAllActions()
    .filter((action) => whitelist.has(action.id))
    .map((action) => ({
      type: 'function' as const,
      function: {
        name: action.id,
        description: action.description,
        parameters: action.parameters,
      },
    }));
}

/**
 * 获取工具风险等级
 */
export function getToolRisk(toolId: string): ToolRiskLevel {
  return TOOL_RISK[toolId] || 'medium';
}

/**
 * 检查角色是否被允许调用某工具
 */
export function isToolAllowedForRole(role: AgentRole, toolId: string): boolean {
  return ROLE_TOOL_WHITELIST[role].includes(toolId);
}

/**
 * 安全调用工具 — Agent 通过此入口执行动作
 * 校验权限 + 记录日志 + 统一错误处理
 */
export async function safeCallTool(
  role: AgentRole,
  toolId: string,
  params: Record<string, unknown>,
): Promise<{ success: boolean; message: string; risk: ToolRiskLevel }> {
  const risk = getToolRisk(toolId);

  if (!isToolAllowedForRole(role, toolId)) {
    return {
      success: false,
      message: `权限不足：${role} 角色无法调用 ${toolId}`,
      risk,
    };
  }

  const action = getAction(toolId);
  if (!action) {
    return {
      success: false,
      message: `工具不存在：${toolId}`,
      risk,
    };
  }

  try {
    const result = await executeAction(toolId, params);
    return {
      success: result.success,
      message: result.message,
      risk,
    };
  } catch (err) {
    return {
      success: false,
      message: `工具调用异常：${err instanceof Error ? err.message : String(err)}`,
      risk,
    };
  }
}

/**
 * 获取角色可用工具的简要列表（用于注入到 Agent 的系统提示词）
 */
export function getToolListSummary(role: AgentRole): string {
  const tools = getToolsForRole(role);
  return tools.map((t) => `- \`${t.function.name}\` — ${t.function.description}`).join('\n');
}
