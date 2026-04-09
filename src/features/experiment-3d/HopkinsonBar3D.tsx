// src/features/experiment-3d/HopkinsonBar3D.tsx
// 霍普金森杆3D数字孪生 — 加载真实 GLTF 模型 + 实验动画状态驱动

import { useRef, useEffect, Suspense, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, useGLTF, Float, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { AnimationState } from '@/hooks/useExperimentAnimation';

// ═══ 颜色配置 ═══
const COLORS = {
  cyan: '#00F5FF',
  incidentWave: '#3B82F6',
  reflectedWave: '#EF4444',
  transmittedWave: '#10B981',
};

/* ═══════════════════════════════════════════════
 * GLTF 模型加载 + 实验动画
 * ═══════════════════════════════════════════════ */

function HopkinsonGLTFModel({ animState, materialColor }: { animState: AnimationState; materialColor: string }) {
  const { scene } = useGLTF('/models/new_hopkinson.gltf');
  const groupRef = useRef<THREE.Group>(null);

  // 克隆场景避免状态污染
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    // 给所有材质设置统一金属质感
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          const mat = (mesh.material as THREE.MeshStandardMaterial);
          if (mat.isMeshStandardMaterial) {
            mat.metalness = Math.max(mat.metalness, 0.4);
            mat.roughness = Math.min(mat.roughness, 0.6);
            mat.envMapIntensity = 1.2;
          }
        }
      }
    });
    return clone;
  }, [scene]);

  // 计算模型包围盒，自动居中和缩放
  const { center, scale } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(clonedScene);
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    // 目标：让模型占据约 8 个单位的宽度
    const s = 8 / maxDim;
    return { center: c, scale: s };
  }, [clonedScene]);

  // 缓慢自动旋转（待机时）+ 实验运行时的微震
  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    // 待机时缓慢旋转
    if (!animState.isPlaying && !animState.isComplete) {
      groupRef.current.rotation.y += 0.001;
    }

    // 撞击和变形阶段微震
    if (animState.currentStage === 'strikerLaunch' || animState.currentStage === 'deformation') {
      const intensity = animState.currentStage === 'deformation' ? 0.003 : 0.001;
      const t = clock.getElapsedTime();
      groupRef.current.position.x = Math.sin(t * 30) * intensity;
      groupRef.current.position.y = Math.cos(t * 25) * intensity * 0.5;
    } else {
      // 恢复
      groupRef.current.position.x *= 0.95;
      groupRef.current.position.y *= 0.95;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive
        object={clonedScene}
        scale={scale}
        position={[-center.x * scale, -center.y * scale, -center.z * scale]}
      />
    </group>
  );
}

/* ═══════════════════════════════════════════════
 * 应力波粒子效果（叠加在模型上方）
 * ═══════════════════════════════════════════════ */

function StressWaveOverlay({ animState }: { animState: AnimationState }) {
  const incidentRef = useRef<THREE.Points>(null);
  const reflectedRef = useRef<THREE.Points>(null);
  const transmittedRef = useRef<THREE.Points>(null);

  const PARTICLE_COUNT = 60;

  const positions = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
      const r = 0.12 * Math.sqrt(Math.random());
      pos[i * 3] = 0;
      pos[i * 3 + 1] = Math.cos(angle) * r;
      pos[i * 3 + 2] = Math.sin(angle) * r;
    }
    return pos;
  }, []);

  const showWaves = animState.currentStage === 'wavePropagate' ||
                    animState.currentStage === 'deformation' ||
                    animState.currentStage === 'dataCollect';

  useFrame(({ clock }) => {
    if (!showWaves) {
      if (incidentRef.current) incidentRef.current.visible = false;
      if (reflectedRef.current) reflectedRef.current.visible = false;
      if (transmittedRef.current) transmittedRef.current.visible = false;
      return;
    }

    const progress = animState.currentStage === 'wavePropagate' ? animState.stageProgress : 1;
    const time = clock.getElapsedTime();

    // 入射波沿 -X 方向传播
    if (incidentRef.current) {
      incidentRef.current.visible = true;
      const geo = incidentRef.current.geometry;
      const pos = geo.attributes.position.array as Float32Array;
      const waveHead = -4 + 4 * Math.min(1, progress * 1.6);
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        pos[i * 3] = waveHead - (i / PARTICLE_COUNT) * 0.6 + Math.sin(time * 10 + i * 0.5) * 0.02;
      }
      geo.attributes.position.needsUpdate = true;
    }

    // 反射波
    if (reflectedRef.current) {
      if (progress > 0.5) {
        reflectedRef.current.visible = true;
        const geo = reflectedRef.current.geometry;
        const pos = geo.attributes.position.array as Float32Array;
        const refProgress = (progress - 0.5) / 0.5;
        const waveHead = 0 - 3 * refProgress;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          pos[i * 3] = waveHead + (i / PARTICLE_COUNT) * 0.4 + Math.sin(time * 12 + i * 0.3) * 0.015;
        }
        geo.attributes.position.needsUpdate = true;
      } else {
        reflectedRef.current.visible = false;
      }
    }

    // 透射波
    if (transmittedRef.current) {
      if (progress > 0.5) {
        transmittedRef.current.visible = true;
        const geo = transmittedRef.current.geometry;
        const pos = geo.attributes.position.array as Float32Array;
        const transProgress = (progress - 0.5) / 0.5;
        const waveHead = 0.2 + 3 * Math.min(1, transProgress * 1.3);
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          pos[i * 3] = waveHead - (i / PARTICLE_COUNT) * 0.5 + Math.sin(time * 8 + i * 0.4) * 0.02;
        }
        geo.attributes.position.needsUpdate = true;
      } else {
        transmittedRef.current.visible = false;
      }
    }
  });

  return (
    <>
      <points ref={incidentRef} visible={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={PARTICLE_COUNT} array={positions.slice()} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial size={0.04} color={COLORS.incidentWave} transparent opacity={0.8} sizeAttenuation blending={THREE.AdditiveBlending} />
      </points>
      <points ref={reflectedRef} visible={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={PARTICLE_COUNT} array={positions.slice()} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial size={0.03} color={COLORS.reflectedWave} transparent opacity={0.6} sizeAttenuation blending={THREE.AdditiveBlending} />
      </points>
      <points ref={transmittedRef} visible={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={PARTICLE_COUNT} array={positions.slice()} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial size={0.035} color={COLORS.transmittedWave} transparent opacity={0.7} sizeAttenuation blending={THREE.AdditiveBlending} />
      </points>
    </>
  );
}

/* ═══════════════════════════════════════════════
 * 阶段 HUD
 * ═══════════════════════════════════════════════ */

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
        position={[0, 3.5, 0]}
        fontSize={0.18}
        color={COLORS.cyan}
        anchorX="center"
        font={undefined}
      >
        {stageLabels[animState.currentStage] || 'STANDBY'}
      </Text>
      {animState.isPlaying && (
        <Text
          position={[0, 3.2, 0]}
          fontSize={0.1}
          color="#ffffff40"
          anchorX="center"
        >
          {`STAGE ${animState.stageIndex + 1}/6 · ${Math.round(animState.stageProgress * 100)}%`}
        </Text>
      )}
    </Float>
  );
}

/* ═══════════════════════════════════════════════
 * 相机设置
 * ═══════════════════════════════════════════════ */

function CameraSetup() {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(3, 3, 8);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  return (
    <OrbitControls
      target={[0, 0, 0]}
      minDistance={3}
      maxDistance={20}
      maxPolarAngle={Math.PI * 0.85}
      enableDamping
      dampingFactor={0.05}
      autoRotate={false}
    />
  );
}

/* ═══════════════════════════════════════════════
 * 主场景
 * ═══════════════════════════════════════════════ */

function Scene({ animState, materialColor }: { animState: AnimationState; materialColor: string }) {
  return (
    <>
      {/* 光照 */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow shadow-mapSize={1024} />
      <directionalLight position={[-5, 5, -5]} intensity={0.5} />
      <pointLight position={[-6, 2, 3]} intensity={0.4} color={COLORS.cyan} />
      <pointLight position={[6, 2, -3]} intensity={0.2} color="#8B5CF6" />

      {/* 相机 */}
      <CameraSetup />

      {/* GLTF 模型 */}
      <HopkinsonGLTFModel animState={animState} materialColor={materialColor} />

      {/* 应力波粒子叠加 */}
      <StressWaveOverlay animState={animState} />

      {/* 阶段 HUD */}
      <StageHUD animState={animState} />

      {/* 地面阴影 */}
      <ContactShadows position={[0, -2, 0]} opacity={0.4} scale={20} blur={2} far={5} />

      {/* 环境 */}
      <Environment preset="city" />

      {/* 网格地面 */}
      <gridHelper args={[20, 40, '#ffffff08', '#ffffff05']} position={[0, -2, 0]} />
    </>
  );
}

/* ═══════════════════════════════════════════════
 * 加载占位
 * ═══════════════════════════════════════════════ */

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#334155" wireframe />
    </mesh>
  );
}

/* ═══════════════════════════════════════════════
 * 导出的主组件
 * ═══════════════════════════════════════════════ */

interface HopkinsonBar3DProps {
  animState: AnimationState;
  materialColor?: string;
  className?: string;
}

export default function HopkinsonBar3D({ animState, materialColor = '#E8B888', className }: HopkinsonBar3DProps) {
  return (
    <div className={className || 'w-full h-full'}>
      <Canvas
        shadows
        camera={{ position: [3, 3, 8], fov: 50 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'linear-gradient(180deg, #0A2540 0%, #051020 100%)' }}
      >
        <Suspense fallback={<LoadingFallback />}>
          <Scene animState={animState} materialColor={materialColor} />
        </Suspense>
      </Canvas>
    </div>
  );
}

// 预加载模型
useGLTF.preload('/models/new_hopkinson.gltf');
