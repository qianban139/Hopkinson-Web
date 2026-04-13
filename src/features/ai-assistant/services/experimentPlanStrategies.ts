// src/features/ai-assistant/services/experimentPlanStrategies.ts
// 规则化实验计划策略 — 将用户研究目标分解为具体实验序列
import type { PlannedExperiment, PlanStrategy, ExperimentPlan } from '@/types';
import type { Material } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { calcStoredEnergy } from '@/services/shpbPhysicsEngine';

// ═══════════════════════════════════════════════
// 策略意图识别
// ═══════════════════════════════════════════════

interface StrategyMatch {
  strategy: PlanStrategy;
  confidence: number;
  extractedInfo: {
    materialNames?: string[];
    materialId?: string;
    targetStrainRates?: number[];
    targetTemperatures?: number[];
  };
}

/** 从用户输入中识别实验策略 */
export function detectStrategy(input: string, materials: Material[]): StrategyMatch | null {
  // 应变率扫描
  if (/不同应变率|应变率效应|率效应|应变率.*变化|应变率.*影响/.test(input)) {
    const materialMatch = findMaterialInInput(input, materials);
    return {
      strategy: 'strain_rate_sweep',
      confidence: 0.9,
      extractedInfo: {
        materialId: materialMatch?.id,
        materialNames: materialMatch ? [materialMatch.name] : undefined,
      },
    };
  }

  // 温度扫描
  if (/不同温度|温度效应|热效应|温度.*影响|高温.*性能|温度.*变化/.test(input)) {
    const materialMatch = findMaterialInInput(input, materials);
    return {
      strategy: 'temperature_sweep',
      confidence: 0.9,
      extractedInfo: {
        materialId: materialMatch?.id,
        materialNames: materialMatch ? [materialMatch.name] : undefined,
      },
    };
  }

  // 材料对比
  if (/对比|比较|哪种.*好|哪个.*强|材料.*选择/.test(input)) {
    const matchedMaterials = findMultipleMaterialsInInput(input, materials);
    if (matchedMaterials.length >= 2) {
      return {
        strategy: 'material_comparison',
        confidence: 0.85,
        extractedInfo: {
          materialNames: matchedMaterials.map(m => m.name),
        },
      };
    }
    // 如果只提到了类别，选择该类别的代表材料
    const category = detectCategory(input);
    if (category) {
      const categoryMaterials = materials.filter(m => m.category === category).slice(0, 4);
      return {
        strategy: 'material_comparison',
        confidence: 0.7,
        extractedInfo: {
          materialNames: categoryMaterials.map(m => m.name),
        },
      };
    }
  }

  // 参数优化
  if (/最佳|最优|优化|最好|最合适|寻找.*参数/.test(input)) {
    const materialMatch = findMaterialInInput(input, materials);
    return {
      strategy: 'parameter_optimization',
      confidence: 0.8,
      extractedInfo: {
        materialId: materialMatch?.id,
        materialNames: materialMatch ? [materialMatch.name] : undefined,
      },
    };
  }

  return null;
}

// ═══════════════════════════════════════════════
// 辅助函数：材料名称匹配
// ═══════════════════════════════════════════════

function findMaterialInInput(input: string, materials: Material[]): Material | null {
  // 优先精确匹配
  for (const m of materials) {
    if (input.includes(m.name)) return m;
  }
  // 模糊匹配常见缩写
  const aliases: Record<string, string> = {
    'Q235': 'Q235',
    'q235': 'Q235',
    '铝合金': '铝合金',
    '5A06': '5A06',
    'TC4': 'TC4',
    '钛合金': 'TC4',
    '45钢': '45#',
    '45号钢': '45#',
    '花岗岩': '花岗岩',
    '砂岩': '砂岩',
    '红砂岩': '红砂岩',
    '紫铜': '紫铜',
    'T2': 'T2',
    '7075': '7075',
  };
  for (const [alias, keyword] of Object.entries(aliases)) {
    if (input.includes(alias)) {
      const found = materials.find(m => m.name.includes(keyword));
      if (found) return found;
    }
  }
  // 如果什么都没找到，尝试使用已选材料
  const selectedMaterial = useAppStore.getState().selectedMaterial;
  if (selectedMaterial) return selectedMaterial;
  return null;
}

function findMultipleMaterialsInInput(input: string, materials: Material[]): Material[] {
  const found: Material[] = [];
  for (const m of materials) {
    if (input.includes(m.name)) found.push(m);
  }
  // 也检查"和"/"与"/"跟"连接的材料
  if (found.length < 2) {
    const segments = input.split(/[和与跟,，]/);
    for (const seg of segments) {
      const trimmed = seg.trim();
      const match = materials.find(m => trimmed.includes(m.name) || m.name.includes(trimmed));
      if (match && !found.includes(match)) found.push(match);
    }
  }
  return found;
}

function detectCategory(input: string): string | null {
  if (/金属|钢|铝|铜|钛/.test(input)) return '金属';
  if (/岩石|矿石|砂岩|花岗岩/.test(input)) return '矿石';
  if (/混凝土/.test(input)) return '混凝土';
  if (/陶瓷/.test(input)) return '陶瓷';
  if (/高分子|聚合物|塑料|橡胶/.test(input)) return '高分子材料';
  return null;
}

// ═══════════════════════════════════════════════
// 计划生成策略
// ═══════════════════════════════════════════════

/** 根据电压估算电流 */
function estimateCurrent(voltage: number): number {
  return Math.min(50000, Math.round(15000 + (voltage / 4000) * 35000));
}

/** 根据电压估算脉宽 */
function estimatePulseWidth(voltage: number): number {
  // 高电压对应短脉宽
  return Math.round(800 - (voltage / 4000) * 400);
}

/** 安全阈值检查：储能不超 36kJ */
function clampVoltage(voltage: number): number {
  const energy = calcStoredEnergy(voltage);
  if (energy / 1000 > 36) {
    // 反推最大安全电压
    return Math.floor(Math.sqrt(2 * 36000 / 0.004));  // E = 0.5*C*V^2, C=4000μF
  }
  return Math.min(4000, Math.max(1000, voltage));
}

/** 创建单个实验条目 */
function createExperiment(
  index: number,
  material: Material,
  voltage: number,
  temperature: number,
  confinementPressure: number,
  rationale: string,
): PlannedExperiment {
  const safeVoltage = clampVoltage(voltage);
  return {
    id: `auto-exp-${Date.now()}-${index}`,
    index,
    materialId: material.id,
    materialName: material.name,
    voltage: safeVoltage,
    current: estimateCurrent(safeVoltage),
    pulseWidth: estimatePulseWidth(safeVoltage),
    temperature,
    confinementPressure,
    rationale,
    status: 'pending',
    result: null,
    safetyStatus: 'unchecked',
    startedAt: null,
    completedAt: null,
  };
}

// ═══════════════════════════════════════════════
// 四种策略实现
// ═══════════════════════════════════════════════

/** 策略1：应变率扫描 — 固定材料，5个不同电压（对应不同应变率） */
export function generateStrainRateSweep(
  material: Material,
  goal: string,
): ExperimentPlan {
  const voltages = [1500, 2000, 2500, 3000, 3500];
  const labels = ['低应变率', '中低应变率', '中等应变率', '中高应变率', '高应变率'];

  const experiments = voltages.map((v, i) =>
    createExperiment(i, material, v, 25, 0,
      `${labels[i]}测试：电压${v}V，预期获得不同应变率下的力学响应`)
  );

  return {
    id: `plan-${Date.now()}`,
    goal,
    strategy: 'strain_rate_sweep',
    rationale: `对 ${material.name} 进行应变率扫描实验，通过改变驱动电压(1500-3500V)获得不同应变率下的动态力学响应，验证 J-C 本构模型中应变率敏感系数 C=${material.johnsonCookParams.C} 的效果`,
    experiments,
    createdAt: Date.now(),
  };
}

/** 策略2：温度扫描 — 固定材料和电压，5个不同温度 */
export function generateTemperatureSweep(
  material: Material,
  goal: string,
): ExperimentPlan {
  const meltingTemp = material.johnsonCookParams.Tm;
  // 从室温到 0.6*Tm（不超过安全阈值 80°C 系统温度对应的试件温度）
  const maxTestTemp = Math.min(meltingTemp * 0.6, 800);
  const step = (maxTestTemp - 25) / 4;
  const temperatures = Array.from({ length: 5 }, (_, i) => Math.round(25 + step * i));
  const voltage = 2500; // 中等电压

  const experiments = temperatures.map((t, i) =>
    createExperiment(i, material, voltage, t, 0,
      `温度 ${t}°C 测试：观察热软化效应对 ${material.name} 动态强度的影响`)
  );

  return {
    id: `plan-${Date.now()}`,
    goal,
    strategy: 'temperature_sweep',
    rationale: `对 ${material.name} 进行温度扫描实验(${temperatures[0]}-${temperatures[temperatures.length - 1]}°C)，研究 J-C 模型中热软化指数 m=${material.johnsonCookParams.m} 的效果，熔点 Tm=${meltingTemp}°C`,
    experiments,
    createdAt: Date.now(),
  };
}

/** 策略3：材料对比 — 同参数，不同材料 */
export function generateMaterialComparison(
  materials: Material[],
  goal: string,
): ExperimentPlan {
  const voltage = 2500;
  const experiments = materials.map((m, i) =>
    createExperiment(i, m, voltage, 25, 0,
      `${m.name} 标准冲击测试：与其他材料在相同条件下对比动态力学性能`)
  );

  return {
    id: `plan-${Date.now()}`,
    goal,
    strategy: 'material_comparison',
    rationale: `在相同实验条件(电压${voltage}V, 室温)下对比 ${materials.map(m => m.name).join('、')} 的动态力学性能差异`,
    experiments,
    createdAt: Date.now(),
  };
}

/** 策略4：参数优化 — 粗扫描 + 细化 */
export function generateParameterOptimization(
  material: Material,
  goal: string,
): ExperimentPlan {
  // 第一阶段：3点粗扫描
  const coarseVoltages = [1500, 2500, 3500];
  const experiments = coarseVoltages.map((v, i) =>
    createExperiment(i, material, v, 25, 0,
      `粗扫描 #${i + 1}：电压${v}V，确定最佳参数区间`)
  );

  return {
    id: `plan-${Date.now()}`,
    goal,
    strategy: 'parameter_optimization',
    rationale: `对 ${material.name} 进行参数优化实验。第一阶段进行粗扫描(1500/2500/3500V)确定最佳区间，后续根据结果自动细化搜索`,
    experiments,
    createdAt: Date.now(),
  };
}

// ═══════════════════════════════════════════════
// 主入口：生成计划
// ═══════════════════════════════════════════════

/**
 * 基于用户输入和策略匹配结果生成实验计划
 * @returns 生成的计划，如果策略不匹配则返回 null
 */
export function generatePlanFromStrategy(
  match: StrategyMatch,
  goal: string,
  allMaterials: Material[],
): ExperimentPlan | null {
  const { strategy, extractedInfo } = match;

  switch (strategy) {
    case 'strain_rate_sweep': {
      const material = extractedInfo.materialId
        ? allMaterials.find(m => m.id === extractedInfo.materialId)
        : allMaterials.find(m => extractedInfo.materialNames?.[0] && m.name.includes(extractedInfo.materialNames[0]));
      if (!material) return null;
      return generateStrainRateSweep(material, goal);
    }

    case 'temperature_sweep': {
      const material = extractedInfo.materialId
        ? allMaterials.find(m => m.id === extractedInfo.materialId)
        : allMaterials.find(m => extractedInfo.materialNames?.[0] && m.name.includes(extractedInfo.materialNames[0]));
      if (!material) return null;
      return generateTemperatureSweep(material, goal);
    }

    case 'material_comparison': {
      const materials = (extractedInfo.materialNames || [])
        .map(name => allMaterials.find(m => m.name.includes(name)))
        .filter((m): m is Material => m !== undefined);
      if (materials.length < 2) return null;
      return generateMaterialComparison(materials, goal);
    }

    case 'parameter_optimization': {
      const material = extractedInfo.materialId
        ? allMaterials.find(m => m.id === extractedInfo.materialId)
        : allMaterials.find(m => extractedInfo.materialNames?.[0] && m.name.includes(extractedInfo.materialNames[0]));
      if (!material) return null;
      return generateParameterOptimization(material, goal);
    }

    default:
      return null;
  }
}

// ═══════════════════════════════════════════════
// 中间分析：规则化
// ═══════════════════════════════════════════════

/** 分析应变率扫描结果 */
export function analyzeStrainRateSweep(experiments: PlannedExperiment[]): IntermediateAnalysis {
  const completed = experiments.filter(e => e.status === 'complete' && e.result);
  const sorted = [...completed].sort((a, b) => a.voltage - b.voltage);

  let isMonotonic = true;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].result!.peakStress < sorted[i - 1].result!.peakStress * 0.95) {
      isMonotonic = false;
      break;
    }
  }

  const maxStress = Math.max(...completed.map(e => e.result!.peakStress));
  const minStress = Math.min(...completed.map(e => e.result!.peakStress));
  const sensitivityPercent = ((maxStress - minStress) / minStress * 100).toFixed(1);

  return {
    afterExperimentIndex: completed[completed.length - 1].index,
    observation: isMonotonic
      ? `应力随应变率单调递增，应变率敏感性约 ${sensitivityPercent}%，符合 J-C 模型预期`
      : `检测到非单调行为：高应变率区域应力出现下降，可能存在热软化与应变率强化的竞争效应`,
    decision: 'continue',
    reasoning: isMonotonic
      ? '数据趋势合理，按计划继续执行'
      : '虽有异常但不影响后续实验，建议完成后进一步分析',
  };
}

/** 分析温度扫描结果 */
export function analyzeTemperatureSweep(experiments: PlannedExperiment[]): IntermediateAnalysis {
  const completed = experiments.filter(e => e.status === 'complete' && e.result);
  const sorted = [...completed].sort((a, b) => a.temperature - b.temperature);

  const hasSoftening = sorted.length >= 2 &&
    sorted[sorted.length - 1].result!.peakStress < sorted[0].result!.peakStress * 0.9;

  const reductionPercent = sorted.length >= 2
    ? ((sorted[0].result!.peakStress - sorted[sorted.length - 1].result!.peakStress) / sorted[0].result!.peakStress * 100).toFixed(1)
    : '0';

  return {
    afterExperimentIndex: completed[completed.length - 1].index,
    observation: hasSoftening
      ? `明显热软化效应：最高温度下强度下降约 ${reductionPercent}%，与 J-C 热软化模型一致`
      : `温度范围内未观察到显著热软化（强度变化 < 10%），可能需要更高温度或更敏感材料`,
    decision: 'continue',
    reasoning: '温度实验数据已收集，继续完成剩余实验',
  };
}

/** 分析材料对比结果 */
export function analyzeMaterialComparison(experiments: PlannedExperiment[]): IntermediateAnalysis {
  const completed = experiments.filter(e => e.status === 'complete' && e.result);
  if (completed.length < 2) {
    return {
      afterExperimentIndex: completed.length > 0 ? completed[completed.length - 1].index : 0,
      observation: '已完成的实验数据不足，继续执行',
      decision: 'continue',
      reasoning: '需要更多数据进行对比',
    };
  }

  const ranked = [...completed].sort((a, b) => b.result!.peakStress - a.result!.peakStress);
  const best = ranked[0];
  const bestEnergy = [...completed].sort((a, b) => b.result!.energyAbsorption - a.result!.energyAbsorption)[0];

  return {
    afterExperimentIndex: completed[completed.length - 1].index,
    observation: `峰值应力最高：${best.materialName}(${best.result!.peakStress.toFixed(0)}MPa)；` +
      `能量吸收最优：${bestEnergy.materialName}(${bestEnergy.result!.energyAbsorption.toFixed(0)}J/m³)`,
    decision: 'continue',
    reasoning: '材料对比数据正在积累，继续完成剩余实验',
  };
}

/** 分析参数优化结果并决定是否追加细化实验 */
export function analyzeParameterOptimization(
  experiments: PlannedExperiment[],
  allMaterials: Material[],
): IntermediateAnalysis {
  const completed = experiments.filter(e => e.status === 'complete' && e.result);
  if (completed.length < 3) {
    return {
      afterExperimentIndex: completed.length > 0 ? completed[completed.length - 1].index : 0,
      observation: '粗扫描未完成，继续执行',
      decision: 'continue',
      reasoning: '需要完成全部粗扫描数据点',
    };
  }

  // 找到能量吸收最大的电压区间
  const sorted = [...completed].sort((a, b) => a.voltage - b.voltage);
  let bestIdx = 0;
  let bestMetric = 0;
  for (let i = 0; i < sorted.length; i++) {
    const metric = sorted[i].result!.energyAbsorption;
    if (metric > bestMetric) {
      bestMetric = metric;
      bestIdx = i;
    }
  }

  // 在最佳点附近细化
  const bestV = sorted[bestIdx].voltage;
  const lowerV = bestIdx > 0 ? sorted[bestIdx - 1].voltage : bestV - 500;
  const upperV = bestIdx < sorted.length - 1 ? sorted[bestIdx + 1].voltage : bestV + 500;
  const step = (upperV - lowerV) / 3;

  const material = allMaterials.find(m => m.id === sorted[0].materialId);
  if (!material) {
    return {
      afterExperimentIndex: completed[completed.length - 1].index,
      observation: `最佳区间在 ${bestV}V 附近`,
      decision: 'continue',
      reasoning: '无法获取材料信息进行细化',
    };
  }

  const refinedExperiments: PlannedExperiment[] = [
    createExperiment(experiments.length, material, Math.round(lowerV + step), 25, 0,
      `细化搜索 #1：${Math.round(lowerV + step)}V`),
    createExperiment(experiments.length + 1, material, Math.round(lowerV + step * 2), 25, 0,
      `细化搜索 #2：${Math.round(lowerV + step * 2)}V`),
  ];

  return {
    afterExperimentIndex: completed[completed.length - 1].index,
    observation: `粗扫描完成：最佳能量吸收在 ${bestV}V 附近(${bestMetric.toFixed(0)}J/m³)，将在 ${Math.round(lowerV)}-${Math.round(upperV)}V 区间细化搜索`,
    decision: 'add_experiments',
    addedExperiments: refinedExperiments,
    reasoning: `在最佳区间 [${Math.round(lowerV)}V, ${Math.round(upperV)}V] 添加2个细化实验点`,
  };
}

// ═══════════════════════════════════════════════
// 报告生成（规则模板）
// ═══════════════════════════════════════════════

export { type StrategyMatch };
