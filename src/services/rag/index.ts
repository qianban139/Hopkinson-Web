/**
 * RAG 子系统 — 统一导出
 */

export * from './types';
export { tokenize, embed, buildIDF, cosineSimilarity, vectorNorm } from './embedding';
export { vectorStore, getLiteratureMeta } from './vectorStore';
export {
  retrieve,
  buildAugmentedQuery,
  extractUsedCitations,
  type RetrieveOptions,
} from './retrievalEngine';
export {
  experimentMemory,
  rememberExperiment,
  recallSimilarExperiments,
  type ExperimentRecallResult,
} from './experimentMemory';
