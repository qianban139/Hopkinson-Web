// src/services/safetyCheck.ts
// 预实验安全检查服务
import type { SafetyCheckItem, ExperimentRequirements } from '@/store/experimentWorkflow';

// 安全阈值定义
const SAFETY_THRESHOLDS = {
  voltage:     { warning: 3500, danger: 4000, unit: 'V' },
  current:     { warning: 40000, danger: 50000, unit: 'A' },
  energy:      { warning: 30, danger: 36, unit: 'kJ' },
  temperature: { warning: 60, danger: 80, unit: '°C' },
  emi:         { warning: 80, danger: 95, unit: 'dB' },
  strainRate:  { warning: 8000, danger: 12000, unit: '/s' },
};

// 根据材料和测试需求计算所需参数
function computeRequiredParams(requirements: ExperimentRequirements) {
  const { strainRate, specialConditions } = requirements;

  // 根据应变率估算所需电压和电流
  const voltageNeeded = Math.min(4000, 1000 + (strainRate / 10000) * 3000);
  const currentNeeded = Math.min(50000, 15000 + (strainRate / 10000) * 35000);
  const energyNeeded = (voltageNeeded * voltageNeeded * 0.0003); // kJ

  // 系统温度估算
  const baseTemp = specialConditions.highTemperature ? specialConditions.temperature * 0.08 + 35 : 42;

  // EMI估算
  const emiLevel = 55 + (currentNeeded / 50000) * 40;

  return {
    voltage: voltageNeeded,
    current: currentNeeded,
    energy: energyNeeded,
    temperature: baseTemp,
    emi: emiLevel,
    strainRate,
  };
}

// 判定单项状态
function checkStatus(value: number, warning: number, danger: number): 'pass' | 'warning' | 'danger' {
  if (value >= danger) return 'danger';
  if (value >= warning) return 'warning';
  return 'pass';
}

// 执行安全检查
export function performSafetyCheck(requirements: ExperimentRequirements): SafetyCheckItem[] {
  const params = computeRequiredParams(requirements);

  const items: SafetyCheckItem[] = [
    {
      id: 'voltage',
      name: '驱动电压',
      currentValue: Math.round(params.voltage),
      unit: SAFETY_THRESHOLDS.voltage.unit,
      warningThreshold: SAFETY_THRESHOLDS.voltage.warning,
      dangerThreshold: SAFETY_THRESHOLDS.voltage.danger,
      status: 'pending',
    },
    {
      id: 'current',
      name: '峰值电流',
      currentValue: Math.round(params.current),
      unit: SAFETY_THRESHOLDS.current.unit,
      warningThreshold: SAFETY_THRESHOLDS.current.warning,
      dangerThreshold: SAFETY_THRESHOLDS.current.danger,
      status: 'pending',
    },
    {
      id: 'energy',
      name: '电容储能',
      currentValue: parseFloat(params.energy.toFixed(1)),
      unit: SAFETY_THRESHOLDS.energy.unit,
      warningThreshold: SAFETY_THRESHOLDS.energy.warning,
      dangerThreshold: SAFETY_THRESHOLDS.energy.danger,
      status: 'pending',
    },
    {
      id: 'temperature',
      name: '系统温度',
      currentValue: Math.round(params.temperature),
      unit: SAFETY_THRESHOLDS.temperature.unit,
      warningThreshold: SAFETY_THRESHOLDS.temperature.warning,
      dangerThreshold: SAFETY_THRESHOLDS.temperature.danger,
      status: 'pending',
    },
    {
      id: 'emi',
      name: 'EMI干扰',
      currentValue: Math.round(params.emi),
      unit: SAFETY_THRESHOLDS.emi.unit,
      warningThreshold: SAFETY_THRESHOLDS.emi.warning,
      dangerThreshold: SAFETY_THRESHOLDS.emi.danger,
      status: 'pending',
    },
    {
      id: 'strainRate',
      name: '目标应变率',
      currentValue: Math.round(params.strainRate),
      unit: SAFETY_THRESHOLDS.strainRate.unit,
      warningThreshold: SAFETY_THRESHOLDS.strainRate.warning,
      dangerThreshold: SAFETY_THRESHOLDS.strainRate.danger,
      status: 'pending',
    },
  ];

  // 填入检查结果
  return items.map(item => ({
    ...item,
    status: checkStatus(item.currentValue, item.warningThreshold, item.dangerThreshold),
  }));
}

// 格式化单位显示
export function formatValue(value: number, unit: string): string {
  if (unit === 'A' && value >= 1000) return `${(value / 1000).toFixed(1)}kA`;
  return `${value}${unit}`;
}

// 获取安全检查摘要
export function getSafetyCheckSummary(items: SafetyCheckItem[]): {
  passed: number;
  warnings: number;
  dangers: number;
  overallStatus: 'pass' | 'warning' | 'danger';
  message: string;
} {
  const passed = items.filter(i => i.status === 'pass').length;
  const warnings = items.filter(i => i.status === 'warning').length;
  const dangers = items.filter(i => i.status === 'danger').length;

  let overallStatus: 'pass' | 'warning' | 'danger' = 'pass';
  let message = '';

  if (dangers > 0) {
    overallStatus = 'danger';
    message = `检测到 ${dangers} 项危险参数，实验无法进行！请调整参数后重试。`;
  } else if (warnings > 0) {
    overallStatus = 'warning';
    message = `${passed} 项通过，${warnings} 项警告。实验可在警告条件下继续，请确认是否执行。`;
  } else {
    message = `全部 ${passed} 项安全检查通过，可以安全执行实验。`;
  }

  return { passed, warnings, dangers, overallStatus, message };
}
