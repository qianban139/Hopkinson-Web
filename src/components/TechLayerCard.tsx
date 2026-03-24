import { motion } from 'framer-motion';
import { 
  Cpu, 
  Box, 
  BrainCircuit, 
  BarChart3,
  ArrowRight
} from 'lucide-react';

interface TechLayerCardProps {
  title: string;
  subtitle: string;
  description: string;
  features: string[];
  layer: 'physical' | 'digital' | 'ai' | 'data';
  index: number;
}

const layerConfig = {
  physical: {
    icon: Cpu,
    color: '#00F5FF',
    gradient: 'from-[#00F5FF]/20 to-[#0080FF]/20',
  },
  digital: {
    icon: Box,
    color: '#FF9F43',
    gradient: 'from-[#FF9F43]/20 to-[#FF6B6B]/20',
  },
  ai: {
    icon: BrainCircuit,
    color: '#1DD1A1',
    gradient: 'from-[#1DD1A1]/20 to-[#00F5FF]/20',
  },
  data: {
    icon: BarChart3,
    color: '#A29BFE',
    gradient: 'from-[#A29BFE]/20 to-[#FD79A8]/20',
  },
};

export default function TechLayerCard({
  title,
  subtitle,
  description,
  features,
  layer,
  index,
}: TechLayerCardProps) {
  const config = layerConfig[layer];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      whileHover={{ y: -8, transition: { duration: 0.3 } }}
      className="relative group"
    >
      <div
        className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${config.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
      />
      
      <div className="relative tech-card h-full flex flex-col">
        {/* 层数指示 */}
        <div className="absolute top-4 right-4">
          <span
            className="text-4xl font-bold opacity-20"
            style={{ color: config.color }}
          >
            0{index + 1}
          </span>
        </div>

        {/* 图标 */}
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
          style={{ backgroundColor: `${config.color}20` }}
        >
          <Icon className="w-7 h-7" style={{ color: config.color }} />
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
        <div className="flex-1">
          <ul className="space-y-2">
            {features.map((feature, i) => (
              <li key={i} className="flex items-start gap-2">
                <ArrowRight
                  className="w-4 h-4 mt-0.5 flex-shrink-0"
                  style={{ color: config.color }}
                />
                <span className="text-sm text-white/70">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 底部装饰线 */}
        <div
          className="mt-6 h-0.5 rounded-full"
          style={{
            background: `linear-gradient(90deg, ${config.color}, transparent)`,
          }}
        />
      </div>
    </motion.div>
  );
}
