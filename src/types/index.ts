// 材料类别
export type MaterialCategory = '金属' | '矿石' | '混凝土' | '陶瓷' | '高分子材料' | '吸能材料' | '生物材料';

// 材料子分类ID（用于VirtualLab分类筛选）
export type MaterialSubCategory = 'metal' | 'rock' | 'concrete' | 'ceramic' | 'polymer' | 'foam' | 'bio';

// 波形类型
export type WaveformType = '半正弦' | '梯形' | '方波' | '自定义';

// Johnson-Cook模型参数
export interface JohnsonCookParams {
  A: number;  // 屈服强度
  B: number;  // 硬化系数
  C: number;  // 应变率敏感系数
  n: number;  // 硬化指数
  m: number;  // 热软化指数
  Tm: number; // 熔点温度
}

// 应力-应变数据点
export interface StressStrainPoint {
  strain: number;
  stress: number;
}

// 材料数据（统一数据库）
export interface Material {
  id: string;
  name: string;
  category: MaterialCategory;
  subCategory: MaterialSubCategory; // 用于分类筛选
  subcategoryLabel: string;         // 子分类显示名称（如"结构钢"、"沉积岩"）
  examples: string[];
  typicalStrainRate: string;
  preferredWaveform: WaveformType;
  johnsonCookParams: JohnsonCookParams;
  stiffnessK: number;      // 刚度系数 (GPa)
  dampingC: number;        // 阻尼系数
  emiThreshold: number;    // EMI安全阈值 (dB)
  applications: string[];
  stressStrainSample: StressStrainPoint[];
  destructionTime: string; // 典型破坏时刻 (μs)
  mappingWeight: number;   // 跨材料映射权重 (0-1)
  // 物理属性（从VirtualLab内联数据合并）
  density: number;          // 密度 (kg/m³)
  elasticModulus: number;   // 弹性模量 (Pa)
  yieldStrength: number;    // 屈服强度 (Pa)
  color: string;            // 显示颜色
  description: string;      // 材料描述
}

// 材料分类信息
export interface MaterialCategoryInfo {
  id: MaterialSubCategory;
  name: string;
  icon: string;
  color: string;
}

// 实验参数
export interface ExperimentParams {
  voltage: number;         // 电压 (V)
  current: number;         // 电流 (A)
  pulseWidth: number;      // 脉宽 (μs)
  waveform: WaveformType;
  materialId: string;
}

// AI优化状态
export interface AIOptimizationState {
  isOptimizing: boolean;
  step: 'idle' | 'lstm' | 'wgan' | 'ppo' | 'complete';
  progress: number;
  reward: number;
  bestParams: ExperimentParams | null;
}

// 监控数据
export interface MonitorData {
  voltage: number;
  current: number;
  capacitance: number;
  temperature: number;
  emi: number;
  timestamp: number;
}

// 预警级别
export type WarningLevel = 'normal' | 'warning' | 'danger';

// 导航项
export interface NavItem {
  label: string;
  path: string;
  icon?: string;
}

// 波形数据
export interface WaveformData {
  incident: number[];
  reflected: number[];
  transmitted: number[];
  timeAxis: number[];
}

// 实验结果（从experimentWorkflow引用）
export interface LabExperimentResult {
  materialId: string;
  materialName: string;
  params: ExperimentParams;
  waveformData: WaveformData;
  peakStress: number;
  strainRate: number;
  energyAbsorption: number;
  yieldStrength: number;
  maxStrain: number;
  duration: number;
  timestamp: number;
}

// 多场耦合实验数据
export interface MultiFieldExperimentResult {
  thermalParams: { temperature: number; intensity: number };
  mechanicalParams: { stress: number; intensity: number };
  emParams: { fieldStrength: number; intensity: number };
  couplingStrength: number;
  materialId: string;
  resultData: {
    coupledStressStrain: StressStrainPoint[];
    temperatureProfile: number[];
    stressProfile: number[];
    emProfile: number[];
  };
  timestamp: number;
}

// 数据流日志
export interface DataFlowEntry {
  from: string;
  to: string;
  dataType: string;
  description: string;
  timestamp: number;
}

// 安全检查项
export interface SafetyChecklistItem {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'checking' | 'pass' | 'warning' | 'fail';
  currentValue?: number;
  threshold?: number;
  unit?: string;
}

// AI助手动作
export interface AIAction {
  id: string;
  name: string;
  description: string;
  page: string;
  execute: (params: Record<string, unknown>) => Promise<void>;
}

// AI助手模式
export type AIAssistantMode = 'popup' | 'fullscreen';
export type AIAssistantStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'executing';
