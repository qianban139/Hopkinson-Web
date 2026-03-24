// src/features/ai-assistant/services/aiConversationManager.ts
// AI多轮对话管理器 - 维护上下文、注入状态、管理历史
import { useAppStore } from '@/store/useAppStore';
import { useExperimentDataBus } from '@/store/useExperimentDataBus';
import { useExperimentWorkflow } from '@/store/experimentWorkflow';
import { buildFunctionCallingSystemPrompt } from './aiIntentParser';
import type { AIConversationMessage } from '../types';

const MAX_HISTORY_ROUNDS = 12;

class ConversationManager {
  private messages: AIConversationMessage[] = [];

  /**
   * 获取当前应用状态摘要（注入到系统提示中）
   */
  private getAppStateContext(): string {
    const app = useAppStore.getState();
    const dataBus = useExperimentDataBus.getState();
    const workflow = useExperimentWorkflow.getState();

    const material = app.selectedMaterial;
    const params = app.experimentParams;
    const monitor = app.monitorData;
    const safetyDone = dataBus.safetyChecklistCompleted;

    return `
当前系统状态:
- 当前页面: ${app.currentPage}
- 选中材料: ${material ? `${material.name} (${material.subcategoryLabel})` : '未选择'}
- 实验参数: 电压${params.voltage}V, 电流${(params.current / 1000).toFixed(1)}kA, 脉宽${params.pulseWidth}μs, 波形${params.waveform}
- 安全检查: ${safetyDone ? '已通过' : '未完成'}
- 实验状态: ${workflow.phase}
- 监控数据: 电压${monitor.voltage}V, 温度${monitor.temperature}°C, EMI ${monitor.emi}dB
- AI优化: ${app.aiState.isOptimizing ? `进行中(${app.aiState.step}, ${app.aiState.progress}%)` : app.aiState.step === 'complete' ? '已完成' : '未启动'}
${dataBus.lastLabExperiment ? `- 上次实验: ${dataBus.lastLabExperiment.materialName}, 峰值应力${dataBus.lastLabExperiment.peakStress}MPa` : '- 上次实验: 无'}`;
  }

  /**
   * 构建完整的系统提示（基础提示 + 当前状态）
   */
  getSystemPrompt(): string {
    return buildFunctionCallingSystemPrompt() + '\n\n' + this.getAppStateContext();
  }

  /**
   * 添加用户消息
   */
  addUserMessage(content: string): void {
    this.messages.push({
      role: 'user',
      content,
      timestamp: Date.now(),
    });
    this.trimHistory();
  }

  /**
   * 添加助手消息
   */
  addAssistantMessage(content: string, toolCalls?: AIConversationMessage['toolCalls']): void {
    this.messages.push({
      role: 'assistant',
      content,
      toolCalls,
      timestamp: Date.now(),
    });
    this.trimHistory();
  }

  /**
   * 添加工具结果消息
   */
  addToolResult(toolCallId: string, content: string): void {
    this.messages.push({
      role: 'tool',
      content,
      toolCallId,
      timestamp: Date.now(),
    });
  }

  /**
   * 获取用于LLM调用的消息历史
   */
  getMessagesForLLM(): Array<{ role: string; content: string }> {
    return [
      { role: 'system', content: this.getSystemPrompt() },
      ...this.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];
  }

  /**
   * 获取所有消息（用于UI展示）
   */
  getAllMessages(): AIConversationMessage[] {
    return [...this.messages];
  }

  /**
   * 清空历史
   */
  clear(): void {
    this.messages = [];
  }

  /**
   * 裁剪历史到最近N轮
   */
  private trimHistory(): void {
    // 计算轮数（一轮 = user + assistant）
    let rounds = 0;
    let cutIndex = 0;
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].role === 'user') {
        rounds++;
        if (rounds > MAX_HISTORY_ROUNDS) {
          cutIndex = i;
          break;
        }
      }
    }
    if (cutIndex > 0) {
      this.messages = this.messages.slice(cutIndex);
    }
  }
}

// 单例
export const conversationManager = new ConversationManager();
