// src/components/NeuralNetworkBackground.tsx
// 绚丽科技感背景 — 大量粒子 + 星云极光 + 能量脉冲 + 流星 + 神经网络
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
  type: 'float' | 'spark' | 'firefly';
}

interface RippleWave {
  x: number; y: number; radius: number; maxRadius: number;
  opacity: number; color: string; speed: number;
}

interface Meteor {
  x: number; y: number; vx: number; vy: number;
  length: number; life: number; maxLife: number;
  color: [number, number, number]; width: number;
}

const PULSE_COLORS = ['#00F5FF', '#FFD700', '#FF2E63', '#8B5CF6', '#1DD1A1', '#00D2FF', '#A78BFA'];
const NODE_COLORS: [number, number, number][] = [
  [0, 245, 255],    // cyan
  [139, 92, 246],   // purple
  [29, 209, 161],   // teal
  [255, 215, 0],    // gold
  [255, 46, 99],    // pink
  [0, 210, 255],    // sky blue
  [167, 139, 250],  // lavender
];
const NEBULA_COLORS = [
  { r: 0, g: 245, b: 255 },
  { r: 139, g: 92, b: 246 },
  { r: 29, g: 209, b: 161 },
  { r: 255, g: 46, b: 99 },
  { r: 0, g: 170, b: 255 },
  { r: 80, g: 60, b: 200 },
];

export default function NeuralNetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const pulsesRef = useRef<Pulse[]>([]);
  const shapesRef = useRef<FloatingShape[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const ripplesRef = useRef<RippleWave[]>([]);
  const meteorsRef = useRef<Meteor[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);
  const frameCountRef = useRef(0);

  const initScene = useCallback((w: number, h: number) => {
    // 神经网络节点 (70个)
    const count = Math.min(70, Math.floor((w * h) / 18000));
    const nodes: Node[] = [];
    for (let i = 0; i < count; i++) {
      nodes.push({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 3 + 1.5,
        opacity: Math.random() * 0.6 + 0.3,
        layer: Math.floor(Math.random() * 7),
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
    nodesRef.current = nodes;

    // 浮动几何体 (12个)
    const shapes: FloatingShape[] = [];
    for (let i = 0; i < 12; i++) {
      const sides = [3, 4, 5, 6, 8][Math.floor(Math.random() * 5)];
      shapes.push({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.12, vy: (Math.random() - 0.5) * 0.12,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.005,
        size: 20 + Math.random() * 70,
        sides,
        opacity: 0.02 + Math.random() * 0.04,
        color: Math.floor(Math.random() * 7),
      });
    }
    shapesRef.current = shapes;

    // 初始粒子池 (150个)
    const particles: Particle[] = [];
    for (let i = 0; i < 150; i++) {
      const type = Math.random() < 0.4 ? 'firefly' : Math.random() < 0.7 ? 'float' : 'spark';
      particles.push({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * (type === 'spark' ? 0.8 : 0.25),
        vy: type === 'float' ? -0.15 - Math.random() * 0.4 : (Math.random() - 0.5) * 0.3,
        life: Math.floor(Math.random() * 100),
        maxLife: type === 'firefly' ? 200 + Math.random() * 300 : 100 + Math.random() * 200,
        size: type === 'firefly' ? 1 + Math.random() * 2.5 : 0.5 + Math.random() * 1.5,
        color: Math.floor(Math.random() * 7),
        type,
      });
    }
    particlesRef.current = particles;
  }, []);

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
    const meteors = meteorsRef.current;
    const mouse = mouseRef.current;
    const time = timeRef.current;
    const maxDist = 150;

    // ═══════════════════════════════════════
    // 1) 星云极光 — 6色大面积光雾，更亮更饱和
    // ═══════════════════════════════════════
    for (let i = 0; i < NEBULA_COLORS.length; i++) {
      const nc = NEBULA_COLORS[i];
      const phase = time * 0.00025 + i * 1.2;
      const cx = lw * (0.2 + 0.6 * Math.sin(phase + i * 0.8));
      const cy = lh * (0.2 + 0.6 * Math.cos(phase * 0.6 + i * 1.1));
      const radius = lw * (0.2 + 0.15 * Math.sin(phase * 0.4 + i));

      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, `rgba(${nc.r}, ${nc.g}, ${nc.b}, 0.04)`);
      gradient.addColorStop(0.4, `rgba(${nc.r}, ${nc.g}, ${nc.b}, 0.02)`);
      gradient.addColorStop(1, `rgba(${nc.r}, ${nc.g}, ${nc.b}, 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, lw, lh);
    }

    // 鼠标附近的跟随光晕
    if (mouse.x > 0 && mouse.y > 0) {
      const mg = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 180);
      mg.addColorStop(0, 'rgba(0, 245, 255, 0.03)');
      mg.addColorStop(0.5, 'rgba(139, 92, 246, 0.015)');
      mg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = mg;
      ctx.fillRect(0, 0, lw, lh);
    }

    // ═══════════════════════════════════════
    // 2) 流星
    // ═══════════════════════════════════════
    // 生成
    if (Math.random() < 0.012 && meteors.length < 5) {
      const angle = -Math.PI / 6 + (Math.random() - 0.5) * 0.4;
      const speed = 3 + Math.random() * 4;
      const c = NODE_COLORS[Math.floor(Math.random() * 7)];
      meteors.push({
        x: Math.random() * lw * 0.8 + lw * 0.1,
        y: -10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle + Math.PI / 2) * speed,
        length: 40 + Math.random() * 80,
        life: 0, maxLife: 60 + Math.random() * 40,
        color: c, width: 1 + Math.random() * 1.5,
      });
    }

    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.life++;
      m.x += m.vx;
      m.y += m.vy;

      if (m.life > m.maxLife || m.y > lh + 10) {
        meteors.splice(i, 1);
        continue;
      }

      const fade = m.life < 10 ? m.life / 10 : m.life > m.maxLife - 15 ? (m.maxLife - m.life) / 15 : 1;
      const tailX = m.x - (m.vx / Math.sqrt(m.vx * m.vx + m.vy * m.vy)) * m.length;
      const tailY = m.y - (m.vy / Math.sqrt(m.vx * m.vx + m.vy * m.vy)) * m.length;

      const grad = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.7, `rgba(${m.color[0]},${m.color[1]},${m.color[2]},${0.3 * fade})`);
      grad.addColorStop(1, `rgba(${m.color[0]},${m.color[1]},${m.color[2]},${0.7 * fade})`);

      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(m.x, m.y);
      ctx.strokeStyle = grad;
      ctx.lineWidth = m.width;
      ctx.stroke();

      // 头部发光
      const headG = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 6);
      headG.addColorStop(0, `rgba(255,255,255,${0.6 * fade})`);
      headG.addColorStop(0.3, `rgba(${m.color[0]},${m.color[1]},${m.color[2]},${0.4 * fade})`);
      headG.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(m.x, m.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = headG;
      ctx.fill();
    }

    // ═══════════════════════════════════════
    // 3) 浮动几何体 — 双层描边+旋转光晕
    // ═══════════════════════════════════════
    for (const shape of shapes) {
      shape.x += shape.vx;
      shape.y += shape.vy;
      shape.rotation += shape.rotationSpeed;

      const px = (mouse.x - lw / 2) * 0.015;
      const py = (mouse.y - lh / 2) * 0.015;

      if (shape.x < -shape.size) shape.x = lw + shape.size;
      if (shape.x > lw + shape.size) shape.x = -shape.size;
      if (shape.y < -shape.size) shape.y = lh + shape.size;
      if (shape.y > lh + shape.size) shape.y = -shape.size;

      const dx = shape.x + px * (1 + shape.sides * 0.12);
      const dy = shape.y + py * (1 + shape.sides * 0.12);
      const breathe = 1 + Math.sin(time * 0.0012 + shape.rotation) * 0.12;
      const [cr, cg, cb] = NODE_COLORS[shape.color];

      // 光晕填充
      const shapeGlow = ctx.createRadialGradient(dx, dy, 0, dx, dy, shape.size * breathe * 1.5);
      shapeGlow.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${shape.opacity * 0.15})`);
      shapeGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = shapeGlow;
      ctx.fillRect(dx - shape.size * 2, dy - shape.size * 2, shape.size * 4, shape.size * 4);

      // 外层
      drawPolygon(ctx, dx, dy, shape.size * breathe * 1.35, shape.sides, shape.rotation);
      ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${shape.opacity * 0.25})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // 主体
      drawPolygon(ctx, dx, dy, shape.size * breathe, shape.sides, shape.rotation);
      ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${shape.opacity})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${shape.opacity * 0.06})`;
      ctx.fill();
    }

    // ═══════════════════════════════════════
    // 4) 脉冲波纹 — 更频繁，更绚丽
    // ═══════════════════════════════════════
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rip = ripples[i];
      rip.radius += rip.speed;
      rip.opacity *= 0.983;

      if (rip.radius > rip.maxRadius || rip.opacity < 0.002) {
        ripples.splice(i, 1);
        continue;
      }

      const hex = rip.color;
      const rr = parseInt(hex.slice(1, 3), 16);
      const rg = parseInt(hex.slice(3, 5), 16);
      const rb = parseInt(hex.slice(5, 7), 16);

      // 外环
      ctx.beginPath();
      ctx.arc(rip.x, rip.y, rip.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${rr},${rg},${rb},${rip.opacity})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 中环
      if (rip.radius > 8) {
        ctx.beginPath();
        ctx.arc(rip.x, rip.y, rip.radius * 0.65, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${rr},${rg},${rb},${rip.opacity * 0.5})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // 内环填充
      if (rip.radius > 5 && rip.opacity > 0.01) {
        const ripGlow = ctx.createRadialGradient(rip.x, rip.y, 0, rip.x, rip.y, rip.radius * 0.4);
        ripGlow.addColorStop(0, `rgba(${rr},${rg},${rb},${rip.opacity * 0.15})`);
        ripGlow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = ripGlow;
        ctx.beginPath();
        ctx.arc(rip.x, rip.y, rip.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (Math.random() < 0.015) {
      ripples.push({
        x: Math.random() * lw, y: Math.random() * lh,
        radius: 0, maxRadius: 80 + Math.random() * 250,
        opacity: 0.06 + Math.random() * 0.05,
        color: PULSE_COLORS[Math.floor(Math.random() * PULSE_COLORS.length)],
        speed: 0.4 + Math.random() * 0.8,
      });
    }

    // 鼠标点击产生波纹（通过鼠标位置变化检测）
    // 这里只在鼠标有效范围内随机触发
    if (mouse.x > 0 && mouse.y > 0 && Math.random() < 0.003) {
      ripples.push({
        x: mouse.x + (Math.random() - 0.5) * 100,
        y: mouse.y + (Math.random() - 0.5) * 100,
        radius: 0, maxRadius: 60 + Math.random() * 100,
        opacity: 0.08,
        color: PULSE_COLORS[Math.floor(Math.random() * PULSE_COLORS.length)],
        speed: 0.6,
      });
    }

    // ═══════════════════════════════════════
    // 5) 神经网络连线 — 渐变 + 脉动
    // ═══════════════════════════════════════
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const ddx = nodes[i].x - nodes[j].x;
        const ddy = nodes[i].y - nodes[j].y;
        const distSq = ddx * ddx + ddy * ddy;
        if (distSq > maxDist * maxDist) continue;

        const dist = Math.sqrt(distSq);
        const breathe = 0.75 + Math.sin(time * 0.0015 + i * 0.08 + j * 0.05) * 0.25;
        const alpha = 0.16 * (1 - dist / maxDist) * breathe;

        const c1 = NODE_COLORS[nodes[i].layer];
        const c2 = NODE_COLORS[nodes[j].layer];

        const gradient = ctx.createLinearGradient(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y);
        gradient.addColorStop(0, `rgba(${c1[0]}, ${c1[1]}, ${c1[2]}, ${alpha})`);
        gradient.addColorStop(1, `rgba(${c2[0]}, ${c2[1]}, ${c2[2]}, ${alpha})`);

        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }
    }

    // ═══════════════════════════════════════
    // 6) 传输脉冲 — 更亮更多拖尾
    // ═══════════════════════════════════════
    for (let p = pulses.length - 1; p >= 0; p--) {
      const pulse = pulses[p];
      pulse.progress += pulse.speed;
      if (pulse.progress >= 1) { pulses.splice(p, 1); continue; }
      const from = nodes[pulse.fromIdx];
      const to = nodes[pulse.toIdx];
      if (!from || !to) continue;

      const ppx = from.x + (to.x - from.x) * pulse.progress;
      const ppy = from.y + (to.y - from.y) * pulse.progress;

      const hex = pulse.color;
      const pr = parseInt(hex.slice(1, 3), 16);
      const pg = parseInt(hex.slice(3, 5), 16);
      const pb = parseInt(hex.slice(5, 7), 16);

      // 5帧拖尾
      for (let t = 1; t <= 5; t++) {
        const tp = pulse.progress - t * 0.025;
        if (tp < 0) continue;
        const tx = from.x + (to.x - from.x) * tp;
        const ty = from.y + (to.y - from.y) * tp;
        ctx.beginPath();
        ctx.arc(tx, ty, 5 - t * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${pr},${pg},${pb},${0.2 / t})`;
        ctx.fill();
      }

      // 主光点 + 光晕
      const glow = ctx.createRadialGradient(ppx, ppy, 0, ppx, ppy, 10);
      glow.addColorStop(0, `rgba(255,255,255,0.7)`);
      glow.addColorStop(0.2, `rgba(${pr},${pg},${pb},0.8)`);
      glow.addColorStop(0.5, `rgba(${pr},${pg},${pb},0.3)`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(ppx, ppy, 10, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
    }

    // 更频繁的脉冲
    if (Math.random() < 0.08 && nodes.length > 1) {
      const fromIdx = Math.floor(Math.random() * nodes.length);
      let toIdx = Math.floor(Math.random() * nodes.length);
      if (toIdx === fromIdx) toIdx = (toIdx + 1) % nodes.length;
      const ddx = nodes[fromIdx].x - nodes[toIdx].x;
      const ddy = nodes[fromIdx].y - nodes[toIdx].y;
      if (Math.sqrt(ddx * ddx + ddy * ddy) < maxDist * 1.5) {
        pulses.push({
          fromIdx, toIdx, progress: 0,
          speed: 0.01 + Math.random() * 0.025,
          color: PULSE_COLORS[Math.floor(Math.random() * PULSE_COLORS.length)],
        });
      }
    }

    // ═══════════════════════════════════════
    // 7) 节点 — 7色 + 大光晕 + 呼吸环 + 核心高光
    // ═══════════════════════════════════════
    for (const node of nodes) {
      const [cr, cg, cb] = NODE_COLORS[node.layer];
      const mdx = node.x - mouse.x;
      const mdy = node.y - mouse.y;
      const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
      const mouseInf = Math.max(0, 1 - mDist / 220);

      const breathe = Math.sin(time * 0.002 + node.pulsePhase) * 0.18 + 0.82;
      const baseOp = node.opacity * breathe + mouseInf * 0.6;
      const r = node.radius * (1 + mouseInf * 1.2);

      // 外层大光晕
      if (baseOp > 0.3 || mouseInf > 0.03) {
        const glowR = r * 5;
        const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowR);
        glow.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${baseOp * 0.4})`);
        glow.addColorStop(0.3, `rgba(${cr}, ${cg}, ${cb}, ${baseOp * 0.15})`);
        glow.addColorStop(0.7, `rgba(${cr}, ${cg}, ${cb}, ${baseOp * 0.03})`);
        glow.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
      }

      // 呼吸环（鼠标靠近时）
      if (mouseInf > 0.15) {
        const ringR = r * 3.5 * (1 + Math.sin(time * 0.004 + node.pulsePhase) * 0.3);
        ctx.beginPath();
        ctx.arc(node.x, node.y, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${mouseInf * 0.35})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // 第二环
        const ringR2 = ringR * 1.4;
        ctx.beginPath();
        ctx.arc(node.x, node.y, ringR2, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${mouseInf * 0.15})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // 核心实心
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${Math.min(1, baseOp)})`;
      ctx.fill();

      // 白色核心
      if (baseOp > 0.45) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${baseOp * 0.35})`;
        ctx.fill();
      }
    }

    // ═══════════════════════════════════════
    // 8) 海量粒子 — 漂浮/火花/萤火虫三种类型
    // ═══════════════════════════════════════
    const maxParticles = 200;

    // 持续生成
    if (particles.length < maxParticles) {
      const batchSize = Math.min(3, maxParticles - particles.length);
      for (let b = 0; b < batchSize; b++) {
        const roll = Math.random();
        const type: Particle['type'] = roll < 0.35 ? 'firefly' : roll < 0.7 ? 'float' : 'spark';
        particles.push({
          x: Math.random() * lw,
          y: type === 'float' ? lh + Math.random() * 20 : Math.random() * lh,
          vx: (Math.random() - 0.5) * (type === 'spark' ? 1.0 : 0.2),
          vy: type === 'float' ? -0.2 - Math.random() * 0.6 :
              type === 'spark' ? (Math.random() - 0.5) * 0.8 :
              (Math.random() - 0.5) * 0.15,
          life: 0,
          maxLife: type === 'firefly' ? 200 + Math.random() * 350 :
                   type === 'spark' ? 40 + Math.random() * 60 :
                   120 + Math.random() * 200,
          size: type === 'firefly' ? 1.2 + Math.random() * 2.5 :
                type === 'spark' ? 0.8 + Math.random() * 1.2 :
                0.5 + Math.random() * 1.5,
          color: Math.floor(Math.random() * 7),
          type,
        });
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.life++;
      if (pt.life > pt.maxLife) { particles.splice(i, 1); continue; }

      // 运动
      if (pt.type === 'firefly') {
        // 萤火虫：不规则漂浮
        pt.x += pt.vx + Math.sin(time * 0.0015 + pt.y * 0.008) * 0.25;
        pt.y += pt.vy + Math.cos(time * 0.0012 + pt.x * 0.006) * 0.2;
        pt.vx *= 0.995;
        pt.vy *= 0.995;
        // 偶尔改方向
        if (Math.random() < 0.01) {
          pt.vx += (Math.random() - 0.5) * 0.3;
          pt.vy += (Math.random() - 0.5) * 0.3;
        }
      } else if (pt.type === 'spark') {
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vx *= 0.97;
        pt.vy *= 0.97;
      } else {
        pt.x += pt.vx + Math.sin(time * 0.001 + pt.x * 0.01) * 0.12;
        pt.y += pt.vy;
      }

      // 边界循环
      if (pt.x < -10) pt.x = lw + 10;
      if (pt.x > lw + 10) pt.x = -10;
      if (pt.y < -10 && pt.type === 'float') { pt.y = lh + 10; pt.life = 0; }

      const lifeRatio = pt.life / pt.maxLife;
      const fadeIn = Math.min(1, pt.life / 15);
      const fadeOut = Math.max(0, 1 - (lifeRatio - 0.7) / 0.3);
      const [pr, pg, pb] = NODE_COLORS[pt.color];

      if (pt.type === 'firefly') {
        // 萤火虫：脉冲闪烁 + 光晕
        const flicker = 0.5 + 0.5 * Math.sin(time * 0.006 + pt.x * 0.02 + pt.y * 0.02);
        const alpha = fadeIn * (lifeRatio < 0.7 ? 1 : fadeOut) * flicker * 0.6;

        // 光晕
        const ffGlow = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, pt.size * 4);
        ffGlow.addColorStop(0, `rgba(${pr}, ${pg}, ${pb}, ${alpha * 0.5})`);
        ffGlow.addColorStop(0.5, `rgba(${pr}, ${pg}, ${pb}, ${alpha * 0.15})`);
        ffGlow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = ffGlow;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size * 4, 0, Math.PI * 2);
        ctx.fill();

        // 核心
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${pr}, ${pg}, ${pb}, ${alpha})`;
        ctx.fill();

        // 白芯
        if (alpha > 0.3) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, pt.size * 0.4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${alpha * 0.4})`;
          ctx.fill();
        }
      } else {
        const alpha = fadeIn * (lifeRatio < 0.7 ? 1 : fadeOut) * (pt.type === 'spark' ? 0.6 : 0.45);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${pr}, ${pg}, ${pb}, ${alpha})`;
        ctx.fill();
      }
    }

    // ═══════════════════════════════════════
    // 更新节点位置
    // ═══════════════════════════════════════
    for (const node of nodes) {
      const mdx = node.x - mouse.x;
      const mdy = node.y - mouse.y;
      const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
      if (mDist < 180 && mDist > 0) {
        const force = 0.7 * (1 - mDist / 180);
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
    // 暗角（轻一点，让粒子更可见）
    // ═══════════════════════════════════════
    const vignette = ctx.createRadialGradient(lw / 2, lh / 2, lw * 0.3, lw / 2, lh / 2, lw * 0.9);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(5, 16, 32, 0.4)');
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
      const cw = window.innerWidth;
      const ch = window.innerHeight;
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
      canvas.style.width = cw + 'px';
      canvas.style.height = ch + 'px';
      if (nodesRef.current.length === 0) initScene(cw, ch);
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
  }, [initScene, render]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ background: 'transparent' }}
    />
  );
}
