// src/features/ai-assistant/LiteraturePanel.tsx
// 文献库面板 — 可在 AI 助手侧边展开，浏览/搜索/查看文献详情 + 知识图谱
import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Search, X, ChevronDown, ChevronRight,
  ExternalLink, Tag, Users, Calendar,
} from 'lucide-react';
import { LITERATURE_CORPUS, searchLiterature, getLiteratureByCategory } from '@/data/literature';
import type { LiteratureEntry } from '@/services/rag/types';
import { vectorStore } from '@/services/rag';
import LiteratureKnowledgeGraph from './LiteratureKnowledgeGraph';

/* ─────────── 分类配置 ─────────── */

const CATEGORY_META: Record<string, { label: string; color: string; icon: string }> = {
  'shpb-theory': { label: 'SHPB 理论', color: '#00F5FF', icon: '🔬' },
  'constitutive-model': { label: '本构模型', color: '#8B5CF6', icon: '📐' },
  'material-science': { label: '材料科学', color: '#F472B6', icon: '🧪' },
  'signal-processing': { label: '信号处理', color: '#FF9F43', icon: '📡' },
  'experimental-method': { label: '实验方法', color: '#10B981', icon: '⚙️' },
  'simulation': { label: '数值仿真', color: '#3B82F6', icon: '💻' },
};

/* ─────────── 组件 ─────────── */

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** 点击文献后的回调（如注入 AI 对话） */
  onCite?: (lit: LiteratureEntry) => void;
}

type ViewMode = 'list' | 'graph';

export default function LiteraturePanel({ isOpen, onClose, onCite }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [selectedLit, setSelectedLit] = useState<LiteratureEntry | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const filteredLiterature = useMemo(
    () => searchLiterature(searchQuery),
    [searchQuery],
  );

  const categories = useMemo(() => {
    const cats = [...new Set(filteredLiterature.map((l) => l.category))];
    return cats.map((cat) => ({
      key: cat,
      meta: CATEGORY_META[cat] || { label: cat, color: '#888', icon: '📄' },
      items: filteredLiterature.filter((l) => l.category === cat),
    }));
  }, [filteredLiterature]);

  const stats = useMemo(() => vectorStore.getStats(), []);

  const toggleCategory = useCallback((cat: string) => {
    setExpandedCategory((prev) => (prev === cat ? null : cat));
  }, []);

  const handleSelectFromGraph = useCallback((lit: LiteratureEntry) => {
    setSelectedLit(lit);
    setViewMode('list');
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 250 }}
        className="fixed right-0 top-0 bottom-0 w-[420px] bg-[#0A1628]/95 backdrop-blur-xl border-l border-white/10 z-[60] flex flex-col shadow-2xl"
      >
        {/* 头部 */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-white/10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#10B981]" />
              <h3 className="text-sm font-bold text-white">文献知识库</h3>
              <span className="text-[10px] text-white/40 px-1.5 py-0.5 rounded bg-white/5">
                {LITERATURE_CORPUS.length} 篇 · {stats.vocabularySize} 词
              </span>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 视图切换 */}
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                viewMode === 'list' ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-white/5 text-white/50 hover:text-white/70'
              }`}
            >
              列表
            </button>
            <button
              onClick={() => setViewMode('graph')}
              className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                viewMode === 'graph' ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-white/5 text-white/50 hover:text-white/70'
              }`}
            >
              知识图谱
            </button>
          </div>

          {/* 搜索栏 */}
          {viewMode === 'list' && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索文献（标题/作者/关键词）..."
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#10B981]/40"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {viewMode === 'graph' ? (
            <div className="h-full">
              <LiteratureKnowledgeGraph onSelectLiterature={handleSelectFromGraph} />
            </div>
          ) : selectedLit ? (
            /* 文献详情 */
            <div className="p-4 space-y-3">
              <button
                onClick={() => setSelectedLit(null)}
                className="text-xs text-[#10B981]/80 hover:text-[#10B981] flex items-center gap-1"
              >
                <ChevronRight className="w-3 h-3 rotate-180" /> 返回列表
              </button>
              <h4 className="text-sm font-bold text-white leading-snug">{selectedLit.title}</h4>
              <div className="flex items-center gap-2 text-[11px] text-white/50">
                <Users className="w-3 h-3" />
                {selectedLit.authors.join(', ')}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-white/50">
                <Calendar className="w-3 h-3" />
                {selectedLit.year} · {selectedLit.venue}
              </div>
              {selectedLit.doi && (
                <div className="flex items-center gap-2 text-[11px]">
                  <ExternalLink className="w-3 h-3 text-white/40" />
                  <span className="text-[#10B981]/70">{selectedLit.doi}</span>
                </div>
              )}
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedLit.keywords.map((kw) => (
                  <span key={kw} className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-white/50 border border-white/5">
                    {kw}
                  </span>
                ))}
              </div>
              <div className="text-xs text-white/70 leading-relaxed mt-2 p-3 rounded-lg bg-white/5 border border-white/5">
                {selectedLit.abstract}
              </div>
              {selectedLit.materials && selectedLit.materials.length > 0 && (
                <div className="text-[11px] text-white/50">
                  <Tag className="w-3 h-3 inline mr-1" />
                  适用材料：{selectedLit.materials.join('、')}
                </div>
              )}
              {onCite && (
                <button
                  onClick={() => onCite(selectedLit)}
                  className="w-full mt-2 px-3 py-2 rounded-lg bg-[#10B981]/15 border border-[#10B981]/20 text-[#10B981] text-xs hover:bg-[#10B981]/25 transition-colors"
                >
                  📎 引用到对话中
                </button>
              )}
            </div>
          ) : (
            /* 分类列表 */
            <div className="py-2">
              {categories.map(({ key, meta, items }) => (
                <div key={key}>
                  <button
                    onClick={() => toggleCategory(key)}
                    className="w-full flex items-center gap-2 px-4 py-2 hover:bg-white/5 transition-colors"
                  >
                    <span className="text-sm">{meta.icon}</span>
                    <span className="text-xs font-medium text-white/80 flex-1 text-left">{meta.label}</span>
                    <span className="text-[10px] text-white/30 mr-1">{items.length}</span>
                    {expandedCategory === key ? (
                      <ChevronDown className="w-3 h-3 text-white/30" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-white/30" />
                    )}
                  </button>
                  <AnimatePresence>
                    {expandedCategory === key && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        {items.map((lit) => (
                          <button
                            key={lit.id}
                            onClick={() => setSelectedLit(lit)}
                            className="w-full text-left px-4 pl-10 py-2 hover:bg-white/5 transition-colors border-l-2 ml-4"
                            style={{ borderColor: meta.color + '40' }}
                          >
                            <div className="text-[11px] text-white/70 leading-snug line-clamp-2">{lit.title}</div>
                            <div className="text-[10px] text-white/35 mt-0.5">
                              {lit.authors[0]}{lit.authors.length > 1 ? ' et al.' : ''} · {lit.year}
                            </div>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}

              {categories.length === 0 && (
                <div className="text-center py-8 text-xs text-white/30">
                  无匹配文献
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部提示 */}
        <div className="flex-shrink-0 px-4 py-2 border-t border-white/5 text-[10px] text-white/25 text-center">
          RAG 检索引擎 · TF-IDF 向量化 · {LITERATURE_CORPUS.length} 篇文献
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
