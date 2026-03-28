// src/features/teaching-system/LearningPaths.tsx
// 学习路径选择与进度展示

import { motion } from 'framer-motion';
import { CheckCircle2, Circle, MapPin, ArrowRight, BookOpen } from 'lucide-react';
import { LEARNING_PATHS, KNOWLEDGE_NODES } from './knowledgeData';
import { useTeachingStore } from './useTeachingStore';

export default function LearningPaths() {
  const completedNodes = useTeachingStore(s => s.completedNodes);
  const activePathId = useTeachingStore(s => s.activePathId);
  const setActivePath = useTeachingStore(s => s.setActivePath);
  const setSelectedNode = useTeachingStore(s => s.setSelectedNode);
  const setViewMode = useTeachingStore(s => s.setViewMode);

  const handleStartStudy = (nodeId: string) => {
    setSelectedNode(nodeId);
    setViewMode('study');
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* 页头 */}
        <div className="flex items-center gap-3">
          <MapPin className="w-5 h-5 text-[#00F5FF]" />
          <h2 className="text-white font-semibold text-lg">学习路径</h2>
        </div>
        <p className="text-white/40 text-sm -mt-3">选择一条路径，按步骤掌握霍普金森杆实验知识</p>

        {/* 总进度 */}
        <div className="bg-[#0A2540]/50 rounded-xl p-4 border border-[#00F5FF]/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/50">总体掌握进度</span>
            <span className="text-xs text-white/50 font-mono">
              {completedNodes.length} / {KNOWLEDGE_NODES.length}
            </span>
          </div>
          <div className="h-2 bg-[#051020] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#00F5FF] to-[#10B981] transition-all duration-500"
              style={{ width: `${(completedNodes.length / KNOWLEDGE_NODES.length) * 100}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[10px] text-white/30">入门</span>
            <span className="text-[10px] text-white/30">进阶</span>
            <span className="text-[10px] text-white/30">精通</span>
          </div>
        </div>

        {/* 路径列表 */}
        {LEARNING_PATHS.map((path, pi) => {
          const completedSteps = path.steps.filter(s => completedNodes.includes(s.nodeId)).length;
          const totalSteps = path.steps.length;
          const progress = totalSteps > 0 ? completedSteps / totalSteps : 0;
          const isActive = activePathId === path.id;
          const nextStep = path.steps.find(s => !completedNodes.includes(s.nodeId));
          const totalMinutes = path.steps.reduce((sum, s) => {
            const node = KNOWLEDGE_NODES.find(n => n.id === s.nodeId);
            return sum + (node?.estimatedMinutes || 0);
          }, 0);

          return (
            <motion.div
              key={path.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: pi * 0.1 }}
              className={`rounded-xl border overflow-hidden transition-all ${
                isActive ? 'border-white/20 bg-[#0A2540]/60' : 'border-white/10 bg-[#0A2540]/30 hover:border-white/15'
              }`}
            >
              {/* 路径头 */}
              <button
                onClick={() => setActivePath(isActive ? null : path.id)}
                className="w-full p-4 flex items-center gap-4 text-left"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${path.color}20`, border: `1px solid ${path.color}40` }}
                >
                  {progress >= 1 ? (
                    <CheckCircle2 className="w-6 h-6" style={{ color: path.color }} />
                  ) : (
                    <BookOpen className="w-5 h-5" style={{ color: path.color }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold">{path.title}</h3>
                    {progress >= 1 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#10B981]/20 text-[#10B981]">已完成</span>
                    )}
                  </div>
                  <p className="text-xs text-white/40 mt-0.5">{path.description}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex-1 h-1.5 bg-[#051020] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${progress * 100}%`, backgroundColor: path.color }}
                      />
                    </div>
                    <span className="text-[10px] text-white/40 font-mono">{completedSteps}/{totalSteps}</span>
                    <span className="text-[10px] text-white/30">~{totalMinutes}min</span>
                  </div>
                </div>
                <ArrowRight className={`w-5 h-5 text-white/30 transition-transform ${isActive ? 'rotate-90' : ''}`} />
              </button>

              {/* 展开步骤 */}
              {isActive && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  className="border-t border-white/5 px-4 pb-4"
                >
                  <div className="relative pl-6 pt-3 space-y-0">
                    {/* 纵轴线 */}
                    <div className="absolute left-[11px] top-3 bottom-3 w-px bg-white/10" />

                    {path.steps.map((step, si) => {
                      const node = KNOWLEDGE_NODES.find(n => n.id === step.nodeId);
                      if (!node) return null;
                      const isDone = completedNodes.includes(step.nodeId);
                      const isNext = nextStep?.nodeId === step.nodeId;

                      return (
                        <div key={step.nodeId} className="relative">
                          {/* 里程碑标记 */}
                          {step.milestone && si > 0 && (
                            <div className="flex items-center gap-2 mb-2 -ml-6">
                              <div className="w-[22px] flex justify-center">
                                <div className="w-2 h-2 rounded-full bg-[#FFD700]" />
                              </div>
                              <span className="text-[10px] text-[#FFD700]/70 font-medium">{step.milestone}</span>
                            </div>
                          )}

                          <button
                            onClick={() => handleStartStudy(step.nodeId)}
                            className={`w-full flex items-center gap-3 py-2.5 rounded-lg px-2 -ml-2 transition-all ${
                              isNext ? 'bg-white/5' : 'hover:bg-white/5'
                            }`}
                          >
                            {/* 节点圆点 */}
                            <div className="absolute left-0">
                              {isDone ? (
                                <CheckCircle2 className="w-[22px] h-[22px] text-[#10B981]" />
                              ) : isNext ? (
                                <div className="w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center" style={{ borderColor: path.color }}>
                                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: path.color }} />
                                </div>
                              ) : (
                                <Circle className="w-[22px] h-[22px] text-white/20" />
                              )}
                            </div>

                            <div className="flex-1 text-left ml-4">
                              <div className={`text-sm ${isDone ? 'text-white/50' : isNext ? 'text-white font-medium' : 'text-white/70'}`}>
                                {node.title}
                              </div>
                              <div className="text-[10px] text-white/30">
                                L{node.level} · ~{node.estimatedMinutes}min
                                {isNext && <span className="text-[#00F5FF] ml-2">← 当前</span>}
                              </div>
                            </div>

                            <ArrowRight className="w-3.5 h-3.5 text-white/20" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
