// src/shared/components/ModuleConnectionBadge.tsx
// 页面顶部显示数据来源/去向的徽章
import { motion } from 'framer-motion';
import { ArrowRight, ArrowLeft } from 'lucide-react';

interface ConnectionInfo {
  module: string;
  path: string;
  hasData?: boolean;
}

interface ModuleConnectionBadgeProps {
  dataFrom?: ConnectionInfo[];
  dataTo?: ConnectionInfo[];
  className?: string;
}

export default function ModuleConnectionBadge({
  dataFrom = [],
  dataTo = [],
  className = '',
}: ModuleConnectionBadgeProps) {
  if (dataFrom.length === 0 && dataTo.length === 0) return null;

  return (
    <div className={`flex items-center gap-3 text-xs ${className}`}>
      {dataFrom.length > 0 && (
        <div className="flex items-center gap-1.5">
          <ArrowLeft className="w-3 h-3 text-[#1DD1A1]" />
          <span className="text-white/40">数据来自:</span>
          {dataFrom.map((item) => (
            <motion.a
              key={item.module}
              href={item.path}
              className={`px-2 py-0.5 rounded-full border transition-colors ${
                item.hasData
                  ? 'border-[#1DD1A1]/50 text-[#1DD1A1] bg-[#1DD1A1]/10'
                  : 'border-white/20 text-white/40 bg-white/5'
              }`}
              whileHover={{ scale: 1.05 }}
            >
              {item.module}
              {item.hasData && (
                <motion.span
                  className="inline-block w-1.5 h-1.5 rounded-full bg-[#1DD1A1] ml-1"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
            </motion.a>
          ))}
        </div>
      )}
      {dataFrom.length > 0 && dataTo.length > 0 && (
        <div className="w-px h-4 bg-white/20" />
      )}
      {dataTo.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-white/40">数据流向:</span>
          {dataTo.map((item) => (
            <motion.a
              key={item.module}
              href={item.path}
              className="px-2 py-0.5 rounded-full border border-[#00F5FF]/30 text-[#00F5FF]/70 bg-[#00F5FF]/5 hover:bg-[#00F5FF]/10 transition-colors"
              whileHover={{ scale: 1.05 }}
            >
              {item.module}
            </motion.a>
          ))}
          <ArrowRight className="w-3 h-3 text-[#00F5FF]" />
        </div>
      )}
    </div>
  );
}
