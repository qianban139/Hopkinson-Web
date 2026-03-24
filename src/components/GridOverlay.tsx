// src/components/GridOverlay.tsx
// 科技感网格叠加层 — 透视网格 + 水平扫描线
export default function GridOverlay() {
  return (
    <div className="fixed inset-0 pointer-events-none z-[1] overflow-hidden">
      {/* 透视网格 */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 245, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 245, 255, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 30%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 30%, transparent 70%)',
        }}
      />

      {/* 水平扫描线 */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, transparent 0%, rgba(0, 245, 255, 0.04) 50%, transparent 100%)',
          backgroundSize: '100% 4px',
          animation: 'scanDown 8s linear infinite',
          opacity: 0.5,
        }}
      />

      {/* 边缘暗角 */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 40%, rgba(5, 16, 32, 0.6) 100%)',
        }}
      />

      <style>{`
        @keyframes scanDown {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
      `}</style>
    </div>
  );
}
