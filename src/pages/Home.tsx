import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Play, ChevronRight, Cpu, Box, BrainCircuit, BarChart3, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MaterialCard from '@/components/MaterialCard';
import TechLayerCard from '@/components/TechLayerCard';
import SceneCard from '@/components/SceneCard';
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
                className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-[#00F5FF]/10 border border-[#00F5FF]/30 mx-auto"
              >
                <span className="w-2 h-2 rounded-full bg-[#00F5FF] animate-pulse" />
                <span className="text-sm tracking-widest text-[#00F5FF]">嘉本科技 · 前沿测试技术</span>
              </motion.div>

              <div className="space-y-5">
                <motion.h1
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold text-white leading-[1.3] tracking-wide"
                >
                  数智化电磁驱动
                </motion.h1>
                <motion.h1
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-5xl sm:text-6xl lg:text-7xl font-extrabold gradient-text leading-[1.2] tracking-wider"
                >
                  霍普金森杆
                </motion.h1>
                <motion.h1
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold text-white leading-[1.3] tracking-wide"
                >
                  多场耦合动态测试系统
                </motion.h1>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="flex flex-col items-center gap-5 pt-2"
              >
                <div className="flex items-center gap-3 text-white/80 text-lg tracking-[0.2em]">
                  <span>电磁驱动</span>
                  <span className="w-1 h-1 rounded-full bg-[#00F5FF]" />
                  <span>数字孪生</span>
                  <span className="w-1 h-1 rounded-full bg-[#00F5FF]" />
                  <span>人工智能</span>
                  <span className="text-[#00F5FF] font-medium ml-1">深度融合</span>
                </div>
                <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-white/55 text-[0.95rem] tracking-wider">
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
                    立即进入虚拟实验室
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

      {/* 【新增】项目概述 */}
      <section className="py-20 bg-[#051020]/30">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-4">项目概述</h2>
            <p className="text-white/60 max-w-3xl mx-auto">
              本系统通过电磁驱动-数字孪生-人工智能深度融合，实现热-力-电多场耦合动态加载、
              智能波形调控、全链条数据融合三大突破，为极端环境材料性能评估提供全流程数智化测试平台。
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0 }}
              className="tech-card text-center"
            >
              <div className="w-16 h-16 rounded-xl bg-[#00F5FF]/20 flex items-center justify-center mx-auto mb-4">
                <Cpu className="w-8 h-8 text-[#00F5FF]" />
              </div>
              <p className="text-4xl font-bold text-[#00F5FF] mb-2">7</p>
              <p className="text-white/60">大类材料数据库</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="tech-card text-center"
            >
              <div className="w-16 h-16 rounded-xl bg-[#FFD700]/20 flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-8 h-8 text-[#FFD700]" />
              </div>
              <p className="text-4xl font-bold text-[#FFD700] mb-2">10万</p>
              <p className="text-white/60">fps高速采集</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="tech-card text-center"
            >
              <div className="w-16 h-16 rounded-xl bg-[#1DD1A1]/20 flex items-center justify-center mx-auto mb-4">
                <BrainCircuit className="w-8 h-8 text-[#1DD1A1]" />
              </div>
              <p className="text-4xl font-bold text-[#1DD1A1] mb-2">3</p>
              <p className="text-white/60">级AI闭环优化</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="tech-card text-center"
            >
              <div className="w-16 h-16 rounded-xl bg-[#FF9F43]/20 flex items-center justify-center mx-auto mb-4">
                <Box className="w-8 h-8 text-[#FF9F43]" />
              </div>
              <p className="text-4xl font-bold text-[#FF9F43] mb-2">4</p>
              <p className="text-white/60">层技术架构</p>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            <div className="flex items-start gap-4">
              <div className="w-2 h-2 rounded-full bg-[#00F5FF] mt-2 flex-shrink-0" />
              <div>
                <h4 className="text-white font-medium mb-1">电磁驱动技术</h4>
                <p className="text-white/60 text-sm">可调谐RLC链式电路，实现0-50kA精准电流输出</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-2 h-2 rounded-full bg-[#FFD700] mt-2 flex-shrink-0" />
              <div>
                <h4 className="text-white font-medium mb-1">数字孪生仿真</h4>
                <p className="text-white/60 text-sm">Maxwell-Simplorer-Simulink联合仿真，虚实映射</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-2 h-2 rounded-full bg-[#1DD1A1] mt-2 flex-shrink-0" />
              <div>
                <h4 className="text-white font-medium mb-1">AI智能控制</h4>
                <p className="text-white/60 text-sm">LSTM+WGAN-GP+PPO三级闭环，波形自适应调控</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="mt-8 text-center"
          >
            <Link to="/lab">
              <Button
                size="lg"
                className="bg-[#00F5FF] text-[#0A2540] hover:bg-[#00F5FF]/90 btn-glow font-semibold"
              >
                进入虚拟实验室
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* 【移动后】产品介绍视频 */}
      <section className="py-20">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-4">产品介绍</h2>
            <p className="text-white/60 max-w-2xl mx-auto">
              观看系统演示视频，了解电磁驱动霍普金森杆的工作原理和核心功能
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
                src="/assets/videos/xiaotiao.mp4"
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
      <section className="py-20 bg-[#051020]/50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-4">
              四层技术架构
            </h2>
            <p className="text-white/60 max-w-2xl mx-auto">
              从物理层到数据分析层，构建完整的数智化测试平台
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
      <section className="py-20">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-4">
              三大应用场景
            </h2>
            <p className="text-white/60 max-w-2xl mx-auto">
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
      <section className="py-20 bg-[#051020]/50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-4">
              7大类材料动态性能数据库
            </h2>
            <p className="text-white/60 max-w-2xl mx-auto">
              覆盖金属、矿石、混凝土、陶瓷、高分子、吸能材料、生物材料，
              支持AI跨材料映射与动态性能预测
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
