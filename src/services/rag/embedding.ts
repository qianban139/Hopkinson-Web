/**
 * 文本向量化服务
 *
 * 采用 TF-IDF 词袋模型 + 中英文字符级 n-gram 切分，无需联网或外部 API。
 * 优点：完全本地、确定性、零成本、对中文友好
 * 缺点：无语义泛化，但对于专业术语密集的科技文献检索已经足够
 *
 * 设计要点：
 * 1. 中文按 1-2 字符 n-gram 切分（"应力波" → ["应","力","波","应力","力波"]）
 * 2. 英文按单词 + 小写 + 移除停用词
 * 3. 数字和常见标点单独处理
 * 4. TF-IDF 权重在语料库构建时一次性计算
 */

import type { EmbeddedDocument } from './types';

/* ============================================================
 * 停用词与分词
 * ============================================================ */

const ENGLISH_STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'of', 'in', 'on', 'at',
  'to', 'for', 'with', 'by', 'from', 'as', 'and', 'or', 'but', 'if',
  'this', 'that', 'these', 'those', 'it', 'its', 'we', 'our', 'you',
]);

const CHINESE_STOPWORDS = new Set([
  '的', '了', '是', '在', '和', '与', '及', '或', '但', '而', '为',
  '对', '从', '到', '把', '被', '让', '使', '由', '以', '于', '其',
  '此', '该', '本', '我', '你', '他', '她', '它', '们', '这', '那',
  '哪', '什', '么', '吗', '呢', '吧', '啊', '呀', '哦',
]);

/**
 * 中英混合分词：
 * - 英文单词整体保留（小写化、去停用词）
 * - 中文按 1-gram + 2-gram 切分
 * - 数字保留
 */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const normalized = text.toLowerCase();

  // 用正则将文本分段：英文/数字串 / 中文串 / 其他
  const segments = normalized.match(/[a-z0-9]+|[\u4e00-\u9fa5]+|[α-ωΑ-Ω]+/g) || [];

  for (const seg of segments) {
    if (/^[a-z]/.test(seg)) {
      // 英文单词
      if (seg.length > 1 && !ENGLISH_STOPWORDS.has(seg)) {
        tokens.push(seg);
      }
    } else if (/^[0-9]/.test(seg)) {
      // 数字
      tokens.push(seg);
    } else {
      // 中文（含希腊字母）：1-gram + 2-gram
      for (let i = 0; i < seg.length; i++) {
        const ch = seg[i];
        if (!CHINESE_STOPWORDS.has(ch)) {
          tokens.push(ch);
        }
        if (i < seg.length - 1) {
          const bigram = seg.slice(i, i + 2);
          tokens.push(bigram);
        }
      }
    }
  }

  return tokens;
}

/* ============================================================
 * TF-IDF 向量化
 * ============================================================ */

/** 词频统计 */
function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) {
    tf.set(t, (tf.get(t) ?? 0) + 1);
  }
  // 归一化（避免长文档主导）
  const total = tokens.length || 1;
  for (const [k, v] of tf) {
    tf.set(k, v / total);
  }
  return tf;
}

/** 全局 IDF 表（语料库构建时计算） */
let _idfCache: Map<string, number> | null = null;

/**
 * 从一批文档构建 IDF
 *
 * IDF(t) = log(1 + N / (1 + df(t)))
 *   N = 文档总数
 *   df(t) = 包含 t 的文档数
 */
export function buildIDF(documents: string[]): Map<string, number> {
  const N = documents.length;
  const df = new Map<string, number>();

  for (const doc of documents) {
    const tokens = new Set(tokenize(doc));
    for (const t of tokens) {
      df.set(t, (df.get(t) ?? 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [t, count] of df) {
    idf.set(t, Math.log(1 + N / (1 + count)));
  }

  _idfCache = idf;
  return idf;
}

/**
 * 文本 → TF-IDF 向量
 *
 * 返回稀疏 Map<term, weight> 表示
 */
export function embed(text: string, idf?: Map<string, number>): Map<string, number> {
  const idfTable = idf ?? _idfCache;
  if (!idfTable) {
    throw new Error('IDF not built. Call buildIDF first.');
  }

  const tokens = tokenize(text);
  const tf = termFrequency(tokens);
  const vector = new Map<string, number>();
  for (const [term, freq] of tf) {
    const idfWeight = idfTable.get(term) ?? Math.log(2); // 未见词的默认 IDF
    vector.set(term, freq * idfWeight);
  }
  return vector;
}

/** 向量模长 */
export function vectorNorm(vec: Map<string, number>): number {
  let sum = 0;
  for (const v of vec.values()) sum += v * v;
  return Math.sqrt(sum);
}

/** 余弦相似度 */
export function cosineSimilarity(
  a: Map<string, number>,
  b: Map<string, number>,
  normA?: number,
  normB?: number,
): number {
  const nA = normA ?? vectorNorm(a);
  const nB = normB ?? vectorNorm(b);
  if (nA === 0 || nB === 0) return 0;

  // 遍历较小的 vector
  const [smaller, larger] = a.size < b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [term, weight] of smaller) {
    const otherWeight = larger.get(term);
    if (otherWeight !== undefined) {
      dot += weight * otherWeight;
    }
  }

  return dot / (nA * nB);
}

/**
 * 创建已嵌入的文档对象
 */
export function createEmbeddedDocument(
  id: string,
  text: string,
  literatureId: string,
  type: EmbeddedDocument['type'],
  idf?: Map<string, number>,
): EmbeddedDocument {
  const vector = embed(text, idf);
  return {
    id,
    text,
    vector,
    norm: vectorNorm(vector),
    literatureId,
    type,
  };
}

/** 获取当前缓存的 IDF（供调试） */
export function getCachedIDF(): Map<string, number> | null {
  return _idfCache;
}
