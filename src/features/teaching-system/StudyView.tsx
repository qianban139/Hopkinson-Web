// src/features/teaching-system/StudyView.tsx
// 知识节点详情阅读 + 标记已学

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen, Clock, CheckCircle2, Circle, ChevronRight } from 'lucide-react';
import { KNOWLEDGE_NODES, CATEGORY_META } from './knowledgeData';
import { useTeachingStore } from './useTeachingStore';

export default function StudyView() {
  const selectedNodeId = useTeachingStore(s => s.selectedNodeId);
  const completedNodes = useTeachingStore(s => s.completedNodes);
  const completeNode = useTeachingStore(s => s.completeNode);
  const uncompleteNode = useTeachingStore(s => s.uncompleteNode);
  const setSelectedNode = useTeachingStore(s => s.setSelectedNode);
  const setViewMode = useTeachingStore(s => s.setViewMode);

  const node = useMemo(() => KNOWLEDGE_NODES.find(n => n.id === selectedNodeId), [selectedNodeId]);

  if (!node) {
    return (
      <div className="h-full flex items-center justify-center text-white/40">
        <div className="text-center space-y-3">
          <BookOpen className="w-12 h-12 mx-auto opacity-30" />
          <p>请从知识图谱或学习路径中选择一个知识点</p>
          <button
            onClick={() => setViewMode('graph')}
            className="px-4 py-2 rounded-lg bg-[#00F5FF]/20 text-[#00F5FF] text-sm hover:bg-[#00F5FF]/30 transition-colors"
          >
            打开知识图谱
          </button>
        </div>
      </div>
    );
  }

  const meta = CATEGORY_META[node.category];
  const isCompleted = completedNodes.includes(node.id);
  const relatedNodes = node.connections
    .map(id => KNOWLEDGE_NODES.find(n => n.id === id))
    .filter(Boolean) as typeof KNOWLEDGE_NODES;

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      className="h-full flex flex-col"
    >
      {/* 顶部导航 */}
      <div className="flex-shrink-0 px-6 py-3 border-b border-[#00F5FF]/10 flex items-center justify-between">
        <button
          onClick={() => setViewMode('graph')}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          返回图谱
        </button>
        <button
          onClick={() => isCompleted ? uncompleteNode(node.id) : completeNode(node.id)}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            isCompleted
              ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30'
              : 'bg-[#00F5FF]/20 text-[#00F5FF] border border-[#00F5FF]/30 hover:bg-[#00F5FF]/30'
          }`}
        >
          {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
          {isCompleted ? '已掌握' : '标记已学'}
        </button>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
          {/* 标题 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: `${meta.color}20`, color: meta.color }}>
                {meta.icon} {meta.label}
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-mono bg-white/5 text-white/40">
                Level {node.level}
              </span>
              <span className="flex items-center gap-1 text-xs text-white/40">
                <Clock className="w-3 h-3" />
                ~{node.estimatedMinutes}分钟
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white">{node.title}</h1>
            {node.subtitle && <p className="text-white/40 text-sm mt-1">{node.subtitle}</p>}
          </div>

          {/* 关键公式卡片 */}
          {node.keyFormulas && node.keyFormulas.length > 0 && (
            <div className="bg-gradient-to-r from-[#8B5CF6]/10 to-[#00F5FF]/10 rounded-xl p-4 border border-[#8B5CF6]/20">
              <div className="text-xs text-[#8B5CF6] font-medium mb-2">核心公式</div>
              <div className="flex flex-wrap gap-3">
                {node.keyFormulas.map((f, i) => (
                  <code key={i} className="px-3 py-1.5 rounded-lg bg-[#0A2540]/60 text-[#00F5FF] font-mono text-sm border border-[#00F5FF]/15">
                    {f}
                  </code>
                ))}
              </div>
            </div>
          )}

          {/* 正文内容（简化Markdown渲染） */}
          <div className="prose-dark">
            {renderMarkdown(node.content)}
          </div>

          {/* 关联知识 */}
          {relatedNodes.length > 0 && (
            <div className="border-t border-[#00F5FF]/10 pt-6">
              <h3 className="text-sm font-medium text-white/60 mb-3">关联知识</h3>
              <div className="grid grid-cols-2 gap-2">
                {relatedNodes.map(rn => {
                  const rm = CATEGORY_META[rn.category];
                  const done = completedNodes.includes(rn.id);
                  return (
                    <button
                      key={rn.id}
                      onClick={() => setSelectedNode(rn.id)}
                      className="p-3 rounded-xl border border-white/10 hover:border-white/25 bg-[#0A2540]/40 hover:bg-[#0A2540] transition-all text-left flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: done ? 'rgba(16,185,129,0.2)' : `${rm.color}20` }}>
                        {done ? <CheckCircle2 className="w-4 h-4 text-[#10B981]" /> :
                          <span className="text-sm">{rm.icon}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-xs font-medium truncate">{rn.title}</div>
                        <div className="text-[10px] text-white/40">L{rn.level} · ~{rn.estimatedMinutes}min</div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/** 简化Markdown渲染 - 支持标题、列表、表格、代码、粗体 */
function renderMarkdown(content: string) {
  const lines = content.split('\n');
  const elements: JSX.Element[] = [];
  let i = 0;
  let tableRows: string[][] = [];
  let inTable = false;

  while (i < lines.length) {
    const line = lines[i];

    // 表格
    if (line.includes('|') && line.trim().startsWith('|')) {
      if (!inTable) { inTable = true; tableRows = []; }
      const cells = line.split('|').map(c => c.trim()).filter(Boolean);
      // 跳过分隔行
      if (!cells.every(c => /^[-:]+$/.test(c))) {
        tableRows.push(cells);
      }
      i++;
      // 如果下一行不是表格，输出
      if (i >= lines.length || !lines[i].includes('|') || !lines[i].trim().startsWith('|')) {
        inTable = false;
        elements.push(
          <div key={`tbl-${i}`} className="overflow-x-auto my-3">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  {tableRows[0]?.map((h, j) => (
                    <th key={j} className="px-3 py-2 text-left text-white/60 bg-[#0A2540]/60 border-b border-white/10 font-medium">
                      {formatInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.slice(1).map((row, ri) => (
                  <tr key={ri} className="border-b border-white/5">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-1.5 text-white/70">{formatInline(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
      }
      continue;
    }

    // 标题
    if (line.startsWith('### ')) {
      elements.push(<h4 key={i} className="text-sm font-bold text-white mt-5 mb-2">{formatInline(line.slice(4))}</h4>);
      i++; continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<h3 key={i} className="text-lg font-bold text-white mt-6 mb-3">{formatInline(line.slice(3))}</h3>);
      i++; continue;
    }

    // 公式块
    if (line.trim().startsWith('$$')) {
      const formula = line.trim().replace(/\$\$/g, '');
      elements.push(
        <div key={i} className="my-3 px-4 py-2.5 rounded-lg bg-[#0A2540]/60 border border-[#8B5CF6]/15 text-center">
          <code className="text-[#00F5FF] font-mono text-sm">{formula}</code>
        </div>
      );
      i++; continue;
    }

    // 列表
    if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={i} className="flex gap-2 my-0.5 ml-2">
          <span className="text-[#00F5FF] mt-0.5">•</span>
          <span className="text-sm text-white/70 leading-relaxed">{formatInline(line.slice(2))}</span>
        </div>
      );
      i++; continue;
    }

    // 有序列表
    const olMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      elements.push(
        <div key={i} className="flex gap-2 my-0.5 ml-2">
          <span className="text-[#FFD700] text-xs font-mono mt-0.5 w-4">{olMatch[1]}.</span>
          <span className="text-sm text-white/70 leading-relaxed">{formatInline(olMatch[2])}</span>
        </div>
      );
      i++; continue;
    }

    // 空行
    if (!line.trim()) { i++; continue; }

    // 普通段落
    elements.push(<p key={i} className="text-sm text-white/70 leading-relaxed my-2">{formatInline(line)}</p>);
    i++;
  }

  return <>{elements}</>;
}

/** 内联格式化: **bold**, `code`, 公式 */
function formatInline(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  let remaining = text;
  let key = 0;

  while (remaining) {
    // **bold**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // `code`
    const codeMatch = remaining.match(/`(.+?)`/);

    const matches = [
      boldMatch ? { type: 'bold', match: boldMatch, index: boldMatch.index! } : null,
      codeMatch ? { type: 'code', match: codeMatch, index: codeMatch.index! } : null,
    ].filter(Boolean).sort((a, b) => a!.index - b!.index);

    if (matches.length === 0) {
      parts.push(remaining);
      break;
    }

    const first = matches[0]!;
    if (first.index > 0) {
      parts.push(remaining.slice(0, first.index));
    }

    if (first.type === 'bold') {
      parts.push(<strong key={key++} className="text-white font-semibold">{first.match![1]}</strong>);
    } else {
      parts.push(<code key={key++} className="px-1.5 py-0.5 rounded bg-[#0A2540]/80 text-[#00F5FF] text-xs font-mono">{first.match![1]}</code>);
    }

    remaining = remaining.slice(first.index + first.match![0].length);
  }

  return parts;
}
