// src/features/ai-assistant/LiteratureKnowledgeGraph.tsx
// 文献知识图谱 — Canvas 力导向布局，展示文献间的主题与材料关联
import { useRef, useEffect, useCallback, useState } from 'react';
import { LITERATURE_CORPUS } from '@/data/literature';
import type { LiteratureEntry } from '@/services/rag/types';

/* ─────────── 图节点/边类型 ─────────── */

interface GraphNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  label: string;
  type: 'topic' | 'paper' | 'material';
  color: string;
  radius: number;
  /** 关联的文献 id（paper 节点） */
  litId?: string;
}

interface GraphEdge {
  source: string;
  target: string;
}

/* ─────────── 颜色 ─────────── */

const TOPIC_COLORS: Record<string, string> = {
  'shpb-theory': '#00F5FF',
  'constitutive-model': '#8B5CF6',
  'material-science': '#F472B6',
  'signal-processing': '#FF9F43',
  'experimental-method': '#10B981',
  'simulation': '#3B82F6',
};

const TOPIC_LABELS: Record<string, string> = {
  'shpb-theory': 'SHPB 理论',
  'constitutive-model': '本构模型',
  'material-science': '材料科学',
  'signal-processing': '信号处理',
  'experimental-method': '实验方法',
  'simulation': '数值仿真',
};

const MATERIAL_COLOR = '#F59E0B';

/* ─────────── 构建图数据 ─────────── */

function buildGraph(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const cx = 400, cy = 250;

  // 主题节点（6 个分类）
  const categories = [...new Set(LITERATURE_CORPUS.map((l) => l.category))];
  const angleStep = (2 * Math.PI) / categories.length;
  categories.forEach((cat, i) => {
    const angle = angleStep * i - Math.PI / 2;
    nodes.push({
      id: `topic_${cat}`,
      x: cx + Math.cos(angle) * 200 + (Math.random() - 0.5) * 20,
      y: cy + Math.sin(angle) * 160 + (Math.random() - 0.5) * 20,
      vx: 0, vy: 0,
      label: TOPIC_LABELS[cat] || cat,
      type: 'topic',
      color: TOPIC_COLORS[cat] || '#888',
      radius: 22,
    });
  });

  // 文献节点
  LITERATURE_CORPUS.forEach((lit) => {
    const topicNode = nodes.find((n) => n.id === `topic_${lit.category}`);
    const bx = topicNode ? topicNode.x : cx;
    const by = topicNode ? topicNode.y : cy;
    nodes.push({
      id: `paper_${lit.id}`,
      x: bx + (Math.random() - 0.5) * 120,
      y: by + (Math.random() - 0.5) * 100,
      vx: 0, vy: 0,
      label: lit.authors[0]?.split(' ').pop() || lit.id,
      type: 'paper',
      color: TOPIC_COLORS[lit.category] || '#888',
      radius: 10,
      litId: lit.id,
    });
    edges.push({ source: `topic_${lit.category}`, target: `paper_${lit.id}` });
  });

  // 材料节点（从文献的 materials 字段提取）
  const materialSet = new Map<string, string[]>(); // material → paper ids
  LITERATURE_CORPUS.forEach((lit) => {
    lit.materials?.forEach((m) => {
      if (!materialSet.has(m)) materialSet.set(m, []);
      materialSet.get(m)!.push(lit.id);
    });
  });

  materialSet.forEach((paperIds, mat) => {
    const mid = `mat_${mat}`;
    // 居中在关联文献附近
    const relatedPapers = nodes.filter((n) => paperIds.includes(n.litId || ''));
    const avgX = relatedPapers.reduce((s, n) => s + n.x, 0) / (relatedPapers.length || 1);
    const avgY = relatedPapers.reduce((s, n) => s + n.y, 0) / (relatedPapers.length || 1);
    nodes.push({
      id: mid,
      x: avgX + (Math.random() - 0.5) * 60,
      y: avgY + (Math.random() - 0.5) * 60,
      vx: 0, vy: 0,
      label: mat,
      type: 'material',
      color: MATERIAL_COLOR,
      radius: 8,
    });
    paperIds.forEach((pid) => {
      edges.push({ source: `paper_${pid}`, target: mid });
    });
  });

  return { nodes, edges };
}

/* ─────────── 组件 ─────────── */

interface Props {
  className?: string;
  onSelectLiterature?: (lit: LiteratureEntry) => void;
}

export default function LiteratureKnowledgeGraph({ className, onSelectLiterature }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const animRef = useRef<number>(0);
  const dragRef = useRef<{ nodeId: string | null; offsetX: number; offsetY: number }>({ nodeId: null, offsetX: 0, offsetY: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  // 初始化图数据
  useEffect(() => {
    const { nodes, edges } = buildGraph();
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, []);

  // 力导向仿真 + 渲染
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * devicePixelRatio;
      canvas.height = rect.height * devicePixelRatio;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let tick = 0;
    const MAX_TICKS = 300;

    const simulate = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const W = canvas.width / devicePixelRatio;
      const H = canvas.height / devicePixelRatio;

      if (tick < MAX_TICKS) {
        const alpha = 1 - tick / MAX_TICKS;

        // 斥力
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[j].x - nodes[i].x;
            const dy = nodes[j].y - nodes[i].y;
            const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
            const force = (800 * alpha) / (dist * dist);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            nodes[i].vx -= fx;
            nodes[i].vy -= fy;
            nodes[j].vx += fx;
            nodes[j].vy += fy;
          }
        }

        // 引力（边）
        const nodeMap = new Map(nodes.map((n) => [n.id, n]));
        for (const edge of edges) {
          const s = nodeMap.get(edge.source);
          const t = nodeMap.get(edge.target);
          if (!s || !t) continue;
          const dx = t.x - s.x;
          const dy = t.y - s.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = (dist - 60) * 0.01 * alpha;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          s.vx += fx;
          s.vy += fy;
          t.vx -= fx;
          t.vy -= fy;
        }

        // 向心力
        for (const n of nodes) {
          n.vx += (W / 2 - n.x) * 0.001 * alpha;
          n.vy += (H / 2 - n.y) * 0.001 * alpha;
        }

        // 更新位置
        for (const n of nodes) {
          if (dragRef.current.nodeId === n.id) continue;
          n.vx *= 0.85;
          n.vy *= 0.85;
          n.x += n.vx;
          n.y += n.vy;
          n.x = Math.max(n.radius, Math.min(W - n.radius, n.x));
          n.y = Math.max(n.radius, Math.min(H - n.radius, n.y));
        }
        tick++;
      }

      // 渲染
      ctx.clearRect(0, 0, W, H);

      // 边
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));
      for (const edge of edges) {
        const s = nodeMap.get(edge.source);
        const t = nodeMap.get(edge.target);
        if (!s || !t) continue;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = hoveredNode && (edge.source === hoveredNode || edge.target === hoveredNode)
          ? 'rgba(255,255,255,0.4)'
          : 'rgba(255,255,255,0.08)';
        ctx.lineWidth = hoveredNode && (edge.source === hoveredNode || edge.target === hoveredNode) ? 1.5 : 0.5;
        ctx.stroke();
      }

      // 节点
      for (const n of nodes) {
        const isHovered = hoveredNode === n.id;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius * (isHovered ? 1.3 : 1), 0, Math.PI * 2);

        if (n.type === 'topic') {
          const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius * 1.5);
          grad.addColorStop(0, n.color + 'CC');
          grad.addColorStop(1, n.color + '33');
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = n.color + (isHovered ? 'CC' : '66');
        }
        ctx.fill();

        if (isHovered || n.type === 'topic') {
          ctx.strokeStyle = n.color + '99';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // 标签
        if (n.type === 'topic' || isHovered) {
          ctx.fillStyle = '#fff';
          ctx.font = n.type === 'topic' ? 'bold 11px sans-serif' : '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(n.label, n.x, n.y + n.radius + 12);
        }
      }

      animRef.current = requestAnimationFrame(simulate);
    };

    animRef.current = requestAnimationFrame(simulate);

    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, [hoveredNode]);

  // 鼠标交互
  const getNodeAt = useCallback((x: number, y: number) => {
    for (let i = nodesRef.current.length - 1; i >= 0; i--) {
      const n = nodesRef.current[i];
      const dx = x - n.x;
      const dy = y - n.y;
      if (dx * dx + dy * dy <= (n.radius + 4) * (n.radius + 4)) return n;
    }
    return null;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (dragRef.current.nodeId) {
      const node = nodesRef.current.find((n) => n.id === dragRef.current.nodeId);
      if (node) {
        node.x = x + dragRef.current.offsetX;
        node.y = y + dragRef.current.offsetY;
      }
      return;
    }

    const node = getNodeAt(x, y);
    setHoveredNode(node?.id || null);

    if (node && node.type === 'paper' && node.litId) {
      const lit = LITERATURE_CORPUS.find((l) => l.id === node.litId);
      if (lit) {
        setTooltip({
          x: e.clientX - rect.left + 12,
          y: e.clientY - rect.top - 8,
          text: `${lit.authors.join(', ')} (${lit.year})\n${lit.title}`,
        });
        return;
      }
    }
    setTooltip(null);
  }, [getNodeAt]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const node = getNodeAt(x, y);
    if (node) {
      dragRef.current = { nodeId: node.id, offsetX: node.x - x, offsetY: node.y - y };
    }
  }, [getNodeAt]);

  const handleMouseUp = useCallback(() => {
    dragRef.current = { nodeId: null, offsetX: 0, offsetY: 0 };
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
    if (node?.type === 'paper' && node.litId && onSelectLiterature) {
      const lit = LITERATURE_CORPUS.find((l) => l.id === node.litId);
      if (lit) onSelectLiterature(lit);
    }
  }, [getNodeAt, onSelectLiterature]);

  return (
    <div ref={containerRef} className={`relative w-full h-full ${className || ''}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { handleMouseUp(); setHoveredNode(null); setTooltip(null); }}
        onClick={handleClick}
      />
      {/* 图例 */}
      <div className="absolute top-2 left-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/60">
        {Object.entries(TOPIC_LABELS).map(([cat, label]) => (
          <span key={cat} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TOPIC_COLORS[cat] }} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: MATERIAL_COLOR }} />
          材料
        </span>
      </div>
      {/* 工具提示 */}
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-black/80 border border-white/20 rounded-lg px-3 py-2 text-[11px] text-white/80 max-w-[220px] whitespace-pre-line z-10"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
