// src/pages/Teaching.tsx
// AI教学系统页面 — 知识图谱 / 学习路径 / 测验 / 学习

import { motion } from 'framer-motion';
import { BookOpen, Map, Brain, GraduationCap, RotateCcw } from 'lucide-react';
import ModuleConnectionBadge from '@/shared/components/ModuleConnectionBadge';
import KnowledgeGraph from '@/features/teaching-system/KnowledgeGraph';
import LearningPaths from '@/features/teaching-system/LearningPaths';
import QuizPanel from '@/features/teaching-system/QuizPanel';
import StudyView from '@/features/teaching-system/StudyView';
import { useTeachingStore } from '@/features/teaching-system/useTeachingStore';
import { KNOWLEDGE_NODES } from '@/features/teaching-system/knowledgeData';

const tabs = [
  { id: 'paths' as const, label: '学习路径', icon: Map },
  { id: 'graph' as const, label: '知识图谱', icon: BookOpen },
  { id: 'quiz' as const, label: '在线测验', icon: Brain },
  { id: 'study' as const, label: '知识学习', icon: GraduationCap },
];

export default function Teaching() {
  const viewMode = useTeachingStore(s => s.viewMode);
  const setViewMode = useTeachingStore(s => s.setViewMode);
  const completedNodes = useTeachingStore(s => s.completedNodes);
  const quizResults = useTeachingStore(s => s.quizResults);
  const resetProgress = useTeachingStore(s => s.resetProgress);

  const totalCorrect = quizResults.filter(r => r.correct).length;
  const accuracy = quizResults.length > 0 ? (totalCorrect / quizResults.length * 100).toFixed(0) : '--';

  return (
    <div className="min-h-screen pt-24">
      {/* 模块连接指示 */}
      <div className="h-8 bg-[#051020] border-b border-[#00F5FF]/10 flex items-center px-4">
        <ModuleConnectionBadge
          dataTo={[
            { module: '虚拟实验室', path: '/lab' },
          ]}
          dataFrom={[
            { module: '虚拟实验室', path: '/lab', hasData: true },
          ]}
        />
      </div>

      <div className="h-[calc(100vh-128px)] flex flex-col">
        {/* 顶部统计栏 */}
        <div className="flex-shrink-0 h-14 bg-[#051020] border-b border-[#00F5FF]/10 flex items-center justify-between px-6">
          <div className="flex items-center gap-6">
            {/* Tab切换 */}
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = viewMode === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setViewMode(tab.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all relative ${
                    isActive
                      ? 'text-[#00F5FF] bg-[#00F5FF]/10'
                      : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {isActive && (
                    <motion.div layoutId="teaching-tab-indicator" className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#00F5FF] rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          {/* 右侧统计 */}
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#10B981]" />
                <span className="text-white/40">已学</span>
                <span className="text-white font-mono font-bold">{completedNodes.length}</span>
                <span className="text-white/30">/ {KNOWLEDGE_NODES.length}</span>
              </div>
              <div className="w-px h-4 bg-white/10" />
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
                <span className="text-white/40">测验</span>
                <span className="text-white font-mono font-bold">{quizResults.length}</span>
                <span className="text-white/30">题</span>
              </div>
              <div className="w-px h-4 bg-white/10" />
              <div className="flex items-center gap-1.5">
                <span className="text-white/40">正确率</span>
                <span className="text-[#10B981] font-mono font-bold">{accuracy}%</span>
              </div>
            </div>
            <button
              onClick={() => {
                if (window.confirm('确定要重置所有学习进度吗？')) resetProgress();
              }}
              className="p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors"
              title="重置进度"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 主内容 */}
        <div className="flex-1 min-h-0">
          {viewMode === 'paths' && <LearningPaths />}
          {viewMode === 'graph' && <KnowledgeGraph />}
          {viewMode === 'quiz' && <QuizPanel />}
          {viewMode === 'study' && <StudyView />}
        </div>
      </div>
    </div>
  );
}
