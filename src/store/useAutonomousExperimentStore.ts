// src/store/useAutonomousExperimentStore.ts
// 自主实验状态管理 — 管理 AI 自主实验的完整生命周期
import { create } from 'zustand';
import type {
  AutoExperimentStatus,
  ExperimentPlan,
  PlannedExperiment,
  IntermediateAnalysis,
  AutoExperimentReport,
} from '@/types';
import type { SHPBSimulationResult } from '@/services/shpbPhysicsEngine';

// ═══════════════════════════════════════════════
// 状态接口
// ═══════════════════════════════════════════════

interface AutonomousExperimentState {
  // 核心状态
  status: AutoExperimentStatus;
  plan: ExperimentPlan | null;
  currentExperimentIndex: number;
  analyses: IntermediateAnalysis[];
  report: AutoExperimentReport | null;

  // 用户控制
  isPausedByUser: boolean;
  userEdits: Record<string, Partial<PlannedExperiment>>;

  // 进度
  progressPercent: number;
  currentStepDescription: string;

  // 侧边栏可见性
  sidebarOpen: boolean;

  // 错误
  lastError: string | null;
}

interface AutonomousExperimentActions {
  // 生命周期
  setStatus: (status: AutoExperimentStatus) => void;
  setPlan: (plan: ExperimentPlan) => void;
  approvePlan: () => void;
  rejectPlan: () => void;

  // 执行控制
  pause: () => void;
  resume: () => void;
  abort: () => void;

  // 实验操作
  startExperiment: (index: number) => void;
  completeExperiment: (index: number, result: SHPBSimulationResult) => void;
  failExperiment: (index: number, reason: string) => void;
  skipExperiment: (index: number, reason: string) => void;

  // 用户编辑
  editExperiment: (index: number, edits: Partial<PlannedExperiment>) => void;
  insertExperiment: (afterIndex: number, exp: PlannedExperiment) => void;
  removeExperiment: (index: number) => void;

  // 分析与报告
  addAnalysis: (analysis: IntermediateAnalysis) => void;
  setReport: (report: AutoExperimentReport) => void;

  // 进度
  updateProgress: (percent: number, description: string) => void;
  setError: (error: string | null) => void;

  // 侧边栏
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  // 重置
  reset: () => void;
}

type AutonomousExperimentStore = AutonomousExperimentState & AutonomousExperimentActions;

// ═══════════════════════════════════════════════
// Store 实现
// ═══════════════════════════════════════════════

const initialState: AutonomousExperimentState = {
  status: 'idle',
  plan: null,
  currentExperimentIndex: -1,
  analyses: [],
  report: null,
  isPausedByUser: false,
  userEdits: {},
  progressPercent: 0,
  currentStepDescription: '',
  sidebarOpen: false,
  lastError: null,
};

export const useAutonomousExperimentStore = create<AutonomousExperimentStore>((set, get) => ({
  ...initialState,

  setStatus: (status) => set({ status }),

  setPlan: (plan) => set({
    plan,
    status: 'ready',
    sidebarOpen: true,
    currentExperimentIndex: -1,
    analyses: [],
    report: null,
    lastError: null,
  }),

  approvePlan: () => set({ status: 'running', isPausedByUser: false }),

  rejectPlan: () => set({
    status: 'idle',
    plan: null,
    sidebarOpen: false,
  }),

  pause: () => set({ isPausedByUser: true, status: 'paused' }),

  resume: () => set({ isPausedByUser: false, status: 'running' }),

  abort: () => {
    const { plan } = get();
    if (!plan) return;
    // 将所有 pending 实验标记为 skipped
    const experiments = plan.experiments.map(exp =>
      exp.status === 'pending' ? { ...exp, status: 'skipped' as const, failReason: '用户终止' } : exp
    );
    set({
      plan: { ...plan, experiments },
      status: 'aborted',
      isPausedByUser: false,
    });
  },

  startExperiment: (index) => {
    const { plan } = get();
    if (!plan) return;
    const experiments = plan.experiments.map((exp, i) =>
      i === index ? { ...exp, status: 'running' as const, startedAt: Date.now() } : exp
    );
    set({
      plan: { ...plan, experiments },
      currentExperimentIndex: index,
    });
  },

  completeExperiment: (index, result) => {
    const { plan } = get();
    if (!plan) return;
    const experiments = plan.experiments.map((exp, i) =>
      i === index ? { ...exp, status: 'complete' as const, result, completedAt: Date.now() } : exp
    );
    set({ plan: { ...plan, experiments } });
  },

  failExperiment: (index, reason) => {
    const { plan } = get();
    if (!plan) return;
    const experiments = plan.experiments.map((exp, i) =>
      i === index ? { ...exp, status: 'failed' as const, failReason: reason, completedAt: Date.now() } : exp
    );
    set({ plan: { ...plan, experiments } });
  },

  skipExperiment: (index, reason) => {
    const { plan } = get();
    if (!plan) return;
    const experiments = plan.experiments.map((exp, i) =>
      i === index ? { ...exp, status: 'skipped' as const, failReason: reason } : exp
    );
    set({ plan: { ...plan, experiments } });
  },

  editExperiment: (index, edits) => {
    const { plan } = get();
    if (!plan) return;
    const experiments = plan.experiments.map((exp, i) =>
      i === index ? { ...exp, ...edits } : exp
    );
    set({ plan: { ...plan, experiments } });
  },

  insertExperiment: (afterIndex, exp) => {
    const { plan } = get();
    if (!plan) return;
    const experiments = [...plan.experiments];
    experiments.splice(afterIndex + 1, 0, exp);
    // 重新编号
    const reindexed = experiments.map((e, i) => ({ ...e, index: i }));
    set({ plan: { ...plan, experiments: reindexed } });
  },

  removeExperiment: (index) => {
    const { plan } = get();
    if (!plan) return;
    const experiments = plan.experiments.filter((_, i) => i !== index)
      .map((e, i) => ({ ...e, index: i }));
    set({ plan: { ...plan, experiments } });
  },

  addAnalysis: (analysis) => set((state) => ({
    analyses: [...state.analyses, analysis],
  })),

  setReport: (report) => set({ report, status: 'complete' }),

  updateProgress: (percent, description) => set({
    progressPercent: percent,
    currentStepDescription: description,
  }),

  setError: (error) => set({
    lastError: error,
    ...(error ? { status: 'error' as const } : {}),
  }),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  reset: () => set({ ...initialState }),
}));
