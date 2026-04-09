/**
 * 跨实验记忆库
 *
 * 持久化存储：将历史实验记录保存到 localStorage，使 AI 助手能在新实验中
 * 引用过去的经验数据。
 *
 * 使用场景：
 *   - 用户问"上次铝合金的 J-C 参数是多少"
 *   - 用户问"在 2000/s 应变率下，哪些材料的 R² 最好"
 *   - AI 在拟合新材料时自动参考相似材料的历史拟合结果
 */

import type { ExperimentMemory } from './types';

const STORAGE_KEY = 'hopkinson:experiment-memory';
const MAX_ENTRIES = 100;

class ExperimentMemoryStore {
  private memories: ExperimentMemory[] = [];
  private loaded = false;

  /** 从 localStorage 加载 */
  private load(): void {
    if (this.loaded) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.memories = parsed;
        }
      }
    } catch {
      // 忽略损坏的存储
      this.memories = [];
    }
    this.loaded = true;
  }

  /** 保存到 localStorage */
  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.memories));
    } catch {
      // 配额超限或不可用时静默失败
    }
  }

  /** 添加一条实验记录 */
  add(entry: Omit<ExperimentMemory, 'id' | 'timestamp'>): ExperimentMemory {
    this.load();
    const memory: ExperimentMemory = {
      ...entry,
      id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };
    this.memories.unshift(memory);
    // 限制总数
    if (this.memories.length > MAX_ENTRIES) {
      this.memories = this.memories.slice(0, MAX_ENTRIES);
    }
    this.persist();
    return memory;
  }

  /** 获取所有记录（按时间倒序） */
  list(): ExperimentMemory[] {
    this.load();
    return [...this.memories];
  }

  /** 通过 id 获取 */
  get(id: string): ExperimentMemory | undefined {
    this.load();
    return this.memories.find((m) => m.id === id);
  }

  /** 删除记录 */
  remove(id: string): void {
    this.load();
    this.memories = this.memories.filter((m) => m.id !== id);
    this.persist();
  }

  /** 清空所有记录 */
  clear(): void {
    this.memories = [];
    this.persist();
  }

  /** 通过材料筛选 */
  findByMaterial(materialId: string): ExperimentMemory[] {
    this.load();
    return this.memories.filter((m) => m.materialId === materialId);
  }

  /** 在指定应变率/温度范围内查找 */
  findInRange(opts: {
    materialId?: string;
    minStrainRate?: number;
    maxStrainRate?: number;
    minTemperature?: number;
    maxTemperature?: number;
  }): ExperimentMemory[] {
    this.load();
    return this.memories.filter((m) => {
      if (opts.materialId && m.materialId !== opts.materialId) return false;
      if (opts.minStrainRate !== undefined && m.strainRate < opts.minStrainRate) return false;
      if (opts.maxStrainRate !== undefined && m.strainRate > opts.maxStrainRate) return false;
      if (opts.minTemperature !== undefined && m.temperature < opts.minTemperature) return false;
      if (opts.maxTemperature !== undefined && m.temperature > opts.maxTemperature) return false;
      return true;
    });
  }
}

export const experimentMemory = new ExperimentMemoryStore();

/* ============================================================
 * 便捷函数
 * ============================================================ */

/** 记录一次实验 */
export function rememberExperiment(
  entry: Omit<ExperimentMemory, 'id' | 'timestamp'>,
): ExperimentMemory {
  return experimentMemory.add(entry);
}

export interface ExperimentRecallResult {
  memory: ExperimentMemory;
  /** 相似度（基于材料一致性 + 应变率/温度接近度） */
  similarity: number;
  /** 相似度的人类可读描述 */
  reason: string;
}

/**
 * 召回相似的历史实验
 *
 * 相似度算法：
 *   - 同一材料：+0.5
 *   - 应变率倍数比 < 2：+0.3，< 5：+0.15
 *   - 温度差 < 50°C：+0.2，< 200°C：+0.1
 */
export function recallSimilarExperiments(
  query: { materialId?: string; strainRate: number; temperature: number },
  topK = 5,
): ExperimentRecallResult[] {
  const allMemories = experimentMemory.list();
  if (allMemories.length === 0) return [];

  const scored = allMemories.map((mem) => {
    let similarity = 0;
    const reasons: string[] = [];

    if (query.materialId && mem.materialId === query.materialId) {
      similarity += 0.5;
      reasons.push('同一材料');
    }

    const rateRatio = Math.max(query.strainRate, mem.strainRate) /
      Math.max(Math.min(query.strainRate, mem.strainRate), 1);
    if (rateRatio < 2) {
      similarity += 0.3;
      reasons.push('应变率接近');
    } else if (rateRatio < 5) {
      similarity += 0.15;
      reasons.push('应变率同量级');
    }

    const tempDiff = Math.abs(query.temperature - mem.temperature);
    if (tempDiff < 50) {
      similarity += 0.2;
      reasons.push('温度接近');
    } else if (tempDiff < 200) {
      similarity += 0.1;
      reasons.push('温度同区间');
    }

    return {
      memory: mem,
      similarity,
      reason: reasons.length > 0 ? reasons.join(' + ') : '弱相关',
    };
  });

  return scored
    .filter((r) => r.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}
