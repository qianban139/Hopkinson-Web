// src/features/ai-assistant/services/proactiveAssistant.ts
// 主动建议系统 - 基于应用状态智能推送建议
import { useAppStore } from '@/store/useAppStore';
import { useExperimentDataBus } from '@/store/useExperimentDataBus';
import { getRecentExperiments } from './memoryService';

export interface ProactiveSuggestion {
  id: string;
  text: string;
  action?: string;      // Command to execute
  priority: 'low' | 'medium' | 'high';
  dismissable: boolean;
}

/**
 * 检查当前状态并生成上下文建议
 */
export function getProactiveSuggestions(): ProactiveSuggestion[] {
  const app = useAppStore.getState();
  const dataBus = useExperimentDataBus.getState();
  const suggestions: ProactiveSuggestion[] = [];

  // 1. 实验室页面但未选择材料
  if (app.currentPage === 'lab' && !app.selectedMaterial) {
    suggestions.push({
      id: 'select_material',
      text: '还未选择测试材料，需要我帮您推荐吗？',
      action: '帮我推荐测试材料',
      priority: 'medium',
      dismissable: true,
    });
  }

  // 2. 实验完成后提示分析
  if (dataBus.lastLabExperiment && app.currentPage === 'lab') {
    suggestions.push({
      id: 'analyze_results',
      text: `上次实验(${dataBus.lastLabExperiment.materialName})已完成，需要AI分析结果吗？`,
      action: '分析上次实验结果',
      priority: 'medium',
      dismissable: true,
    });
  }

  // 3. 安全检查未通过
  if (app.currentPage === 'lab' && !dataBus.safetyChecklistCompleted) {
    suggestions.push({
      id: 'safety_check',
      text: '安全检查尚未完成，建议先执行安全检查。',
      action: '执行安全检查',
      priority: 'high',
      dismissable: true,
    });
  }

  // 4. 温度过高警告
  if (app.monitorData.temperature > 70) {
    suggestions.push({
      id: 'temp_warning',
      text: `当前温度${app.monitorData.temperature}°C偏高，建议关注散热。`,
      priority: 'high',
      dismissable: false,
    });
  }

  // 5. AI优化完成
  if (app.aiState.step === 'complete' && app.currentPage === 'ai') {
    suggestions.push({
      id: 'optimization_done',
      text: 'AI优化已完成，查看优化结果？',
      action: '查看AI优化结果',
      priority: 'low',
      dismissable: true,
    });
  }

  // 6. 首次进入某页面的引导提示
  if (app.currentPage === 'multifield') {
    suggestions.push({
      id: 'multifield_guide',
      text: '多场耦合模块支持热-力-电磁耦合分析，需要我介绍吗？',
      action: '介绍多场耦合功能',
      priority: 'low',
      dismissable: true,
    });
  }

  // 7. 电压过高警告
  if (app.currentPage === 'lab' && app.experimentParams.voltage > 3500) {
    suggestions.push({
      id: 'high_voltage_warning',
      text: `当前电压${app.experimentParams.voltage}V较高，可能导致试样碎裂，建议适当降低。`,
      priority: 'high',
      dismissable: true,
    });
  }

  // 8. 软质/脆性材料 + 高电压诊断
  if (app.currentPage === 'lab' && app.selectedMaterial) {
    const mat = app.selectedMaterial;
    const voltage = app.experimentParams.voltage;
    const sub = mat.subcategoryLabel || '';

    if ((sub.includes('泡沫') || sub.includes('树脂')) && voltage > 2000) {
      suggestions.push({
        id: 'soft_material_voltage',
        text: `${mat.name}为软质材料，电压${voltage}V可能过高，建议1000-2000V。`,
        action: '设置电压1500V',
        priority: 'high',
        dismissable: true,
      });
    }

    if ((sub.includes('陶瓷') || sub.includes('岩')) && voltage > 3000) {
      suggestions.push({
        id: 'brittle_material_warning',
        text: `${mat.name}为脆性材料，高电压可能导致碎裂，建议2000-3000V。`,
        action: '设置电压2500V',
        priority: 'medium',
        dismissable: true,
      });
    }
  }

  // 9. EMI过高
  if (app.monitorData.emi > 80) {
    suggestions.push({
      id: 'emi_warning',
      text: `EMI水平${app.monitorData.emi}dB偏高，可能影响数据采集精度。`,
      priority: 'high',
      dismissable: false,
    });
  }

  // 10. 实验历史对比建议
  const recentExps = getRecentExperiments(1);
  if (recentExps.length > 0 && app.currentPage === 'lab' && app.selectedMaterial) {
    const lastExp = recentExps[0];
    if (lastExp.materialName === app.selectedMaterial.name) {
      suggestions.push({
        id: 'repeat_experiment',
        text: `上次用${lastExp.materialName}实验(${lastExp.voltage}V)，需要对比不同参数吗？`,
        action: `设置电压${lastExp.voltage}V`,
        priority: 'low',
        dismissable: true,
      });
    }
  }

  return suggestions;
}
