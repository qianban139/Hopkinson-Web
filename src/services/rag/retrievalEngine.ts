/**
 * RAG 检索引擎
 *
 * 给定用户查询，从向量库检索相关文献片段，构建 LLM 提示上下文，
 * 并自动生成引用信息。
 *
 * 调用流程：
 *   user query → vectorStore.search() → top-K results
 *              → 生成 promptContext (用于注入 LLM)
 *              → 生成 citations (用于 UI 渲染)
 */

import { vectorStore, getLiteratureMeta } from './vectorStore';
import type { Citation, RAGContext, RetrievalResult } from './types';

export interface RetrieveOptions {
  /** 检索 top-K，默认 4 */
  topK?: number;
  /** 最低相似度阈值，默认 0.05 */
  minScore?: number;
  /** 是否在提示词中包含完整摘要 */
  includeFullAbstract?: boolean;
}

/**
 * 主入口：检索 + 构建 RAG 上下文
 */
export function retrieve(query: string, options: RetrieveOptions = {}): RAGContext {
  const t0 = performance.now();
  const topK = options.topK ?? 4;
  const minScore = options.minScore ?? 0.05;

  // 1. 向量检索
  const results = vectorStore.search(query, topK, minScore);

  // 2. 生成引用列表（去重）
  const citations = buildCitations(results);

  // 3. 构建提示上下文
  const promptContext = buildPromptContext(results, citations, options.includeFullAbstract ?? true);

  return {
    retrievedChunks: results,
    citations,
    promptContext,
    retrievalDurationMs: performance.now() - t0,
  };
}

/* ============================================================
 * 构建引用列表
 * ============================================================ */

function buildCitations(results: RetrievalResult[]): Citation[] {
  const seen = new Set<string>();
  const citations: Citation[] = [];

  for (const result of results) {
    if (seen.has(result.literatureId)) continue;
    seen.add(result.literatureId);

    const meta = getLiteratureMeta(result.literatureId);
    if (!meta) continue;

    const firstAuthor = meta.authors[0] ?? '佚名';
    const authorLabel = meta.authors.length > 1 ? `${firstAuthor} et al.` : firstAuthor;

    citations.push({
      index: citations.length + 1,
      literatureId: result.literatureId,
      shortLabel: `${authorLabel} (${meta.year})`,
      fullTitle: meta.title,
      doi: meta.doi,
    });
  }

  return citations;
}

/* ============================================================
 * 构建注入 LLM 的上下文
 * ============================================================ */

function buildPromptContext(
  results: RetrievalResult[],
  citations: Citation[],
  includeFullAbstract: boolean,
): string {
  if (results.length === 0) {
    return '';
  }

  const lines: string[] = [];
  lines.push('## 相关文献检索结果');
  lines.push('');
  lines.push('以下是从专业文献库中检索到的与用户问题相关的内容，请在回答时引用对应的 [编号]：');
  lines.push('');

  // 将检索结果按文献 id 聚合，避免重复
  const literatureMap = new Map<string, RetrievalResult>();
  for (const r of results) {
    if (!literatureMap.has(r.literatureId)) {
      literatureMap.set(r.literatureId, r);
    }
  }

  for (const citation of citations) {
    const result = literatureMap.get(citation.literatureId);
    if (!result) continue;
    const meta = getLiteratureMeta(citation.literatureId);
    if (!meta) continue;

    lines.push(`### [${citation.index}] ${citation.shortLabel} — ${meta.title}`);
    lines.push(`- 来源：${meta.venue}${meta.doi ? ` · DOI: ${meta.doi}` : ''}`);
    lines.push(`- 关键词：${meta.keywords.join('、')}`);
    if (includeFullAbstract) {
      lines.push(`- 摘要：${meta.abstract}`);
    }
    lines.push(`- 检索匹配：${result.matchedTerms.join('、')} · 相似度 ${(result.score * 100).toFixed(1)}%`);
    lines.push('');
  }

  lines.push('---');
  lines.push('请基于以上文献内容回答用户问题，并在引用信息时使用 [1]、[2] 等编号。');
  lines.push('如果文献中没有直接相关内容，请明确说明，避免编造。');
  lines.push('');

  return lines.join('\n');
}

/* ============================================================
 * 提示词增强：将 RAG 上下文拼接到原始用户问题
 * ============================================================ */

/**
 * 用 RAG 上下文包装用户问题
 *
 * @returns 包含检索内容的增强用户消息
 */
export function buildAugmentedQuery(userQuery: string, ragContext: RAGContext): string {
  if (ragContext.retrievedChunks.length === 0) {
    return userQuery;
  }
  return `${ragContext.promptContext}\n## 用户问题\n${userQuery}`;
}

/**
 * 检查回答中实际使用的引用编号
 */
export function extractUsedCitations(response: string, allCitations: Citation[]): Citation[] {
  const used = new Set<number>();
  const matches = response.matchAll(/\[(\d+)\]/g);
  for (const m of matches) {
    used.add(parseInt(m[1], 10));
  }
  return allCitations.filter((c) => used.has(c.index));
}
