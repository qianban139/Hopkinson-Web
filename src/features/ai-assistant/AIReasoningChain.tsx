// src/features/ai-assistant/AIReasoningChain.tsx
// Agent 推理链可视化组件 — Phase 2 智能助手 2.0
//
// 在 AI 面板中以时间线形式展示 Agent 的思考过程：
//   1. 路由分析（哪个 Agent 接管）
//   2. 规划（要调用哪些工具）
//   3. 工具调用（每一次执行）
//   4. 观察（工具返回结果）
//   5. 结论（最终回复生成）

import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Search, Wrench, Eye, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { AgentThought } from './agent/types';

interface AIReasoningChainProps {
  thoughts: AgentThought[];
  /** 默认是否展开 */
  defaultExpanded?: boolean;
  /** Agent 角色色（用于头部高亮） */
  accentColor?: string;
}

const PHASE_META: Record<AgentThought['phase'], { icon: React.ElementType; label: string; color: string }> = {
  analyzing: { icon: Search, label: '分析', color: '#A78BFA' },
  planning: { icon: Brain, label: '规划', color: '#00F5FF' },
  tool_call: { icon: Wrench, label: '调用工具', color: '#FBBF24' },
  observing: { icon: Eye, label: '观察结果', color: '#10B981' },
  concluding: { icon: CheckCircle2, label: '生成结论', color: '#F472B6' },
};

export default function AIReasoningChain({
  thoughts,
  defaultExpanded = false,
  accentColor = '#00F5FF',
}: AIReasoningChainProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!thoughts || thoughts.length === 0) return null;

  return (
    <div className="my-2 rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
      {/* 头部 */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.04] transition-colors"
      >
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: `${accentColor}22`, boxShadow: `0 0 10px ${accentColor}33` }}
        >
          <Brain className="w-3.5 h-3.5" style={{ color: accentColor }} />
        </div>
        <div className="flex-1 text-left">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
            推理链
          </div>
          <div className="text-[10px] text-white/40">
            共 {thoughts.length} 步 · 点击{expanded ? '收起' : '展开'}
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-white/40" />
        ) : (
          <ChevronRight className="w-4 h-4 text-white/40" />
        )}
      </button>

      {/* 时间线 */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 space-y-2">
              {thoughts.map((thought, idx) => {
                const meta = PHASE_META[thought.phase];
                const Icon = meta.icon;
                const isLast = idx === thoughts.length - 1;
                return (
                  <div key={thought.id} className="flex gap-2.5 relative">
                    {/* 连接线 */}
                    {!isLast && (
                      <div
                        className="absolute left-[11px] top-6 w-px h-[calc(100%-8px)]"
                        style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.15), rgba(255,255,255,0.05))' }}
                      />
                    )}
                    {/* 阶段图标 */}
                    <div
                      className="flex-shrink-0 w-[22px] h-[22px] rounded-full flex items-center justify-center mt-0.5 z-10"
                      style={{ background: `${meta.color}22`, border: `1px solid ${meta.color}55` }}
                    >
                      <Icon className="w-3 h-3" style={{ color: meta.color }} />
                    </div>
                    {/* 内容 */}
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-baseline gap-1.5 mb-0.5">
                        <span
                          className="text-[10px] font-semibold uppercase tracking-wider"
                          style={{ color: meta.color }}
                        >
                          {meta.label}
                        </span>
                        <span className="text-[9px] text-white/30">
                          {new Date(thought.timestamp).toLocaleTimeString('zh-CN', { hour12: false })}
                        </span>
                      </div>
                      <div className="text-[12px] text-white/80 leading-relaxed break-words">
                        {thought.content}
                      </div>
                      {thought.toolCall && (
                        <div className="mt-1 px-2 py-1 rounded-md bg-black/30 border border-white/5 font-mono text-[10px] text-white/60 break-all">
                          {thought.toolCall.name}({JSON.stringify(thought.toolCall.arguments).replace(/[{}"]/g, '')})
                        </div>
                      )}
                      {thought.observation && (
                        <div className="mt-1 text-[11px] text-white/50 italic line-clamp-2">
                          ↳ {thought.observation}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
