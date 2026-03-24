// src/shared/components/DataSourceIndicator.tsx
// 数据来源指示横幅
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';

interface DataSourceIndicatorProps {
  source: 'lab' | 'multifield' | 'ai' | 'none';
  description?: string;
  timestamp?: number;
  className?: string;
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  return `${hours}小时前`;
}

const sourceConfig = {
  lab: { label: '虚拟实验室', color: '#3B82F6', icon: '🔬' },
  multifield: { label: '多场耦合实验', color: '#8B5CF6', icon: '🌡️' },
  ai: { label: 'AI智能优化', color: '#10B981', icon: '🤖' },
  none: { label: '无实验数据', color: '#F59E0B', icon: '⚠️' },
};

export default function DataSourceIndicator({
  source,
  description,
  timestamp,
  className = '',
}: DataSourceIndicatorProps) {
  const config = sourceConfig[source];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${className}`}
      style={{
        borderColor: `${config.color}30`,
        backgroundColor: `${config.color}08`,
      }}
    >
      <span className="text-lg">{config.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/50">数据来源:</span>
          <span className="text-sm font-medium" style={{ color: config.color }}>
            {config.label}
          </span>
          {source === 'none' && (
            <span className="text-xs text-white/40">— 显示数据库默认值</span>
          )}
        </div>
        {description && (
          <p className="text-xs text-white/50 truncate mt-0.5">{description}</p>
        )}
      </div>
      {timestamp && source !== 'none' && (
        <div className="flex items-center gap-1 text-xs text-white/40">
          <Clock className="w-3 h-3" />
          {formatTimeAgo(timestamp)}
        </div>
      )}
    </motion.div>
  );
}
