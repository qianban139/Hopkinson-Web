import { motion } from 'framer-motion';
import 'katex/dist/katex.min.css';
import { BlockMath } from 'react-katex';
import { Brain, GitBranch, Target, TrendingUp } from 'lucide-react';

interface AISectionProps {
  step: 'idle' | 'lstm' | 'wgan' | 'ppo' | 'complete';
  progress: number;
  reward: number;
}

const stepConfig = {
  idle: { label: '等待启动', color: '#666', icon: Brain },
  lstm: { label: 'LSTM预测中', color: '#00F5FF', icon: Brain },
  wgan: { label: 'WGAN-GP生成中', color: '#FF9F43', icon: GitBranch },
  ppo: { label: 'PPO优化中', color: '#1DD1A1', icon: Target },
  complete: { label: '优化完成', color: '#FFD700', icon: TrendingUp },
};

export default function AISection({ step, progress, reward }: AISectionProps) {
  const config = stepConfig[step];
  const Icon = config.icon;

  return (
    <div className="space-y-6">
      {/* 进度指示器 */}
      <div className="tech-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${config.color}20` }}
            >
              <Icon className="w-5 h-5" style={{ color: config.color }} />
            </div>
            <div>
              <p className="text-sm text-white/60">当前步骤</p>
              <p className="text-lg font-semibold" style={{ color: config.color }}>
                {config.label}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-white/60">进度</p>
            <p className="text-2xl font-bold text-[#00F5FF]">{progress}%</p>
          </div>
        </div>

        {/* 进度条 */}
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${config.color}, ${config.color}80)`,
            }}
          />
        </div>

        {/* 三步指示 */}
        <div className="flex items-center justify-between mt-4">
          {(['lstm', 'wgan', 'ppo'] as const).map((s, i) => {
            const isActive = step === s || (step === 'complete');
            const isPast =
              step === 'complete' ||
              (step === 'ppo' && s !== 'ppo') ||
              (step === 'wgan' && s === 'lstm');

            return (
              <div key={s} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    isActive || isPast
                      ? 'bg-[#00F5FF] text-[#0A2540]'
                      : 'bg-white/10 text-white/50'
                  }`}
                >
                  {i + 1}
                </div>
                <span
                  className={`ml-2 text-sm ${
                    isActive || isPast ? 'text-white' : 'text-white/50'
                  }`}
                >
                  {s === 'lstm' && 'LSTM'}
                  {s === 'wgan' && 'WGAN-GP'}
                  {s === 'ppo' && 'PPO'}
                </span>
                {i < 2 && (
                  <div className="mx-4 w-8 h-0.5 bg-white/20" />
                )}
              </div>
            );
          })}
        </div>

        {/* 奖励值 */}
        {step === 'complete' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 bg-[#FFD700]/10 rounded-lg border border-[#FFD700]/30"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/70">优化奖励值</span>
              <span className="text-2xl font-bold text-[#FFD700]">
                {reward.toFixed(2)}
              </span>
            </div>
          </motion.div>
        )}
      </div>

      {/* 公式展示区 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LSTM公式 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="tech-card"
        >
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-5 h-5 text-[#00F5FF]" />
            <h4 className="text-lg font-semibold text-white">LSTM 材料感知</h4>
          </div>
          <div className="bg-[#0A2540] rounded-lg p-4 overflow-x-auto">
            <BlockMath math="h_t = \text{LSTM}(x_t, h_{t-1}, c_{t-1})" />
            <BlockMath math="x_t = [\dot{\epsilon}, k, c, e_t]" />
          </div>
          <p className="mt-3 text-sm text-white/60">
            输入特征包含应变率、刚度系数、阻尼系数和EMI强度，实现材料特性实时感知
          </p>
        </motion.div>

        {/* WGAN-GP公式 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="tech-card"
        >
          <div className="flex items-center gap-2 mb-4">
            <GitBranch className="w-5 h-5 text-[#FF9F43]" />
            <h4 className="text-lg font-semibold text-white">WGAN-GP 波形生成</h4>
          </div>
          <div className="bg-[#0A2540] rounded-lg p-4 overflow-x-auto">
            <BlockMath math="L_D = \mathbb{E}[D(\hat{x})] - \mathbb{E}[D(x)] + \lambda\mathbb{E}[(||\nabla D(\hat{x})||_2 - 1)^2]" />
            <BlockMath math="L_G = -\mathbb{E}[D(G(z))]" />
          </div>
          <p className="mt-3 text-sm text-white/60">
            梯度惩罚保证训练稳定性，生成器学习从随机噪声到目标波形的映射
          </p>
        </motion.div>

        {/* PPO公式 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="tech-card lg:col-span-2"
        >
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-[#1DD1A1]" />
            <h4 className="text-lg font-semibold text-white">PPO-Clip 强化学习优化</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#0A2540] rounded-lg p-4 overflow-x-auto">
              <p className="text-sm text-white/50 mb-2">目标函数</p>
              <BlockMath math="L^{\text{CLIP}}(\theta) = \hat{\mathbb{E}}_t[\min(r_t(\theta)\hat{A}_t, \text{clip}(r_t(\theta),1-\epsilon,1+\epsilon)\hat{A}_t)]" />
            </div>
            <div className="bg-[#0A2540] rounded-lg p-4 overflow-x-auto">
              <p className="text-sm text-white/50 mb-2">奖励函数</p>
              <BlockMath math="r_t = -\text{MSE} - \lambda_1 \cdot \text{EMI}_{\text{penalty}} + \lambda_2 \cdot \text{efficiency} - \lambda_3 \cdot \text{safety}" />
            </div>
          </div>
          <p className="mt-3 text-sm text-white/60">
            近端策略优化通过限制策略更新幅度，确保训练稳定性，奖励函数综合考虑波形误差、电磁干扰、效率和安全
          </p>
        </motion.div>
      </div>
    </div>
  );
}
