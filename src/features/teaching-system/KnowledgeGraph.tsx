// src/features/teaching-system/KnowledgeGraph.tsx
// 交互式知识图谱 — Canvas力导向布局

import { useRef, useEffect, useCallback, useState } from 'react';
import { KNOWLEDGE_NODES, CATEGORY_META } from './knowledgeData';
import { useTeachingStore } from './useTeachingStore';

interface GraphNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  title: string;
  category: string;
  level: number;
  radius: number;
}

interface GraphEdge {
  source: string;
  target: string;
}

export default function KnowledgeGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const animRef = useRef<number>(0);
  const dragRef = useRef<{ nodeId: string | null; offsetX: number; offsetY: number }>({ nodeId: null, offsetX: 0, offsetY: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const completedNodes = useTeachingStore(s => s.completedNodes);
  const setSelectedNode = useTeachingStore(s => s.setSelectedNode);
  const setViewMode = useTeachingStore(s => s.setViewMode);

  // 初始化节点和边
  useEffect(() => {
    const cx = 500, cy = 300;
    const categoryPositions: Record<string, { x: number; y: number }> = {
      fundamental: { x: 200, y: 150 },
      equipment: { x: 500, y: 100 },
      theory: { x: 800, y: 200 },
      operation: { x: 200, y: 450 },
      analysis: { x: 600, y: 450 },
      advanced: { x: 900, y: 400 },
    };

    nodesRef.current = KNOWLEDGE_NODES.map((kn) => {
      const catPos = categoryPositions[kn.category] || { x: cx, y: cy };
      return {
        id: kn.id,
        x: catPos.x + (Math.random() - 0.5) * 120,
        y: catPos.y + (Math.random() - 0.5) * 100,
        vx: 0,
        vy: 0,
        title: kn.title,
        category: kn.category,
        level: kn.level,
        radius: 20 + kn.level * 4,
      };
    });

    const edgeSet = new Set<string>();
    const edges: GraphEdge[] = [];
    KNOWLEDGE_NODES.forEach((kn) => {
      kn.connections.forEach((targetId) => {
        const key = [kn.id, targetId].sort().join('|');
        if (!edgeSet.has(key) && KNOWLEDGE_NODES.some(n => n.id === targetId)) {
          edgeSet.add(key);
          edges.push({ source: kn.id, target: targetId });
        }
      });
    });
    edgesRef.current = edges;
  }, []);

  // 力导向模拟 + 渲染
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const { clientWidth: w, clientHeight: h } = container;
    if (!w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // 力模拟（轻量）
    const repulsion = 8000;
    const attraction = 0.005;
    const damping = 0.85;
    const centerGravity = 0.002;

    for (const n of nodes) {
      if (dragRef.current.nodeId === n.id) continue;
      let fx = 0, fy = 0;

      // 排斥力
      for (const m of nodes) {
        if (m.id === n.id) continue;
        const dx = n.x - m.x;
        const dy = n.y - m.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const force = repulsion / (dist * dist);
        fx += (dx / dist) * force;
        fy += (dy / dist) * force;
      }

      // 弹簧力（边）
      for (const e of edges) {
        let other: GraphNode | undefined;
        if (e.source === n.id) other = nodeMap.get(e.target);
        else if (e.target === n.id) other = nodeMap.get(e.source);
        if (!other) continue;
        const dx = other.x - n.x;
        const dy = other.y - n.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        fx += dx * attraction;
        fy += dy * attraction;
      }

      // 中心引力
      fx += (w / 2 - n.x) * centerGravity;
      fy += (h / 2 - n.y) * centerGravity;

      n.vx = (n.vx + fx) * damping;
      n.vy = (n.vy + fy) * damping;
      n.x = Math.max(n.radius, Math.min(w - n.radius, n.x + n.vx));
      n.y = Math.max(n.radius, Math.min(h - n.radius, n.y + n.vy));
    }

    // 背景
    ctx.fillStyle = '#0A2540';
    ctx.fillRect(0, 0, w, h);

    // 网格
    ctx.strokeStyle = 'rgba(0,245,255,0.03)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    // 绘制边
    for (const e of edges) {
      const s = nodeMap.get(e.source);
      const t = nodeMap.get(e.target);
      if (!s || !t) continue;

      const bothDone = completedNodes.includes(s.id) && completedNodes.includes(t.id);
      const anyHover = hoveredNode === s.id || hoveredNode === t.id;

      ctx.strokeStyle = anyHover
        ? 'rgba(0,245,255,0.4)'
        : bothDone
          ? 'rgba(16,185,129,0.25)'
          : 'rgba(255,255,255,0.08)';
      ctx.lineWidth = anyHover ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      ctx.stroke();
    }

    // 绘制节点
    for (const n of nodes) {
      const meta = CATEGORY_META[n.category];
      const isCompleted = completedNodes.includes(n.id);
      const isHovered = hoveredNode === n.id;
      const r = isHovered ? n.radius + 4 : n.radius;

      // 发光
      if (isHovered || isCompleted) {
        const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 2);
        glow.addColorStop(0, isCompleted ? 'rgba(16,185,129,0.15)' : `${meta.color}22`);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // 节点圆
      const grad = ctx.createRadialGradient(n.x - r * 0.2, n.y - r * 0.2, 0, n.x, n.y, r);
      grad.addColorStop(0, isCompleted ? '#10B981' : meta.color);
      grad.addColorStop(1, isCompleted ? '#065F46' : `${meta.color}88`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fill();

      // 边框
      ctx.strokeStyle = isHovered ? '#fff' : isCompleted ? '#10B981' : `${meta.color}66`;
      ctx.lineWidth = isHovered ? 2 : 1;
      ctx.stroke();

      // 完成勾号
      if (isCompleted) {
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${r * 0.7}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✓', n.x, n.y);
      } else {
        // 级别标记
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.font = `bold ${r * 0.5}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`L${n.level}`, n.x, n.y);
      }

      // 标题
      ctx.fillStyle = isHovered ? '#fff' : 'rgba(255,255,255,0.7)';
      ctx.font = `${isHovered ? 'bold ' : ''}11px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(n.title, n.x, n.y + r + 14);
    }

    // 分类图例
    const legendX = 16, legendY = h - 10 - Object.keys(CATEGORY_META).length * 20;
    Object.entries(CATEGORY_META).forEach(([, meta], i) => {
      const ly = legendY + i * 20;
      ctx.fillStyle = meta.color;
      ctx.beginPath();
      ctx.arc(legendX + 6, ly + 6, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${meta.icon} ${meta.label}`, legendX + 16, ly + 10);
    });

    animRef.current = requestAnimationFrame(render);
  }, [completedNodes, hoveredNode]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animRef.current);
  }, [render]);

  // 鼠标交互
  const getNodeAt = useCallback((mx: number, my: number) => {
    for (const n of nodesRef.current) {
      const dx = mx - n.x, dy = my - n.y;
      if (dx * dx + dy * dy < n.radius * n.radius) return n;
    }
    return null;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;

    if (dragRef.current.nodeId) {
      const n = nodesRef.current.find(n => n.id === dragRef.current.nodeId);
      if (n) {
        n.x = mx - dragRef.current.offsetX;
        n.y = my - dragRef.current.offsetY;
        n.vx = 0;
        n.vy = 0;
      }
      return;
    }

    const node = getNodeAt(mx, my);
    setHoveredNode(node?.id || null);
  }, [getNodeAt]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const node = getNodeAt(mx, my);
    if (node) {
      dragRef.current = { nodeId: node.id, offsetX: mx - node.x, offsetY: my - node.y };
    }
  }, [getNodeAt]);

  const handleMouseUp = useCallback(() => {
    dragRef.current = { nodeId: null, offsetX: 0, offsetY: 0 };
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const node = getNodeAt(mx, my);
    if (node) {
      setSelectedNode(node.id);
      setViewMode('study');
    }
  }, [getNodeAt, setSelectedNode, setViewMode]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      />
      {/* 提示 */}
      <div className="absolute top-3 right-4 text-[10px] text-white/30 pointer-events-none">
        拖拽节点 · 双击进入学习
      </div>
      {/* 统计 */}
      <div className="absolute top-3 left-4 px-3 py-1.5 rounded-lg bg-[#051020]/80 border border-[#00F5FF]/15 text-xs">
        <span className="text-white/50">已掌握 </span>
        <span className="text-[#10B981] font-mono font-bold">{completedNodes.length}</span>
        <span className="text-white/50"> / {KNOWLEDGE_NODES.length}</span>
      </div>
    </div>
  );
}
