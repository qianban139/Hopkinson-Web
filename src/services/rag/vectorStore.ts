/**
 * 向量存储 - 内存版本
 *
 * 单例模式，应用启动时一次性构建：
 *   1. 加载文献语料库
 *   2. 为每篇文献的标题+摘要+关键词构建嵌入文档
 *   3. 构建全局 IDF 表
 *   4. 提供 topK 检索接口
 */

import { LITERATURE_CORPUS, LITERATURE_INDEX } from '@/data/literature';
import {
  buildIDF,
  cosineSimilarity,
  createEmbeddedDocument,
  embed,
  vectorNorm,
} from './embedding';
import type { EmbeddedDocument, RetrievalResult } from './types';

class VectorStore {
  private documents: EmbeddedDocument[] = [];
  private idfTable: Map<string, number> | null = null;
  private initialized = false;

  /** 初始化（应用启动时调用一次） */
  initialize(): void {
    if (this.initialized) return;

    // 1. 准备所有文档文本（每篇文献作为一个文档）
    const literatureTexts = LITERATURE_CORPUS.map((entry) =>
      buildLiteratureText(entry.title, entry.abstract, entry.keywords),
    );

    // 2. 构建全局 IDF
    this.idfTable = buildIDF(literatureTexts);

    // 3. 为每篇文献创建嵌入文档
    this.documents = LITERATURE_CORPUS.map((entry, idx) =>
      createEmbeddedDocument(
        `lit_${entry.id}`,
        literatureTexts[idx],
        entry.id,
        'literature',
        this.idfTable!,
      ),
    );

    this.initialized = true;
  }

  /** 添加新文档（如实验记录） */
  addDocument(
    id: string,
    text: string,
    literatureId: string,
    type: EmbeddedDocument['type'],
  ): void {
    if (!this.idfTable) this.initialize();
    const doc = createEmbeddedDocument(id, text, literatureId, type, this.idfTable!);
    // 移除重复
    this.documents = this.documents.filter((d) => d.id !== id);
    this.documents.push(doc);
  }

  /** 删除文档 */
  removeDocument(id: string): void {
    this.documents = this.documents.filter((d) => d.id !== id);
  }

  /** topK 检索 */
  search(query: string, topK = 5, minScore = 0.05): RetrievalResult[] {
    if (!this.initialized) this.initialize();
    if (!query.trim()) return [];

    const queryVec = embed(query, this.idfTable!);
    const queryNorm = vectorNorm(queryVec);
    if (queryNorm === 0) return [];

    // 计算所有文档的相似度
    const scored = this.documents
      .map((doc) => {
        const score = cosineSimilarity(queryVec, doc.vector, queryNorm, doc.norm);
        return { doc, score };
      })
      .filter((x) => x.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return scored.map(({ doc, score }) => {
      const matchedTerms = findMatchedTerms(queryVec, doc.vector, 5);
      return {
        documentId: doc.id,
        literatureId: doc.literatureId,
        text: doc.text,
        score: Number(score.toFixed(4)),
        type: doc.type,
        matchedTerms,
      };
    });
  }

  /** 获取所有文档（用于调试） */
  getAllDocuments(): EmbeddedDocument[] {
    return [...this.documents];
  }

  /** 获取统计信息 */
  getStats(): { documentCount: number; vocabularySize: number } {
    return {
      documentCount: this.documents.length,
      vocabularySize: this.idfTable?.size ?? 0,
    };
  }

  /** 清空（供测试用） */
  clear(): void {
    this.documents = [];
    this.idfTable = null;
    this.initialized = false;
  }
}

/* ============================================================
 * 辅助函数
 * ============================================================ */

/** 拼接文献的可索引文本 */
function buildLiteratureText(title: string, abstract: string, keywords: string[]): string {
  // 标题权重 ×3，关键词权重 ×2（通过重复实现）
  return `${title} ${title} ${title} ${keywords.join(' ')} ${keywords.join(' ')} ${abstract}`;
}

/** 找出查询和文档共有的高权重词 */
function findMatchedTerms(
  query: Map<string, number>,
  doc: Map<string, number>,
  limit: number,
): string[] {
  const matched: Array<[string, number]> = [];
  for (const [term, qWeight] of query) {
    const dWeight = doc.get(term);
    if (dWeight !== undefined) {
      // 只保留有意义的词（长度 > 1 或单字数字）
      if (term.length > 1 || /[0-9]/.test(term)) {
        matched.push([term, qWeight * dWeight]);
      }
    }
  }
  return matched
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map((x) => x[0]);
}

/* ============================================================
 * 单例导出
 * ============================================================ */

export const vectorStore = new VectorStore();

/** 工具：通过文献 id 获取完整元数据 */
export function getLiteratureMeta(literatureId: string) {
  return LITERATURE_INDEX.get(literatureId);
}
