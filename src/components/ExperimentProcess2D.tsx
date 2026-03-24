import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useExperimentAnimation, STAGE_CONFIGS, type ExperimentStage } from '@/hooks/useExperimentAnimation';
import { Play, Pause, RotateCcw, SkipForward } from 'lucide-react';
import StressWaveCanvas from './StressWaveCanvas';

interface ExperimentProcess2DProps {
  voltage: number;
  current: number;
  pulseWidth: number;
  waveform: string;
  materialName: string;
  materialColor: string;
  materialCategory?: string;
  stiffnessK?: number;
  dampingC?: number;
  onStageChange?: (stage: ExperimentStage, index: number) => void;
  onExperimentComplete?: () => void;
}

// 阶段颜色
const STAGE_COLORS: Record<ExperimentStage, string> = {
  idle: '#666',
  charging: '#FFD700',
  coilAccel: '#CD7F32',
  strikerLaunch: '#00F5FF',
  wavePropagate: '#3B82F6',
  deformation: '#EF4444',
  dataCollect: '#10B981',
};

export default function ExperimentProcess2D({
  voltage,
  current,
  materialName,
  materialColor,
  materialCategory = 'metal',
  stiffnessK = 100,
  dampingC: _dampingC = 1,
  onExperimentComplete,
}: ExperimentProcess2DProps) {
  const anim = useExperimentAnimation();
  const { currentStage, stageIndex, stageProgress, globalProgress, isPlaying, isComplete } = anim;

  // 派生参数
  const capacitance = voltage * voltage * 0.0003;
  const bulletVelocity = Math.sqrt(2 * capacitance * 1000 / 0.5);

  // 充能进度值
  const chargeLevel = currentStage === 'charging' ? stageProgress : (stageIndex > 0 ? 1 : 0);

  // 单个电容充电状态(8个电容单元)
  const capacitorCells = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => {
      const cellThreshold = (i + 1) / 8;
      if (chargeLevel >= cellThreshold) return 1;
      if (chargeLevel >= (cellThreshold - 1 / 8)) return (chargeLevel - (cellThreshold - 1 / 8)) * 8;
      return 0;
    });
  }, [chargeLevel]);

  // 子弹位置(非线性加速)
  const strikerX = useMemo(() => {
    if (currentStage === 'strikerLaunch') {
      // 二次曲线加速
      const t = stageProgress;
      return t * t * 100;
    }
    if (stageIndex > 2) return 100;
    return 0;
  }, [currentStage, stageProgress, stageIndex]);

  // 子弹速度(显示用)
  const currentVelocity = useMemo(() => {
    if (currentStage === 'strikerLaunch') return bulletVelocity * stageProgress;
    if (stageIndex > 2) return bulletVelocity;
    return 0;
  }, [currentStage, stageProgress, stageIndex, bulletVelocity]);

  // 应力波传播是否激活
  const isWavePropagating = stageIndex >= 3;

  // 试样变形量（根据材料类别差异化）
  const deformAmount = useMemo(() => {
    const baseDeform = currentStage === 'deformation' ? stageProgress * 10 : (stageIndex > 4 ? 10 : 0);
    // 软材料变形更大
    const stiffnessFactor = Math.max(0.3, Math.min(2, 50 / (stiffnessK + 1)));
    return baseDeform * stiffnessFactor;
  }, [currentStage, stageProgress, stageIndex, stiffnessK]);

  // 数据采集闪烁
  const isCollecting = currentStage === 'dataCollect';

  // 线圈激活状态
  const activeCoils = useMemo(() => {
    if (currentStage === 'coilAccel') {
      if (stageProgress < 0.33) return 1;
      if (stageProgress < 0.66) return 2;
      return 3;
    }
    if (stageIndex > 1) return 3;
    return 0;
  }, [currentStage, stageProgress, stageIndex]);

  // 磁场线强度保留用于未来磁场可视化扩展
  // const fieldIntensity = currentStage === 'coilAccel' ? stageProgress : (stageIndex > 1 ? 1 : 0);

  // 回调实验完成
  useMemo(() => {
    if (isComplete && onExperimentComplete) {
      onExperimentComplete();
    }
  }, [isComplete, onExperimentComplete]);

  // 裂纹路径（岩石/混凝土类材料）
  const crackPaths = useMemo(() => {
    if (deformAmount < 3) return [];
    const isBrittle = ['rock', 'concrete', 'ceramic'].includes(materialCategory);
    if (!isBrittle) return [];
    const progress = Math.min(1, (deformAmount - 3) / 7);
    return [
      { d: `M12,2 L16,10 L13,18 L17,28`, opacity: progress },
      { d: `M28,5 L24,14 L27,22 L23,30`, opacity: progress * 0.7 },
      { d: `M20,0 L18,8 L22,16 L19,24`, opacity: progress * 0.5 },
    ];
  }, [deformAmount, materialCategory]);

  return (
    <div className="w-full h-full flex flex-col">
      {/* SVG实验示意图 */}
      <div className="flex-1 relative flex items-center justify-center p-4">
        <svg viewBox="0 0 1050 340" className="w-full max-w-6xl" style={{ filter: 'drop-shadow(0 0 20px rgba(0,245,255,0.05))' }}>
          <defs>
            {/* 杆件金属渐变 */}
            <linearGradient id="barGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#E0E0E0" />
              <stop offset="20%" stopColor="#B0B0B0" />
              <stop offset="50%" stopColor="#909090" />
              <stop offset="80%" stopColor="#B0B0B0" />
              <stop offset="100%" stopColor="#D0D0D0" />
            </linearGradient>
            {/* 铜线圈渐变 */}
            <linearGradient id="copperGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#B87333" />
              <stop offset="50%" stopColor="#CD7F32" />
              <stop offset="100%" stopColor="#8B4513" />
            </linearGradient>
            {/* 电容渐变 */}
            <linearGradient id="capacitorFill" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#FFD700" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#FFA500" stopOpacity="0.2" />
            </linearGradient>
            {/* 发光滤镜 */}
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="strongGlow">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            {/* 磁场线渐变 */}
            <radialGradient id="fieldGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#00F5FF" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#00F5FF" stopOpacity="0" />
            </radialGradient>
            {/* 箭头标记 */}
            <marker id="arrowYellow" markerWidth="8" markerHeight="5" refX="8" refY="2.5" orient="auto">
              <path d="M0,0 L8,2.5 L0,5 Z" fill="#FFD700" />
            </marker>
            <marker id="arrowCyan" markerWidth="8" markerHeight="5" refX="8" refY="2.5" orient="auto">
              <path d="M0,0 L8,2.5 L0,5 Z" fill="#00F5FF" />
            </marker>
          </defs>

          {/* ====== 1. 电容器组（8单元） ====== */}
          <g transform="translate(15, 55)">
            <text x="52" y="-8" fill="#00F5FF" fontSize="11" textAnchor="middle" fontWeight="bold">
              电容组 ({(capacitance * chargeLevel).toFixed(1)}kJ)
            </text>
            {/* 电容外壳 */}
            <rect x="0" y="0" width="104" height="70" fill="#0D1B2A" stroke={chargeLevel > 0 ? '#FFD70080' : '#00F5FF40'} strokeWidth="2" rx="6" />
            {/* 8个电容单元 */}
            {capacitorCells.map((level, i) => {
              const col = i % 4;
              const row = Math.floor(i / 4);
              const cx = 8 + col * 24;
              const cy = 6 + row * 34;
              return (
                <g key={i} transform={`translate(${cx}, ${cy})`}>
                  {/* 电容圆柱体 */}
                  <rect x="0" y="0" width="20" height="30" rx="3" fill="#1A2A3A"
                    stroke={level > 0 ? '#FFD700' : '#334155'} strokeWidth="1.5" />
                  {/* 充电液位 */}
                  <rect x="2" y={2 + 26 * (1 - level)} width="16" height={26 * level} rx="2"
                    fill="url(#capacitorFill)" opacity={0.6 + level * 0.4} />
                  {/* 顶部指示灯 */}
                  <circle cx="10" cy="-3" r="2.5"
                    fill={level >= 1 ? '#10B981' : level > 0 ? '#FFD700' : '#334155'}
                    filter={level > 0 ? 'url(#glow)' : undefined} />
                </g>
              );
            })}
            {/* 充电火花 */}
            {currentStage === 'charging' && stageProgress > 0.5 && (
              <>
                <motion.line x1="52" y1="35" x2={52 + Math.random() * 20 - 10} y2={35 + Math.random() * 10 - 5}
                  stroke="#FFD700" strokeWidth="1.5" filter="url(#glow)"
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 0.15, repeat: Infinity, repeatDelay: 0.3 }} />
                <motion.circle cx="52" cy="35" r="4" fill="#FFD700" filter="url(#strongGlow)"
                  animate={{ opacity: [0, 0.8, 0], r: [2, 6, 2] }}
                  transition={{ duration: 0.3, repeat: Infinity, repeatDelay: 0.5 }} />
              </>
            )}
            {/* 电压/能量读数 */}
            <text x="52" y="82" textAnchor="middle" fill="#FFD700" fontSize="10" fontFamily="monospace" fontWeight="bold">
              {(voltage * chargeLevel).toFixed(0)}V / {(capacitance * chargeLevel).toFixed(1)}kJ
            </text>
          </g>

          {/* 连接导线：电容→线圈 */}
          <g>
            <path d="M119,90 C140,90 140,88 155,88" stroke={chargeLevel > 0 ? '#FFD700' : '#334155'} strokeWidth="2" fill="none" />
            {chargeLevel > 0 && (
              <motion.circle r="3" fill="#FFD700" filter="url(#glow)"
                animate={{ offsetDistance: ['0%', '100%'] }}
                transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
                style={{ offsetPath: "path('M119,90 C140,90 140,88 155,88')" } as React.CSSProperties}
              />
            )}
          </g>

          {/* ====== 2. 三级电磁线圈 ====== */}
          <g transform="translate(155, 48)">
            <text x="80" y="-5" fill="#CD7F32" fontSize="11" textAnchor="middle" fontWeight="bold">三级电磁驱动线圈</text>
            {[0, 1, 2].map(level => {
              const isActive = activeCoils > level;
              const coilX = level * 58;
              return (
                <g key={level} transform={`translate(${coilX}, 0)`}>
                  {/* 级别标签 */}
                  <text x="24" y="12" textAnchor="middle" fill={isActive ? '#FFD700' : '#666'} fontSize="8" fontWeight="bold">
                    {['Ⅰ级', 'Ⅱ级', 'Ⅲ级'][level]}
                  </text>
                  {/* 线圈绕组截面 - 更写实的螺线管 */}
                  <rect x="4" y="18" width="40" height="52" rx="4" fill="#1A1A2A"
                    stroke={isActive ? '#CD7F32' : '#334155'} strokeWidth="1.5" />
                  {/* 上下铜线绕组 */}
                  {[0, 1, 2, 3, 4, 5].map(w => (
                    <g key={w}>
                      <rect x="6" y={20 + w * 8} width="36" height="6" rx="1"
                        fill={isActive ? '#CD7F32' : '#5A4A3A'} opacity={isActive ? 0.9 : 0.4}
                        stroke={isActive ? '#FFD70050' : 'none'} strokeWidth="0.5" />
                    </g>
                  ))}
                  {/* 磁场线（虚线同心椭圆） */}
                  {isActive && (
                    <g opacity={0.6}>
                      {[1, 2, 3].map(r => (
                        <motion.ellipse key={r} cx="24" cy="44" rx={12 + r * 10} ry={18 + r * 8}
                          fill="none" stroke="#00F5FF" strokeWidth="0.8"
                          strokeDasharray="4 3" opacity={0.4 / r}
                          animate={{ strokeDashoffset: [0, -14] }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                      ))}
                    </g>
                  )}
                  {/* 电流流向箭头 */}
                  {isActive && (
                    <motion.path
                      d={`M10,16 L38,16`}
                      stroke="#FFD700" strokeWidth="1.5" fill="none"
                      markerEnd="url(#arrowYellow)"
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 0.3, repeat: Infinity, delay: level * 0.1 }}
                    />
                  )}
                  {/* 激活时的光晕 */}
                  {isActive && (
                    <motion.rect x="2" y="16" width="44" height="56" rx="5"
                      fill="none" stroke="#00F5FF" strokeWidth="1"
                      animate={{ opacity: [0.2, 0.6, 0.2] }}
                      transition={{ duration: 0.4, repeat: Infinity, delay: level * 0.08 }} />
                  )}
                </g>
              );
            })}
            {/* 电流读数 */}
            <text x="80" y="82" textAnchor="middle" fill="#F59E0B" fontSize="10" fontFamily="monospace">
              {activeCoils > 0 ? `I = ${(current / 1000).toFixed(1)} kA` : 'I = 0 kA'}
            </text>
            {/* 中心通道（子弹通过） */}
            <rect x="18" y="42" width={3 * 58 - 12} height="8" fill="#0A2540" opacity="0.5" rx="1" />
          </g>

          {/* ====== 3. 子弹(撞击杆) ====== */}
          <g transform={`translate(${310 + strikerX}, 0)`}>
            {/* 子弹本体 - 圆柱形 */}
            <rect x="0" y="73" width="55" height="38" fill="url(#barGrad)" rx="4"
              stroke={stageIndex >= 2 ? '#00F5FF' : '#555'} strokeWidth="2" />
            {/* 子弹头部（尖头） */}
            <polygon points="55,73 68,82 68,100 55,111" fill="url(#barGrad)"
              stroke={stageIndex >= 2 ? '#00F5FF' : '#555'} strokeWidth="1.5" />
            {/* 标签 */}
            <text x="27" y="90" textAnchor="middle" fill="#0A2540" fontSize="9" fontWeight="bold">子弹</text>
            <text x="27" y="103" textAnchor="middle" fill="#0A2540" fontSize="7">Striker</text>
            {/* 速度标签 */}
            {currentStage === 'strikerLaunch' && (
              <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <text x="27" y="125" textAnchor="middle" fill="#FFD700" fontSize="10" fontFamily="monospace" fontWeight="bold">
                  v = {currentVelocity.toFixed(0)} m/s
                </text>
              </motion.g>
            )}
            {/* 运动模糊拖尾 */}
            {currentStage === 'strikerLaunch' && stageProgress > 0.15 && (
              <>
                <motion.rect x={-20} y="78" width="18" height="28" rx="3"
                  fill="#00F5FF" opacity={0.12}
                  animate={{ opacity: [0.12, 0.04], x: [-20, -40] }}
                  transition={{ duration: 0.25, repeat: Infinity }} />
                <motion.rect x={-42} y="82" width="12" height="20" rx="3"
                  fill="#00F5FF" opacity={0.06}
                  animate={{ opacity: [0.06, 0.01], x: [-42, -65] }}
                  transition={{ duration: 0.35, repeat: Infinity }} />
                {/* 空气压缩波（子弹前方） */}
                {stageProgress > 0.5 && (
                  <motion.path
                    d={`M70,${75} Q80,${92} 70,${109}`}
                    stroke="#00F5FF" strokeWidth="1" fill="none" opacity={0.3}
                    animate={{ opacity: [0.3, 0.1, 0.3] }}
                    transition={{ duration: 0.2, repeat: Infinity }} />
                )}
              </>
            )}
          </g>

          {/* 撞击闪光 */}
          {currentStage === 'strikerLaunch' && stageProgress > 0.93 && (
            <motion.g>
              <motion.circle cx="418" cy="92" r="8" fill="#FFD700" filter="url(#strongGlow)"
                initial={{ opacity: 0, r: 3 }}
                animate={{ opacity: [0, 1, 0], r: [3, 22, 28] }}
                transition={{ duration: 0.5 }} />
              {/* 撞击火花粒子 */}
              {[0, 1, 2, 3, 4, 5].map(i => (
                <motion.circle key={i} cx="418" cy="92" r="1.5" fill="#FFD700"
                  initial={{ x: 0, y: 0, opacity: 1 }}
                  animate={{
                    x: Math.cos(i * Math.PI / 3) * 25,
                    y: Math.sin(i * Math.PI / 3) * 20,
                    opacity: 0
                  }}
                  transition={{ duration: 0.4, delay: 0.05 }} />
              ))}
            </motion.g>
          )}

          {/* ====== 4. 入射杆 ====== */}
          <g transform="translate(415, 65)">
            <text x="95" y="-5" fill="#3B82F6" fontSize="11" textAnchor="middle" fontWeight="bold">入射杆 (Incident Bar)</text>
            {/* 杆件本体 - 带金属质感 */}
            <rect x="0" y="0" width="190" height="50" fill="url(#barGrad)" rx="2"
              stroke="#3B82F6" strokeWidth="2" />
            {/* 杆件表面纹理线 */}
            {[0, 1, 2, 3].map(i => (
              <line key={i} x1={45 * i + 20} y1="3" x2={45 * i + 20} y2="47"
                stroke="#00000015" strokeWidth="0.5" />
            ))}
            {/* 应变片SG1 */}
            <g transform="translate(25, -16)">
              <rect x="0" y="0" width="32" height="10" rx="2"
                fill={isCollecting ? '#FFD700' : '#8B6914'} opacity={isCollecting ? 1 : 0.6}
                stroke={isCollecting ? '#FFD700' : '#666'} strokeWidth="1" />
              {isCollecting && (
                <motion.rect x="0" y="0" width="32" height="10" rx="2"
                  fill="none" stroke="#FFD700" strokeWidth="1.5"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }} />
              )}
              <text x="16" y="-3" textAnchor="middle" fill="#FFD700" fontSize="8" fontWeight="bold">SG1</text>
              {/* 引线 */}
              <line x1="16" y1="10" x2="16" y2="16" stroke={isCollecting ? '#FFD700' : '#666'} strokeWidth="1" />
            </g>
            {/* 应变片SG2 */}
            <g transform="translate(130, -16)">
              <rect x="0" y="0" width="32" height="10" rx="2"
                fill={isCollecting ? '#FFD700' : '#8B6914'} opacity={isCollecting ? 1 : 0.6}
                stroke={isCollecting ? '#FFD700' : '#666'} strokeWidth="1" />
              {isCollecting && (
                <motion.rect x="0" y="0" width="32" height="10" rx="2"
                  fill="none" stroke="#FFD700" strokeWidth="1.5"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity, delay: 0.15 }} />
              )}
              <text x="16" y="-3" textAnchor="middle" fill="#FFD700" fontSize="8" fontWeight="bold">SG2</text>
              <line x1="16" y1="10" x2="16" y2="16" stroke={isCollecting ? '#FFD700' : '#666'} strokeWidth="1" />
            </g>
          </g>

          {/* ====== 5. 试样 ====== */}
          <g transform="translate(615, 75)">
            <text x="22" y="-18" fill="#F59E0B" fontSize="10" textAnchor="middle" fontWeight="bold">试样</text>
            {/* 试样本体 - 根据材料类别差异化变形 */}
            {materialCategory === 'metal' || materialCategory === 'polymer' ? (
              // 金属/聚合物: 鼓形膨胀
              <g>
                <rect
                  x={0 - deformAmount * 0.4}
                  y={0 - deformAmount * 0.2}
                  width={44 + deformAmount * 0.8}
                  height={35 + deformAmount * 0.4}
                  fill={materialColor}
                  rx="2"
                  stroke="#F59E0B"
                  strokeWidth="2"
                />
                {/* 鼓形凸起(大变形) */}
                {deformAmount > 4 && (
                  <ellipse
                    cx={22}
                    cy={17}
                    rx={22 + deformAmount * 0.5}
                    ry={17 + deformAmount * 0.15}
                    fill="none"
                    stroke={materialColor}
                    strokeWidth="1.5"
                    opacity={0.5}
                  />
                )}
              </g>
            ) : materialCategory === 'foam' ? (
              // 泡沫: 压缩塌陷
              <rect
                x={0}
                y={deformAmount * 0.5}
                width={44}
                height={Math.max(8, 35 - deformAmount * 2)}
                fill={materialColor}
                rx="2"
                stroke="#F59E0B"
                strokeWidth="2"
              />
            ) : (
              // 岩石/混凝土/陶瓷: 裂纹扩展
              <g>
                <rect
                  x={0 - deformAmount * 0.15}
                  y={0 - deformAmount * 0.1}
                  width={44 + deformAmount * 0.3}
                  height={35 + deformAmount * 0.2}
                  fill={materialColor}
                  rx="2"
                  stroke="#F59E0B"
                  strokeWidth="2"
                />
                {/* 裂纹 */}
                {crackPaths.map((crack, i) => (
                  <motion.path
                    key={i}
                    d={crack.d}
                    stroke="rgba(30,30,30,0.8)"
                    strokeWidth="1.5"
                    fill="none"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: crack.opacity }}
                    transition={{ duration: 0.6 }}
                  />
                ))}
              </g>
            )}
            <text x="22" y={52 + deformAmount * 0.4} textAnchor="middle" fill="#F59E0B" fontSize="8" fontWeight="bold">
              {materialName}
            </text>
          </g>

          {/* ====== 6. 透射杆 ====== */}
          <g transform="translate(670, 65)">
            <text x="80" y="-5" fill="#10B981" fontSize="11" textAnchor="middle" fontWeight="bold">透射杆 (Trans. Bar)</text>
            <rect x="0" y="0" width="160" height="50" fill="url(#barGrad)" rx="2"
              stroke="#10B981" strokeWidth="2" />
            {[0, 1, 2].map(i => (
              <line key={i} x1={40 * i + 30} y1="3" x2={40 * i + 30} y2="47"
                stroke="#00000015" strokeWidth="0.5" />
            ))}
            {/* 应变片SG3 */}
            <g transform="translate(60, -16)">
              <rect x="0" y="0" width="32" height="10" rx="2"
                fill={isCollecting ? '#FFD700' : '#8B6914'} opacity={isCollecting ? 1 : 0.6}
                stroke={isCollecting ? '#FFD700' : '#666'} strokeWidth="1" />
              {isCollecting && (
                <motion.rect x="0" y="0" width="32" height="10" rx="2"
                  fill="none" stroke="#FFD700" strokeWidth="1.5"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity, delay: 0.3 }} />
              )}
              <text x="16" y="-3" textAnchor="middle" fill="#FFD700" fontSize="8" fontWeight="bold">SG3</text>
              <line x1="16" y1="10" x2="16" y2="16" stroke={isCollecting ? '#FFD700' : '#666'} strokeWidth="1" />
            </g>
          </g>

          {/* ====== 7. 阻尼器（动量阱） ====== */}
          <g transform="translate(840, 55)">
            <text x="35" y="-3" fill="#8B5CF6" fontSize="10" textAnchor="middle" fontWeight="bold">动量阱</text>
            <rect x="0" y="0" width="70" height="65" fill="#1A1A2A" rx="5"
              stroke="#8B5CF6" strokeWidth="2" />
            {/* 内部阻尼弹簧 */}
            <path d="M15,10 L15,18 L55,22 L15,26 L55,30 L15,34 L55,38 L15,42 L55,46 L15,50 L15,55"
              stroke="#8B5CF6" strokeWidth="2" fill="none" opacity="0.8" />
            {/* 吸能指示 */}
            {stageIndex >= 4 && (
              <motion.rect x="3" y="3" width="64" height="59" rx="3"
                fill="#8B5CF6" opacity={0}
                animate={{ opacity: [0, 0.15, 0] }}
                transition={{ duration: 1, repeat: Infinity }} />
            )}
          </g>

          {/* ====== 8. 数据采集系统 ====== */}
          <g transform="translate(230, 210)">
            <rect x="0" y="0" width="480" height="78" fill="#0A1628"
              stroke={isCollecting ? '#00F5FF' : '#00F5FF40'} strokeWidth="2" rx="8" />
            {isCollecting && (
              <motion.rect x="0" y="0" width="480" height="78" fill="none"
                stroke="#00F5FF" strokeWidth="2" rx="8"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity }} />
            )}
            {/* 标题栏 */}
            <rect x="0" y="0" width="480" height="22" rx="8" fill="#0D2238" />
            <text x="240" y="15" textAnchor="middle" fill="#00F5FF" fontSize="11" fontWeight="bold">
              高速数据采集系统 DAQ (100,000 fps)
            </text>
            {/* 三波数据显示 */}
            <g transform="translate(20, 30)">
              <circle cx="8" cy="10" r="5" fill="#3B82F6" />
              <text x="20" y="8" fill="#3B82F680" fontSize="8">入射波 σᵢ</text>
              <text x="20" y="22" fill="#3B82F6" fontSize="13" fontFamily="monospace" fontWeight="bold">
                {stageIndex >= 3 ? `${(voltage * 0.8 * Math.min(1, stageIndex >= 4 ? 1 : stageProgress)).toFixed(0)}` : '---'} MPa
              </text>
            </g>
            <g transform="translate(180, 30)">
              <circle cx="8" cy="10" r="5" fill="#EF4444" />
              <text x="20" y="8" fill="#EF444480" fontSize="8">反射波 σᵣ</text>
              <text x="20" y="22" fill="#EF4444" fontSize="13" fontFamily="monospace" fontWeight="bold">
                {stageIndex >= 4 ? `${(voltage * 0.24 * Math.min(1, stageProgress)).toFixed(0)}` : '---'} MPa
              </text>
            </g>
            <g transform="translate(340, 30)">
              <circle cx="8" cy="10" r="5" fill="#10B981" />
              <text x="20" y="8" fill="#10B98180" fontSize="8">透射波 σₜ</text>
              <text x="20" y="22" fill="#10B981" fontSize="13" fontFamily="monospace" fontWeight="bold">
                {stageIndex >= 4 ? `${(voltage * 0.56 * Math.min(1, stageProgress)).toFixed(0)}` : '---'} MPa
              </text>
            </g>

            {/* 数据流动线(应变片到采集系统) */}
            {isCollecting && (
              <>
                <motion.line x1="50" y1="-20" x2="50" y2="0" stroke="#3B82F6" strokeWidth="1.5" strokeDasharray="4 3"
                  animate={{ strokeDashoffset: [0, -14] }} transition={{ duration: 0.4, repeat: Infinity, ease: 'linear' }} />
                <motion.line x1="210" y1="-20" x2="210" y2="0" stroke="#EF4444" strokeWidth="1.5" strokeDasharray="4 3"
                  animate={{ strokeDashoffset: [0, -14] }} transition={{ duration: 0.4, repeat: Infinity, ease: 'linear' }} />
                <motion.line x1="370" y1="-20" x2="370" y2="0" stroke="#10B981" strokeWidth="1.5" strokeDasharray="4 3"
                  animate={{ strokeDashoffset: [0, -14] }} transition={{ duration: 0.4, repeat: Infinity, ease: 'linear' }} />
              </>
            )}
          </g>

          {/* ====== 状态面板 ====== */}
          <g transform="translate(760, 220)">
            <rect x="0" y="0" width="160" height="65" fill="#0A1628"
              stroke={isPlaying ? '#10B981' : isComplete ? '#00F5FF' : '#F59E0B'} strokeWidth="2" rx="8" />
            <circle cx="18" cy="22" r="5"
              fill={isPlaying ? '#10B981' : isComplete ? '#00F5FF' : '#F59E0B'} />
            {isPlaying && (
              <motion.circle cx="18" cy="22" r="5" fill="#10B981"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }} />
            )}
            <text x="30" y="26"
              fill={isPlaying ? '#10B981' : isComplete ? '#00F5FF' : '#F59E0B'}
              fontSize="11" fontWeight="bold">
              {isPlaying ? '实验进行中' : isComplete ? '实验完成' : '待机就绪'}
            </text>
            <text x="80" y="46" textAnchor="middle" fill="#fff" fontSize="10">
              {stageIndex >= 0 ? `阶段 ${stageIndex + 1}/6 · ${STAGE_CONFIGS[stageIndex]?.label}` : '等待开始'}
            </text>
            {/* 进度条 */}
            <rect x="10" y="54" width="140" height="4" rx="2" fill="#ffffff10" />
            <rect x="10" y="54" width={140 * globalProgress} height="4" rx="2"
              fill={isPlaying ? '#10B981' : isComplete ? '#00F5FF' : '#F59E0B'} />
          </g>
        </svg>

        {/* 应力波Canvas叠加层 */}
        {isWavePropagating && (
          <div className="absolute inset-0 pointer-events-none">
            <StressWaveCanvas
              isActive={isWavePropagating}
              progress={currentStage === 'wavePropagate' ? stageProgress : 1}
              voltage={voltage}
            />
          </div>
        )}
      </div>

      {/* 底部控制栏 + 时间轴 */}
      <div className="h-[100px] bg-[#051020]/90 border-t border-[#00F5FF]/10 px-6 py-3 flex flex-col gap-2">
        {/* 阶段时间轴 */}
        <div className="flex items-center gap-1">
          {STAGE_CONFIGS.map((config, i) => {
            const isActive = i === stageIndex;
            const isPast = i < stageIndex;
            const width = (config.duration / anim.totalDuration) * 100;
            return (
              <button
                key={config.stage}
                onClick={() => anim.jumpToStage(i)}
                className="relative h-8 rounded transition-all hover:brightness-125"
                style={{ width: `${width}%` }}
                title={`${config.label}: ${config.description}`}
              >
                <div className={`absolute inset-0 rounded ${isPast ? 'opacity-60' : 'opacity-20'}`}
                  style={{ backgroundColor: STAGE_COLORS[config.stage] }} />
                {isActive && (
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded"
                    style={{
                      backgroundColor: STAGE_COLORS[config.stage],
                      width: `${stageProgress * 100}%`,
                      opacity: 0.8,
                    }}
                  />
                )}
                {isPast && (
                  <div className="absolute inset-0 rounded"
                    style={{ backgroundColor: STAGE_COLORS[config.stage], opacity: 0.8 }} />
                )}
                <span className={`relative z-10 text-[10px] leading-8 font-medium ${
                  isActive || isPast ? 'text-white' : 'text-white/50'
                }`}>
                  {config.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* 控制按钮 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!isPlaying ? (
              <button onClick={anim.play}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[#00F5FF] text-[#0A2540] rounded-lg text-sm font-medium hover:bg-[#00F5FF]/90 transition-colors">
                <Play className="w-4 h-4" />
                {isComplete ? '重新播放' : globalProgress > 0 ? '继续' : '开始仿真'}
              </button>
            ) : (
              <button onClick={anim.pause}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/20 transition-colors border border-white/20">
                <Pause className="w-4 h-4" />
                暂停
              </button>
            )}
            <button onClick={anim.reset}
              className="p-1.5 bg-white/5 text-white/60 rounded-lg hover:bg-white/10 hover:text-white transition-colors">
              <RotateCcw className="w-4 h-4" />
            </button>
            {!isPlaying && stageIndex >= 0 && stageIndex < 5 && (
              <button onClick={() => anim.jumpToStage(stageIndex + 1)}
                className="p-1.5 bg-white/5 text-white/60 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
                title="跳到下一阶段">
                <SkipForward className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* 进度信息 */}
          <div className="text-xs text-white/50 font-mono">
            {(anim.elapsedTime / 1000).toFixed(1)}s / {(anim.totalDuration / 1000).toFixed(1)}s
            {currentVelocity > 0 && ` · v=${currentVelocity.toFixed(0)}m/s`}
          </div>
        </div>
      </div>
    </div>
  );
}
