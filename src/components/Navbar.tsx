import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAppStore } from '@/store/useAppStore';
import WorkflowProgressBar from './WorkflowProgressBar';

// 保留导出以兼容旧代码引用
export const AI_ASSISTANT_TOGGLE_EVENT = 'ai-assistant-toggle';

const navItems = [
  { label: '首页', path: '/' },
  { label: '虚拟实验室', path: '/lab' },
  { label: 'AI智能控制', path: '/ai' },
  { label: '多场耦合实验', path: '/multifield' },
  { label: '材料力学分析', path: '/analysis' },
  { label: '系统监控', path: '/monitor' },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const navigateTo = useAppStore(s => s.navigateTo);
  const setNavigateTo = useAppStore(s => s.setNavigateTo);
  const setCurrentPage = useAppStore(s => s.setCurrentPage);

  // 同步当前页面到store
  useEffect(() => {
    const pageMap: Record<string, string> = {
      '/': 'home', '/lab': 'lab', '/ai': 'ai',
      '/multifield': 'multifield', '/analysis': 'analysis', '/monitor': 'monitor',
    };
    setCurrentPage(pageMap[location.pathname] || 'home');
  }, [location.pathname, setCurrentPage]);

  // 响应AI发起的程序化导航
  useEffect(() => {
    if (navigateTo && navigateTo !== location.pathname) {
      navigate(navigateTo);
      setNavigateTo(null);
    } else if (navigateTo) {
      setNavigateTo(null);
    }
  }, [navigateTo, navigate, location.pathname, setNavigateTo]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-[#0A2540]/95 backdrop-blur-md shadow-lg shadow-[#00F5FF]/5'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="嘉本科技"
              className="h-10 w-auto"
            />
            <div className="hidden sm:block">
              <span className="text-sm font-medium text-white/80">数智化电磁驱动</span>
              <span className="text-xs text-[#00F5FF] block">霍普金森杆测试系统</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`relative px-4 py-2 text-sm font-medium transition-colors ${
                  location.pathname === item.path
                    ? 'text-[#00F5FF]'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                {item.label}
                {location.pathname === item.path && (
                  <motion.div
                    layoutId="navbar-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00F5FF]"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </Link>
            ))}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-3">
            {/* Mobile Menu */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon" className="text-white">
                  <Menu className="w-6 h-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-[#0A2540] border-l border-[#00F5FF]/20 w-[280px]">
                <div className="flex flex-col gap-4 mt-8">
                  {navItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsOpen(false)}
                      className={`px-4 py-3 text-lg font-medium rounded-lg transition-colors ${
                        location.pathname === item.path
                          ? 'bg-[#00F5FF]/10 text-[#00F5FF]'
                          : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </motion.nav>
    <div className="fixed top-16 left-0 right-0 z-40">
      <WorkflowProgressBar />
    </div>
    </>
  );
}
