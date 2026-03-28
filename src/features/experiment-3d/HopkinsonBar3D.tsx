// src/features/experiment-3d/HopkinsonBar3D.tsx
// 霍普金森杆3D数字孪生 - 实时物理驱动的Three.js场景
// 替换原有视频播放，由实验动画状态驱动

import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Text, Float } from '@react-three/drei';
import * as THREE from 'three';
import type { AnimationState } from '@/hooks/useExperimentAnimation';

// ═══ 颜色配置 ═══
const COLORS = {
  steel: '#8B9DAF',
  steelLight: '#B8C8D8',
  copper: '#B87333',
  specimen: '#E8B888',
  cyan: '#00F5FF',
  capacitorYellow: '#F59E0B',
  incidentWave: '#3B82F6',
  reflectedWave: '#EF4444',
  transmittedWave: '#10B981',
  coilActive: '#8B5CF6',
  daqGreen: '#10B981',
};

// ═══ 物理尺寸常数 ═══
const BAR_RADIUS = 0.15;
const INCIDENT_BAR_LENGTH = 3.0;
const TRANSMITTED_BAR_LENGTH = 2.5;
const STRIKER_LENGTH = 0.6;
const SPECIMEN_SIZE = 0.2;
const COIL_RADIUS = 0.35;

// ═══ 电容器组 ═══
function CapacitorBank({ animState }: { animState: AnimationState }) {
  const groupRef = useRef<THREE.Group>(null);
  const chargeLevel = animState.currentStage === 'charging' ? animState.stageProgress :
                      animState.stageIndex > 0 ? 1 : 0;

  return (
    <group ref={groupRef} position={[-5.5, 0, 0]}>
      {/* 外壳 */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1.2, 1.4, 0.8]} />
        <meshStandardMaterial color="#1a2a3a" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* 8个电容单元 (2x4) */}
      {Array.from({ length: 8 }).map((_, i) => {
        const row = Math.floor(i / 4);
        const col = i % 4;
        const isCharged = chargeLevel > (i / 8);
        return (
          <mesh key={i} position={[-0.3 + col * 0.2, -0.4 + row * 0.8, 0.45]}>
            <cylinderGeometry args={[0.06, 0.06, 0.7, 16]} />
            <meshStandardMaterial
              color={isCharged ? COLORS.capacitorYellow : '#334155'}
              emissive={isCharged ? COLORS.capacitorYellow : '#000000'}
              emissiveIntensity={isCharged ? 0.5 * chargeLevel : 0}
              metalness={0.7}
              roughness={0.3}
            />
          </mesh>
        );
      })}
      {/* 充能指示灯 */}
      <mesh position={[0, 0.85, 0.42]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial
          color={chargeLevel > 0.9 ? '#10B981' : chargeLevel > 0 ? COLORS.capacitorYellow : '#334155'}
          emissive={chargeLevel > 0 ? (chargeLevel > 0.9 ? '#10B981' : COLORS.capacitorYellow) : '#000000'}
          emissiveIntensity={chargeLevel * 2}
        />
      </mesh>
      {/* 标签 */}
      <Text position={[0, -0.9, 0.42]} fontSize={0.1} color="#ffffff80" anchorY="top">
        CAPACITOR BANK
      </Text>
    </group>
  );
}

// ═══ 电磁线圈（三级） ═══
function ElectromagneticCoils({ animState }: { animState: AnimationState }) {
  const coilProgress = animState.currentStage === 'coilAccel' ? animState.stageProgress :
                       animState.stageIndex > 1 ? 1 : 0;

  return (
    <group position={[-3.5, 0, 0]}>
      {[0, 1, 2].map(i => {
        const xOffset = i * 0.55;
        const activation = coilProgress > (i / 3) ? Math.min(1, (coilProgress - i / 3) * 3) : 0;
        const color = activation > 0 ? COLORS.coilActive : COLORS.copper;

        return (
          <group key={i} position={[xOffset, 0, 0]}>
            {/* 线圈环 */}
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[COIL_RADIUS, 0.04, 16, 32]} />
              <meshStandardMaterial
                color={color}
                emissive={activation > 0 ? COLORS.coilActive : '#000000'}
                emissiveIntensity={activation * 1.5}
                metalness={0.8}
                roughness={0.2}
              />
            </mesh>
            {/* 磁场可视化环 */}
            {activation > 0 && (
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <torusGeometry args={[COIL_RADIUS + 0.1 + activation * 0.15, 0.01, 8, 32]} />
                <meshBasicMaterial
                  color={COLORS.coilActive}
                  transparent
                  opacity={0.3 * activation}
                  side={THREE.DoubleSide}
                />
              </mesh>
            )}
          </group>
        );
      })}
      <Text position={[0.55, -0.6, 0]} fontSize={0.08} color="#ffffff60" anchorY="top">
        EM COIL × 3
      </Text>
    </group>
  );
}

// ═══ 撞击杆（Striker Bar） ═══
function StrikerBar({ animState }: { animState: AnimationState }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const startX = -2.2;
  const endX = -0.85;

  useFrame(() => {
    if (!meshRef.current) return;
    let x = startX;

    if (animState.currentStage === 'strikerLaunch') {
      const t = animState.stageProgress;
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      x = startX + (endX - startX) * eased;
    } else if (animState.stageIndex > 2) {
      x = endX;
    }

    meshRef.current.position.x = x;
  });

  const isMoving = animState.currentStage === 'strikerLaunch';

  return (
    <mesh ref={meshRef} position={[startX, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[BAR_RADIUS, BAR_RADIUS, STRIKER_LENGTH, 32]} />
      <meshStandardMaterial
        color={COLORS.steel}
        metalness={0.85}
        roughness={0.15}
        emissive={isMoving ? COLORS.cyan : '#000000'}
        emissiveIntensity={isMoving ? 0.3 : 0}
      />
    </mesh>
  );
}

// ═══ 入射杆（Incident Bar） ═══
function IncidentBar({ animState }: { animState: AnimationState }) {
  const barCenter = -0.5 + INCIDENT_BAR_LENGTH / 2;

  return (
    <group>
      {/* 主杆体 */}
      <mesh position={[barCenter * -1 + 0.5, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[BAR_RADIUS, BAR_RADIUS, INCIDENT_BAR_LENGTH, 32]} />
        <meshStandardMaterial color={COLORS.steelLight} metalness={0.8} roughness={0.2} />
      </mesh>
      {/* 应变片 1 */}
      <mesh position={[-0.5 + INCIDENT_BAR_LENGTH * 0.3, BAR_RADIUS + 0.02, 0]}>
        <boxGeometry args={[0.08, 0.02, 0.06]} />
        <meshStandardMaterial color="#F59E0B" emissive="#F59E0B" emissiveIntensity={0.5} />
      </mesh>
      {/* 应变片 2 */}
      <mesh position={[-0.5 + INCIDENT_BAR_LENGTH * 0.6, BAR_RADIUS + 0.02, 0]}>
        <boxGeometry args={[0.08, 0.02, 0.06]} />
        <meshStandardMaterial color="#F59E0B" emissive="#F59E0B" emissiveIntensity={0.5} />
      </mesh>
      <Text position={[-0.5 + INCIDENT_BAR_LENGTH * 0.5, -0.3, 0]} fontSize={0.08} color="#ffffff60">
        INCIDENT BAR
      </Text>
    </group>
  );
}

// ═══ 试样（Specimen） ═══
function Specimen({ animState, materialColor }: { animState: AnimationState; materialColor: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    if (!meshRef.current || !matRef.current) return;

    let scaleX = 1;
    let scaleY = 1;
    let scaleZ = 1;
    let emissiveIntensity = 0;

    if (animState.currentStage === 'deformation') {
      const t = animState.stageProgress;
      const smoothT = t * t * (3 - 2 * t); // smoothstep
      scaleX = 1 - smoothT * 0.3;   // 轴向压缩
      scaleY = 1 + smoothT * 0.15;  // 泊松膨胀
      scaleZ = 1 + smoothT * 0.15;
      emissiveIntensity = smoothT * 0.8; // 温度升高发热
    } else if (animState.isComplete) {
      scaleX = 0.7;
      scaleY = 1.15;
      scaleZ = 1.15;
      emissiveIntensity = 0.3;
    }

    meshRef.current.scale.set(scaleX, scaleY, scaleZ);
    matRef.current.emissiveIntensity = emissiveIntensity;
  });

  const isDeforming = animState.currentStage === 'deformation' || animState.isComplete;

  return (
    <group position={[INCIDENT_BAR_LENGTH - 0.5, 0, 0]}>
      <mesh ref={meshRef}>
        <boxGeometry args={[SPECIMEN_SIZE, SPECIMEN_SIZE * 1.2, SPECIMEN_SIZE * 1.2]} />
        <meshStandardMaterial
          ref={matRef}
          color={materialColor}
          emissive={isDeforming ? '#FF4500' : '#000000'}
          emissiveIntensity={0}
          metalness={0.3}
          roughness={0.6}
        />
      </mesh>
      <Text position={[0, -0.3, 0]} fontSize={0.06} color="#ffffff50">
        SPECIMEN
      </Text>
    </group>
  );
}

// ═══ 透射杆（Transmitted Bar） ═══
function TransmittedBar({ animState }: { animState: AnimationState }) {
  const startX = INCIDENT_BAR_LENGTH - 0.5 + SPECIMEN_SIZE / 2;

  return (
    <group>
      <mesh position={[startX + TRANSMITTED_BAR_LENGTH / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[BAR_RADIUS, BAR_RADIUS, TRANSMITTED_BAR_LENGTH, 32]} />
        <meshStandardMaterial color={COLORS.steelLight} metalness={0.8} roughness={0.2} />
      </mesh>
      {/* 应变片 */}
      <mesh position={[startX + TRANSMITTED_BAR_LENGTH * 0.4, BAR_RADIUS + 0.02, 0]}>
        <boxGeometry args={[0.08, 0.02, 0.06]} />
        <meshStandardMaterial color="#F59E0B" emissive="#F59E0B" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[startX + TRANSMITTED_BAR_LENGTH * 0.7, BAR_RADIUS + 0.02, 0]}>
        <boxGeometry args={[0.08, 0.02, 0.06]} />
        <meshStandardMaterial color="#F59E0B" emissive="#F59E0B" emissiveIntensity={0.5} />
      </mesh>
      <Text position={[startX + TRANSMITTED_BAR_LENGTH * 0.5, -0.3, 0]} fontSize={0.08} color="#ffffff60">
        TRANSMITTED BAR
      </Text>
    </group>
  );
}

// ═══ 应力波可视化（粒子系统） ═══
function StressWaveParticles({ animState }: { animState: AnimationState }) {
  const incidentRef = useRef<THREE.Points>(null);
  const reflectedRef = useRef<THREE.Points>(null);
  const transmittedRef = useRef<THREE.Points>(null);

  const PARTICLE_COUNT = 80;
  const barStartX = -0.5;
  const specimenX = INCIDENT_BAR_LENGTH - 0.5;
  const transStartX = specimenX + SPECIMEN_SIZE / 2;

  // 生成粒子初始位置（环形分布在杆截面内）
  const createRingPositions = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
      const r = BAR_RADIUS * 0.8 * Math.sqrt(Math.random());
      positions[i * 3] = 0; // X will be set in useFrame
      positions[i * 3 + 1] = Math.cos(angle) * r;
      positions[i * 3 + 2] = Math.sin(angle) * r;
    }
    return positions;
  }, []);

  useFrame(({ clock }) => {
    if (animState.currentStage !== 'wavePropagate' && animState.currentStage !== 'deformation' && animState.currentStage !== 'dataCollect') {
      // 隐藏粒子
      if (incidentRef.current) incidentRef.current.visible = false;
      if (reflectedRef.current) reflectedRef.current.visible = false;
      if (transmittedRef.current) transmittedRef.current.visible = false;
      return;
    }

    const progress = animState.currentStage === 'wavePropagate' ? animState.stageProgress :
                     animState.currentStage === 'deformation' ? 1 : 1;
    const time = clock.getElapsedTime();

    // 入射波
    if (incidentRef.current) {
      incidentRef.current.visible = true;
      const geo = incidentRef.current.geometry;
      const pos = geo.attributes.position.array as Float32Array;
      const waveHead = barStartX + INCIDENT_BAR_LENGTH * Math.min(1, progress * 1.6);

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const baseX = waveHead - (i / PARTICLE_COUNT) * 0.8;
        pos[i * 3] = baseX + Math.sin(time * 10 + i * 0.5) * 0.02;
      }
      geo.attributes.position.needsUpdate = true;
    }

    // 反射波（progress > 0.5）
    if (reflectedRef.current) {
      if (progress > 0.5) {
        reflectedRef.current.visible = true;
        const geo = reflectedRef.current.geometry;
        const pos = geo.attributes.position.array as Float32Array;
        const refProgress = (progress - 0.5) / 0.5;
        const waveHead = specimenX - INCIDENT_BAR_LENGTH * refProgress;

        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const baseX = waveHead + (i / PARTICLE_COUNT) * 0.5;
          pos[i * 3] = baseX + Math.sin(time * 12 + i * 0.3) * 0.015;
        }
        geo.attributes.position.needsUpdate = true;
      } else {
        reflectedRef.current.visible = false;
      }
    }

    // 透射波（progress > 0.5）
    if (transmittedRef.current) {
      if (progress > 0.5) {
        transmittedRef.current.visible = true;
        const geo = transmittedRef.current.geometry;
        const pos = geo.attributes.position.array as Float32Array;
        const transProgress = (progress - 0.5) / 0.5;
        const waveHead = transStartX + TRANSMITTED_BAR_LENGTH * Math.min(1, transProgress * 1.3);

        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const baseX = waveHead - (i / PARTICLE_COUNT) * 0.6;
          pos[i * 3] = baseX + Math.sin(time * 8 + i * 0.4) * 0.02;
        }
        geo.attributes.position.needsUpdate = true;
      } else {
        transmittedRef.current.visible = false;
      }
    }
  });

  return (
    <>
      {/* 入射波 - 蓝色 */}
      <points ref={incidentRef} visible={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={PARTICLE_COUNT} array={createRingPositions.slice()} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial size={0.04} color={COLORS.incidentWave} transparent opacity={0.8} sizeAttenuation blending={THREE.AdditiveBlending} />
      </points>
      {/* 反射波 - 红色 */}
      <points ref={reflectedRef} visible={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={PARTICLE_COUNT} array={createRingPositions.slice()} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial size={0.03} color={COLORS.reflectedWave} transparent opacity={0.6} sizeAttenuation blending={THREE.AdditiveBlending} />
      </points>
      {/* 透射波 - 绿色 */}
      <points ref={transmittedRef} visible={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={PARTICLE_COUNT} array={createRingPositions.slice()} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial size={0.035} color={COLORS.transmittedWave} transparent opacity={0.7} sizeAttenuation blending={THREE.AdditiveBlending} />
      </points>
    </>
  );
}

// ═══ 动量阱（Momentum Trap） ═══
function MomentumTrap({ animState }: { animState: AnimationState }) {
  const trapX = INCIDENT_BAR_LENGTH - 0.5 + SPECIMEN_SIZE / 2 + TRANSMITTED_BAR_LENGTH + 0.3;
  const isActive = animState.currentStage === 'wavePropagate' || animState.currentStage === 'deformation';

  return (
    <group position={[trapX, 0, 0]}>
      {/* 弹簧可视化 */}
      {[0, 1, 2, 3].map(i => (
        <mesh key={i} position={[i * 0.1, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.1, 0.015, 8, 16]} />
          <meshStandardMaterial
            color={isActive ? '#10B981' : '#475569'}
            emissive={isActive ? '#10B981' : '#000000'}
            emissiveIntensity={isActive ? 0.5 : 0}
          />
        </mesh>
      ))}
      {/* 端板 */}
      <mesh position={[0.5, 0, 0]}>
        <boxGeometry args={[0.08, 0.5, 0.5]} />
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}

// ═══ DAQ数据采集系统 ═══
function DAQSystem({ animState }: { animState: AnimationState }) {
  const isActive = animState.currentStage === 'dataCollect' || animState.isComplete;
  const daqX = 1.5;

  return (
    <group position={[daqX, -1.2, 0]}>
      <mesh>
        <boxGeometry args={[1.0, 0.6, 0.3]} />
        <meshStandardMaterial
          color="#1a2a3a"
          emissive={isActive ? COLORS.daqGreen : '#000000'}
          emissiveIntensity={isActive ? 0.2 : 0}
          metalness={0.5}
          roughness={0.5}
        />
      </mesh>
      {/* 屏幕 */}
      <mesh position={[0, 0.05, 0.16]}>
        <planeGeometry args={[0.7, 0.35]} />
        <meshBasicMaterial color={isActive ? '#0a1628' : '#0a0a0a'} />
      </mesh>
      {/* 指示灯 */}
      {[0, 1, 2, 3].map(i => (
        <mesh key={i} position={[-0.35 + i * 0.15, 0.35, 0.16]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshStandardMaterial
            color={isActive ? (i < 3 ? '#10B981' : '#3B82F6') : '#334155'}
            emissive={isActive ? (i < 3 ? '#10B981' : '#3B82F6') : '#000000'}
            emissiveIntensity={isActive ? 2 : 0}
          />
        </mesh>
      ))}
      <Text position={[0, -0.4, 0.16]} fontSize={0.07} color="#ffffff50">
        8-CH DAQ SYSTEM
      </Text>
    </group>
  );
}

// ═══ 底座/支撑台 ═══
function SupportBase() {
  return (
    <group>
      {/* 主底座 */}
      <mesh position={[1, -0.5, 0]}>
        <boxGeometry args={[12, 0.15, 1.5]} />
        <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* 支撑脚 */}
      {[-3, -1, 1, 3, 5].map((x, i) => (
        <mesh key={i} position={[x, -0.35, 0]}>
          <boxGeometry args={[0.15, 0.15, 0.8]} />
          <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

// ═══ 阶段信息HUD ═══
function StageHUD({ animState }: { animState: AnimationState }) {
  const stageLabels: Record<string, string> = {
    idle: 'STANDBY',
    charging: 'CHARGING',
    coilAccel: 'EM ACCELERATION',
    strikerLaunch: 'STRIKER LAUNCH',
    wavePropagate: 'WAVE PROPAGATION',
    deformation: 'SPECIMEN DEFORMATION',
    dataCollect: 'DATA ACQUISITION',
  };

  return (
    <Float speed={1} rotationIntensity={0} floatIntensity={0.1}>
      <Text
        position={[1, 2, 0]}
        fontSize={0.15}
        color={COLORS.cyan}
        anchorX="center"
        font={undefined}
      >
        {stageLabels[animState.currentStage] || 'STANDBY'}
      </Text>
      {animState.isPlaying && (
        <Text
          position={[1, 1.75, 0]}
          fontSize={0.08}
          color="#ffffff40"
          anchorX="center"
        >
          {`STAGE ${animState.stageIndex + 1}/6 · ${Math.round(animState.stageProgress * 100)}%`}
        </Text>
      )}
    </Float>
  );
}

// ═══ 自适应相机控制 ═══
function CameraSetup() {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(1, 2, 6);
    camera.lookAt(1, 0, 0);
  }, [camera]);

  return (
    <OrbitControls
      target={[1, 0, 0]}
      minDistance={3}
      maxDistance={15}
      maxPolarAngle={Math.PI * 0.85}
      enableDamping
      dampingFactor={0.05}
    />
  );
}

// ═══ 主场景 ═══
function Scene({ animState, materialColor }: { animState: AnimationState; materialColor: string }) {
  return (
    <>
      {/* 光照 */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 8, 5]} intensity={1} castShadow shadow-mapSize={1024} />
      <pointLight position={[-6, 2, 3]} intensity={0.5} color={COLORS.cyan} />
      <pointLight position={[6, 2, -3]} intensity={0.3} color="#8B5CF6" />

      {/* 相机 */}
      <CameraSetup />

      {/* 设备组件 */}
      <CapacitorBank animState={animState} />
      <ElectromagneticCoils animState={animState} />
      <StrikerBar animState={animState} />
      <IncidentBar animState={animState} />
      <Specimen animState={animState} materialColor={materialColor} />
      <TransmittedBar animState={animState} />
      <MomentumTrap animState={animState} />
      <DAQSystem animState={animState} />
      <SupportBase />

      {/* 应力波粒子 */}
      <StressWaveParticles animState={animState} />

      {/* 阶段HUD */}
      <StageHUD animState={animState} />

      {/* 地面阴影 */}
      <ContactShadows position={[1, -0.58, 0]} opacity={0.4} scale={15} blur={2} far={5} />

      {/* 环境 */}
      <Environment preset="city" />

      {/* 网格地面 */}
      <gridHelper args={[20, 40, '#ffffff08', '#ffffff05']} position={[1, -0.58, 0]} />
    </>
  );
}

// ═══ 导出的主组件 ═══
interface HopkinsonBar3DProps {
  animState: AnimationState;
  materialColor?: string;
  className?: string;
}

export default function HopkinsonBar3D({ animState, materialColor = COLORS.specimen, className }: HopkinsonBar3DProps) {
  return (
    <div className={className || 'w-full h-full'}>
      <Canvas
        shadows
        camera={{ position: [1, 2, 6], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'linear-gradient(180deg, #0A2540 0%, #051020 100%)' }}
      >
        <Scene animState={animState} materialColor={materialColor} />
      </Canvas>
    </div>
  );
}
