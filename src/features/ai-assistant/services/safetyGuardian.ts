// src/features/ai-assistant/services/safetyGuardian.ts
// 安全守卫系统 — 基于物理参数的主动安全预警
// 订阅实验参数变化，在检测到危险组合时主动推送警告

import { useAppStore } from '@/store/useAppStore';
import { calcStoredEnergy, runSHPBSimulation } from '@/services/shpbPhysicsEngine';
import type { Material } from '@/types';

// ═══════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════

export type SafetyLevel = 'safe' | 'warning' | 'danger';

export interface SafetyAlert {
  id: string;
  level: SafetyLevel;
  title: string;
  message: string;
  suggestion?: string;       // 推荐修正操作
  suggestedVoltage?: number; // 推荐电压
}

// ═══════════════════════════════════════════════════════
// 安全阈值配置
// ═══════════════════════════════════════════════════════

const SAFETY_LIMITS = {
  maxVoltage: 4000,        // V
  warningVoltage: 3500,    // V
  maxCurrent: 50000,       // A
  maxEnergy: 36000,        // J (36kJ)
  warningEnergy: 30000,    // J (30kJ)
  maxTemperature: 80,      // °C
  maxEMI: 95,              // dB
};

/** 材料类别对应的安全电压上限 */
function getMaterialSafeVoltageRange(material: Material): { min: number; max: number; reason: string } {
  const jcA = material.johnsonCookParams.A;
  const sub = material.subcategoryLabel || '';
  const cat = material.subCategory;

  // 泡沫/吸能材料 — 极低强度，高电压会直接粉碎
  if (cat === 'foam' || sub.includes('泡沫')) {
    return { min: 1000, max: 2000, reason: '泡沫材料强度极低(A≤30MPa)，高电压会导致试件瞬间碎裂' };
  }

  // 高分子材料 — 低-中等强度
  if (cat === 'polymer' || sub.includes('树脂') || sub.includes('聚') || sub.includes('尼龙')) {
    return { min: 1000, max: 2500, reason: '高分子材料强度较低，过高电压可能超出测量范围' };
  }

  // 陶瓷/脆性材料 — 高强度但脆性大
  if (cat === 'ceramic' || sub.includes('陶瓷') || sub.includes('氧化')) {
    return { min: 1500, max: 3000, reason: '陶瓷材料脆性大，高应变率可能导致多段碎裂，影响数据有效性' };
  }

  // 生物材料 — 低强度、高含水率
  if (cat === 'bio' || sub.includes('骨') || sub.includes('肌腱')) {
    return { min: 1000, max: 2000, reason: '生物材料含水率高且强度低，需要低能量精确加载' };
  }

  // 岩石/混凝土 — 中等强度
  if (cat === 'rock' || cat === 'concrete') {
    return { min: 1500, max: 3500, reason: '岩石/混凝土试件需要足够应力但过高会导致碎片飞溅' };
  }

  // 金属 — 根据屈服强度分级
  if (jcA > 800) {
    // 高强度金属 (钛合金等)
    return { min: 2000, max: 4000, reason: '高强度金属需要较大的入射波幅值' };
  }
  if (jcA > 300) {
    // 中等强度金属 (碳钢等)
    return { min: 1500, max: 3500, reason: '中等强度金属适用范围较广' };
  }
  // 低强度金属 (铝合金等)
  return { min: 1000, max: 3000, reason: '低强度金属在高电压下可能过度变形' };
}

// ═══════════════════════════════════════════════════════
// 安全检查引擎
// ═══════════════════════════════════════════════════════

/**
 * 综合安全评估 — 检查当前材料+参数组合是否安全
 * @returns 活跃的安全警告列表（按严重程度排序）
 */
export function evaluateSafety(): SafetyAlert[] {
  const { selectedMaterial, experimentParams } = useAppStore.getState();
  const alerts: SafetyAlert[] = [];

  if (!selectedMaterial) return alerts;

  const { voltage } = experimentParams;
  const safeRange = getMaterialSafeVoltageRange(selectedMaterial);

  // ——— 1. 材料-电压匹配检查 ———
  if (voltage > safeRange.max) {
    const overPercent = Math.round((voltage - safeRange.max) / safeRange.max * 100);
    alerts.push({
      id: 'material_voltage_danger',
      level: voltage > safeRange.max * 1.3 ? 'danger' : 'warning',
      title: `电压超出${selectedMaterial.name}安全范围`,
      message: `当前电压 ${voltage}V 超出推荐上限 ${safeRange.max}V（+${overPercent}%）。${safeRange.reason}`,
      suggestion: `建议将电压调整至 ${safeRange.max}V 以内`,
      suggestedVoltage: safeRange.max,
    });
  }
  if (voltage < safeRange.min) {
    alerts.push({
      id: 'material_voltage_low',
      level: 'warning',
      title: `电压可能不足`,
      message: `当前电压 ${voltage}V 低于${selectedMaterial.name}的推荐下限 ${safeRange.min}V，可能无法达到有效应变率。`,
      suggestion: `建议将电压提升至 ${safeRange.min}V 以上`,
      suggestedVoltage: safeRange.min,
    });
  }

  // ——— 2. 绝对安全阈值检查 ———
  if (voltage > SAFETY_LIMITS.maxVoltage) {
    alerts.push({
      id: 'voltage_exceed',
      level: 'danger',
      title: '电压超过系统极限',
      message: `电压 ${voltage}V 超过系统安全极限 ${SAFETY_LIMITS.maxVoltage}V！可能导致电容器击穿或绝缘失效。`,
      suggestion: `立即降低电压至 ${SAFETY_LIMITS.maxVoltage}V 以下`,
      suggestedVoltage: SAFETY_LIMITS.maxVoltage,
    });
  } else if (voltage > SAFETY_LIMITS.warningVoltage) {
    alerts.push({
      id: 'voltage_warning',
      level: 'warning',
      title: '电压接近系统上限',
      message: `电压 ${voltage}V 接近系统极限 ${SAFETY_LIMITS.maxVoltage}V，请确保冷却系统和EMI屏蔽正常工作。`,
    });
  }

  // ——— 3. 储能检查 ———
  const storedEnergy = calcStoredEnergy(voltage);
  if (storedEnergy > SAFETY_LIMITS.maxEnergy) {
    alerts.push({
      id: 'energy_exceed',
      level: 'danger',
      title: '储能超过安全阈值',
      message: `当前储能 ${(storedEnergy / 1000).toFixed(1)}kJ 超过安全阈值 ${SAFETY_LIMITS.maxEnergy / 1000}kJ。请降低电压或检查电容器组状态。`,
      suggestedVoltage: Math.floor(Math.sqrt(2 * SAFETY_LIMITS.maxEnergy / 4000e-6)), // V = sqrt(2E/C)
    });
  } else if (storedEnergy > SAFETY_LIMITS.warningEnergy) {
    alerts.push({
      id: 'energy_warning',
      level: 'warning',
      title: '储能较高',
      message: `当前储能 ${(storedEnergy / 1000).toFixed(1)}kJ，接近安全阈值 ${SAFETY_LIMITS.maxEnergy / 1000}kJ。`,
    });
  }

  // ——— 4. 仿真预判 — 检查预计结果是否合理 ———
  try {
    const sim = runSHPBSimulation({ material: selectedMaterial, voltage });
    // 应变率过高
    if (sim.strainRate > 12000) {
      alerts.push({
        id: 'strain_rate_extreme',
        level: 'warning',
        title: '预计应变率过高',
        message: `仿真预测应变率约 ${sim.strainRate}/s，超过 12000/s。高应变率下一维应力波假设可能不成立，数据可靠性降低。`,
        suggestion: '建议降低电压或增大试件尺寸',
      });
    }
    // 应力远超屈服强度（可能过度变形）
    if (sim.peakStress > selectedMaterial.johnsonCookParams.A * 5) {
      alerts.push({
        id: 'over_deformation',
        level: 'warning',
        title: '预计应力过大',
        message: `预测峰值应力 ${sim.peakStress.toFixed(0)}MPa，约为屈服强度的 ${(sim.peakStress / selectedMaterial.johnsonCookParams.A).toFixed(1)} 倍。试件可能过度变形或碎裂。`,
      });
    }
  } catch {
    // 仿真失败不阻塞安全检查
  }

  // 按严重程度排序：danger > warning > safe
  alerts.sort((a, b) => {
    const order = { danger: 0, warning: 1, safe: 2 };
    return order[a.level] - order[b.level];
  });

  return alerts;
}

/**
 * 快速判断当前状态是否安全
 */
export function isCurrentStateSafe(): boolean {
  const alerts = evaluateSafety();
  return !alerts.some(a => a.level === 'danger');
}

/**
 * 获取安全摘要文本（用于AI对话上下文注入）
 */
export function getSafetySummary(): string {
  const alerts = evaluateSafety();
  if (alerts.length === 0) return '当前参数安全。';

  const dangerCount = alerts.filter(a => a.level === 'danger').length;
  const warningCount = alerts.filter(a => a.level === 'warning').length;

  let summary = `安全状态: ${dangerCount > 0 ? '⚠️ 存在危险' : '⚡ 存在警告'}`;
  summary += `（${dangerCount}项危险，${warningCount}项警告）`;

  alerts.forEach(a => {
    summary += `\n- [${a.level.toUpperCase()}] ${a.title}: ${a.message}`;
  });

  return summary;
}

// ═══════════════════════════════════════════════════════
// 状态变化监听（供组件使用）
// ═══════════════════════════════════════════════════════

type SafetyCallback = (alerts: SafetyAlert[]) => void;

let listeners: SafetyCallback[] = [];
let lastAlertIds = '';

/**
 * 注册安全警告监听器
 * @returns 取消注册的函数
 */
export function onSafetyChange(callback: SafetyCallback): () => void {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter(l => l !== callback);
  };
}

/**
 * 触发安全检查并通知监听器（当参数变化时调用）
 */
export function checkAndNotify(): void {
  const alerts = evaluateSafety();
  const currentIds = alerts.map(a => a.id).join(',');

  // 只有在警告变化时才通知（避免重复推送）
  if (currentIds !== lastAlertIds) {
    lastAlertIds = currentIds;
    listeners.forEach(cb => cb(alerts));
  }
}
