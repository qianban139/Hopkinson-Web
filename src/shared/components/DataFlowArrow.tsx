// src/shared/components/DataFlowArrow.tsx
// 模块间数据流动画箭头
import { motion } from 'framer-motion';

interface DataFlowArrowProps {
  direction?: 'right' | 'left' | 'down' | 'up';
  label?: string;
  color?: string;
  active?: boolean;
  className?: string;
}

export default function DataFlowArrow({
  direction = 'right',
  label,
  color = '#00F5FF',
  active = true,
  className = '',
}: DataFlowArrowProps) {
  const isHorizontal = direction === 'right' || direction === 'left';
  const isReverse = direction === 'left' || direction === 'up';

  return (
    <div
      className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} items-center gap-1 ${className}`}
      style={{ opacity: active ? 1 : 0.3 }}
    >
      {/* 流动粒子线 */}
      <div
        className={`relative overflow-hidden ${
          isHorizontal ? 'w-full h-[2px]' : 'w-[2px] h-full'
        }`}
        style={{ backgroundColor: `${color}30` }}
      >
        {active && (
          <motion.div
            className={`absolute ${isHorizontal ? 'h-full w-4' : 'w-full h-4'}`}
            style={{
              background: `linear-gradient(${isHorizontal ? '90deg' : '180deg'}, transparent, ${color}, transparent)`,
            }}
            animate={
              isHorizontal
                ? { x: isReverse ? ['100%', '-100%'] : ['-100%', '500%'] }
                : { y: isReverse ? ['100%', '-100%'] : ['-100%', '500%'] }
            }
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        )}
      </div>
      {/* 箭头 */}
      <svg
        width={isHorizontal ? 12 : 8}
        height={isHorizontal ? 8 : 12}
        viewBox={isHorizontal ? '0 0 12 8' : '0 0 8 12'}
        className={`flex-shrink-0 ${isReverse ? (isHorizontal ? 'rotate-180' : 'rotate-180') : ''}`}
      >
        {isHorizontal ? (
          <path d="M0,0 L12,4 L0,8 Z" fill={color} opacity={active ? 0.8 : 0.3} />
        ) : (
          <path d="M0,0 L8,0 L4,12 Z" fill={color} opacity={active ? 0.8 : 0.3} />
        )}
      </svg>
      {/* 标签 */}
      {label && (
        <span className="text-[10px] whitespace-nowrap" style={{ color: `${color}CC` }}>
          {label}
        </span>
      )}
    </div>
  );
}
