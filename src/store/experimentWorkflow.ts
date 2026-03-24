// src/store/experimentWorkflow.ts
// 实验工作流状态机 - 管理AI引导自动实验的完整流程
import { create } from 'zustand';

// 实验工作流阶段
export type ExperimentPhase =
  | 'idle'           // 空闲
  | 'inquiry'        // AI询问实验需求
  | 'safetyCheck'    // 安全检查
  | 'preparation'    // 参数设定/确认
  | 'execution'      // 实验执行
  | 'dataCollection' // 数据采集
  | 'analysis'       // 结果分析
  | 'complete';      // 完成

// 实验测试类型
export type TestType = 'compression' | 'tension' | 'shear';

// 特殊条件
export interface SpecialConditions {
  highTemperature: boolean;
  temperature: number;         // °C
  confinement: boolean;
  confinementPressure: number; // MPa
}

// 用户在inquiry阶段的选择
export interface ExperimentRequirements {
  materialId: string;
  materialName: string;
  testType: TestType;
  strainRate: number;          // /s
  specialConditions: SpecialConditions;
}

// 安全检查项
export interface SafetyCheckItem {
  id: string;
  name: string;
  currentValue: number;
  unit: string;
  warningThreshold: number;
  dangerThreshold: number;
  status: 'pending' | 'pass' | 'warning' | 'danger';
}

// 实验执行步骤
export interface ExecutionStep {
  id: string;
  label: string;
  description: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  progress: number; // 0~100
}

// inquiry阶段的当前步骤
export type InquiryStep = 'material' | 'testType' | 'strainRate' | 'specialConditions' | 'confirm';

// 实时可调参数（执行中可更改）
export interface LiveParameters {
  voltage: number;      // V
  current: number;      // A
  pulseWidth: number;   // μs
}

interface ExperimentWorkflowState {
  // 当前阶段
  phase: ExperimentPhase;
  setPhase: (phase: ExperimentPhase) => void;

  // inquiry阶段
  inquiryStep: InquiryStep;
  setInquiryStep: (step: InquiryStep) => void;

  // 实验需求
  requirements: ExperimentRequirements;
  updateRequirements: (req: Partial<ExperimentRequirements>) => void;

  // 安全检查结果
  safetyItems: SafetyCheckItem[];
  setSafetyItems: (items: SafetyCheckItem[]) => void;
  safetyCheckComplete: boolean;
  safetyCheckPassed: boolean;

  // 实验执行步骤
  executionSteps: ExecutionStep[];
  setExecutionSteps: (steps: ExecutionStep[]) => void;
  updateExecutionStep: (id: string, update: Partial<ExecutionStep>) => void;
  currentExecutionStepIndex: number;

  // 实验结果
  experimentResults: ExperimentResults | null;
  setExperimentResults: (results: ExperimentResults | null) => void;

  // ═══ 实验控制（新增） ═══
  isPaused: boolean;
  setPaused: (paused: boolean) => void;
  isEmergencyStopped: boolean;
  emergencyStop: () => void;
  parameterLocked: boolean;
  setParameterLocked: (locked: boolean) => void;
  liveParameters: LiveParameters;
  setLiveParameters: (params: Partial<LiveParameters>) => void;
  jumpToPhase: (phase: ExperimentPhase) => void;

  // 重置
  resetWorkflow: () => void;

  // 启动实验流程
  startWorkflow: () => void;
}

// 实验结果
export interface ExperimentResults {
  peakStress: number;      // MPa
  strainRate: number;      // /s
  energyAbsorption: number; // J/m³
  yieldStrength: number;   // MPa
  maxStrain: number;       // %
  duration: number;        // μs
  incidentWavePeak: number; // MPa
  reflectedWavePeak: number;
  transmittedWavePeak: number;
}

const defaultRequirements: ExperimentRequirements = {
  materialId: '',
  materialName: '',
  testType: 'compression',
  strainRate: 1000,
  specialConditions: {
    highTemperature: false,
    temperature: 25,
    confinement: false,
    confinementPressure: 0,
  },
};

const defaultExecutionSteps: ExecutionStep[] = [
  { id: 'init',      label: '系统初始化',   description: '初始化电磁驱动系统，自检传感器...', status: 'pending', progress: 0 },
  { id: 'charge',    label: '电容充能',     description: '电容组储能充电中...', status: 'pending', progress: 0 },
  { id: 'ready',     label: '系统就绪',     description: '所有参数已锁定，等待触发信号...', status: 'pending', progress: 0 },
  { id: 'launch',    label: '电磁发射',     description: '电磁驱动子弹加速撞击入射杆...', status: 'pending', progress: 0 },
  { id: 'capture',   label: '高速采集',     description: '100,000fps高速采集应变信号...', status: 'pending', progress: 0 },
  { id: 'process',   label: '信号处理',     description: '小波变换滤波与数据校准...', status: 'pending', progress: 0 },
  { id: 'result',    label: '结果输出',     description: '生成应力-应变曲线与分析报告...', status: 'pending', progress: 0 },
];

const defaultLiveParameters: LiveParameters = {
  voltage: 2000,
  current: 25000,
  pulseWidth: 500,
};

export const useExperimentWorkflow = create<ExperimentWorkflowState>((set) => ({
  phase: 'idle',
  inquiryStep: 'material',
  requirements: { ...defaultRequirements },
  safetyItems: [],
  safetyCheckComplete: false,
  safetyCheckPassed: false,
  executionSteps: defaultExecutionSteps.map(s => ({ ...s })),
  currentExecutionStepIndex: -1,
  experimentResults: null,

  // 新增控制状态
  isPaused: false,
  isEmergencyStopped: false,
  parameterLocked: false,
  liveParameters: { ...defaultLiveParameters },

  setPhase: (phase) => set({ phase }),
  setInquiryStep: (step) => set({ inquiryStep: step }),

  updateRequirements: (req) => set((state) => ({
    requirements: { ...state.requirements, ...req },
  })),

  setSafetyItems: (items) => {
    const allChecked = items.every(i => i.status !== 'pending');
    const allPassed = items.every(i => i.status !== 'danger');
    set({ safetyItems: items, safetyCheckComplete: allChecked, safetyCheckPassed: allPassed });
  },

  setExecutionSteps: (steps) => set({ executionSteps: steps }),

  updateExecutionStep: (id, update) => set((state) => {
    const steps = state.executionSteps.map(s =>
      s.id === id ? { ...s, ...update } : s
    );
    const currentIdx = steps.findIndex(s => s.status === 'running');
    return { executionSteps: steps, currentExecutionStepIndex: currentIdx };
  }),

  setExperimentResults: (results) => set({ experimentResults: results }),

  // ═══ 实验控制方法 ═══
  setPaused: (paused) => set({ isPaused: paused }),

  emergencyStop: () => set((state) => ({
    isEmergencyStopped: true,
    isPaused: true,
    executionSteps: state.executionSteps.map(s =>
      s.status === 'running' ? { ...s, status: 'error' as const } : s
    ),
  })),

  setParameterLocked: (locked) => set({ parameterLocked: locked }),

  setLiveParameters: (params) => set((state) => ({
    liveParameters: { ...state.liveParameters, ...params },
  })),

  jumpToPhase: (targetPhase) => set((state) => {
    const phaseOrder: ExperimentPhase[] = ['idle', 'inquiry', 'safetyCheck', 'preparation', 'execution', 'dataCollection', 'analysis', 'complete'];
    const currentIdx = phaseOrder.indexOf(state.phase);
    const targetIdx = phaseOrder.indexOf(targetPhase);

    // 只允许跳回之前的阶段或前进到下一阶段
    if (targetIdx < currentIdx) {
      return {
        phase: targetPhase,
        isPaused: false,
        isEmergencyStopped: false,
        // 重置后续步骤
        ...(targetIdx <= 3 ? {
          executionSteps: defaultExecutionSteps.map(s => ({ ...s })),
          currentExecutionStepIndex: -1,
          experimentResults: null,
        } : {}),
      };
    }
    return { phase: targetPhase };
  }),

  resetWorkflow: () => set({
    phase: 'idle',
    inquiryStep: 'material',
    requirements: { ...defaultRequirements },
    safetyItems: [],
    safetyCheckComplete: false,
    safetyCheckPassed: false,
    executionSteps: defaultExecutionSteps.map(s => ({ ...s })),
    currentExecutionStepIndex: -1,
    experimentResults: null,
    isPaused: false,
    isEmergencyStopped: false,
    parameterLocked: false,
    liveParameters: { ...defaultLiveParameters },
  }),

  startWorkflow: () => set({
    phase: 'inquiry',
    inquiryStep: 'material',
    requirements: { ...defaultRequirements },
    safetyItems: [],
    safetyCheckComplete: false,
    safetyCheckPassed: false,
    executionSteps: defaultExecutionSteps.map(s => ({ ...s })),
    currentExecutionStepIndex: -1,
    experimentResults: null,
    isPaused: false,
    isEmergencyStopped: false,
    parameterLocked: false,
    liveParameters: { ...defaultLiveParameters },
  }),
}));
