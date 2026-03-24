// src/components/Model3D.tsx
import { useRef, Suspense, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';

function HopkinsonModel({ isAnimating }: { isAnimating: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const strikerRef = useRef<THREE.Group | null>(null);   // ← 改为可空

  const { scene } = useGLTF('/models/new_hopkinson.gltf');

  // ✅ 关键修复：遍历逻辑移到 useEffect，只执行一次
  useEffect(() => {
    if (!scene) return;

    let found = false;
    scene.traverse((child) => {
      const name = child.name.toLowerCase();
      if (
        name.includes('撞击杆') ||
        name.includes('striker') ||
        name.includes('撞击')
      ) {
        strikerRef.current = child as THREE.Group;
        found = true;
        console.log('✅ 找到撞击杆节点:', child.name); // 调试用
      }
    });

    if (!found) {
      console.warn('⚠️ 未在 glTF 中找到包含“撞击杆/striker”的节点，动画将使用备用逻辑');
    }
  }, [scene]);

  // 动画（整体旋转 + 子弹单次撞击入射杆）
  // 正确物理过程：电磁驱动子弹(撞击杆)加速→撞击入射杆→入射杆与透射杆一起挤压试样
  // 子弹不会往复运动，只有一次撞击
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.15;
    }

    if (strikerRef.current && isAnimating) {
      // 单次撞击：子弹从初始位置加速到撞击位置后停止
      const elapsed = state.clock.elapsedTime;
      const impactTime = 0.8; // 撞击时间点(秒)
      if (elapsed < impactTime) {
        // 加速阶段：电磁驱动子弹向入射杆方向加速
        const progress = elapsed / impactTime;
        const easeIn = progress * progress; // 加速曲线
        strikerRef.current.position.x = -3.5 + easeIn * 3.5;
      } else {
        // 撞击后：子弹停在撞击位置
        strikerRef.current.position.x = 0;
      }
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} scale={1.8} position={[0, -0.5, 0]} />
    </group>
  );
}

interface Model3DProps {
  isAnimating?: boolean;
  className?: string;
}

export default function Model3D({ isAnimating = true, className = '' }: Model3DProps) {
  return (
    <div className={`w-full h-full ${className}`}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ 
          antialias: true, 
          alpha: true,
          preserveDrawingBuffer: true 
        }}
        camera={{ position: [8, 6, 12], fov: 45 }}
        style={{ background: 'transparent' }}
      >
        <Suspense 
          fallback={
            <Html center>
              <div className="text-[#00F5FF] text-xl font-medium flex items-center gap-3">
                <div className="w-6 h-6 border-4 border-[#00F5FF] border-t-transparent rounded-full animate-spin" />
                加载真实3D霍普金森杆模型...
              </div>
            </Html>
          }
        >
          <HopkinsonModel isAnimating={isAnimating} />

          {/* 灯光 */}
          <ambientLight intensity={0.6} />
          <directionalLight 
            position={[10, 15, 8]} 
            intensity={1.2} 
            castShadow 
            shadow-mapSize={[2048, 2048]} 
          />
          <pointLight position={[-8, 5, -5]} color="#00F5FF" intensity={0.8} />

          {/* 控制 */}
          <OrbitControls 
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={4}
            maxDistance={25}
            target={[0, 0.5, 0]}
          />

          {/* 科技网格 */}
          <gridHelper 
            args={[30, 30]} 
            position={[0, -1.8, 0]} 
          />
        </Suspense>
      </Canvas>
    </div>
  );
}