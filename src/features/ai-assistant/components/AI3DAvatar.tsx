// src/features/ai-assistant/components/AI3DAvatar.tsx
// 3D AI助手形象 - 替代2D悬浮球的动态3D头像
// 使用 React Three Fiber + Three.js

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbState } from '../types';

// ═══ 状态颜色映射 ═══
const STATE_COLORS: Record<OrbState, string> = {
  idle: '#00F5FF',
  listening: '#8B5CF6',
  thinking: '#FFD700',
  executing: '#1DD1A1',
  speaking: '#00F5FF',
  error: '#EF4444',
};

// ═══ 核心球体（带呼吸/脉冲动画） ═══
function CoreSphere({ orbState, energy }: { orbState: OrbState; energy: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const targetColor = useMemo(() => new THREE.Color(STATE_COLORS[orbState]), [orbState]);
  const currentColor = useRef(new THREE.Color(STATE_COLORS.idle));

  useFrame((_, delta) => {
    if (!meshRef.current || !materialRef.current) return;

    // 颜色平滑过渡
    currentColor.current.lerp(targetColor, delta * 4);
    materialRef.current.color.copy(currentColor.current);
    materialRef.current.emissive.copy(currentColor.current).multiplyScalar(0.3);

    // 状态动画
    const time = Date.now() * 0.001;
    let scale = 1;

    switch (orbState) {
      case 'idle':
        // 呼吸脉冲
        scale = 1 + Math.sin(time * 1.5) * 0.04;
        break;
      case 'listening':
        // 随音频能量缩放
        scale = 1 + energy * 0.2 + Math.sin(time * 3) * 0.03;
        break;
      case 'thinking':
        // 旋转 + 轻微缩放
        meshRef.current.rotation.y += delta * 1.5;
        scale = 1 + Math.sin(time * 2) * 0.05;
        break;
      case 'executing':
        meshRef.current.rotation.y += delta * 2;
        scale = 1.05;
        break;
      case 'speaking':
        // 口型模拟：随时间波动
        scale = 1 + Math.sin(time * 8) * 0.06 + Math.sin(time * 12) * 0.03;
        break;
      case 'error':
        // 震动
        meshRef.current.position.x = Math.sin(time * 30) * 0.02;
        scale = 0.95;
        break;
    }

    meshRef.current.scale.setScalar(scale);
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.5, 64, 64]} />
      <meshStandardMaterial
        ref={materialRef}
        color={STATE_COLORS.idle}
        emissive={STATE_COLORS.idle}
        emissiveIntensity={0.3}
        roughness={0.2}
        metalness={0.8}
        envMapIntensity={1}
      />
    </mesh>
  );
}

// ═══ 环绕粒子环 ═══
function OrbitalRing({ orbState, ringIndex }: { orbState: OrbState; ringIndex: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const particleCount = 24;
  const radius = 0.7 + ringIndex * 0.15;

  const positions = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      pos[i * 3] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.1;
      pos[i * 3 + 2] = Math.sin(angle) * radius;
    }
    return pos;
  }, [particleCount, radius]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const speed = orbState === 'idle' ? 0.3 :
                  orbState === 'thinking' ? 1.5 :
                  orbState === 'executing' ? 2 :
                  orbState === 'listening' ? 0.8 : 0.5;

    groupRef.current.rotation.y += delta * speed * (ringIndex % 2 === 0 ? 1 : -1);
    groupRef.current.rotation.x = Math.sin(Date.now() * 0.0005 + ringIndex) * 0.3;
  });

  const color = STATE_COLORS[orbState];

  return (
    <group ref={groupRef}>
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particleCount}
            array={positions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.03}
          color={color}
          transparent
          opacity={0.7}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

// ═══ 能量场光环 ═══
function EnergyField({ orbState, energy }: { orbState: OrbState; energy: number }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;

    // listening状态下随能量变化
    const targetOpacity = orbState === 'listening'
      ? 0.1 + energy * 0.3
      : orbState === 'idle' ? 0.05 : 0.15;

    mat.opacity += (targetOpacity - mat.opacity) * 0.1;

    const targetScale = orbState === 'listening'
      ? 1.2 + energy * 0.5
      : 1.3;
    const s = meshRef.current.scale.x + (targetScale - meshRef.current.scale.x) * 0.1;
    meshRef.current.scale.setScalar(s);
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.6, 32, 32]} />
      <meshBasicMaterial
        color={STATE_COLORS[orbState]}
        transparent
        opacity={0.1}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// ═══ 主组件 ═══
interface AI3DAvatarProps {
  orbState: OrbState;
  /** 音频能量 0-1（来自VAD或音频分析） */
  energy?: number;
  /** 容器尺寸 px */
  size?: number;
  /** 点击事件 */
  onClick?: () => void;
}

export default function AI3DAvatar({
  orbState,
  energy = 0,
  size = 80,
  onClick,
}: AI3DAvatarProps) {
  return (
    <div
      style={{ width: size, height: size, cursor: 'pointer' }}
      onClick={onClick}
    >
      <Canvas
        camera={{ position: [0, 0, 2], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[2, 2, 2]} intensity={1} color="#00F5FF" />
        <pointLight position={[-2, -1, 1]} intensity={0.5} color="#8B5CF6" />

        <Float speed={2} rotationIntensity={0.2} floatIntensity={0.3}>
          <CoreSphere orbState={orbState} energy={energy} />
          <OrbitalRing orbState={orbState} ringIndex={0} />
          <OrbitalRing orbState={orbState} ringIndex={1} />
          <EnergyField orbState={orbState} energy={energy} />
        </Float>
      </Canvas>
    </div>
  );
}
