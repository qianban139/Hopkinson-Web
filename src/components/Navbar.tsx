import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Zap, FlaskConical, BarChart3, Monitor, Home, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAppStore } from '@/store/useAppStore';
import WorkflowProgressBar from './WorkflowProgressBar';

export const AI_ASSISTANT_TOGGLE_EVENT = 'ai-assistant-toggle';

const navItems = [
  { label: '首页', path: '/', icon: Home },
  { label: '虚拟实验室', path: '/lab', icon: FlaskConical },
  { label: '材料力学分析', path: '/analysis', icon: BarChart3 },
  { label: '系统监控', path: '/monitor', icon: Monitor },
  { label: '教学系统', path: '/teaching', icon: GraduationCap },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const navigateTo = useAppStore(s => s.navigateTo);
  const setNavigateTo = useAppStore(s => s.setNavigateTo);
  const setCurrentPage = useAppStore(s => s.setCurrentPage);

  useEffect(() => {
    const pageMap: Record<string, string> = {
      '/': 'home', '/lab': 'lab', '/analysis': 'analysis', '/monitor': 'monitor', '/teaching': 'teaching',
    };
    setCurrentPage(pageMap[location.pathname] || 'home');
  }, [location.pathname, setCurrentPage]);

  useEffect(() => {
    if (navigateTo && navigateTo !== location.pathname) {
      navigate(navigateTo);
      setNavigateTo(null);
    } else if (navigateTo) {
      setNavigateTo(null);
    }
  }, [navigateTo, navigate, location.pathname, setNavigateTo]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled
            ? 'py-1'
            : 'py-2'
        }`}
      >
        {/* 导航栏背景层 */}
        <div
          className={`absolute inset-0 transition-all duration-500 ${
            isScrolled ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            background: 'linear-gradient(180deg, rgba(10, 37, 64, 0.95) 0%, rgba(10, 37, 64, 0.85) 100%)',
            backdropFilter: 'blur(20px) saturate(1.5)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
            borderBottom: '1px solid rgba(0, 245, 255, 0.08)',
          }}
        />

        {/* 顶部发光线 */}
        <div
          className="absolute top-0 left-0 right-0 h-[1px]"
          style={{
            background: 'linear-gradient(90deg, transparent 5%, rgba(0, 245, 255, 0.3) 30%, rgba(139, 92, 246, 0.3) 50%, rgba(29, 209, 161, 0.3) 70%, transparent 95%)',
          }}
        />

        <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative">
                <img src="/logo.png" alt="嘉本科技" className="h-9 w-auto relative z-10" />
                {/* Logo 背后光晕 */}
                <div
                  className="absolute inset-0 -m-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background: 'radial-gradient(circle, rgba(0, 245, 255, 0.2) 0%, transparent 70%)',
                    filter: 'blur(8px)',
                  }}
                />
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-sm font-semibold text-white/90 tracking-wide leading-tight">
                  数智化电磁驱动
                </span>
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-[#00F5FF]" />
                  <span className="text-[11px] text-[#00F5FF]/80 font-medium tracking-wider">
                    HOPKINSON BAR SYSTEM
                  </span>
                </div>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center">
              <div
                className="flex items-center gap-0.5 p-1 rounded-2xl"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  const isHovered = hoveredPath === item.path;
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onMouseEnter={() => setHoveredPath(item.path)}
                      onMouseLeave={() => setHoveredPath(null)}
                      className="relative px-3.5 py-2 text-sm font-medium transition-colors duration-200"
                    >
                      {/* 活跃/悬停背景 */}
                      <AnimatePresence>
                        {(isActive || isHovered) && (
                          <motion.div
                            layoutId="nav-pill"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                            className="absolute inset-0 rounded-xl"
                            style={{
                              background: isActive
                                ? 'linear-gradient(135deg, rgba(0, 245, 255, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%)'
                                : 'rgba(255, 255, 255, 0.04)',
                              border: isActive ? '1px solid rgba(0, 245, 255, 0.15)' : '1px solid transparent',
                              boxShadow: isActive ? '0 0 20px rgba(0, 245, 255, 0.08), inset 0 1px 0 rgba(255,255,255,0.05)' : 'none',
                            }}
                          />
                        )}
                      </AnimatePresence>

                      {/* 内容 */}
                      <span className={`relative z-10 flex items-center gap-1.5 ${
                        isActive
                          ? 'text-[#00F5FF]'
                          : isHovered
                            ? 'text-white'
                            : 'text-white/60'
                      }`}>
                        <Icon className={`w-3.5 h-3.5 transition-all duration-200 ${
                          isActive ? 'text-[#00F5FF] drop-shadow-[0_0_4px_rgba(0,245,255,0.5)]' : ''
                        }`} />
                        {item.label}
                      </span>

                      {/* 活跃指示点 */}
                      {isActive && (
                        <motion.div
                          layoutId="nav-dot"
                          className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#00F5FF]"
                          style={{ boxShadow: '0 0 6px rgba(0, 245, 255, 0.6)' }}
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Right Side — 状态指示 + 移动端菜单 */}
            <div className="flex items-center gap-3">
              {/* 系统状态灯 */}
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full"
                style={{
                  background: 'rgba(29, 209, 161, 0.06)',
                  border: '1px solid rgba(29, 209, 161, 0.12)',
                }}
              >
                <div className="relative">
                  <div className="w-2 h-2 rounded-full bg-[#1DD1A1]" />
                  <div className="absolute inset-0 w-2 h-2 rounded-full bg-[#1DD1A1] animate-ping opacity-40" />
                </div>
                <span className="text-[11px] text-[#1DD1A1]/80 font-medium">ONLINE</span>
              </div>

              {/* Mobile Menu */}
              <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild className="lg:hidden">
                  <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/5">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="border-l border-[#00F5FF]/10 w-[300px] p-0"
                  style={{
                    background: 'linear-gradient(180deg, rgba(10, 37, 64, 0.98) 0%, rgba(6, 23, 40, 0.98) 100%)',
                    backdropFilter: 'blur(20px)',
                  }}
                >
                  {/* 移动端头部 */}
                  <div className="p-6 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <img src="/logo.png" alt="嘉本科技" className="h-8 w-auto" />
                      <div>
                        <span className="text-sm font-semibold text-white/90 block">霍普金森杆</span>
                        <span className="text-[10px] text-[#00F5FF]/70 font-medium tracking-wider">TESTING SYSTEM</span>
                      </div>
                    </div>
                  </div>

                  {/* 移动端导航列表 */}
                  <div className="flex flex-col gap-1 p-3 mt-2">
                    {navItems.map((item) => {
                      const isActive = location.pathname === item.path;
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setIsOpen(false)}
                          className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                            isActive
                              ? 'text-[#00F5FF]'
                              : 'text-white/60 hover:text-white hover:bg-white/5'
                          }`}
                          style={isActive ? {
                            background: 'linear-gradient(135deg, rgba(0, 245, 255, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)',
                            border: '1px solid rgba(0, 245, 255, 0.1)',
                          } : {}}
                        >
                          <Icon className={`w-4 h-4 ${isActive ? 'text-[#00F5FF]' : 'text-white/40'}`} />
                          {item.label}
                          {isActive && (
                            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#00F5FF]"
                              style={{ boxShadow: '0 0 6px rgba(0, 245, 255, 0.5)' }}
                            />
                          )}
                        </Link>
                      );
                    })}
                  </div>

                  {/* 移动端底部状态 */}
                  <div className="absolute bottom-6 left-0 right-0 px-6">
                    <div className="flex items-center justify-between text-[10px] text-white/30 px-2">
                      <span>v1.0.0</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#1DD1A1]" />
                        <span>System Online</span>
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>

        {/* 底部渐变消隐线 */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[1px]"
          style={{
            background: 'linear-gradient(90deg, transparent 10%, rgba(0, 245, 255, 0.06) 50%, transparent 90%)',
          }}
        />
      </motion.nav>

      <div className="fixed top-[60px] left-0 right-0 z-40">
        <WorkflowProgressBar />
      </div>
    </>
  );
}
