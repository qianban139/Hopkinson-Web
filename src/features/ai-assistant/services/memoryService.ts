// src/features/ai-assistant/services/memoryService.ts
// AI长期记忆系统 - 跨会话记忆用户偏好和实验历史

const MEMORY_KEY = 'hopkinson_ai_memory';
const MAX_EXPERIMENT_HISTORY = 20;
const MAX_PREFERENCES = 50;

export interface UserPreference {
  key: string;
  value: string;
  updatedAt: number;
}

export interface ExperimentMemory {
  id: string;
  materialName: string;
  voltage: number;
  waveform: string;
  peakStress: number;
  strainRate: number;
  timestamp: number;
  notes?: string;
}

export interface AIMemory {
  preferences: UserPreference[];
  experimentHistory: ExperimentMemory[];
  lastActive: number;
}

function loadMemory(): AIMemory {
  try {
    const saved = localStorage.getItem(MEMORY_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return { preferences: [], experimentHistory: [], lastActive: Date.now() };
}

function saveMemory(memory: AIMemory): void {
  try {
    memory.lastActive = Date.now();
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
  } catch {}
}

// ═══ 用户偏好 ═══

export function setPreference(key: string, value: string): void {
  const memory = loadMemory();
  const existing = memory.preferences.findIndex(p => p.key === key);
  if (existing >= 0) {
    memory.preferences[existing] = { key, value, updatedAt: Date.now() };
  } else {
    memory.preferences.push({ key, value, updatedAt: Date.now() });
  }
  if (memory.preferences.length > MAX_PREFERENCES) {
    memory.preferences = memory.preferences
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_PREFERENCES);
  }
  saveMemory(memory);
}

export function getPreference(key: string): string | null {
  const memory = loadMemory();
  return memory.preferences.find(p => p.key === key)?.value || null;
}

// ═══ 实验历史 ═══

export function addExperimentMemory(experiment: Omit<ExperimentMemory, 'id' | 'timestamp'>): void {
  const memory = loadMemory();
  memory.experimentHistory.push({
    ...experiment,
    id: `exp_${Date.now()}`,
    timestamp: Date.now(),
  });
  if (memory.experimentHistory.length > MAX_EXPERIMENT_HISTORY) {
    memory.experimentHistory = memory.experimentHistory.slice(-MAX_EXPERIMENT_HISTORY);
  }
  saveMemory(memory);
}

export function getRecentExperiments(count: number = 5): ExperimentMemory[] {
  return loadMemory().experimentHistory.slice(-count);
}

// ═══ 记忆摘要（注入到AI上下文） ═══

export function getMemorySummary(): string {
  const memory = loadMemory();
  const lines: string[] = [];

  if (memory.preferences.length > 0) {
    lines.push('用户偏好:');
    for (const pref of memory.preferences.slice(-5)) {
      lines.push(`  - ${pref.key}: ${pref.value}`);
    }
  }

  if (memory.experimentHistory.length > 0) {
    lines.push(`实验历史 (共${memory.experimentHistory.length}次):`);
    for (const exp of memory.experimentHistory.slice(-3)) {
      const date = new Date(exp.timestamp).toLocaleDateString('zh-CN');
      lines.push(`  - ${date}: ${exp.materialName}, ${exp.voltage}V, 峰值应力${exp.peakStress.toFixed(1)}MPa`);
    }
  }

  return lines.length > 0 ? '\n' + lines.join('\n') : '';
}

export function clearMemory(): void {
  localStorage.removeItem(MEMORY_KEY);
}
