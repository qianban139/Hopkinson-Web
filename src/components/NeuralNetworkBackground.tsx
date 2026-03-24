// src/components/NeuralNetworkBackground.tsx
// 华丽神经网络背景 — 星云极光 + 能量粒子 + 数据流 + 脉冲波纹 + 神经网络
import { useEffect, useRef, useCallback } from 'react';

interface Node {
  x: number; y: number; vx: number; vy: number;
  radius: number; opacity: number; layer: number; pulsePhase: number;
}

interface Pulse {
  fromIdx: number; toIdx: number; progress: number; speed: number; color: string;
}

interface FloatingShape {
  x: number; y: number; vx: number; vy: number;
  rotation: number; rotationSpeed: number;
  size: number; sides: number; opacity: number; color: number;
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: number;
}

interface RippleWave {
  x: number; y: number; radius: number; maxRadius: number;
  opacity: number; color: string; speed: number;
}

interface DataStream {
  x: number; y: number; speed: number; length: number;
  opacity: number; color: string; width: number;
}

const PULSE_COLORS = ['#00F5FF', '#FFD700', '#FF2E63', '#8B5CF6', '#1DD1A1'];
const NODE_COLORS: [number, number, number][] = [
  [0, 245, 255],    // cyan
  [139, 92, 246],   // purple
  [29, 209, 161],   // teal
  [255, 215, 0],    // gold
  [255, 46, 99],    // pink
];
const NEBULA_COLORS = [
  { r: 0, g: 245, b: 255 },    // cyan
  { r: 139, g: 92, b: 246 },   // purple
  { r: 29, g: 209, b: 161 },   // teal
  { r: 255, g: 46, b: 99 },    // pink
];

export default function NeuralNetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const pulsesRef = useRef<Pulse[]>([]);
  const shapesRef = useRef<FloatingShape[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const ripplesRef = useRef<RippleWave[]>([]);
  const streamsRef = useRef<DataStream[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);
  const frameCountRef = useRef(0);

  const initNodes = useCallback((w: number, h: number) => {
    // --- 神经网络节点 (55个) ---
    const count = Math.min(55, Math.floor((w * h) / 25000));
    const nodes: Node[] = [];
    for (let i = 0; i < count; i++) {
      nodes.push({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
        radius: Math.random() * 2.5 + 1.5,
        opacity: Math.random() * 0.5 + 0.3,
        layer: Math.floor(Math.random() * 5),
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
    nodesRef.current = nodes;

    // --- 浮动几何体 (10个，更多样) ---
    const shapes: FloatingShape[] = [];
    for (let i = 0; i < 10; i++) {
      const sides = [3, 4, 5, 6, 8][Math.floor(Math.random() * 5)];
      shapes.push({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.12, vy: (Math.random() - 0.5) * 0.12,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.004,
        size: 25 + Math.random() * 60,
        sides,
        opacity: 0.015 + Math.random() * 0.035,
        color: Math.floor(Math.random() * 5),
      });
    }
    shapesRef.current = shapes;

    // --- 数据流光柱 (8条) ---
    const streams: DataStream[] = [];
    for (let i = 0; i < 8; i++) {
      streams.push({
        x: Math.random() * w,
        y: -Math.random() * h,
        speed: 0.5 + Math.random() * 1.5,
        length: 80 + Math.random() * 200,
        opacity: 0.02 + Math.random() * 0.04,
        color: PULSE_COLORS[Math.floor(Math.random() * PULSE_COLORS.length)],
        width: 1 + Math.random() * 2,
      });
    }
    streamsRef.current = streams;
  }, []);

  // 绘制正多边形
  const drawPolygon = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, sides: number, rotation: number) => {
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const angle = (i / sides) * Math.PI * 2 + rotation;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };

  // 主渲染
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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
    const lw = w / dpr;
    const lh = h / dpr;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.scale(dpr, dpr);

    const nodes = nodesRef.current;
    const pulses = pulsesRef.current;
    const shapes = shapesRef.current;
    const particles = particlesRef.current;
    const ripples = ripplesRef.current;
    const streams = streamsRef.current;
    const mouse = mouseRef.current;
    const time = timeRef.current;
    const maxDist = 140;

    // ═══════════════════════════════════════
    // 1) 星云/极光效果 — 大面积柔和光雾
    // ═══════════════════════════════════════
    for (let i = 0; i < NEBULA_COLORS.length; i++) {
      const nc = NEBULA_COLORS[i];
      const phase = time * 0.0003 + i * 1.5;
      const cx = lw * (0.3 + 0.4 * Math.sin(phase));
      const cy = lh * (0.3 + 0.4 * Math.cos(phase * 0.7 + i));
      const radius = lw * (0.25 + 0.1 * Math.sin(phase * 0.5));

      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, `rgba(${nc.r}, ${nc.g}, ${nc.b}, 0.025)`);
      gradient.addColorStop(0.5, `rgba(${nc.r}, ${nc.g}, ${nc.b}, 0.012)`);
      gradient.addColorStop(1, `rgba(${nc.r}, ${nc.g}, ${nc.b}, 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, lw, lh);
    }

    // ═══════════════════════════════════════
    // 2) 数据流光柱 — 垂直方向流动
    // ═══════════════════════════════════════
    for (const stream of streams) {
      stream.y += stream.speed;
      if (stream.y > lh + stream.length) {
        stream.y = -stream.length;
        stream.x = Math.random() * lw;
        stream.color = PULSE_COLORS[Math.floor(Math.random() * PULSE_COLORS.length)];
      }

      const gradient = ctx.createLinearGradient(stream.x, stream.y, stream.x, stream.y + stream.length);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(0.3, stream.color.replace(')', `, ${stream.opacity})`).replace('rgb(', 'rgba(').replace('#', ''));
      gradient.addColorStop(0.7, stream.color.replace(')', `, ${stream.opacity * 0.6})`).replace('rgb(', 'rgba(').replace('#', ''));
      gradient.addColorStop(1, 'rgba(0,0,0,0)');

      // Use hex to rgba conversion
      const hex = stream.color;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);

      const grad = ctx.createLinearGradient(stream.x, stream.y, stream.x, stream.y + stream.length);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.2, `rgba(${r},${g},${b},${stream.opacity})`);
      grad.addColorStop(0.5, `rgba(${r},${g},${b},${stream.opacity * 1.5})`);
      grad.addColorStop(0.8, `rgba(${r},${g},${b},${stream.opacity * 0.5})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.beginPath();
      ctx.moveTo(stream.x, stream.y);
      ctx.lineTo(stream.x, stream.y + stream.length);
      ctx.strokeStyle = grad;
      ctx.lineWidth = stream.width;
      ctx.stroke();

      // 头部发光点
      ctx.beginPath();
      ctx.arc(stream.x, stream.y + stream.length * 0.15, stream.width * 2, 0, Math.PI * 2);
      const headGlow = ctx.createRadialGradient(
        stream.x, stream.y + stream.length * 0.15, 0,
        stream.x, stream.y + stream.length * 0.15, stream.width * 4
      );
      headGlow.addColorStop(0, `rgba(${r},${g},${b},${stream.opacity * 3})`);
      headGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = headGlow;
      ctx.fill();
    }

    // ═══════════════════════════════════════
    // 3) 浮动几何体（更华丽，双层描边+内发光）
    // ═══════════════════════════════════════
    for (const shape of shapes) {
      shape.x += shape.vx;
      shape.y += shape.vy;
      shape.rotation += shape.rotationSpeed;

      const parallaxX = (mouse.x - lw / 2) * 0.015;
      const parallaxY = (mouse.y - lh / 2) * 0.015;

      if (shape.x < -shape.size) shape.x = lw + shape.size;
      if (shape.x > lw + shape.size) shape.x = -shape.size;
      if (shape.y < -shape.size) shape.y = lh + shape.size;
      if (shape.y > lh + shape.size) shape.y = -shape.size;

      const drawX = shape.x + parallaxX * (1 + shape.sides * 0.1);
      const drawY = shape.y + parallaxY * (1 + shape.sides * 0.1);
      const breathe = 1 + Math.sin(time * 0.001 + shape.rotation) * 0.1;
      const [cr, cg, cb] = NODE_COLORS[shape.color];

      // 外层光晕
      drawPolygon(ctx, drawX, drawY, shape.size * breathe * 1.3, shape.sides, shape.rotation);
      ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${shape.opacity * 0.3})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // 主描边
      drawPolygon(ctx, drawX, drawY, shape.size * breathe, shape.sides, shape.rotation);
      ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${shape.opacity})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // 内部微填充
      ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${shape.opacity * 0.08})`;
      ctx.fill();
    }

    // ═══════════════════════════════════════
    // 4) 脉冲波纹 — 同心圆扩散
    // ═══════════════════════════════════════
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rip = ripples[i];
      rip.radius += rip.speed;
      rip.opacity *= 0.985;

      if (rip.radius > rip.maxRadius || rip.opacity < 0.002) {
        ripples.splice(i, 1);
        continue;
      }

      const hex = rip.color;
      const rr = parseInt(hex.slice(1, 3), 16);
      const rg = parseInt(hex.slice(3, 5), 16);
      const rb = parseInt(hex.slice(5, 7), 16);

      ctx.beginPath();
      ctx.arc(rip.x, rip.y, rip.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${rr},${rg},${rb},${rip.opacity})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 第二圈（稍小，更亮）
      if (rip.radius > 10) {
        ctx.beginPath();
        ctx.arc(rip.x, rip.y, rip.radius * 0.7, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${rr},${rg},${rb},${rip.opacity * 0.5})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }

    // 随机生成新波纹
    if (Math.random() < 0.008) {
      ripples.push({
        x: Math.random() * lw,
        y: Math.random() * lh,
        radius: 0,
        maxRadius: 100 + Math.random() * 200,
        opacity: 0.06 + Math.random() * 0.04,
        color: PULSE_COLORS[Math.floor(Math.random() * PULSE_COLORS.length)],
        speed: 0.3 + Math.random() * 0.8,
      });
    }

    // ═══════════════════════════════════════
    // 5) 神经网络连线（渐变色 + 呼吸感）
    // ═══════════════════════════════════════
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const distSq = dx * dx + dy * dy;
        if (distSq > maxDist * maxDist) continue;

        const dist = Math.sqrt(distSq);
        const breathe = 0.8 + Math.sin(time * 0.001 + i * 0.1) * 0.2;
        const alpha = 0.14 * (1 - dist / maxDist) * breathe;

        const c1 = NODE_COLORS[nodes[i].layer];
        const c2 = NODE_COLORS[nodes[j].layer];

        // 真正的渐变连线
        const gradient = ctx.createLinearGradient(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y);
        gradient.addColorStop(0, `rgba(${c1[0]}, ${c1[1]}, ${c1[2]}, ${alpha})`);
        gradient.addColorStop(1, `rgba(${c2[0]}, ${c2[1]}, ${c2[2]}, ${alpha})`);

        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }

    // ═══════════════════════════════════════
    // 6) 传输脉冲（更大更亮 + 拖尾）
    // ═══════════════════════════════════════
    for (let p = pulses.length - 1; p >= 0; p--) {
      const pulse = pulses[p];
      pulse.progress += pulse.speed;
      if (pulse.progress >= 1) { pulses.splice(p, 1); continue; }
      const from = nodes[pulse.fromIdx];
      const to = nodes[pulse.toIdx];
      if (!from || !to) continue;

      const px = from.x + (to.x - from.x) * pulse.progress;
      const py = from.y + (to.y - from.y) * pulse.progress;

      const hex = pulse.color;
      const pr = parseInt(hex.slice(1, 3), 16);
      const pg = parseInt(hex.slice(3, 5), 16);
      const pb = parseInt(hex.slice(5, 7), 16);

      // 拖尾
      for (let t = 1; t <= 3; t++) {
        const tp = pulse.progress - t * 0.03;
        if (tp < 0) continue;
        const tx = from.x + (to.x - from.x) * tp;
        const ty = from.y + (to.y - from.y) * tp;
        ctx.beginPath();
        ctx.arc(tx, ty, 4 - t, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${pr},${pg},${pb},${0.15 / t})`;
        ctx.fill();
      }

      // 主光点
      const glow = ctx.createRadialGradient(px, py, 0, px, py, 8);
      glow.addColorStop(0, `rgba(${pr},${pg},${pb},0.8)`);
      glow.addColorStop(0.4, `rgba(${pr},${pg},${pb},0.3)`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
    }

    // 生成脉冲（更频繁）
    if (Math.random() < 0.06 && nodes.length > 1) {
      const fromIdx = Math.floor(Math.random() * nodes.length);
      let toIdx = Math.floor(Math.random() * nodes.length);
      if (toIdx === fromIdx) toIdx = (toIdx + 1) % nodes.length;
      const dx = nodes[fromIdx].x - nodes[toIdx].x;
      const dy = nodes[fromIdx].y - nodes[toIdx].y;
      if (Math.sqrt(dx * dx + dy * dy) < maxDist * 1.5) {
        pulses.push({
          fromIdx, toIdx, progress: 0,
          speed: 0.012 + Math.random() * 0.02,
          color: PULSE_COLORS[Math.floor(Math.random() * PULSE_COLORS.length)],
        });
      }
    }

    // ═══════════════════════════════════════
    // 7) 节点（多色 + 强化光晕 + 呼吸环）
    // ═══════════════════════════════════════
    for (const node of nodes) {
      const [cr, cg, cb] = NODE_COLORS[node.layer];
      const mdx = node.x - mouse.x;
      const mdy = node.y - mouse.y;
      const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
      const mouseInfluence = Math.max(0, 1 - mDist / 200);

      const breathe = Math.sin(time * 0.002 + node.pulsePhase) * 0.15 + 0.85;
      const baseOpacity = node.opacity * breathe + mouseInfluence * 0.5;
      const r = node.radius * (1 + mouseInfluence * 1.0);

      // 外层光晕
      if (baseOpacity > 0.35 || mouseInfluence > 0.05) {
        const glowR = r * 4;
        const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowR);
        glow.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${baseOpacity * 0.35})`);
        glow.addColorStop(0.5, `rgba(${cr}, ${cg}, ${cb}, ${baseOpacity * 0.1})`);
        glow.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
      }

      // 呼吸环（鼠标靠近时显示）
      if (mouseInfluence > 0.2) {
        const ringR = r * 3 * (1 + Math.sin(time * 0.005) * 0.3);
        ctx.beginPath();
        ctx.arc(node.x, node.y, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${mouseInfluence * 0.3})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // 核心
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${Math.min(1, baseOpacity)})`;
      ctx.fill();

      // 白色核心高光
      if (baseOpacity > 0.5) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${baseOpacity * 0.3})`;
        ctx.fill();
      }
    }

    // ═══════════════════════════════════════
    // 8) 能量粒子场 — 微小漂浮粒子
    // ═══════════════════════════════════════
    // 生成新粒子
    if (particles.length < 80 && Math.random() < 0.15) {
      particles.push({
        x: Math.random() * lw,
        y: Math.random() * lh,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.2 - Math.random() * 0.5, // 向上漂浮
        life: 0,
        maxLife: 120 + Math.random() * 180,
        size: 0.5 + Math.random() * 1.5,
        color: Math.floor(Math.random() * 5),
      });
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.life++;
      if (pt.life > pt.maxLife) { particles.splice(i, 1); continue; }

      pt.x += pt.vx + Math.sin(time * 0.001 + pt.x * 0.01) * 0.1;
      pt.y += pt.vy;

      const lifeRatio = pt.life / pt.maxLife;
      const fadeIn = Math.min(1, pt.life / 20);
      const fadeOut = Math.max(0, 1 - (lifeRatio - 0.7) / 0.3);
      const alpha = fadeIn * (lifeRatio < 0.7 ? 1 : fadeOut) * 0.4;

      const [pr, pg, pb] = NODE_COLORS[pt.color];
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${pr}, ${pg}, ${pb}, ${alpha})`;
      ctx.fill();
    }

    // ═══════════════════════════════════════
    // 更新节点位置
    // ═══════════════════════════════════════
    for (const node of nodes) {
      const mdx = node.x - mouse.x;
      const mdy = node.y - mouse.y;
      const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
      if (mDist < 150 && mDist > 0) {
        const force = 0.6 * (1 - mDist / 150);
        node.vx += (mdx / mDist) * force;
        node.vy += (mdy / mDist) * force;
      }

      node.vx *= 0.98;
      node.vy *= 0.98;
      node.x += node.vx;
      node.y += node.vy;

      if (node.x < 0) { node.x = 0; node.vx = Math.abs(node.vx) * 0.5; }
      if (node.x > lw) { node.x = lw; node.vx = -Math.abs(node.vx) * 0.5; }
      if (node.y < 0) { node.y = 0; node.vy = Math.abs(node.vy) * 0.5; }
      if (node.y > lh) { node.y = lh; node.vy = -Math.abs(node.vy) * 0.5; }
    }

    // ═══════════════════════════════════════
    // 暗角
    // ═══════════════════════════════════════
    const vignette = ctx.createRadialGradient(lw / 2, lh / 2, lw * 0.25, lw / 2, lh / 2, lw * 0.85);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(5, 16, 32, 0.5)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, lw, lh);

    ctx.restore();
    timeRef.current += 32;
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
