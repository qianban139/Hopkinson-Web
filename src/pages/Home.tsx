import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Play, ChevronRight, Volume2, VolumeX, FileText, Cpu, BrainCircuit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MaterialCard from '@/components/MaterialCard';
import TechLayerCard from '@/components/TechLayerCard';
import SceneCard from '@/components/SceneCard';
import ProjectOverviewSection from '@/components/ProjectOverviewSection';
import { useAppStore } from '@/store/useAppStore';

const techLayers = [
  {
    title: '物理层',
    subtitle: 'Physical Layer',
    description: '电磁驱动霍普金森杆主体，包含可调谐RLC链式电路、锥形次级线圈、多场耦合加载模块',
    features: [
      '可调谐RLC链式电路',
      '铜质锥形次级线圈',
      '热脉冲发生器',
      '电场加载装置',
      'XTDIC高速视觉传感器',
    ],
    layer: 'physical' as const,
  },
  {
    title: '数字孪生层',
    subtitle: 'Digital Twin Layer',
    description: '基于高保真多物理场耦合模型，实现虚拟实体与物理实体的实时映射与交互',
    features: [
      'Maxwell-Simplorer联合仿真',
      'Simulink实时建模',
      '真实3D模型映射',
      '加载路径优化',
      '故障预测预警',
    ],
    layer: 'digital' as const,
  },
  {
    title: '智能控制层',
    subtitle: 'AI Control Layer',
    description: '集成深度学习算法，实现波形自适应调控、多轴同步加载、电磁干扰智能抑制',
    features: [
      'LSTM时序预测',
      'WGAN-GP波形生成',
      'PPO强化学习优化',
      '多轴同步控制',
      'EMI智能抑制',
    ],
    layer: 'ai' as const,
  },
  {
    title: '数据分析层',
    subtitle: 'Data Analysis Layer',
    description: '融合动态本构方程与小波变换，支持跨装置比对验证与实验结果可重复性分析',
    features: [
      '改进Johnson-Cook模型',
      '小波变换数据融合',
      '应力-应变信号处理',
      '跨装置比对验证',
      '实验结果可重复性分析',
    ],
    layer: 'data' as const,
  },
];

const scenes = [
  {
    title: '土木路基动态稳定性评估',
    subtitle: '川藏铁路等重大工程',
    description: '采用电磁驱动霍普金森杆结合XTDIC三维全场应变测量系统，对岩土试样进行高应变率动态压缩/拉伸测试',
    features: [
      '波形自适应调控',
      '裂纹实时追踪',
      '本构关系提取',
      '动力稳定性评价',
    ],
    scene: 'civil' as const,
  },
  {
    title: '深部岩石动态破碎实验',
    subtitle: '深部矿产开采',
    description: '依托动态三轴电磁霍普金森杆试验系统，实现岩石试样在三维应力状态下的动态响应测试',
    features: [
      '真三轴六向加载',
      '纳秒级同步控制',
      '裂纹网络演化监测',
      '爆破参数优化',
    ],
    scene: 'mining' as const,
  },
  {
    title: '防火材料抗冲击性能评估',
    subtitle: '石油化工安全防护',
    description: '利用电磁驱动霍普金森杆进行防火材料的高应变率热-力耦合测试，验证极端环境下的结构完整性',
    features: [
      '热-力-电多场耦合',
      '智能信号处理',
      '能量吸收特性分析',
      '失效阈值提取',
    ],
    scene: 'safety' as const,
  },
];

const researchHighlights = [
  {
    id: 'ann-shpb-concrete',
    tag: '学术论文 · 2021',
    title: 'ANN 驱动的混凝土 SHPB 本构预测',
    subtitle: '龙旭 等 · 南京航空航天大学学报 53(5)',
    summary:
      'ABAQUS 有限元 + Drucker-Prager 本构生成 20 组训练样本,BP 神经网络以入射波为输入、反射/透射波为输出,精确预测 500–1400/s 应变率区间混凝土的应力应变响应,可外推训练未覆盖的应变率区间。',
    chips: ['BP 神经网络', 'ABAQUS', 'Drucker-Prager', '500–1400/s'],
    color: '#00F5FF',
    icon: <FileText className="h-6 w-6" />,
    link: '/analysis',
    linkLabel: '试用 BP-ANN 本构预测',
    theoryLink: '/teaching?node=ann-shpb-concrete',
  },
  {
    id: 'deep-learning-coal-ct',
    tag: '学术论文 · 2024',
    title: '深度学习煤岩 Micro-CT 裂隙智能提取',
    subtitle: '王登科 等 · 煤炭学报 49(8)',
    summary:
      '提出 MCSN 网络(U-Net + VGG16 迁移 + DCAC 空洞卷积 + 残差),6000 张煤岩 CT 数据集训练。Recall/Precision/MPA/MIoU 全面领先经典 CNN,并成功应用于巷道围岩钻孔窥视裂隙识别,指导瓦斯抽采钻孔注封。',
    chips: ['U-Net', 'VGG16 迁移', 'DCAC 空洞卷积', 'MCSN'],
    color: '#1DD1A1',
    icon: <BrainCircuit className="h-6 w-6" />,
    link: '/analysis',
    linkLabel: '运行 CT 裂隙提取',
    theoryLink: '/teaching?node=deep-learning-coal-ct',
  },
  {
    id: 'pid-servo-confining',
    tag: '控制理论 · 围压应用',
    title: 'PID 闭环精准伺服调控',
    subtitle: '三层拆解 · 50 MPa 围压稳定加载',
    summary:
      '伺服 = 执行精准 / PID = 自动纠错(比例·积分·微分)/ 闭环 = 测量-对比-修正。50 MPa 围压下,PID 闭环伺服在 2–3 秒内稳定于目标值 ±2%,不漂移、不超调,精度极高。',
    chips: ['Kp·Ki·Kd', '闭环反馈', '50 MPa 稳定', '±2% 精度'],
    color: '#FF9F43',
    icon: <Cpu className="h-6 w-6" />,
    link: '/lab',
    linkLabel: '打开 PID 闭环调参',
    theoryLink: '/teaching?node=pid-servo-confining',
  },
];

export default function Home() {
  const { materials } = useAppStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVideoClick = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVideoPlay = () => setIsPlaying(true);
  const handleVideoPause = () => setIsPlaying(false);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-16">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="flex justify-center items-center">
            {/* 标题内容 - 居中显示 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-10 text-center max-w-4xl"
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-[#00F5FF]/10 border border-[#00F5FF]/30 mx-auto"
              >
                <span className="w-2 h-2 rounded-full bg-[#00F5FF] animate-pulse" />
                <span className="text-sm tracking-widest text-[#00F5FF]">嘉本科技 · 前沿测试技术</span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex flex-col items-center gap-5 sm:gap-6 lg:gap-7"
              >
                <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-[4.5rem] font-bold text-white tracking-[0.08em] leading-[1.15]">
                  数智化电磁驱动
                </h1>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-[4.5rem] font-bold text-[#00F5FF] tracking-[0.08em] leading-[1.15]" style={{ textShadow: '0 0 40px rgba(0, 245, 255, 0.4)' }}>
                  霍普金森杆
                </h1>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-[4.5rem] font-bold text-white tracking-[0.08em] leading-[1.15]">
                  多场耦合动态测试系统
                </h1>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="flex flex-col items-center gap-5 pt-2"
              >
                <div className="flex items-center gap-4 text-white/80 text-lg tracking-[0.25em]">
                  <span>电磁驱动</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00F5FF]" />
                  <span>数字孪生</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00F5FF]" />
                  <span>人工智能</span>
                  <span className="text-[#00F5FF] font-semibold ml-2">深度融合</span>
                </div>
                <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-white/60 text-sm tracking-wider">
                  <span>热-力-电多场耦合动态加载</span>
                  <span className="hidden sm:inline text-white/30">|</span>
                  <span>智能波形调控</span>
                  <span className="hidden sm:inline text-white/30">|</span>
                  <span>全链条数据融合</span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="flex flex-wrap gap-4 justify-center pt-4"
              >
                <Link to="/lab">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-[#00F5FF]/40 text-[#00F5FF] hover:bg-[#00F5FF]/10 hover:border-[#00F5FF]/70 px-8 py-5 text-[0.95rem] tracking-wide rounded-full transition-all duration-300"
                  >
                    立即开始
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </motion.div>
            </motion.div>


          </div>
        </div>

        {/* 滚动指示 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <div className="flex flex-col items-center gap-2">
            <span className="text-sm text-white/50">向下滚动</span>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <ChevronRight className="w-5 h-5 text-white/50 rotate-90" />
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* 【重写】项目概述 — 7 层动效叠加(GSAP + CountUp + 3D Tilt + Tabs + 流光) */}
      <ProjectOverviewSection />

      {/* 前沿研究成果 — 论文 + 工程理论 */}
      <section className="section-spacing">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="h2-section text-white mb-4">前沿研究成果</h2>
            <p className="body-base max-w-2xl mx-auto">
              集成学术论文与工程理论,支撑 AI 驱动的材料本构预测、智能裂隙识别与高精度闭环控制
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {researchHighlights.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.12 }}
              >
                <div
                  className="h-full rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-[color:var(--accent)]/50 hover:shadow-[0_0_40px_-10px_var(--accent)] flex flex-col"
                  style={{ ['--accent' as string]: item.color }}
                >
                  <div
                    className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl"
                    style={{ background: `${item.color}1a`, color: item.color, boxShadow: `0 0 24px -6px ${item.color}` }}
                  >
                    {item.icon}
                  </div>
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.2em]" style={{ color: item.color }}>
                    {item.tag}
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-white leading-snug">
                    {item.title}
                  </h3>
                  <p className="mb-4 text-xs text-white/50 leading-relaxed">
                    {item.subtitle}
                  </p>
                  <p className="mb-5 text-sm text-white/70 leading-relaxed line-clamp-4">
                    {item.summary}
                  </p>
                  <div className="mb-5 flex flex-wrap gap-1.5">
                    {item.chips.map(chip => (
                      <span
                        key={chip}
                        className="rounded-full border px-2.5 py-0.5 text-[10px] tracking-wide"
                        style={{ borderColor: `${item.color}55`, color: item.color, background: `${item.color}0d` }}
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                  <div className="mt-auto space-y-2">
                    <Link
                      to={item.link}
                      className="flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all hover:translate-x-0.5"
                      style={{ borderColor: `${item.color}66`, color: item.color, background: `${item.color}15` }}
                    >
                      {item.linkLabel}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                    <Link
                      to={item.theoryLink}
                      className="flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-[10px] text-white/50 hover:text-white/80 hover:border-white/30 transition-colors"
                    >
                      阅读理论背景
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 【移动后】产品介绍视频 */}
      <section className="section-spacing">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="h2-section text-white mb-4">产品介绍</h2>
            <p className="body-base max-w-2xl mx-auto">
              观看系统演示视频,了解电磁驱动霍普金森杆的工作原理和核心功能
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto"
          >
            <div className="h-[500px] rounded-2xl overflow-hidden border border-[#00F5FF]/20 relative group">
              <video
                ref={videoRef}
                src="https://hopkinson-assets.oss-cn-hangzhou.aliyuncs.com/videos/xiaotiao.mp4"
                autoPlay
                muted={isMuted}
                loop
                playsInline
                className="w-full h-full object-cover cursor-pointer"
                poster="/logo.png"
                onClick={handleVideoClick}
                onPlay={handleVideoPlay}
                onPause={handleVideoPause}
              >
                您的浏览器不支持视频播放
              </video>

              {/* 静音/声音切换按钮 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMute();
                }}
                className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-all z-10"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>

              {/* 播放状态指示 */}
              {!isPlaying && (
                <div
                  onClick={handleVideoClick}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer"
                >
                  <div className="w-16 h-16 rounded-full bg-[#00F5FF]/90 flex items-center justify-center">
                    <Play className="w-8 h-8 text-[#0A2540] ml-1" />
                  </div>
                </div>
              )}

              {/* 静音提示 */}
              {isMuted && isPlaying && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm text-xs text-white/80 flex items-center gap-2"
                >
                  <VolumeX className="w-3 h-3" />
                  点击开启声音
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* 四层技术架构 */}
      <section className="section-spacing bg-[#051020]/50">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="h2-section text-white mb-4">
              四层技术架构
            </h2>
            <p className="body-base max-w-2xl mx-auto">
              从物理层到数据分析层,构建完整的数智化测试平台
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {techLayers.map((layer, index) => (
              <TechLayerCard key={layer.title} {...layer} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* 三大应用场景 */}
      <section className="section-spacing">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="h2-section text-white mb-4">
              三大应用场景
            </h2>
            <p className="body-base max-w-2xl mx-auto">
              聚焦土木工程、矿业工程、安全科学与工程等极端环境材料性能评估
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {scenes.map((scene, index) => (
              <SceneCard key={scene.title} {...scene} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* 7大类材料数据库 */}
      <section className="section-spacing bg-[#051020]/50">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="h2-section text-white mb-4">
              7 大类材料动态性能数据库
            </h2>
            <p className="body-base max-w-2xl mx-auto">
              覆盖金属、矿石、混凝土、陶瓷、高分子、吸能材料、生物材料,
              支持 AI 跨材料映射与动态性能预测
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {materials.slice(0, 4).map((material) => (
              <MaterialCard key={material.id} material={material} />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6 max-w-4xl mx-auto">
            {materials.slice(4).map((material) => (
              <MaterialCard key={material.id} material={material} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
