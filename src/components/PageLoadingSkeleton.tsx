// src/components/PageLoadingSkeleton.tsx
// 页面加载骨架屏 - 品牌风格loading
export default function PageLoadingSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A2540]">
      <div className="flex flex-col items-center gap-6">
        {/* 品牌Logo光效 */}
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00F5FF]/20 to-[#0066FF]/20 border border-[#00F5FF]/30 flex items-center justify-center animate-pulse">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00F5FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          {/* 外层旋转光环 */}
          <div
            className="absolute -inset-3 rounded-3xl border border-[#00F5FF]/20 animate-spin"
            style={{ animationDuration: '3s' }}
          />
        </div>

        {/* 加载文字 */}
        <div className="text-[#00F5FF]/60 text-sm tracking-widest">
          加载中...
        </div>

        {/* 进度条 */}
        <div className="w-48 h-0.5 bg-[#00F5FF]/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#00F5FF]/60 to-[#0066FF]/60 rounded-full animate-pulse"
            style={{ width: '60%', animationDuration: '1.5s' }}
          />
        </div>
      </div>
    </div>
  );
}
