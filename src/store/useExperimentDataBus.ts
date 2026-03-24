// src/store/useExperimentDataBus.ts
// 跨模块数据总线 - 连接 VirtualLab、AIControl、MultiField、MaterialAnalysis、SystemMonitor
import { create } from 'zustand';
import type { LabExperimentResult, MultiFieldExperimentResult, DataFlowEntry, SafetyChecklistItem } from '@/types';

type ExperimentPhase = 'setup' | 'safety' | 'experiment' | 'optimization' | 'coupling' | 'analysis' | 'complete';

interface ExperimentSession {
  id: string;
  startedAt: number;
  completedModules: string[];
  pendingModules: string[];
  currentPhase: ExperimentPhase;
}

interface ExperimentDataBusState {
  // 最近一次虚拟实验室实验数据
  lastLabExperiment: LabExperimentResult | null;
  // 最近一次多场耦合实验数据
  lastMultiFieldExperiment: MultiFieldExperimentResult | null;
  // 数据流日志（用于可视化模块间数据流动）
  dataFlowLog: DataFlowEntry[];
  // 安全检查清单
  safetyChecklist: SafetyChecklistItem[];
  safetyChecklistCompleted: boolean;
  safetyChecklistTimestamp: number;
  // 实验会话跟踪
  experimentSession: ExperimentSession;
  // AI优化结果
  aiOptimizedParams: {
    voltage: number;
    current: number;
    pulseWidth: number;
    improvements: Record<string, number>; // 如 { stressUniformity: 23, energyEfficiency: 15 }
    timestamp: number;
  } | null;
  // AI优化历史记录
  aiOptimizationHistory: {
    voltage: number;
    current: number;
    pulseWidth: number;
    improvements?: Record<string, number>;
    timestamp: number;
  }[];

  // 发布虚拟实验室数据
  publishLabExperiment: (data: LabExperimentResult) => void;
  // 发布多场耦合数据
  publishMultiFieldExperiment: (data: MultiFieldExperimentResult) => void;
  // 发布AI优化结果
  publishAIOptimization: (params: ExperimentDataBusState['aiOptimizedParams']) => void;
  // 记录数据流
  logDataFlow: (entry: Omit<DataFlowEntry, 'timestamp'>) => void;
  // 安全检查
  setSafetyChecklist: (items: SafetyChecklistItem[]) => void;
  completeSafetyChecklist: () => void;
  resetSafetyChecklist: () => void;
  // 会话管理
  updateSessionPhase: (phase: ExperimentPhase) => void;
  markModuleCompleted: (moduleId: string) => void;
  // 清空数据
  clearAll: () => void;
}

const defaultSafetyChecklist: SafetyChecklistItem[] = [
  { id: 'capacitor', name: '电容组状态', description: '检查电容组充放电状态和漏电流', status: 'pending', unit: 'kJ' },
  { id: 'cooling', name: '冷却系统', description: '验证冷却液流量和基线温度', status: 'pending', unit: '°C' },
  { id: 'emi-shield', name: 'EMI屏蔽', description: '确认屏蔽完整性，背景EMI<50dB', status: 'pending', unit: 'dB' },
  { id: 'specimen', name: '试件对位', description: '验证杆件对位和试件安装', status: 'pending' },
  { id: 'daq', name: '数据采集', description: '验证应变片连接和采样率设置', status: 'pending', unit: 'fps' },
  { id: 'emergency', name: '紧急系统', description: '测试紧急停止响应时间', status: 'pending', unit: 'ms' },
  { id: 'personnel', name: '人员安全', description: '确认安全区域清空和PPE检查', status: 'pending' },
];

export const useExperimentDataBus = create<ExperimentDataBusState>((set, get) => ({
  lastLabExperiment: null,
  lastMultiFieldExperiment: null,
  dataFlowLog: [],
  safetyChecklist: defaultSafetyChecklist.map(i => ({ ...i })),
  safetyChecklistCompleted: false,
  safetyChecklistTimestamp: 0,
  aiOptimizedParams: null,
  aiOptimizationHistory: [],
  experimentSession: {
    id: `session-${Date.now()}`,
    startedAt: Date.now(),
    completedModules: [],
    pendingModules: ['monitor', 'lab', 'ai', 'multifield', 'analysis'],
    currentPhase: 'setup',
  },

  publishLabExperiment: (data) => {
    set((state) => ({
      lastLabExperiment: data,
      experimentSession: {
        ...state.experimentSession,
        completedModules: state.experimentSession.completedModules.includes('lab')
          ? state.experimentSession.completedModules
          : [...state.experimentSession.completedModules, 'lab'],
        pendingModules: state.experimentSession.pendingModules.filter(m => m !== 'lab'),
        currentPhase: 'experiment',
      },
    }));
    get().logDataFlow({
      from: 'VirtualLab',
      to: 'DataBus',
      dataType: 'experiment-result',
      description: `实验数据: ${data.materialName}, ${data.params.voltage}V, ${data.params.pulseWidth}μs`,
    });
  },

  publishMultiFieldExperiment: (data) => {
    set((state) => ({
      lastMultiFieldExperiment: data,
      experimentSession: {
        ...state.experimentSession,
        completedModules: state.experimentSession.completedModules.includes('multifield')
          ? state.experimentSession.completedModules
          : [...state.experimentSession.completedModules, 'multifield'],
        pendingModules: state.experimentSession.pendingModules.filter(m => m !== 'multifield'),
        currentPhase: 'coupling',
      },
    }));
    get().logDataFlow({
      from: 'MultiField',
      to: 'DataBus',
      dataType: 'coupling-result',
      description: `耦合数据: T=${data.thermalParams.temperature}°C, σ=${data.mechanicalParams.stress}MPa`,
    });
  },

  publishAIOptimization: (params) => {
    set((state) => ({
      aiOptimizedParams: params,
      aiOptimizationHistory: params
        ? [...state.aiOptimizationHistory.slice(-19), { voltage: params.voltage, current: params.current, pulseWidth: params.pulseWidth, improvements: params.improvements, timestamp: params.timestamp }]
        : state.aiOptimizationHistory,
    }));
    if (params) {
      get().logDataFlow({
        from: 'AIControl',
        to: 'DataBus',
        dataType: 'ai-optimization',
        description: `AI优化: ${params.voltage}V, ${params.current}A, ${params.pulseWidth}μs`,
      });
    }
  },

  logDataFlow: (entry) => {
    set((state) => ({
      dataFlowLog: [
        ...state.dataFlowLog.slice(-49), // 保留最近50条
        { ...entry, timestamp: Date.now() },
      ],
    }));
  },

  setSafetyChecklist: (items) => {
    const allChecked = items.every(i => i.status !== 'pending' && i.status !== 'checking');
    const allPassed = items.every(i => i.status === 'pass' || i.status === 'warning');
    set({
      safetyChecklist: items,
      safetyChecklistCompleted: allChecked && allPassed,
      safetyChecklistTimestamp: allChecked && allPassed ? Date.now() : 0,
    });
  },

  completeSafetyChecklist: () => {
    set((state) => ({
      safetyChecklistCompleted: true,
      safetyChecklistTimestamp: Date.now(),
      experimentSession: {
        ...state.experimentSession,
        completedModules: state.experimentSession.completedModules.includes('monitor')
          ? state.experimentSession.completedModules
          : [...state.experimentSession.completedModules, 'monitor'],
        pendingModules: state.experimentSession.pendingModules.filter(m => m !== 'monitor'),
        currentPhase: 'safety',
      },
    }));
  },

  resetSafetyChecklist: () => {
    set({
      safetyChecklist: defaultSafetyChecklist.map(i => ({ ...i })),
      safetyChecklistCompleted: false,
      safetyChecklistTimestamp: 0,
    });
  },

  updateSessionPhase: (phase) => {
    set((state) => ({
      experimentSession: { ...state.experimentSession, currentPhase: phase },
    }));
  },

  markModuleCompleted: (moduleId) => {
    set((state) => ({
      experimentSession: {
        ...state.experimentSession,
        completedModules: state.experimentSession.completedModules.includes(moduleId)
          ? state.experimentSession.completedModules
          : [...state.experimentSession.completedModules, moduleId],
        pendingModules: state.experimentSession.pendingModules.filter(m => m !== moduleId),
      },
    }));
  },

  clearAll: () => {
    set({
      lastLabExperiment: null,
      lastMultiFieldExperiment: null,
      dataFlowLog: [],
      aiOptimizedParams: null,
      aiOptimizationHistory: [],
      safetyChecklist: defaultSafetyChecklist.map(i => ({ ...i })),
      safetyChecklistCompleted: false,
      safetyChecklistTimestamp: 0,
      experimentSession: {
        id: `session-${Date.now()}`,
        startedAt: Date.now(),
        completedModules: [],
        pendingModules: ['monitor', 'lab', 'ai', 'multifield', 'analysis'],
        currentPhase: 'setup',
      },
    });
  },
}));
