// src/components/AIInquiryFlow.tsx
// AI逐步询问用户实验需求 - 嵌入聊天界面
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Beaker, Zap, Activity, Thermometer, ChevronRight } from 'lucide-react';
import { useExperimentWorkflow, type TestType } from '@/store/experimentWorkflow';
// import { useAppStore } from '@/store/useAppStore';

// 常用材料快捷选择
const QUICK_MATERIALS = [
  { id: 'q235', name: 'Q235钢', category: '金属' },
  { id: 'al6061', name: '6061铝合金', category: '金属' },
  { id: 'ti6al4v', name: 'Ti-6Al-4V钛合金', category: '金属' },
  { id: 'granite', name: '花岗岩', category: '矿石' },
  { id: 'c50', name: 'C50混凝土', category: '混凝土' },
  { id: 'al2o3', name: '氧化铝陶瓷', category: '陶瓷' },
  { id: 'epoxy', name: '环氧树脂', category: '高分子' },
  { id: 'alfoam', name: '铝泡沫', category: '泡沫' },
];

const TEST_TYPES: { value: TestType; label: string; desc: string }[] = [
  { value: 'compression', label: '压缩测试', desc: 'SHPB压缩，测量动态压缩性能' },
  { value: 'tension', label: '拉伸测试', desc: 'SHTB拉伸，测量动态拉伸强度' },
  { value: 'shear', label: '剪切测试', desc: '动态剪切，测量剪切强度与断裂' },
];

const STRAIN_RATE_PRESETS = [
  { value: 500, label: '低速 500/s' },
  { value: 1000, label: '中速 1000/s' },
  { value: 3000, label: '高速 3000/s' },
  { value: 5000, label: '超高速 5000/s' },
  { value: 8000, label: '极高速 8000/s' },
];

interface AIInquiryFlowProps {
  onComplete: () => void;
}

export default function AIInquiryFlow({ onComplete }: AIInquiryFlowProps) {
  const { inquiryStep, setInquiryStep, requirements, updateRequirements, setPhase } = useExperimentWorkflow();
  const [customStrainRate, setCustomStrainRate] = useState('1000');

  // 进入下一步
  const nextStep = () => {
    const steps: typeof inquiryStep[] = ['material', 'testType', 'strainRate', 'specialConditions', 'confirm'];
    const currentIdx = steps.indexOf(inquiryStep);
    if (currentIdx < steps.length - 1) {
      setInquiryStep(steps[currentIdx + 1]);
    }
  };

  // 确认并进入安全检查
  const handleConfirm = () => {
    setPhase('safetyCheck');
    onComplete();
  };

  return (
    <div className="w-full space-y-3">
      {/* 步骤1: 选择材料 */}
      {inquiryStep === 'material' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="text-sm text-white/80 bg-white/5 rounded-lg p-3 border border-white/10">
            <span className="text-[#00F5FF] font-semibold">Step 1/5</span>
            <span className="mx-2 text-white/30">|</span>
            请选择要测试的材料：
          </div>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_MATERIALS.map(mat => (
              <button
                key={mat.id}
                onClick={() => {
                  updateRequirements({ materialId: mat.id, materialName: mat.name });
                  nextStep();
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#00F5FF]/5 border border-[#00F5FF]/20 text-sm text-white/80 hover:bg-[#00F5FF]/15 hover:border-[#00F5FF]/40 transition-all text-left"
              >
                <Beaker className="w-3.5 h-3.5 text-[#00F5FF] flex-shrink-0" />
                <div>
                  <div className="font-medium">{mat.name}</div>
                  <div className="text-xs text-white/40">{mat.category}</div>
                </div>
              </button>
            ))}
          </div>
          <p className="text-xs text-white/30 text-center">或在下方输入框告诉我具体材料名称</p>
        </motion.div>
      )}

      {/* 步骤2: 测试类型 */}
      {inquiryStep === 'testType' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="text-sm text-white/80 bg-white/5 rounded-lg p-3 border border-white/10">
            <span className="text-[#00F5FF] font-semibold">Step 2/5</span>
            <span className="mx-2 text-white/30">|</span>
            已选择 <span className="text-[#00F5FF]">{requirements.materialName}</span>，请选择测试类型：
          </div>
          <div className="space-y-2">
            {TEST_TYPES.map(tt => (
              <button
                key={tt.value}
                onClick={() => {
                  updateRequirements({ testType: tt.value });
                  nextStep();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-[#00F5FF]/5 border border-[#00F5FF]/20 text-left hover:bg-[#00F5FF]/15 hover:border-[#00F5FF]/40 transition-all"
              >
                <Zap className="w-4 h-4 text-[#00F5FF] flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-white/90">{tt.label}</div>
                  <div className="text-xs text-white/40">{tt.desc}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* 步骤3: 应变率 */}
      {inquiryStep === 'strainRate' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="text-sm text-white/80 bg-white/5 rounded-lg p-3 border border-white/10">
            <span className="text-[#00F5FF] font-semibold">Step 3/5</span>
            <span className="mx-2 text-white/30">|</span>
            请选择目标应变率范围 (10²-10⁴ /s)：
          </div>
          <div className="flex flex-wrap gap-2">
            {STRAIN_RATE_PRESETS.map(preset => (
              <button
                key={preset.value}
                onClick={() => {
                  updateRequirements({ strainRate: preset.value });
                  nextStep();
                }}
                className="px-3 py-2 rounded-lg bg-[#00F5FF]/5 border border-[#00F5FF]/20 text-sm text-white/80 hover:bg-[#00F5FF]/15 hover:border-[#00F5FF]/40 transition-all"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={customStrainRate}
              onChange={(e) => setCustomStrainRate(e.target.value)}
              placeholder="自定义应变率"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#00F5FF]/50"
            />
            <button
              onClick={() => {
                const rate = parseInt(customStrainRate);
                if (rate > 0) {
                  updateRequirements({ strainRate: rate });
                  nextStep();
                }
              }}
              className="px-4 py-2 bg-[#00F5FF] text-[#0A2540] rounded-lg text-sm font-medium hover:bg-[#00F5FF]/90"
            >
              确定
            </button>
          </div>
        </motion.div>
      )}

      {/* 步骤4: 特殊条件 */}
      {inquiryStep === 'specialConditions' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="text-sm text-white/80 bg-white/5 rounded-lg p-3 border border-white/10">
            <span className="text-[#00F5FF] font-semibold">Step 4/5</span>
            <span className="mx-2 text-white/30">|</span>
            是否需要特殊加载条件？
          </div>
          <div className="space-y-3">
            {/* 高温选项 */}
            <div className="px-4 py-3 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-orange-400" />
                  <span className="text-sm text-white/80">高温加载</span>
                </div>
                <button
                  onClick={() => updateRequirements({
                    specialConditions: {
                      ...requirements.specialConditions,
                      highTemperature: !requirements.specialConditions.highTemperature,
                    },
                  })}
                  className={`w-10 h-5 rounded-full transition-colors ${
                    requirements.specialConditions.highTemperature ? 'bg-[#00F5FF]' : 'bg-white/20'
                  }`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform mx-0.5 ${
                    requirements.specialConditions.highTemperature ? 'translate-x-5' : ''
                  }`} />
                </button>
              </div>
              {requirements.specialConditions.highTemperature && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="range" min="100" max="800" step="50"
                    value={requirements.specialConditions.temperature}
                    onChange={(e) => updateRequirements({
                      specialConditions: { ...requirements.specialConditions, temperature: parseInt(e.target.value) },
                    })}
                    className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-orange-400"
                  />
                  <span className="text-sm text-orange-400 font-mono w-16 text-right">{requirements.specialConditions.temperature}°C</span>
                </div>
              )}
            </div>

            {/* 围压选项 */}
            <div className="px-4 py-3 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-white/80">围压加载</span>
                </div>
                <button
                  onClick={() => updateRequirements({
                    specialConditions: {
                      ...requirements.specialConditions,
                      confinement: !requirements.specialConditions.confinement,
                    },
                  })}
                  className={`w-10 h-5 rounded-full transition-colors ${
                    requirements.specialConditions.confinement ? 'bg-[#00F5FF]' : 'bg-white/20'
                  }`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform mx-0.5 ${
                    requirements.specialConditions.confinement ? 'translate-x-5' : ''
                  }`} />
                </button>
              </div>
              {requirements.specialConditions.confinement && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="range" min="10" max="200" step="10"
                    value={requirements.specialConditions.confinementPressure}
                    onChange={(e) => updateRequirements({
                      specialConditions: { ...requirements.specialConditions, confinementPressure: parseInt(e.target.value) },
                    })}
                    className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-blue-400"
                  />
                  <span className="text-sm text-blue-400 font-mono w-20 text-right">{requirements.specialConditions.confinementPressure} MPa</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={nextStep}
            className="w-full py-2.5 bg-[#00F5FF]/10 border border-[#00F5FF]/30 rounded-lg text-sm text-[#00F5FF] hover:bg-[#00F5FF]/20 transition-colors"
          >
            {requirements.specialConditions.highTemperature || requirements.specialConditions.confinement
              ? '确认特殊条件，下一步'
              : '无特殊条件，下一步'}
          </button>
        </motion.div>
      )}

      {/* 步骤5: 确认 */}
      {inquiryStep === 'confirm' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="text-sm text-white/80 bg-white/5 rounded-lg p-3 border border-white/10">
            <span className="text-[#00F5FF] font-semibold">Step 5/5</span>
            <span className="mx-2 text-white/30">|</span>
            请确认以下实验参数：
          </div>
          <div className="rounded-lg bg-[#00F5FF]/5 border border-[#00F5FF]/20 divide-y divide-[#00F5FF]/10">
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-sm text-white/60">测试材料</span>
              <span className="text-sm text-[#00F5FF] font-medium">{requirements.materialName}</span>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-sm text-white/60">测试类型</span>
              <span className="text-sm text-white/90">
                {TEST_TYPES.find(t => t.value === requirements.testType)?.label}
              </span>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-sm text-white/60">目标应变率</span>
              <span className="text-sm text-white/90 font-mono">{requirements.strainRate} /s</span>
            </div>
            {requirements.specialConditions.highTemperature && (
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-sm text-white/60">高温加载</span>
                <span className="text-sm text-orange-400 font-mono">{requirements.specialConditions.temperature}°C</span>
              </div>
            )}
            {requirements.specialConditions.confinement && (
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-sm text-white/60">围压加载</span>
                <span className="text-sm text-blue-400 font-mono">{requirements.specialConditions.confinementPressure} MPa</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setInquiryStep('material')}
              className="flex-1 py-2.5 bg-white/5 border border-white/20 rounded-lg text-sm text-white/60 hover:bg-white/10 transition-colors"
            >
              重新选择
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-2.5 bg-[#00F5FF] text-[#0A2540] rounded-lg text-sm font-semibold hover:bg-[#00F5FF]/90 transition-colors"
            >
              确认，开始安全检查
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
