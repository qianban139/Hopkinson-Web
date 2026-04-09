/**
 * RAG (Retrieval-Augmented Generation) 系统 — 类型定义
 *
 * 本模块为 AI 助手提供文献检索与知识增强能力，使其回答专业问题时
 * 能引用具体文献来源，避免幻觉。
 */

/** 文献元数据 */
export interface LiteratureEntry {
  id: string;
  /** 标题 */
  title: string;
  /** 作者列表 */
  authors: string[];
  /** 发表年份 */
  year: number;
  /** 期刊或会议 */
  venue: string;
  /** DOI 或 URL（可选） */
  doi?: string;
  /** 摘要 / 核心内容（中文，便于检索匹配） */
  abstract: string;
  /** 关键词 */
  keywords: string[];
  /** 主题分类 */
  category: 'shpb-theory' | 'constitutive-model' | 'material-science' | 'signal-processing' | 'experimental-method' | 'simulation';
  /** 适用材料范围（可选） */
  materials?: string[];
}

/** 向量化文档（用于检索） */
export interface EmbeddedDocument {
  id: string;
  /** 原文本（用于显示） */
  text: string;
  /** 词频向量（稀疏） */
  vector: Map<string, number>;
  /** 向量模长（预计算以加速相似度） */
  norm: number;
  /** 关联的文献 id */
  literatureId: string;
  /** 文档类型：文献摘要 / 实验记录 / 知识点 */
  type: 'literature' | 'experiment' | 'knowledge';
}

/** 检索结果 */
export interface RetrievalResult {
  /** 文档 id */
  documentId: string;
  /** 关联文献 id */
  literatureId: string;
  /** 文本内容 */
  text: string;
  /** 相似度得分 0-1 */
  score: number;
  /** 文档类型 */
  type: EmbeddedDocument['type'];
  /** 命中的关键词 */
  matchedTerms: string[];
}

/** 引用信息（用于在 AI 回复中标注） */
export interface Citation {
  /** 引用编号 [1], [2] */
  index: number;
  /** 文献 id */
  literatureId: string;
  /** 显示文本：作者 et al. (年份) */
  shortLabel: string;
  /** 完整标题 */
  fullTitle: string;
  /** DOI */
  doi?: string;
}

/** RAG 增强后的提示上下文 */
export interface RAGContext {
  /** 检索到的相关片段 */
  retrievedChunks: RetrievalResult[];
  /** 自动生成的引用列表 */
  citations: Citation[];
  /** 注入到 LLM 提示词的上下文文本 */
  promptContext: string;
  /** 检索耗时 (ms) */
  retrievalDurationMs: number;
}

/** 历史实验记录（用于跨实验学习） */
export interface ExperimentMemory {
  id: string;
  timestamp: number;
  materialName: string;
  materialId: string;
  strainRate: number;
  temperature: number;
  /** J-C 拟合参数 */
  jcParams?: { A: number; B: number; n: number; C: number; m: number };
  /** 拟合优度 */
  fitR2?: number;
  /** 实验备注 */
  notes?: string;
  /** 衍生洞察（由 AI 自动生成） */
  insights?: string[];
}
