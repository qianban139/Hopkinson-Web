import { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid, useGLTF, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

// GLTF模型加载组件
function Model({ url, isAnimating }: { url: string; isAnimating: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(url);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  // 初始化动画混合器
  useEffect(() => {
    if (scene) {
      mixerRef.current = new THREE.AnimationMixer(scene);

      if (animations && animations.length > 0 && mixerRef.current) {
        const action = mixerRef.current.clipAction(animations[0]);
        if (isAnimating) {
          action.play();
        } else {
          action.stop();
        }
      }
    }

    return () => {
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
    };
  }, [scene, animations, isAnimating]);

  useFrame((_, delta) => {
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }
    if (groupRef.current && !isAnimating) {
      // 自动旋转展示
      groupRef.current.rotation.y += 0.002;
    }
  });

  if (!scene) return null;

  // 复制场景以便可以操作
  const clonedScene = scene.clone();

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} scale={1} position={[0, 0, 0]} />
    </group>
  );
}

// 错误状态组件
function ErrorState({ error }: { error: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-white/50 p-8">
      <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <p className="text-sm text-red-400 mb-2">模型加载失败</p>
      <p className="text-xs text-white/30 text-center max-w-xs">{error}</p>
      <p className="text-xs text-white/30 mt-4 text-center">
        请确保模型文件已放置在 public/models/ 目录下
      </p>
    </div>
  );
}

// 场景组件
function Scene({ modelUrl, isAnimating }: { modelUrl: string; isAnimating: boolean }) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[5, 3, 8]} fov={50} />
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={2}
        maxDistance={20}
        autoRotate={!isAnimating}
        autoRotateSpeed={1}
      />

      {/* 环境光 */}
      <ambientLight intensity={0.6} />

      {/* 主光源 */}
      <directionalLight position={[5, 10, 5]} intensity={1.5} castShadow />
      <directionalLight position={[-5, 5, -5]} intensity={0.8} />

      {/* 霓虹环境光 */}
      <pointLight position={[-5, 2, 0]} color="#00F5FF" intensity={0.5} />
      <pointLight position={[5, 2, 0]} color="#FF2E63" intensity={0.3} />

      {/* 环境贴图 */}
      <Environment preset="city" />

      {/* 接触阴影 */}
      <ContactShadows position={[0, -2, 0]} opacity={0.4} scale={20} blur={2.5} far={4} />

      {/* GLTF模型 */}
      <Model url={modelUrl} isAnimating={isAnimating} />

      {/* 网格地面 */}
      <Grid
        position={[0, -2, 0]}
        args={[30, 30]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#00F5FF"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#00F5FF"
        fadeDistance={25}
        fadeStrength={1}
        infiniteGrid
      />
    </>
  );
}

interface GLTFModelProps {
  modelUrl?: string;
  isAnimating?: boolean;
  className?: string;
}

// 预加载钩子 - 在组件外调用
function usePreloadModel(url: string) {
  useGLTF.preload(url);
}

export default function GLTFModel({
  modelUrl = '/models/new_hopkinson.gltf',
  isAnimating = false,
  className = '',
}: GLTFModelProps) {
  const [error, setError] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  // 检查模型文件是否存在
  useEffect(() => {
    const checkModel = async () => {
      try {
        const response = await fetch(modelUrl, { method: 'HEAD' });
        if (!response.ok) {
          setError(`模型文件未找到: ${modelUrl}`);
          setHasError(true);
        }
      } catch (err) {
        setError(`无法访问模型文件: ${modelUrl}`);
        setHasError(true);
      }
    };
    checkModel();
  }, [modelUrl]);

  if (hasError) {
    return (
      <div className={`w-full h-full flex items-center justify-center ${className}`}>
        <ErrorState error={error || '未知错误'} />
      </div>
    );
  }

  return (
    <div className={`w-full h-full ${className}`}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={null}>
          <Scene modelUrl={modelUrl} isAnimating={isAnimating} />
        </Suspense>
      </Canvas>
    </div>
  );
}

// 导出预加载函数
export { usePreloadModel };
