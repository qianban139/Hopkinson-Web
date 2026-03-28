// src/features/teaching-system/QuizPanel.tsx
// 在线测验面板

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, RotateCcw, Trophy, ArrowRight, Brain, Zap } from 'lucide-react';
import { QUIZ_QUESTIONS, KNOWLEDGE_NODES } from './knowledgeData';
import { useTeachingStore } from './useTeachingStore';

type QuizState = 'ready' | 'answering' | 'result' | 'summary';

export default function QuizPanel() {
  const [quizState, setQuizState] = useState<QuizState>('ready');
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [sessionResults, setSessionResults] = useState<{ qId: string; correct: boolean }[]>([]);
  const addQuizResult = useTeachingStore(s => s.addQuizResult);
  const quizResults = useTeachingStore(s => s.quizResults);

  // 按难度筛选题目
  const questions = useMemo(() =>
    QUIZ_QUESTIONS.filter(q => q.difficulty <= difficulty).sort(() => Math.random() - 0.5).slice(0, 10),
    [difficulty]
  );

  const currentQ = questions[currentIndex];

  const handleStart = useCallback((diff: 1 | 2 | 3) => {
    setDifficulty(diff);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setSessionResults([]);
    setQuizState('answering');
  }, []);

  const handleAnswer = useCallback((optIndex: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(optIndex);
    setShowExplanation(true);
    const correct = optIndex === currentQ.correctIndex;
    setSessionResults(prev => [...prev, { qId: currentQ.id, correct }]);
    addQuizResult({ questionId: currentQ.id, correct, timestamp: Date.now() });
  }, [selectedAnswer, currentQ, addQuizResult]);

  const handleNext = useCallback(() => {
    if (currentIndex + 1 >= questions.length) {
      setQuizState('summary');
    } else {
      setCurrentIndex(i => i + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    }
  }, [currentIndex, questions.length]);

  // 历史统计
  const totalAnswered = quizResults.length;
  const totalCorrect = quizResults.filter(r => r.correct).length;
  const accuracy = totalAnswered > 0 ? (totalCorrect / totalAnswered * 100).toFixed(0) : '0';

  return (
    <div className="h-full flex flex-col bg-[#051020]">
      {/* 头部统计 */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-[#00F5FF]/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="w-5 h-5 text-[#8B5CF6]" />
          <h2 className="text-white font-semibold">知识测验</h2>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="text-white/50">
            累计答题 <span className="text-white font-mono">{totalAnswered}</span>
          </div>
          <div className="text-white/50">
            正确率 <span className="text-[#10B981] font-mono">{accuracy}%</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <AnimatePresence mode="wait">
          {/* 准备界面 */}
          {quizState === 'ready' && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-lg mx-auto space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-[#8B5CF6]/20 flex items-center justify-center">
                  <Trophy className="w-8 h-8 text-[#8B5CF6]" />
                </div>
                <h3 className="text-xl text-white font-bold">开始测验</h3>
                <p className="text-white/50 text-sm">检验你对霍普金森杆实验的掌握程度</p>
              </div>

              <div className="space-y-3">
                {([
                  { diff: 1 as const, label: '基础', desc: '应力波、SHPB原理、安全规范', color: '#3B82F6', icon: '📐' },
                  { diff: 2 as const, label: '进阶', desc: '三波法、J-C模型、波阻抗匹配', color: '#F59E0B', icon: '📊' },
                  { diff: 3 as const, label: '挑战', desc: '应力平衡验证、前沿技术', color: '#EF4444', icon: '🚀' },
                ]).map(d => (
                  <button
                    key={d.diff}
                    onClick={() => handleStart(d.diff)}
                    className="w-full p-4 rounded-xl border border-white/10 hover:border-white/30 bg-[#0A2540]/50 hover:bg-[#0A2540] transition-all text-left flex items-center gap-4"
                  >
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: `${d.color}20` }}>
                      {d.icon}
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-medium flex items-center gap-2">
                        {d.label}
                        <div className="flex gap-0.5">
                          {Array.from({ length: d.diff }).map((_, i) => (
                            <Zap key={i} className="w-3 h-3" style={{ color: d.color }} />
                          ))}
                        </div>
                      </div>
                      <div className="text-xs text-white/40 mt-0.5">{d.desc}</div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-white/30" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* 答题界面 */}
          {quizState === 'answering' && currentQ && (
            <motion.div
              key={`q-${currentIndex}`}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              className="max-w-lg mx-auto space-y-6"
            >
              {/* 进度 */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-[#0A2540] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#00F5FF] transition-all duration-300"
                    style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-white/50 font-mono">{currentIndex + 1}/{questions.length}</span>
              </div>

              {/* 题目 */}
              <div className="bg-[#0A2540]/60 rounded-xl p-5 border border-[#00F5FF]/10">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#8B5CF6]/20 text-[#8B5CF6]">
                    {KNOWLEDGE_NODES.find(n => n.id === currentQ.relatedNodeId)?.title || ''}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 text-white/40">
                    难度 {'★'.repeat(currentQ.difficulty)}
                  </span>
                </div>
                <p className="text-white text-base leading-relaxed">{currentQ.question}</p>
              </div>

              {/* 选项 */}
              <div className="space-y-2">
                {currentQ.options.map((opt, i) => {
                  const isSelected = selectedAnswer === i;
                  const isCorrect = i === currentQ.correctIndex;
                  const showResult = selectedAnswer !== null;
                  const bgClass = showResult
                    ? isCorrect
                      ? 'bg-[#10B981]/15 border-[#10B981]/50'
                      : isSelected
                        ? 'bg-[#EF4444]/15 border-[#EF4444]/50'
                        : 'bg-[#0A2540]/30 border-white/5 opacity-50'
                    : 'bg-[#0A2540]/50 border-white/10 hover:border-[#00F5FF]/40 hover:bg-[#0A2540] cursor-pointer';

                  return (
                    <button
                      key={i}
                      onClick={() => handleAnswer(i)}
                      disabled={selectedAnswer !== null}
                      className={`w-full p-3.5 rounded-xl border transition-all text-left flex items-center gap-3 ${bgClass}`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                        showResult && isCorrect ? 'bg-[#10B981] text-white' :
                        showResult && isSelected ? 'bg-[#EF4444] text-white' :
                        'bg-white/10 text-white/50'
                      }`}>
                        {showResult && isCorrect ? <CheckCircle2 className="w-4 h-4" /> :
                         showResult && isSelected ? <XCircle className="w-4 h-4" /> :
                         String.fromCharCode(65 + i)}
                      </div>
                      <span className="text-white/90 text-sm">{opt}</span>
                    </button>
                  );
                })}
              </div>

              {/* 解析 */}
              <AnimatePresence>
                {showExplanation && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-[#0A2540]/60 rounded-xl p-4 border border-[#FFD700]/20"
                  >
                    <div className="text-xs text-[#FFD700] font-medium mb-1">解析</div>
                    <p className="text-sm text-white/70 leading-relaxed">{currentQ.explanation}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 下一题按钮 */}
              {selectedAnswer !== null && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={handleNext}
                  className="w-full py-3 rounded-xl bg-[#00F5FF]/20 text-[#00F5FF] font-medium border border-[#00F5FF]/30 hover:bg-[#00F5FF]/30 transition-colors flex items-center justify-center gap-2"
                >
                  {currentIndex + 1 >= questions.length ? '查看结果' : '下一题'}
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              )}
            </motion.div>
          )}

          {/* 结果界面 */}
          {quizState === 'summary' && (
            <motion.div
              key="summary"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-lg mx-auto space-y-6 text-center"
            >
              {(() => {
                const correctCount = sessionResults.filter(r => r.correct).length;
                const total = sessionResults.length;
                const rate = total > 0 ? correctCount / total : 0;
                const grade = rate >= 0.9 ? 'S' : rate >= 0.7 ? 'A' : rate >= 0.5 ? 'B' : 'C';
                const gradeColor = rate >= 0.9 ? '#FFD700' : rate >= 0.7 ? '#10B981' : rate >= 0.5 ? '#F59E0B' : '#EF4444';

                return (
                  <>
                    <div className="w-24 h-24 mx-auto rounded-full flex items-center justify-center border-4" style={{ borderColor: gradeColor, backgroundColor: `${gradeColor}15` }}>
                      <span className="text-4xl font-black" style={{ color: gradeColor }}>{grade}</span>
                    </div>
                    <div>
                      <h3 className="text-2xl text-white font-bold">测验完成</h3>
                      <p className="text-white/50 mt-1">
                        答对 <span className="text-[#10B981] font-mono font-bold">{correctCount}</span> / {total} 题，
                        正确率 <span className="font-mono font-bold" style={{ color: gradeColor }}>{(rate * 100).toFixed(0)}%</span>
                      </p>
                    </div>

                    {/* 逐题回顾 */}
                    <div className="flex flex-wrap justify-center gap-2">
                      {sessionResults.map((r, i) => (
                        <div
                          key={i}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                            r.correct ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#EF4444]/20 text-[#EF4444]'
                          }`}
                        >
                          {i + 1}
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={() => { setQuizState('ready'); }}
                        className="px-6 py-2.5 rounded-xl bg-[#0A2540] border border-white/10 text-white/70 hover:border-white/30 transition-colors flex items-center gap-2"
                      >
                        <RotateCcw className="w-4 h-4" />
                        再来一次
                      </button>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
