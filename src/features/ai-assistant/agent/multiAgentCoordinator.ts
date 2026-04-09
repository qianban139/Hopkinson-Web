// src/features/ai-assistant/agent/multiAgentCoordinator.ts
// 多 Agent 协作框架 — Phase 5 智能助手 v1.0
//
// 在 Phase 2 单 Agent 编排器之上，构建多角色协同：
//   1. 任务分解：将复杂用户问题拆为多个子任务
//   2. 并行调度：将子任务分配给不同 Agent 并行执行
//   3. 结果汇总：综合各 Agent 的输出生成最终回复
//
// 设计理念：
//   - 单 Agent 适合明确意图的请求 → 走 runOrchestrator
//   - 多 Agent 适合跨领域复杂请求 → 走 runMultiAgent
//   - 由路由层判断意图复杂度（关键词触发或显式开启）

import { runOrchestrator } from './agentOrchestrator';
import { AGENT_REGISTRY } from './agents';
import type { AgentRole, AgentThought, AgentResult } from './types';

/* ============================================================
 * 类型定义
 * ============================================================ */

export interface SubTask {
  id: string;
  /** 子任务描述 */
  description: string;
  /** 分配的 Agent 角色 */
  assignedRole: AgentRole;
  /** 优先级（数字越小越先执行） */
  priority: number;
}

export interface MultiAgentPlan {
  /** 用户原始问题 */
  originalQuery: string;
  /** 拆分后的子任务 */
  subTasks: SubTask[];
  /** 拆分理由 */
  reasoning: string;
}

export interface SubTaskResult {
  subTask: SubTask;
  result: AgentResult;
  durationMs: number;
}

export interface MultiAgentResult {
  /** 最终汇总的回复 */
  response: string;
  /** 所有子任务结果 */
  subTaskResults: SubTaskResult[];
  /** 完整的思考链 */
  allThoughts: AgentThought[];
  /** 总耗时 */
  totalDurationMs: number;
  /** 是否所有子任务都成功 */
  success: boolean;
}

/* ============================================================
 * 任务分解：启发式规则
 * ============================================================ */

/**
 * 判断用户输入是否需要多 Agent 协作
 *
 * 触发条件：
 *   - 包含 2+ 个不同领域关键词
 *   - 明确包含"对比"、"综合"、"全面"、"完整"等多维度词
 *   - 显式包含 "多 Agent" / "多角色" / "协作"
 */
export function shouldUseMultiAgent(userInput: string): boolean {
  const text = userInput.toLowerCase();

  // 显式触发词
  if (/多\s*agent|多角色|协作|分工|多人|团队/.test(text)) return true;

  // 综合性词汇 + 跨领域词汇
  const综合 = /综合|全面|完整|系统|整体|多维|对比|横向/.test(text);

  let domainCount = 0;
  if (/安全|危险|过载|阈值|风险/.test(text)) domainCount++;
  if (/原理|讲解|教学|解释/.test(text)) domainCount++;
  if (/分析|预测|拟合|本构|应力|应变/.test(text)) domainCount++;
  if (/操作|设置|参数|执行|实验/.test(text)) domainCount++;
  if (/报告|论文|对比|文献|引用/.test(text)) domainCount++;

  return (综合 && domainCount >= 1) || domainCount >= 3;
}

/**
 * 启发式任务分解
 *
 * 根据用户问题中出现的领域关键词，生成对应的子任务，
 * 每个子任务交给最匹配的 Agent
 */
export function decomposeTask(userInput: string): MultiAgentPlan {
  const text = userInput.toLowerCase();
  const subTasks: SubTask[] = [];
  let priority = 0;

  // 优先级：先安全 → 教学 → 分析 → 操作 → 研究汇总
  if (/安全|危险|过载|过热|紧急|阈值|告警|风险/.test(text)) {
    subTasks.push({
      id: `task_safety_${Date.now()}`,
      description: `从安全角度评估：${userInput}`,
      assignedRole: 'safety',
      priority: priority++,
    });
  }

  if (/原理|讲解|教学|解释|为什么|新手|入门|介绍/.test(text)) {
    subTasks.push({
      id: `task_edu_${Date.now()}`,
      description: `从教学角度讲解：${userInput}`,
      assignedRole: 'educator',
      priority: priority++,
    });
  }

  if (/分析|预测|拟合|j-?c|本构|材料|应力|应变|微观/.test(text)) {
    subTasks.push({
      id: `task_sci_${Date.now()}`,
      description: `从材料科学角度分析：${userInput}`,
      assignedRole: 'scientist',
      priority: priority++,
    });
  }

  if (/操作|设置|参数|执行|配置|启动/.test(text)) {
    subTasks.push({
      id: `task_eng_${Date.now()}`,
      description: `从实验工程角度规划：${userInput}`,
      assignedRole: 'engineer',
      priority: priority++,
    });
  }

  if (/报告|论文|文献|引用|总结|对比/.test(text)) {
    subTasks.push({
      id: `task_res_${Date.now()}`,
      description: `从研究角度汇总：${userInput}`,
      assignedRole: 'researcher',
      priority: priority++,
    });
  }

  // 默认补充：如果一个领域都没匹配到，至少派一个 scientist + engineer
  if (subTasks.length === 0) {
    subTasks.push(
      {
        id: `task_sci_${Date.now()}`,
        description: `分析问题：${userInput}`,
        assignedRole: 'scientist',
        priority: 0,
      },
      {
        id: `task_eng_${Date.now() + 1}`,
        description: `规划执行方案：${userInput}`,
        assignedRole: 'engineer',
        priority: 1,
      },
    );
  }

  // 限制最多 3 个子任务，避免请求过多
  const limited = subTasks.slice(0, 3);

  return {
    originalQuery: userInput,
    subTasks: limited,
    reasoning: `识别到 ${limited.length} 个相关领域：${limited.map((t) => AGENT_REGISTRY[t.assignedRole].name).join('、')}`,
  };
}

/* ============================================================
 * 并行执行
 * ============================================================ */

export interface MultiAgentOptions {
  userInput: string;
  imageBase64?: string;
  /** 思考步骤回调（合并所有 Agent 的思考） */
  onThought?: (thought: AgentThought, agentRole: AgentRole) => void;
  /** 子任务进度回调 */
  onSubTaskComplete?: (result: SubTaskResult) => void;
}

/**
 * 主入口：多 Agent 协作执行
 */
export async function runMultiAgent(opts: MultiAgentOptions): Promise<MultiAgentResult> {
  const t0 = performance.now();
  const plan = decomposeTask(opts.userInput);
  const allThoughts: AgentThought[] = [];

  // 并行执行所有子任务
  const promises = plan.subTasks.map(async (task): Promise<SubTaskResult> => {
    const taskStart = performance.now();
    const result = await runOrchestrator({
      userInput: task.description,
      imageBase64: opts.imageBase64,
      forceRole: task.assignedRole,
      onThought: (thought) => {
        allThoughts.push(thought);
        opts.onThought?.(thought, task.assignedRole);
      },
    });

    const subTaskResult: SubTaskResult = {
      subTask: task,
      result,
      durationMs: performance.now() - taskStart,
    };
    opts.onSubTaskComplete?.(subTaskResult);
    return subTaskResult;
  });

  const subTaskResults = await Promise.all(promises);

  // 汇总所有 Agent 的回复
  const response = synthesizeResponse(plan, subTaskResults);

  return {
    response,
    subTaskResults,
    allThoughts,
    totalDurationMs: performance.now() - t0,
    success: subTaskResults.every((r) => r.result.success),
  };
}

/* ============================================================
 * 结果汇总：把多个 Agent 的回复合并成结构化文档
 * ============================================================ */

function synthesizeResponse(
  plan: MultiAgentPlan,
  results: SubTaskResult[],
): string {
  const lines: string[] = [];
  lines.push(`## 🤝 多 Agent 协作回复`);
  lines.push('');
  lines.push(`**协作策略**：${plan.reasoning}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const r of results) {
    const meta = AGENT_REGISTRY[r.subTask.assignedRole];
    lines.push(`### ${meta.avatar} ${meta.name}的视角`);
    lines.push('');
    lines.push(r.result.response || '_(无回复)_');
    lines.push('');
    if (r.result.toolCalls.length > 0) {
      lines.push(`> 调用了 ${r.result.toolCalls.length} 个工具，耗时 ${r.durationMs.toFixed(0)} ms`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(`**总耗时**：${results.reduce((s, r) => s + r.durationMs, 0).toFixed(0)} ms · **参与 Agent**：${results.length} 个`);

  return lines.join('\n');
}
