import { motion } from 'framer-motion';
import { Train, Mountain, Shield, ArrowRight } from 'lucide-react';

interface SceneCardProps {
  title: string;
  subtitle: string;
  description: string;
  features: string[];
  scene: 'civil' | 'mining' | 'safety';
  index: number;
}

const sceneConfig = {
  civil: {
    icon: Train,
    color: '#00F5FF',
    gradient: 'from-[#00F5FF]/30 to-[#0080FF]/30',
    image: '土木路基',
  },
  mining: {
    icon: Mountain,
    color: '#FF9F43',
    gradient: 'from-[#FF9F43]/30 to-[#FF6B6B]/30',
    image: '深部采矿',
  },
  safety: {
    icon: Shield,
    color: '#1DD1A1',
    gradient: 'from-[#1DD1A1]/30 to-[#00F5FF]/30',
    image: '安全防护',
  },
};

export default function SceneCard({
  title,
  subtitle,
  description,
  features,
  scene,
  index,
}: SceneCardProps) {
  const config = sceneConfig[scene];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.15 }}
      whileHover={{ y: -8, transition: { duration: 0.3 } }}
      className="relative group cursor-pointer"
    >
      {/* 背景渐变 */}
      <div
        className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${config.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
      />

      <div className="relative tech-card h-full overflow-hidden">
        {/* 顶部装饰 */}
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{
            background: `linear-gradient(90deg, ${config.color}, transparent)`,
          }}
        />

        {/* 图标和标题 */}
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${config.color}20` }}
          >
            <Icon className="w-7 h-7" style={{ color: config.color }} />
          </div>
          <span
            className="px-3 py-1 rounded-full text-xs font-medium"
            style={{
              backgroundColor: `${config.color}20`,
              color: config.color,
            }}
          >
            {config.image}
          </span>
        </div>

        {/* 标题 */}
        <h3 className="text-xl font-bold text-white mb-1">{title}</h3>
        <p className="text-sm mb-4" style={{ color: config.color }}>
          {subtitle}
        </p>

        {/* 描述 */}
        <p className="text-sm text-white/60 mb-4 leading-relaxed">
          {description}
        </p>

        {/* 特性列表 */}
        <div className="space-y-2 mb-6">
          {features.map((feature, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: config.color }}
              />
              <span className="text-sm text-white/70">{feature}</span>
            </div>
          ))}
        </div>

        {/* 了解更多 */}
        <div className="flex items-center gap-2 text-sm font-medium group/link">
          <span style={{ color: config.color }}>了解更多</span>
          <ArrowRight
            className="w-4 h-4 transition-transform group-hover/link:translate-x-1"
            style={{ color: config.color }}
          />
        </div>

        {/* 底部装饰 */}
        <div className="absolute bottom-0 right-0 w-32 h-32 opacity-10">
          <Icon className="w-full h-full" style={{ color: config.color }} />
        </div>
      </div>
    </motion.div>
  );
}
