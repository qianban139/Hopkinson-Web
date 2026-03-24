// src/components/DataBusVisualization.tsx
// 模块间数据流可视化 - 展示实时数据管线图
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Shield, Beaker, Brain, Layers, BarChart3, Activity } from 'lucide-react';
import { useExperimentDataBus } from '@/store/useExperimentDataBus';
import GlowCard from '@/shared/components/GlowCard';

interface ModuleNode {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  path: string;
  x: number;
  y: number;
}

interface DataEdge {
  from: string;
  to: string;
  label: string;
  active: boolean;
}

const NODES: ModuleNode[] = [
  { id: 'monitor', label: '系统监控', icon: Shield, color: '#10B981', path: '/monitor', x: 80, y: 80 },
  { id: 'lab', label: '虚拟实验室', icon: Beaker, color: '#00F5FF', path: '/lab', x: 260, y: 50 },
  { id: 'ai', label: 'AI优化', icon: Brain, color: '#8B5CF6', path: '/ai', x: 440, y: 80 },
  { id: 'multifield', label: '多场耦合', icon: Layers, color: '#FF9F43', path: '/multifield', x: 350, y: 170 },
  { id: 'analysis', label: '材料分析', icon: BarChart3, color: '#F472B6', path: '/analysis', x: 170, y: 170 },
];

export default function DataBusVisualization({ className }: { className?: string }) {
  const { lastLabExperiment, aiOptimizedParams, lastMultiFieldExperiment, safetyChecklistCompleted, dataFlowLog } = useExperimentDataBus();

  const edges = useMemo((): DataEdge[] => [
    { from: 'monitor', to: 'lab', label: '安全检查', active: safetyChecklistCompleted },
    { from: 'lab', to: 'ai', label: '实验数据', active: !!lastLabExperiment },
    { from: 'ai', to: 'lab', label: '优化参数', active: !!aiOptimizedParams },
    { from: 'lab', to: 'analysis', label: '波形数据', active: !!lastLabExperiment },
    { from: 'multifield', to: 'analysis', label: '耦合数据', active: !!lastMultiFieldExperiment },
    { from: 'lab', to: 'multifield', label: '基准数据', active: !!lastLabExperiment },
  ], [safetyChecklistCompleted, lastLabExperiment, aiOptimizedParams, lastMultiFieldExperiment]);

  const nodeMap = useMemo(() => {
    const m: Record<string, ModuleNode> = {};
    NODES.forEach(n => m[n.id] = n);
    return m;
  }, []);

  // Recent data flow count
  const recentFlowCount = dataFlowLog.filter(e => Date.now() - e.timestamp < 60000).length;

  return (
    <GlowCard className={`p-5 ${className ?? ''}`} glowColor="#00F5FF" hoverable={false}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#00F5FF]" />
          数据流拓扑
        </h3>
        <span className="text-[10px] text-white/30">
          {recentFlowCount > 0 ? `${recentFlowCount} 条近期数据流` : '等待数据流'}
        </span>
      </div>

      <div className="relative w-full" style={{ height: 230 }}>
        <svg viewBox="0 0 520 230" className="w-full h-full">
          <defs>
            <marker id="dbv-arrow" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
              <polygon points="0 0, 6 2, 0 4" fill="#ffffff" opacity="0.5" />
            </marker>
            <filter id="dbv-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Edges */}
          {edges.map((edge) => {
            const fromNode = nodeMap[edge.from];
            const toNode = nodeMap[edge.to];
            if (!fromNode || !toNode) return null;

            const dx = toNode.x - fromNode.x;
            const dy = toNode.y - fromNode.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const ux = dx / len;
            const uy = dy / len;
            const shrink = 30;
            const x1 = fromNode.x + ux * shrink;
            const y1 = fromNode.y + uy * shrink;
            const x2 = toNode.x - ux * shrink;
            const y2 = toNode.y - uy * shrink;
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2 - 8;

            return (
              <g key={`${edge.from}-${edge.to}`}>
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={edge.active ? fromNode.color : '#ffffff15'}
                  strokeWidth={edge.active ? 1.5 : 0.8}
                  strokeOpacity={edge.active ? 0.5 : 0.2}
                  markerEnd="url(#dbv-arrow)"
                  strokeDasharray={edge.active ? '' : '4 4'}
                />
                {/* Animated data dot */}
                {edge.active && (
                  <motion.circle
                    r="3"
                    fill={fromNode.color}
                    opacity={0.8}
                    animate={{
                      cx: [x1, x2],
                      cy: [y1, y2],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'linear',
                      delay: Math.random() * 2,
                    }}
                  />
                )}
                {/* Label */}
                {edge.active && (
                  <text
                    x={midX}
                    y={midY}
                    textAnchor="middle"
                    fill="white"
                    fillOpacity={0.35}
                    fontSize="8"
                    fontFamily="sans-serif"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {NODES.map((node) => {
            const isActive = edges.some(e => (e.from === node.id || e.to === node.id) && e.active);

            return (
              <g key={node.id}>
                {/* Background glow */}
                {isActive && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={28}
                    fill={node.color}
                    opacity={0.08}
                    filter="url(#dbv-glow)"
                  />
                )}
                {/* Node circle */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={22}
                  fill={`${node.color}10`}
                  stroke={node.color}
                  strokeWidth={isActive ? 1.5 : 0.8}
                  strokeOpacity={isActive ? 0.6 : 0.2}
                />
                {/* Inner dot */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={6}
                  fill={isActive ? node.color : '#ffffff20'}
                  opacity={isActive ? 0.8 : 0.4}
                />
                {/* Label */}
                <text
                  x={node.x}
                  y={node.y + 35}
                  textAnchor="middle"
                  fill={isActive ? node.color : '#ffffff40'}
                  fontSize="10"
                  fontWeight={isActive ? '600' : '400'}
                  fontFamily="sans-serif"
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Clickable overlay links */}
        {NODES.map((node) => (
          <Link
            key={node.id}
            to={node.path}
            className="absolute"
            style={{
              left: `${(node.x / 520) * 100}%`,
              top: `${(node.y / 230) * 100}%`,
              width: 44,
              height: 44,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
            }}
          />
        ))}
      </div>
    </GlowCard>
  );
}
