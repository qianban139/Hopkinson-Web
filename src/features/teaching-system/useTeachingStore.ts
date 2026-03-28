// src/features/teaching-system/useTeachingStore.ts
// 教学系统状态管理 — 学习进度持久化

import { create } from 'zustand';

interface QuizResult {
  questionId: string;
  correct: boolean;
  timestamp: number;
}

interface TeachingState {
  // 已学习的知识节点
  completedNodes: string[];
  // 当前学习路径
  activePathId: string | null;
  // 测验记录
  quizResults: QuizResult[];
  // 当前选中的知识节点（图谱查看）
  selectedNodeId: string | null;
  // 当前视图模式
  viewMode: 'paths' | 'graph' | 'quiz' | 'study';

  // Actions
  completeNode: (nodeId: string) => void;
  uncompleteNode: (nodeId: string) => void;
  setActivePath: (pathId: string | null) => void;
  addQuizResult: (result: QuizResult) => void;
  setSelectedNode: (nodeId: string | null) => void;
  setViewMode: (mode: TeachingState['viewMode']) => void;
  resetProgress: () => void;
}

const STORAGE_KEY = 'hopkinson-teaching-progress';

function loadProgress(): Partial<TeachingState> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      return {
        completedNodes: data.completedNodes || [],
        activePathId: data.activePathId || null,
        quizResults: data.quizResults || [],
      };
    }
  } catch { /* ignore */ }
  return {};
}

function saveProgress(state: TeachingState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      completedNodes: state.completedNodes,
      activePathId: state.activePathId,
      quizResults: state.quizResults,
    }));
  } catch { /* ignore */ }
}

export const useTeachingStore = create<TeachingState>((set, get) => {
  const saved = loadProgress();
  return {
    completedNodes: saved.completedNodes || [],
    activePathId: saved.activePathId || null,
    quizResults: saved.quizResults || [],
    selectedNodeId: null,
    viewMode: 'paths',

    completeNode: (nodeId) => {
      set((s) => {
        if (s.completedNodes.includes(nodeId)) return s;
        const next = { ...s, completedNodes: [...s.completedNodes, nodeId] };
        saveProgress(next);
        return next;
      });
    },

    uncompleteNode: (nodeId) => {
      set((s) => {
        const next = { ...s, completedNodes: s.completedNodes.filter(id => id !== nodeId) };
        saveProgress(next);
        return next;
      });
    },

    setActivePath: (pathId) => {
      set((s) => {
        const next = { ...s, activePathId: pathId };
        saveProgress(next);
        return next;
      });
    },

    addQuizResult: (result) => {
      set((s) => {
        const next = { ...s, quizResults: [...s.quizResults, result] };
        saveProgress(next);
        return next;
      });
    },

    setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId }),

    setViewMode: (mode) => set({ viewMode: mode }),

    resetProgress: () => {
      const blank = { completedNodes: [] as string[], activePathId: null, quizResults: [] as QuizResult[] };
      localStorage.removeItem(STORAGE_KEY);
      set(blank);
    },
  };
});
