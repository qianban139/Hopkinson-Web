// src/components/NeuralNetworkBackground.tsx
// 神经网络节点+连线Canvas动画背景 - 增强科技感版
// 多色节点(cyan/purple/teal) + 渐变连线 + 浮动几何体 + 暗角
import { useEffect, useRef, useCallback } from 'react';

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  layer: number;
  pulsePhase: number;
}

interface Pulse {
  fromIdx: number;
  toIdx: number;
  progress: number;
  speed: number;
  color: string;
}

interface FloatingShape {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  size: number;
  sides: number; // 6=hexagon, 3=triangle
  opacity: number;
}

const PULSE_COLORS = ['#00F5FF', '#FFD700', '#FF2E63'];
// 节点颜色按layer分配：cyan, purple, teal
const NODE_COLORS: [number, number, number][] = [
  [0, 245, 255],   // cyan
  [139, 92, 246],   // purple
  [29, 209, 161],   // teal
];

export default function NeuralNetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const pulsesRef = useRef<Pulse[]>([]);
  const shapesRef = useRef<FloatingShape[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);
  const frameCountRef = useRef(0);

  // 初始化节点 - 增至45个
  const initNodes = useCallback((w: number, h: number) => {
    const count = Math.min(45, Math.floor((w * h) / 30000));
    const nodes: Node[] = [];
    for (let i = 0; i < count; i++) {
      nodes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 2 + 1.5,
        opacity: Math.random() * 0.4 + 0.3,
        layer: Math.floor(Math.random() * 3),
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
    nodesRef.current = nodes;

    // 初始化浮动几何体
    const shapes: FloatingShape[] = [];
    for (let i = 0; i < 6; i++) {
      shapes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.003,
        size: 30 + Math.random() * 50,
        sides: Math.random() > 0.5 ? 6 : 3,
        opacity: 0.02 + Math.random() * 0.03,
      });
    }
    shapesRef.current = shapes;
  }, []);

  // 绘制正多边形
  const drawPolygon = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, sides: number, rotation: number) => {
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const angle = (i / sides) * Math.PI * 2 + rotation;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };

  // 主渲染
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 30fps: 每2帧渲染1次
    frameCountRef.current++;
    if (frameCountRef.current % 2 !== 0) {
      animRef.current = requestAnimationFrame(render);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const dpr = window.devicePixelRatio || 1;
    const logicalW = w / dpr;
    const logicalH = h / dpr;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.scale(dpr, dpr);

    const nodes = nodesRef.current;
    const pulses = pulsesRef.current;
    const shapes = shapesRef.current;
    const mouse = mouseRef.current;
    const time = timeRef.current;

    const maxDist = 130;

    // --- 绘制浮动几何体（最底层） ---
    for (const shape of shapes) {
      shape.x += shape.vx;
      shape.y += shape.vy;
      shape.rotation += shape.rotationSpeed;

      // 鼠标视差效果
      const parallaxX = (mouse.x - logicalW / 2) * 0.01;
      const parallaxY = (mouse.y - logicalH / 2) * 0.01;

      if (shape.x < -shape.size) shape.x = logicalW + shape.size;
      if (shape.x > logicalW + shape.size) shape.x = -shape.size;
      if (shape.y < -shape.size) shape.y = logicalH + shape.size;
      if (shape.y > logicalH + shape.size) shape.y = -shape.size;

      const drawX = shape.x + parallaxX * (shape.sides === 6 ? 1.5 : 0.8);
      const drawY = shape.y + parallaxY * (shape.sides === 6 ? 1.5 : 0.8);

      drawPolygon(ctx, drawX, drawY, shape.size, shape.sides, shape.rotation);
      const color = shape.sides === 6 ? '0, 245, 255' : '139, 92, 246';
      ctx.strokeStyle = `rgba(${color}, ${shape.opacity})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // --- 绘制连线（多色渐变） ---
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const distSq = dx * dx + dy * dy;
        if (distSq > maxDist * maxDist) continue;

        const dist = Math.sqrt(distSq);
        const alpha = 0.12 * (1 - dist / maxDist);

        // 使用两端节点颜色的混合
        const c1 = NODE_COLORS[nodes[i].layer];
        const c2 = NODE_COLORS[nodes[j].layer];
        const mr = (c1[0] + c2[0]) >> 1;
        const mg = (c1[1] + c2[1]) >> 1;
        const mb = (c1[2] + c2[2]) >> 1;

        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.strokeStyle = `rgba(${mr}, ${mg}, ${mb}, ${alpha})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }

    // --- 绘制脉冲 ---
    for (let p = pulses.length - 1; p >= 0; p--) {
      const pulse = pulses[p];
      pulse.progress += pulse.speed;
      if (pulse.progress >= 1) {
        pulses.splice(p, 1);
        continue;
      }
      const from = nodes[pulse.fromIdx];
      const to = nodes[pulse.toIdx];
      if (!from || !to) continue;

      const px = from.x + (to.x - from.x) * pulse.progress;
      const py = from.y + (to.y - from.y) * pulse.progress;
      const gradient = ctx.createRadialGradient(px, py, 0, px, py, 6);
      gradient.addColorStop(0, pulse.color);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // --- 随机生成新脉冲 ---
    if (Math.random() < 0.04 && nodes.length > 1) {
      const fromIdx = Math.floor(Math.random() * nodes.length);
      let toIdx = Math.floor(Math.random() * nodes.length);
      if (toIdx === fromIdx) toIdx = (toIdx + 1) % nodes.length;
      const dx = nodes[fromIdx].x - nodes[toIdx].x;
      const dy = nodes[fromIdx].y - nodes[toIdx].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < maxDist * 1.5) {
        pulses.push({
          fromIdx,
          toIdx,
          progress: 0,
          speed: 0.01 + Math.random() * 0.02,
          color: PULSE_COLORS[Math.floor(Math.random() * PULSE_COLORS.length)],
        });
      }
    }

    // --- 绘制节点（多色） ---
    for (const node of nodes) {
      const [cr, cg, cb] = NODE_COLORS[node.layer];
      const mdx = node.x - mouse.x;
      const mdy = node.y - mouse.y;
      const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
      const mouseInfluence = Math.max(0, 1 - mDist / 200);

      const breathe = Math.sin(time * 0.002 + node.pulsePhase) * 0.15 + 0.85;
      const baseOpacity = node.opacity * breathe + mouseInfluence * 0.4;
      const r = node.radius * (1 + mouseInfluence * 0.8);

      // 外层光晕（仅高亮节点）
      if (baseOpacity > 0.4 || mouseInfluence > 0.1) {
        const glowR = r * 3;
        const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowR);
        glow.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${baseOpacity * 0.3})`);
        glow.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${Math.min(1, baseOpacity)})`;
      ctx.fill();
    }

    // --- 更新节点位置 ---
    for (const node of nodes) {
      const mdx = node.x - mouse.x;
      const mdy = node.y - mouse.y;
      const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
      if (mDist < 120 && mDist > 0) {
        const force = 0.5 * (1 - mDist / 120);
        node.vx += (mdx / mDist) * force;
        node.vy += (mdy / mDist) * force;
      }

      node.vx *= 0.98;
      node.vy *= 0.98;
      node.x += node.vx;
      node.y += node.vy;

      if (node.x < 0) { node.x = 0; node.vx = Math.abs(node.vx) * 0.5; }
      if (node.x > logicalW) { node.x = logicalW; node.vx = -Math.abs(node.vx) * 0.5; }
      if (node.y < 0) { node.y = 0; node.vy = Math.abs(node.vy) * 0.5; }
      if (node.y > logicalH) { node.y = logicalH; node.vy = -Math.abs(node.vy) * 0.5; }
    }

    // --- 暗角效果 ---
    const vignette = ctx.createRadialGradient(
      logicalW / 2, logicalH / 2, logicalW * 0.3,
      logicalW / 2, logicalH / 2, logicalW * 0.8
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(5, 16, 32, 0.4)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, logicalW, logicalH);

    ctx.restore();
    timeRef.current += 32; // 30fps = ~32ms per frame
    animRef.current = requestAnimationFrame(render);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      if (nodesRef.current.length === 0) initNodes(w, h);
    };

    resize();
    window.addEventListener('resize', resize);

    // RAF节流的mousemove
    let rafPending = false;
    const handleMouse = (e: MouseEvent) => {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        mouseRef.current = { x: e.clientX, y: e.clientY };
        rafPending = false;
      });
    };
    window.addEventListener('mousemove', handleMouse);

    animRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouse);
      cancelAnimationFrame(animRef.current);
    };
  }, [initNodes, render]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ background: 'transparent' }}
    />
  );
}
