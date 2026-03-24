import { create } from 'zustand';
import type { Material, ExperimentParams, AIOptimizationState, MonitorData, WarningLevel, AIAssistantMode, AIAssistantStatus, MaterialCategoryInfo } from '@/types';

// AI助手内部工作模式（chat聊天 vs experiment实验工作流）
type AssistantWorkMode = 'chat' | 'experiment';
import materialsData from '@/data/materials.json';

interface AppState {
  // 当前选中材料
  selectedMaterial: Material | null;
  setSelectedMaterial: (material: Material | null) => void;

  // 实验参数
  experimentParams: ExperimentParams;
  setExperimentParams: (params: Partial<ExperimentParams>) => void;

  // AI优化状态
  aiState: AIOptimizationState;
  setAIState: (state: Partial<AIOptimizationState>) => void;
  startAIOptimization: () => void;

  // 监控数据
  monitorData: MonitorData;
  setMonitorData: (data: Partial<MonitorData>) => void;

  // 预警级别
  warningLevel: WarningLevel;
  setWarningLevel: (level: WarningLevel) => void;

  // 所有材料
  materials: Material[];
  // 材料分类
  materialCategories: MaterialCategoryInfo[];

  // 当前页面
  currentPage: string;
  setCurrentPage: (page: string) => void;

  // 程序化导航（供AI助手使用）
  navigateTo: string | null;
  setNavigateTo: (path: string | null) => void;

  // AI助手状态
  isAssistantOpen: boolean;
  setAssistantOpen: (open: boolean) => void;
  toggleAssistant: () => void;
  assistantMode: AssistantWorkMode;
  setAssistantMode: (mode: AssistantWorkMode) => void;
  assistantDisplayMode: AIAssistantMode;
  setAssistantDisplayMode: (mode: AIAssistantMode) => void;
  assistantStatus: AIAssistantStatus;
  setAssistantStatus: (status: AIAssistantStatus) => void;

  // AI助手正在操作的页面
  activeExperimentPage: string | null;
  setActiveExperimentPage: (page: string | null) => void;

  // AI操作通知 (用于全局Toast显示)
  aiNotification: { message: string; type: 'info' | 'success' | 'warning' | 'error'; id: number } | null;
  showAINotification: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  clearAINotification: () => void;
}

const defaultExperimentParams: ExperimentParams = {
  voltage: 2000,
  current: 25000,
  pulseWidth: 500,
  waveform: '梯形',
  materialId: 'metal-01',
};

const defaultAIState: AIOptimizationState = {
  isOptimizing: false,
  step: 'idle',
  progress: 0,
  reward: 0,
  bestParams: null,
};

const defaultMonitorData: MonitorData = {
  voltage: 2000,
  current: 25000,
  capacitance: 85,
  temperature: 45,
  emi: 72,
  timestamp: Date.now(),
};

// 类型断言处理JSON数据
const typedMaterials = materialsData.materials as Material[];
const typedCategories = materialsData.materialCategories as MaterialCategoryInfo[];

export const useAppStore = create<AppState>((set, get) => ({
  selectedMaterial: typedMaterials[0],
  experimentParams: defaultExperimentParams,
  aiState: defaultAIState,
  monitorData: defaultMonitorData,
  warningLevel: 'normal',
  materials: typedMaterials,
  materialCategories: typedCategories,
  currentPage: 'home',
  navigateTo: null,

  setSelectedMaterial: (material) => set({ selectedMaterial: material }),

  setExperimentParams: (params) => set((state) => ({
    experimentParams: { ...state.experimentParams, ...params },
  })),

  setAIState: (aiState) => set((state) => ({
    aiState: { ...state.aiState, ...aiState },
  })),

  startAIOptimization: () => {
    set({ aiState: { ...defaultAIState, isOptimizing: true, step: 'lstm', progress: 10 } });

    // 模拟AI优化过程
    setTimeout(() => {
      set({ aiState: { ...get().aiState, step: 'wgan', progress: 40 } });
    }, 1000);

    setTimeout(() => {
      set({ aiState: { ...get().aiState, step: 'ppo', progress: 70 } });
    }, 2000);

    setTimeout(() => {
      set({
        aiState: {
          ...get().aiState,
          step: 'complete',
          progress: 100,
          isOptimizing: false,
          reward: 0.87,
          bestParams: {
            voltage: 2500,
            current: 35000,
            pulseWidth: 650,
            waveform: '梯形',
            materialId: get().experimentParams.materialId,
          },
        },
      });
    }, 3000);
  },

  setMonitorData: (data) => set((state) => ({
    monitorData: { ...state.monitorData, ...data },
  })),

  setWarningLevel: (level) => set({ warningLevel: level }),

  setCurrentPage: (page) => set({ currentPage: page }),

  setNavigateTo: (path) => set({ navigateTo: path }),

  // AI助手状态
  isAssistantOpen: false,
  setAssistantOpen: (open) => set({ isAssistantOpen: open }),
  toggleAssistant: () => set((state) => ({ isAssistantOpen: !state.isAssistantOpen })),
  assistantMode: 'chat',
  setAssistantMode: (mode) => set({ assistantMode: mode }),
  assistantDisplayMode: 'popup',
  setAssistantDisplayMode: (mode) => set({ assistantDisplayMode: mode }),
  assistantStatus: 'idle',
  setAssistantStatus: (status) => set({ assistantStatus: status }),

  activeExperimentPage: null,
  setActiveExperimentPage: (page) => set({ activeExperimentPage: page }),

  aiNotification: null,
  showAINotification: (message, type = 'info') => {
    set({ aiNotification: { message, type, id: Date.now() } });
    // 3秒后自动清除
    setTimeout(() => {
      set((state) => {
        if (state.aiNotification && Date.now() - state.aiNotification.id > 2800) {
          return { aiNotification: null };
        }
        return {};
      });
    }, 3000);
  },
  clearAINotification: () => set({ aiNotification: null }),
}));
