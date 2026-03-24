// src/components/GridOverlay.tsx
// 科技感叠加层 — 柔和网格 + 微弱扫描线 + 角落装饰
export default function GridOverlay() {
  return (
    <div className="fixed inset-0 pointer-events-none z-[1] overflow-hidden">
      {/* 主网格 — 极淡 */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 245, 255, 0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 245, 255, 0.015) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 20%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 20%, transparent 70%)',
        }}
      />

      {/* 扫描线 — 单条、慢速、极淡 */}
      <div
        className="absolute w-full"
        style={{
          height: '80px',
          background: 'linear-gradient(180deg, transparent 0%, rgba(0, 245, 255, 0.018) 50%, transparent 100%)',
          animation: 'scanDown 14s linear infinite',
        }}
      />

      {/* 四角装饰框 */}
      <div className="absolute top-4 left-4 w-12 h-12">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-cyan-500/15 to-transparent" />
        <div className="absolute top-0 left-0 w-[1px] h-full bg-gradient-to-b from-cyan-500/15 to-transparent" />
      </div>
      <div className="absolute top-4 right-4 w-12 h-12">
        <div className="absolute top-0 right-0 w-full h-[1px] bg-gradient-to-l from-purple-500/15 to-transparent" />
        <div className="absolute top-0 right-0 w-[1px] h-full bg-gradient-to-b from-purple-500/15 to-transparent" />
      </div>
      <div className="absolute bottom-4 left-4 w-12 h-12">
        <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-teal-500/15 to-transparent" />
        <div className="absolute bottom-0 left-0 w-[1px] h-full bg-gradient-to-t from-teal-500/15 to-transparent" />
      </div>
      <div className="absolute bottom-4 right-4 w-12 h-12">
        <div className="absolute bottom-0 right-0 w-full h-[1px] bg-gradient-to-l from-pink-500/15 to-transparent" />
        <div className="absolute bottom-0 right-0 w-[1px] h-full bg-gradient-to-t from-pink-500/15 to-transparent" />
      </div>

      {/* 边缘暗角 */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 40%, rgba(5, 16, 32, 0.5) 100%)',
        }}
      />

      <style>{`
        @keyframes scanDown {
          0% { transform: translateY(-80px); }
          100% { transform: translateY(100vh); }
        }
      `}</style>
    </div>
  );
}
