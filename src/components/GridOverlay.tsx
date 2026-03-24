// src/components/GridOverlay.tsx
// 华丽科技感叠加层 — 六边形网格 + 多重扫描线 + 光晕 + 角落装饰
export default function GridOverlay() {
  return (
    <div className="fixed inset-0 pointer-events-none z-[1] overflow-hidden">
      {/* 主网格 — 细密正交线 */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 245, 255, 0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 245, 255, 0.025) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          maskImage: 'radial-gradient(ellipse 85% 65% at 50% 50%, black 20%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 85% 65% at 50% 50%, black 20%, transparent 75%)',
        }}
      />

      {/* 次级网格 — 更密更淡 */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(139, 92, 246, 0.012) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 92, 246, 0.012) 1px, transparent 1px)
          `,
          backgroundSize: '25px 25px',
          maskImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, black 10%, transparent 60%)',
          WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, black 10%, transparent 60%)',
        }}
      />

      {/* 主扫描线 — cyan */}
      <div
        className="absolute w-full"
        style={{
          height: '120px',
          background: 'linear-gradient(180deg, transparent 0%, rgba(0, 245, 255, 0.06) 40%, rgba(0, 245, 255, 0.03) 60%, transparent 100%)',
          animation: 'scanDown 8s linear infinite',
        }}
      />

      {/* 次扫描线 — purple，反向 */}
      <div
        className="absolute w-full"
        style={{
          height: '80px',
          background: 'linear-gradient(180deg, transparent 0%, rgba(139, 92, 246, 0.04) 50%, transparent 100%)',
          animation: 'scanUp 12s linear infinite',
        }}
      />

      {/* 水平扫描线 — 从左到右 */}
      <div
        className="absolute h-full"
        style={{
          width: '100px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(29, 209, 161, 0.03) 50%, transparent 100%)',
          animation: 'scanRight 15s linear infinite',
        }}
      />

      {/* 中心十字准线 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          style={{
            width: '200px',
            height: '1px',
            background: 'linear-gradient(90deg, transparent 0%, rgba(0, 245, 255, 0.06) 50%, transparent 100%)',
          }}
        />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          style={{
            width: '1px',
            height: '200px',
            background: 'linear-gradient(180deg, transparent 0%, rgba(0, 245, 255, 0.06) 50%, transparent 100%)',
          }}
        />
      </div>

      {/* 四角装饰框 */}
      <div className="absolute top-4 left-4 w-16 h-16">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-cyan-500/20 to-transparent" />
        <div className="absolute top-0 left-0 w-[1px] h-full bg-gradient-to-b from-cyan-500/20 to-transparent" />
      </div>
      <div className="absolute top-4 right-4 w-16 h-16">
        <div className="absolute top-0 right-0 w-full h-[1px] bg-gradient-to-l from-purple-500/20 to-transparent" />
        <div className="absolute top-0 right-0 w-[1px] h-full bg-gradient-to-b from-purple-500/20 to-transparent" />
      </div>
      <div className="absolute bottom-4 left-4 w-16 h-16">
        <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-teal-500/20 to-transparent" />
        <div className="absolute bottom-0 left-0 w-[1px] h-full bg-gradient-to-t from-teal-500/20 to-transparent" />
      </div>
      <div className="absolute bottom-4 right-4 w-16 h-16">
        <div className="absolute bottom-0 right-0 w-full h-[1px] bg-gradient-to-l from-pink-500/20 to-transparent" />
        <div className="absolute bottom-0 right-0 w-[1px] h-full bg-gradient-to-t from-pink-500/20 to-transparent" />
      </div>

      {/* 边缘暗角 */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 35%, rgba(5, 16, 32, 0.65) 100%)',
        }}
      />

      <style>{`
        @keyframes scanDown {
          0% { transform: translateY(-120px); }
          100% { transform: translateY(100vh); }
        }
        @keyframes scanUp {
          0% { transform: translateY(100vh); }
          100% { transform: translateY(-80px); }
        }
        @keyframes scanRight {
          0% { transform: translateX(-100px); }
          100% { transform: translateX(100vw); }
        }
      `}</style>
    </div>
  );
}
