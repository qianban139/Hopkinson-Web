// src/components/ProjectOverviewSection.tsx
// 首页"项目概述"区域 — 7 层动效叠加(GSAP + Lottie + CountUp + Tilt + Tabs + ScrollTrigger + 流光)
// 设计目标:打开页面后评委必须停留 ≥30s 才能滚动过去
import { useRef, useState, useLayoutEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Cpu, Box, BrainCircuit, BarChart3, Zap, Layers, Brain } from 'lucide-react';
import CountUp from 'react-countup';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface MetricCardProps {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  separator?: string;
  label: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
  delay: number;
}

/** 3D 鼠标跟随倾斜卡片 — 用 framer-motion 实现,避免 react-tilt 的 React 18 限制 */
function TiltCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const xSpring = useSpring(x, { stiffness: 200, damping: 20 });
  const ySpring = useSpring(y, { stiffness: 200, damping: 20 });
  const rotateX = useTransform(ySpring, [-0.5, 0.5], ['10deg', '-10deg']);
  const rotateY = useTransform(xSpring, [-0.5, 0.5], ['-10deg', '10deg']);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    x.set(px);
    y.set(py);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d', transformPerspective: 1000 }}
      className={className}
    >
      <div style={{ transform: 'translateZ(40px)' }}>{children}</div>
    </motion.div>
  );
}

function MetricCard({ value, suffix, prefix, decimals = 0, separator, label, color, bgColor, icon, delay }: MetricCardProps) {
  return (
    <TiltCard className="metric-card group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 backdrop-blur-sm transition-all duration-300 hover:border-cyan-400/40 hover:shadow-[0_0_40px_-10px_var(--glow)]"
              >
      {/* 流光扫过 */}
      <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />

      {/* 背景装饰圆圈 */}
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20 blur-2xl transition-opacity duration-500 group-hover:opacity-40"
        style={{ background: color }}
      />

      <div className="relative z-10">
        <div
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
          style={{ background: bgColor }}
        >
          <div style={{ color }}>{icon}</div>
        </div>

        <div className="mb-2 flex items-baseline gap-1">
          {prefix && <span className="text-2xl font-bold" style={{ color }}>{prefix}</span>}
          <span className="text-5xl font-bold tabular-nums tracking-tight" style={{ color, textShadow: `0 0 30px ${color}40` }}>
            <CountUp
              end={value}
              duration={2.4}
              decimals={decimals}
              separator={separator || ','}
              enableScrollSpy
              scrollSpyOnce
              scrollSpyDelay={delay * 1000}
            />
          </span>
          {suffix && <span className="text-xl font-semibold" style={{ color }}>{suffix}</span>}
        </div>

        <p className="text-sm tracking-wide text-white/65">{label}</p>
      </div>

      <style>{`.metric-card { --glow: ${color}; }`}</style>
    </TiltCard>
  );
}

const coreCapabilities = [
  {
    key: 'electromagnetic',
    label: '电磁驱动',
    icon: <Zap className="h-5 w-5" />,
    color: '#00F5FF',
    title: '可调谐 RLC 电磁驱动',
    description: '基于 Maxwell-Simplorer 联合仿真的链式电磁驱动电路,通过精准的电流-应变率映射实现 0–50 kA 可调输出,峰值电压 ≤ 4 kV,储能容量 ≤ 36 kJ。',
    metrics: [
      { label: '峰值电流', value: '50 kA' },
      { label: '电压上限', value: '4 kV' },
      { label: '储能容量', value: '36 kJ' },
      { label: '波形精度', value: '±2.3%' },
    ],
    techStack: ['Maxwell', 'Simplorer', 'Simulink', 'PLC'],
  },
  {
    key: 'digital-twin',
    label: '数字孪生',
    icon: <Layers className="h-5 w-5" />,
    color: '#FFD700',
    title: '高保真数字孪生引擎',
    description: 'SHPB 一维应力波 + Johnson-Cook 本构 + 多场耦合实时映射,Web 端 Three.js 渲染设备运行状态,与物理实体毫秒级同步。',
    metrics: [
      { label: '渲染帧率', value: '60 FPS' },
      { label: '同步延迟', value: '< 50 ms' },
      { label: '物理模型', value: 'J-C / Z-A' },
      { label: '弥散修正', value: 'Pochhammer' },
    ],
    techStack: ['Three.js', 'WebGL', 'Maxwell', 'ECharts'],
  },
  {
    key: 'ai-control',
    label: 'AI 控制',
    icon: <Brain className="h-5 w-5" />,
    color: '#1DD1A1',
    title: 'LSTM + WGAN-GP + PPO 三级闭环',
    description: 'LSTM 时序预测波形 → WGAN-GP 生成对抗优化 → PPO 强化学习自适应调控,真实 PyTorch 模型部署(LSTM 23 KB / PPO 42 KB)。',
    metrics: [
      { label: 'LSTM 模型', value: '23 KB' },
      { label: 'PPO 模型', value: '42 KB' },
      { label: '推理延迟', value: '< 80 ms' },
      { label: '波形误差', value: '< 5%' },
    ],
    techStack: ['PyTorch', 'LSTM', 'WGAN-GP', 'PPO'],
  },
];

export default function ProjectOverviewSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const cardsContainerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState('electromagnetic');

  useLayoutEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      // 标题入场:逐字符浮现 + 流光扫过
      if (titleRef.current) {
        const text = titleRef.current.textContent || '';
        titleRef.current.innerHTML = text
          .split('')
          .map((c) => `<span class="inline-block opacity-0">${c === ' ' ? '&nbsp;' : c}</span>`)
          .join('');
        gsap.to(titleRef.current.querySelectorAll('span'), {
          opacity: 1,
          y: 0,
          duration: 0.6,
          stagger: 0.04,
          ease: 'power3.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 75%', toggleActions: 'play none none reverse' },
        });
      }

      // 副标题淡入
      if (subtitleRef.current) {
        gsap.from(subtitleRef.current, {
          opacity: 0,
          y: 20,
          duration: 0.8,
          delay: 0.5,
          scrollTrigger: { trigger: sectionRef.current, start: 'top 75%', toggleActions: 'play none none reverse' },
        });
      }

      // 4 张数据卡片 stagger 飞入(自下而上,带旋转)
      if (cardsContainerRef.current) {
        gsap.from(cardsContainerRef.current.querySelectorAll('.metric-card'), {
          y: 60,
          opacity: 0,
          rotateX: 25,
          duration: 0.9,
          stagger: 0.15,
          ease: 'back.out(1.4)',
          scrollTrigger: { trigger: cardsContainerRef.current, start: 'top 80%', toggleActions: 'play none none reverse' },
        });
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-[#051020]/40 py-14 md:py-16">
      {/* 背景装饰 — 视差网格 + 渐变光 */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute right-1/4 bottom-1/4 h-96 w-96 rounded-full bg-emerald-500/10 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        {/* 标题区 */}
        <div className="mb-16 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/5 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.3em] text-cyan-300">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_currentColor]" />
            Project Overview
          </div>
          <h2
            ref={titleRef}
            className="mb-5 bg-gradient-to-r from-white via-cyan-100 to-white bg-clip-text text-4xl font-bold leading-tight text-transparent md:text-5xl lg:text-6xl"
          >
            数智化电磁驱动测试平台
          </h2>
          <p ref={subtitleRef} className="mx-auto max-w-3xl text-base leading-relaxed text-white/65 md:text-lg">
            通过 <span className="text-cyan-300">电磁驱动</span> · <span className="text-amber-300">数字孪生</span> · <span className="text-emerald-300">人工智能</span> 三大技术深度融合,
            实现 <strong className="text-white">热-力-电多场耦合动态加载</strong>、<strong className="text-white">智能波形闭环调控</strong>、
            <strong className="text-white">数据融合分析</strong>,为极端环境材料性能评估提供全流程数智化测试平台。
          </p>
        </div>

        {/* 4 个数据指标卡片 */}
        <div ref={cardsContainerRef} className="mb-20 grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
          <MetricCard
            value={7}
            label="大类材料数据库"
            color="#00F5FF"
            bgColor="rgba(0, 245, 255, 0.15)"
            icon={<Cpu className="h-7 w-7" />}
            delay={0}
          />
          <MetricCard
            value={100000}
            separator=","
            label="fps 高速采集"
            color="#FFD700"
            bgColor="rgba(255, 215, 0, 0.15)"
            icon={<BarChart3 className="h-7 w-7" />}
            delay={0.15}
          />
          <MetricCard
            value={3}
            suffix=" 级"
            label="AI 闭环优化"
            color="#1DD1A1"
            bgColor="rgba(29, 209, 161, 0.15)"
            icon={<BrainCircuit className="h-7 w-7" />}
            delay={0.3}
          />
          <MetricCard
            value={4}
            suffix=" 层"
            label="全栈技术架构"
            color="#FF9F43"
            bgColor="rgba(255, 159, 67, 0.15)"
            icon={<Box className="h-7 w-7" />}
            delay={0.45}
          />
        </div>

        {/* 三大核心能力 Tabs */}
        <div className="mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="mb-8 text-center"
          >
            <h3 className="mb-2 text-2xl font-bold text-white md:text-3xl">三大核心能力</h3>
            <p className="text-sm text-white/55">点击切换,查看每项能力的技术细节与关键指标</p>
          </motion.div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mx-auto mb-8 grid w-full max-w-xl grid-cols-3 bg-white/[0.03] backdrop-blur-sm">
              {coreCapabilities.map((cap) => (
                <TabsTrigger
                  key={cap.key}
                  value={cap.key}
                  className="data-[state=active]:bg-white/10 data-[state=active]:text-white"
                  style={{ ['--tab-color' as string]: cap.color }}
                >
                  <span className="flex items-center gap-2" style={{ color: activeTab === cap.key ? cap.color : undefined }}>
                    {cap.icon}
                    <span className="hidden sm:inline">{cap.label}</span>
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>

            {coreCapabilities.map((cap) => (
              <TabsContent key={cap.key} value={cap.key} className="focus-visible:outline-none">
                <motion.div
                  key={cap.key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="grid grid-cols-1 gap-6 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 backdrop-blur-md md:grid-cols-2 md:p-8"
                  style={{ boxShadow: `0 0 60px -20px ${cap.color}40` }}
                >
                  {/* 左侧:图标 + 标题 + 描述 */}
                  <div className="space-y-5">
                    <div
                      className="flex h-16 w-16 items-center justify-center rounded-2xl"
                      style={{ background: `${cap.color}20`, color: cap.color, boxShadow: `0 0 30px ${cap.color}40` }}
                    >
                      <div className="scale-150">{cap.icon}</div>
                    </div>
                    <h4 className="text-2xl font-bold text-white md:text-3xl">{cap.title}</h4>
                    <p className="text-base leading-relaxed text-white/70">{cap.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {cap.techStack.map((tech) => (
                        <span
                          key={tech}
                          className="rounded-full border px-3 py-1 text-xs font-medium tracking-wide"
                          style={{ borderColor: `${cap.color}40`, color: cap.color, background: `${cap.color}10` }}
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 右侧:4 个关键指标 */}
                  <div className="grid grid-cols-2 gap-3">
                    {cap.metrics.map((m, i) => (
                      <motion.div
                        key={m.label}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 + i * 0.08, duration: 0.4 }}
                        className="rounded-xl border border-white/10 bg-black/20 p-4 transition-all duration-300 hover:scale-[1.03] hover:border-white/30"
                      >
                        <p className="mb-1 text-xs uppercase tracking-wider text-white/50">{m.label}</p>
                        <p className="text-xl font-bold tabular-nums" style={{ color: cap.color }}>
                          {m.value}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </section>
  );
}
