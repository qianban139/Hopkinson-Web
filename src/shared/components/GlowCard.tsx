// src/shared/components/GlowCard.tsx
// AI风格发光卡片组件
import { motion } from 'framer-motion';

interface GlowCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  glowColor?: string;
  pulse?: boolean;
  hoverable?: boolean;
  onClick?: () => void;
}

export default function GlowCard({
  children,
  className = '',
  style,
  glowColor = '#00F5FF',
  pulse = false,
  hoverable = true,
  onClick,
}: GlowCardProps) {
  return (
    <motion.div
      onClick={onClick}
      style={style}
      className={`relative rounded-xl border border-[${glowColor}]/20 bg-[#0A2540]/80 backdrop-blur-sm overflow-hidden ${
        hoverable ? 'cursor-pointer' : ''
      } ${className}`}
      whileHover={hoverable ? { scale: 1.01, borderColor: `${glowColor}40` } : undefined}
      transition={{ duration: 0.2 }}
    >
      {/* 顶部发光边线 */}
      <div
        className="absolute top-0 left-0 right-0 h-[1px]"
        style={{
          background: `linear-gradient(90deg, transparent, ${glowColor}60, transparent)`,
        }}
      />
      {/* 脉冲光效 */}
      {pulse && (
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            boxShadow: `inset 0 0 30px ${glowColor}10, 0 0 15px ${glowColor}08`,
          }}
          animate={{
            opacity: [0.3, 0.8, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
      {/* 内容 */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
