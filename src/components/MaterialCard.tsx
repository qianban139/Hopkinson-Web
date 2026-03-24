import { motion } from 'framer-motion';
import type { Material } from '@/types';
import type { LucideIcon } from 'lucide-react';
import { 
  Circle, 
  Mountain, 
  Building2, 
  Flame, 
  Droplets, 
  Shield, 
  Bone,
  Activity,
  Zap
} from 'lucide-react';

interface MaterialCardProps {
  material: Material;
  isSelected?: boolean;
  onClick?: () => void;
  variant?: 'default' | 'compact';
}

const categoryIcons: Record<string, LucideIcon> = {
  '金属': Circle,
  '矿石': Mountain,
  '混凝土': Building2,
  '陶瓷': Flame,
  '高分子材料': Droplets,
  '吸能材料': Shield,
  '生物材料': Bone,
};

const categoryColors: Record<string, string> = {
  '金属': '#00F5FF',
  '矿石': '#FF9F43',
  '混凝土': '#A0A0A0',
  '陶瓷': '#FF6B6B',
  '高分子材料': '#48DBFB',
  '吸能材料': '#1DD1A1',
  '生物材料': '#FF9FF3',
};

export default function MaterialCard({
  material,
  isSelected = false,
  onClick,
  variant = 'default',
}: MaterialCardProps) {
  const Icon = categoryIcons[material.category] || Activity;
  const color = categoryColors[material.category] || '#00F5FF';

  if (variant === 'compact') {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className={`p-3 rounded-lg cursor-pointer transition-all duration-300 ${
          isSelected
            ? 'bg-[#00F5FF]/20 border-2 border-[#00F5FF]'
            : 'bg-[#051020] border border-[#00F5FF]/20 hover:border-[#00F5FF]/50'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${color}20` }}
          >
            <Icon className="w-5 h-5" style={{ color: color }} />
          </div>
          <div>
            <h4 className="text-sm font-medium text-white">{material.name}</h4>
            <p className="text-xs text-white/50">{material.category}</p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onClick={onClick}
      className={`tech-card tech-card-hover cursor-pointer ${
        isSelected ? 'ring-2 ring-[#00F5FF]' : ''
      }`}
    >
      {/* 头部 */}
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon className="w-6 h-6" style={{ color: color }} />
        </div>
        <span className="tech-badge">{material.preferredWaveform}</span>
      </div>

      {/* 内容 */}
      <h3 className="text-lg font-semibold text-white mb-2">{material.name}</h3>
      <p className="text-sm text-white/60 mb-4">{material.category}</p>

      {/* 参数 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/50">典型应变率</span>
          <span className="text-[#00F5FF]">{material.typicalStrainRate}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/50">破坏时刻</span>
          <span className="text-[#FFD700]">{material.destructionTime}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/50">刚度系数</span>
          <span className="text-white/80">{material.stiffnessK} GPa</span>
        </div>
      </div>

      {/* 应用 */}
      <div className="mt-4 pt-4 border-t border-[#00F5FF]/10">
        <p className="text-xs text-white/40 mb-2">应用场景</p>
        <div className="flex flex-wrap gap-1">
          {material.applications.slice(0, 2).map((app, index) => (
            <span
              key={index}
              className="text-xs px-2 py-1 rounded bg-white/5 text-white/60"
            >
              {app}
            </span>
          ))}
        </div>
      </div>

      {/* EMI阈值指示 */}
      <div className="mt-4 flex items-center gap-2">
        <Zap className="w-4 h-4 text-[#FFD700]" />
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(material.emiThreshold / 100) * 100}%`,
              backgroundColor: material.emiThreshold > 90 ? '#FF2E63' : '#00F5FF',
            }}
          />
        </div>
        <span className="text-xs text-white/50">{material.emiThreshold}dB</span>
      </div>
    </motion.div>
  );
}
