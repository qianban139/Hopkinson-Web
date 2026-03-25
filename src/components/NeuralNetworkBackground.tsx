// src/components/NeuralNetworkBackground.tsx
// 沉浸式科技背景 — 流畅粒子 + 柔和星云 + 流星 + 神经网络
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
  type: 'float' | 'glow';
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

const PULSE_COLORS = ['#00F5FF', '#0EA5E9', '#06B6D4', '#2DD4BF', '#94A3B8', '#CBD5E1', '#38BDF8'];
const NODE_COLORS: [number, number, number][] = [
  [0, 245, 255],    // cyan
  [14, 165, 233],   // sky blue
  [6, 182, 212],    // teal
  [45, 212, 191],   // mint
  [148, 163, 184],  // steel gray
  [56, 189, 248],   // light blue
  [203, 213, 225],  // silver
];
const NEBULA_COLORS = [
  { r: 0, g: 245, b: 255 },    // cyan
  { r: 14, g: 165, b: 233 },   // sky blue
  { r: 6, g: 182, b: 212 },    // teal
  { r: 45, g: 212, b: 191 },   // mint
  { r: 56, g: 189, b: 248 },   // light sky
  { r: 100, g: 116, b: 139 },  // slate
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
    // 神经网络节点 (65个)
    const count = Math.min(65, Math.floor((w * h) / 20000));
    const nodes: Node[] = [];
    for (let i = 0; i < count; i++) {
      nodes.push({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 2.5 + 1.5,
        opacity: Math.random() * 0.5 + 0.3,
        layer: Math.floor(Math.random() * 7),
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
    nodesRef.current = nodes;

    // 浮动几何体 (10个)
    const shapes: FloatingShape[] = [];
    for (let i = 0; i < 10; i++) {
      const sides = [3, 4, 5, 6, 8][Math.floor(Math.random() * 5)];
      shapes.push({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.08, vy: (Math.random() - 0.5) * 0.08,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.003,
        size: 25 + Math.random() * 60,
        sides,
        opacity: 0.02 + Math.random() * 0.03,
        color: Math.floor(Math.random() * 7),
      });
    }
    shapesRef.current = shapes;

    // 初始粒子 (160个)
    const particles: Particle[] = [];
    for (let i = 0; i < 160; i++) {
      const type: Particle['type'] = Math.random() < 0.4 ? 'glow' : 'float';
      particles.push({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.15,
        vy: type === 'float' ? -0.1 - Math.random() * 0.3 : (Math.random() - 0.5) * 0.1,
        life: Math.floor(Math.random() * 150),
        maxLife: type === 'glow' ? 250 + Math.random() * 350 : 150 + Math.random() * 250,
        size: type === 'glow' ? 1 + Math.random() * 2.2 : 0.5 + Math.random() * 1.3,
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
    // 1) 星云极光 — 缓慢流动的柔和光雾
    // ═══════════════════════════════════════
    for (let i = 0; i < NEBULA_COLORS.length; i++) {
      const nc = NEBULA_COLORS[i];
      const phase = time * 0.0002 + i * 1.2;
      const cx = lw * (0.2 + 0.6 * Math.sin(phase + i * 0.8));
      const cy = lh * (0.2 + 0.6 * Math.cos(phase * 0.5 + i * 1.1));
      const radius = lw * (0.22 + 0.12 * Math.sin(phase * 0.3 + i));

      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, `rgba(${nc.r}, ${nc.g}, ${nc.b}, 0.035)`);
      gradient.addColorStop(0.4, `rgba(${nc.r}, ${nc.g}, ${nc.b}, 0.018)`);
      gradient.addColorStop(1, `rgba(${nc.r}, ${nc.g}, ${nc.b}, 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, lw, lh);
    }

    // 鼠标附近柔和光晕
    if (mouse.x > 0 && mouse.y > 0) {
      const mg = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 200);
      mg.addColorStop(0, 'rgba(0, 245, 255, 0.02)');
      mg.addColorStop(0.6, 'rgba(139, 92, 246, 0.008)');
      mg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = mg;
      ctx.fillRect(0, 0, lw, lh);
    }

    // ═══════════════════════════════════════
    // 2) 流星 — 偶尔出现，优雅划过
    // ═══════════════════════════════════════
    if (Math.random() < 0.006 && meteors.length < 3) {
      const angle = -Math.PI / 6 + (Math.random() - 0.5) * 0.3;
      const speed = 2.5 + Math.random() * 3;
      const c = NODE_COLORS[Math.floor(Math.random() * 7)];
      meteors.push({
        x: Math.random() * lw * 0.8 + lw * 0.1, y: -10,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle + Math.PI / 2) * speed,
        length: 50 + Math.random() * 100,
        life: 0, maxLife: 70 + Math.random() * 50,
        color: c, width: 1 + Math.random(),
      });
    }

    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.life++;
      m.x += m.vx;
      m.y += m.vy;

      if (m.life > m.maxLife || m.y > lh + 10) { meteors.splice(i, 1); continue; }

      const fade = m.life < 12 ? m.life / 12 : m.life > m.maxLife - 20 ? (m.maxLife - m.life) / 20 : 1;
      const speed = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
      const tailX = m.x - (m.vx / speed) * m.length;
      const tailY = m.y - (m.vy / speed) * m.length;

      const grad = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.6, `rgba(${m.color[0]},${m.color[1]},${m.color[2]},${0.2 * fade})`);
      grad.addColorStop(1, `rgba(${m.color[0]},${m.color[1]},${m.color[2]},${0.5 * fade})`);

      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(m.x, m.y);
      ctx.strokeStyle = grad;
      ctx.lineWidth = m.width;
      ctx.stroke();

      // 柔和头部光
      const headG = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 5);
      headG.addColorStop(0, `rgba(255,255,255,${0.4 * fade})`);
      headG.addColorStop(0.4, `rgba(${m.color[0]},${m.color[1]},${m.color[2]},${0.25 * fade})`);
      headG.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(m.x, m.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = headG;
      ctx.fill();
    }

    // ═══════════════════════════════════════
    // 3) 浮动几何体 — 缓慢漂移
    // ═══════════════════════════════════════
    for (const shape of shapes) {
      shape.x += shape.vx;
      shape.y += shape.vy;
      shape.rotation += shape.rotationSpeed;

      const px = (mouse.x - lw / 2) * 0.01;
      const py = (mouse.y - lh / 2) * 0.01;

      if (shape.x < -shape.size) shape.x = lw + shape.size;
      if (shape.x > lw + shape.size) shape.x = -shape.size;
      if (shape.y < -shape.size) shape.y = lh + shape.size;
      if (shape.y > lh + shape.size) shape.y = -shape.size;

      const dx = shape.x + px * (1 + shape.sides * 0.1);
      const dy = shape.y + py * (1 + shape.sides * 0.1);
      const breathe = 1 + Math.sin(time * 0.0008 + shape.rotation) * 0.08;
      const [cr, cg, cb] = NODE_COLORS[shape.color];

      // 柔和光晕
      const shapeGlow = ctx.createRadialGradient(dx, dy, 0, dx, dy, shape.size * breathe * 1.3);
      shapeGlow.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${shape.opacity * 0.1})`);
      shapeGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = shapeGlow;
      ctx.beginPath();
      ctx.arc(dx, dy, shape.size * breathe * 1.3, 0, Math.PI * 2);
      ctx.fill();

      // 外层
      drawPolygon(ctx, dx, dy, shape.size * breathe * 1.25, shape.sides, shape.rotation);
      ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${shape.opacity * 0.2})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // 主体
      drawPolygon(ctx, dx, dy, shape.size * breathe, shape.sides, shape.rotation);
      ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${shape.opacity})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${shape.opacity * 0.04})`;
      ctx.fill();
    }

    // ═══════════════════════════════════════
    // 4) 脉冲波纹 — 缓慢扩散
    // ═══════════════════════════════════════
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rip = ripples[i];
      rip.radius += rip.speed;
      rip.opacity *= 0.988;

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
      ctx.lineWidth = 1.2;
      ctx.stroke();

      if (rip.radius > 10) {
        ctx.beginPath();
        ctx.arc(rip.x, rip.y, rip.radius * 0.6, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${rr},${rg},${rb},${rip.opacity * 0.4})`;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
    }

    if (Math.random() < 0.008) {
      ripples.push({
        x: Math.random() * lw, y: Math.random() * lh,
        radius: 0, maxRadius: 100 + Math.random() * 200,
        opacity: 0.05 + Math.random() * 0.03,
        color: PULSE_COLORS[Math.floor(Math.random() * PULSE_COLORS.length)],
        speed: 0.3 + Math.random() * 0.5,
      });
    }

    // ═══════════════════════════════════════
    // 5) 神经网络连线
    // ═══════════════════════════════════════
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const ddx = nodes[i].x - nodes[j].x;
        const ddy = nodes[i].y - nodes[j].y;
        const distSq = ddx * ddx + ddy * ddy;
        if (distSq > maxDist * maxDist) continue;

        const dist = Math.sqrt(distSq);
        const breathe = 0.8 + Math.sin(time * 0.001 + i * 0.06) * 0.2;
        const alpha = 0.13 * (1 - dist / maxDist) * breathe;

        const c1 = NODE_COLORS[nodes[i].layer];
        const c2 = NODE_COLORS[nodes[j].layer];

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
    // 6) 传输脉冲 — 柔和流动
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

      // 平滑拖尾（4帧）
      for (let t = 1; t <= 4; t++) {
        const tp = pulse.progress - t * 0.02;
        if (tp < 0) continue;
        const tx = from.x + (to.x - from.x) * tp;
        const ty = from.y + (to.y - from.y) * tp;
        ctx.beginPath();
        ctx.arc(tx, ty, 4 - t * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${pr},${pg},${pb},${0.12 / t})`;
        ctx.fill();
      }

      // 主光点
      const glow = ctx.createRadialGradient(ppx, ppy, 0, ppx, ppy, 8);
      glow.addColorStop(0, `rgba(255,255,255,0.5)`);
      glow.addColorStop(0.25, `rgba(${pr},${pg},${pb},0.6)`);
      glow.addColorStop(0.6, `rgba(${pr},${pg},${pb},0.15)`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(ppx, ppy, 8, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
    }

    // 脉冲生成（适中频率）
    if (Math.random() < 0.05 && nodes.length > 1) {
      const fromIdx = Math.floor(Math.random() * nodes.length);
      let toIdx = Math.floor(Math.random() * nodes.length);
      if (toIdx === fromIdx) toIdx = (toIdx + 1) % nodes.length;
      const ddx = nodes[fromIdx].x - nodes[toIdx].x;
      const ddy = nodes[fromIdx].y - nodes[toIdx].y;
      if (Math.sqrt(ddx * ddx + ddy * ddy) < maxDist * 1.5) {
        pulses.push({
          fromIdx, toIdx, progress: 0,
          speed: 0.008 + Math.random() * 0.015,
          color: PULSE_COLORS[Math.floor(Math.random() * PULSE_COLORS.length)],
        });
      }
    }

    // ═══════════════════════════════════════
    // 7) 节点 — 柔和光晕 + 稳定呼吸
    // ═══════════════════════════════════════
    for (const node of nodes) {
      const [cr, cg, cb] = NODE_COLORS[node.layer];
      const mdx = node.x - mouse.x;
      const mdy = node.y - mouse.y;
      const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
      const mouseInf = Math.max(0, 1 - mDist / 220);

      // 缓慢平稳的呼吸
      const breathe = Math.sin(time * 0.0015 + node.pulsePhase) * 0.12 + 0.88;
      const baseOp = node.opacity * breathe + mouseInf * 0.4;
      const r = node.radius * (1 + mouseInf * 0.8);

      // 柔和光晕
      if (baseOp > 0.3 || mouseInf > 0.05) {
        const glowR = r * 4.5;
        const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowR);
        glow.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${baseOp * 0.3})`);
        glow.addColorStop(0.4, `rgba(${cr}, ${cg}, ${cb}, ${baseOp * 0.1})`);
        glow.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
      }

      // 鼠标靠近时的环
      if (mouseInf > 0.2) {
        const ringR = r * 3 * (1 + Math.sin(time * 0.003 + node.pulsePhase) * 0.2);
        ctx.beginPath();
        ctx.arc(node.x, node.y, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${mouseInf * 0.25})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }

      // 核心
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${Math.min(1, baseOp)})`;
      ctx.fill();

      // 柔和白芯
      if (baseOp > 0.5) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${baseOp * 0.25})`;
        ctx.fill();
      }
    }

    // ═══════════════════════════════════════
    // 8) 粒子 — 漂浮和柔光两种，平稳运动
    // ═══════════════════════════════════════
    const maxParticles = 180;

    if (particles.length < maxParticles && Math.random() < 0.3) {
      const type: Particle['type'] = Math.random() < 0.4 ? 'glow' : 'float';
      particles.push({
        x: Math.random() * lw,
        y: type === 'float' ? lh + Math.random() * 20 : Math.random() * lh,
        vx: (Math.random() - 0.5) * 0.12,
        vy: type === 'float' ? -0.1 - Math.random() * 0.3 : (Math.random() - 0.5) * 0.08,
        life: 0,
        maxLife: type === 'glow' ? 300 + Math.random() * 400 : 180 + Math.random() * 280,
        size: type === 'glow' ? 1 + Math.random() * 2 : 0.5 + Math.random() * 1.2,
        color: Math.floor(Math.random() * 7),
        type,
      });
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.life++;
      if (pt.life > pt.maxLife) { particles.splice(i, 1); continue; }

      if (pt.type === 'glow') {
        // 柔光粒子：缓慢漂移，不闪烁
        pt.x += pt.vx + Math.sin(time * 0.0008 + pt.y * 0.005) * 0.08;
        pt.y += pt.vy + Math.cos(time * 0.0006 + pt.x * 0.004) * 0.06;
      } else {
        pt.x += pt.vx + Math.sin(time * 0.0007 + pt.x * 0.008) * 0.06;
        pt.y += pt.vy;
      }

      if (pt.x < -10) pt.x = lw + 10;
      if (pt.x > lw + 10) pt.x = -10;
      if (pt.y < -10 && pt.type === 'float') { pt.y = lh + 10; pt.life = 0; }

      const lifeRatio = pt.life / pt.maxLife;
      // 平滑的淡入淡出
      const fadeIn = Math.min(1, pt.life / 30);
      const fadeOut = lifeRatio > 0.75 ? Math.max(0, 1 - (lifeRatio - 0.75) / 0.25) : 1;
      const [pr, pg, pb] = NODE_COLORS[pt.color];

      if (pt.type === 'glow') {
        // 柔和稳定的发光（无闪烁）
        const alpha = fadeIn * fadeOut * 0.4;

        // 光晕
        const ffGlow = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, pt.size * 3.5);
        ffGlow.addColorStop(0, `rgba(${pr}, ${pg}, ${pb}, ${alpha * 0.35})`);
        ffGlow.addColorStop(0.6, `rgba(${pr}, ${pg}, ${pb}, ${alpha * 0.1})`);
        ffGlow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = ffGlow;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size * 3.5, 0, Math.PI * 2);
        ctx.fill();

        // 核心
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${pr}, ${pg}, ${pb}, ${alpha})`;
        ctx.fill();
      } else {
        const alpha = fadeIn * fadeOut * 0.35;
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
      if (mDist < 160 && mDist > 0) {
        const force = 0.5 * (1 - mDist / 160);
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

    // 暗角
    const vignette = ctx.createRadialGradient(lw / 2, lh / 2, lw * 0.3, lw / 2, lh / 2, lw * 0.85);
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
