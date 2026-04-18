import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu, Zap, FlaskConical, Database, Monitor, GraduationCap,
  LogOut, User as UserIcon, Shield, BrainCircuit, Layers,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import WorkflowProgressBar from './WorkflowProgressBar';

export const AI_ASSISTANT_TOGGLE_EVENT = 'ai-assistant-toggle';

type NavChild = { label: string; path: string; icon: typeof Monitor; description?: string };
type NavSection = {
  label: string;
  icon: typeof Monitor;
  primaryPath: string;
  children: NavChild[];
};

/** 4 大版块 — 与计划文档第 A1 节对齐 */
const navSections: NavSection[] = [
  {
    label: '系统安全运维',
    icon: Shield,
    primaryPath: '/monitor',
    children: [
      { label: '系统监控总览', path: '/monitor', icon: Monitor, description: '设备状态 / 实时告警 / 安全阈值' },
    ],
  },
  {
    label: '材料数据中心',
    icon: Database,
    primaryPath: '/analysis',
    children: [
      { label: '材料力学分析', path: '/analysis', icon: Database, description: '本构拟合 / 信号处理 / 报告导出' },
      { label: '多场耦合实验', path: '/multifield', icon: Layers, description: '热-力-电-磁四场任意组合' },
    ],
  },
  {
    label: '虚拟仿真实训',
    icon: FlaskConical,
    primaryPath: '/lab',
    children: [
      { label: '虚拟实验室', path: '/lab', icon: FlaskConical, description: 'SHPB 全流程数字孪生实验' },
      { label: '教学系统', path: '/teaching', icon: GraduationCap, description: '理论学习 / 互动测验 / 知识图谱' },
    ],
  },
  {
    label: '智能数据采集与分析',
    icon: BrainCircuit,
    primaryPath: '/ai-control',
    children: [
      { label: 'AI 自主实验中枢', path: '/ai-control', icon: BrainCircuit, description: 'LLM 规划 / 三级 AI 优化 / 报告生成' },
    ],
  },
];

/** 把所有路径展平,用于活跃态判断 */
const allPaths = navSections.flatMap(s => s.children.map(c => c.path));

function isSectionActive(section: NavSection, currentPath: string): boolean {
  return section.children.some(c => c.path === currentPath);
}

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const navigateTo = useAppStore(s => s.navigateTo);
  const setNavigateTo = useAppStore(s => s.setNavigateTo);
  const setCurrentPage = useAppStore(s => s.setCurrentPage);
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  useEffect(() => {
    const pageMap: Record<string, string> = {
      '/': 'home',
      '/lab': 'lab',
      '/analysis': 'analysis',
      '/monitor': 'monitor',
      '/teaching': 'teaching',
      '/multifield': 'multifield',
      '/ai-control': 'ai-control',
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
          isScrolled ? 'py-1' : 'py-2'
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
            {/* Logo - 跳转首页 */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative">
                <img src="/logo.png" alt="嘉本科技" className="h-9 w-auto relative z-10" />
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

            {/* Desktop Navigation — 4 大版块 + 二级菜单 */}
            <div className="hidden lg:flex items-center">
              <div
                className="flex items-center gap-0.5 p-1 rounded-2xl"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                {navSections.map((section) => {
                  const isActive = isSectionActive(section, location.pathname);
                  const isHovered = hoveredSection === section.label;
                  const Icon = section.icon;
                  const hasChildren = section.children.length > 1;

                  return (
                    <div
                      key={section.label}
                      className="relative"
                      onMouseEnter={() => setHoveredSection(section.label)}
                      onMouseLeave={() => setHoveredSection(null)}
                    >
                      <Link
                        to={section.primaryPath}
                        className="relative px-3.5 py-2 text-sm font-medium transition-colors duration-200 flex items-center"
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
                              : 'text-white/65'
                        }`}>
                          <Icon className={`w-3.5 h-3.5 transition-all duration-200 ${
                            isActive ? 'text-[#00F5FF] drop-shadow-[0_0_4px_rgba(0,245,255,0.5)]' : ''
                          }`} />
                          {section.label}
                          {hasChildren && (
                            <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${
                              isHovered ? 'rotate-180' : ''
                            }`} />
                          )}
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

                      {/* 二级菜单 (hover 显示) */}
                      <AnimatePresence>
                        {hasChildren && isHovered && (
                          <motion.div
                            initial={{ opacity: 0, y: -8, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.96 }}
                            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                            className="absolute top-full left-1/2 -translate-x-1/2 pt-3 z-50"
                            style={{ minWidth: '280px' }}
                          >
                            <div
                              className="rounded-2xl p-2 shadow-2xl"
                              style={{
                                background: 'linear-gradient(180deg, rgba(10, 37, 64, 0.98) 0%, rgba(6, 23, 40, 0.98) 100%)',
                                backdropFilter: 'blur(20px) saturate(1.5)',
                                WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
                                border: '1px solid rgba(0, 245, 255, 0.12)',
                                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 30px rgba(0, 245, 255, 0.06)',
                              }}
                            >
                              {section.children.map((child) => {
                                const childActive = location.pathname === child.path;
                                const ChildIcon = child.icon;
                                return (
                                  <Link
                                    key={child.path}
                                    to={child.path}
                                    className={`flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group/item ${
                                      childActive
                                        ? 'bg-gradient-to-r from-[#00F5FF]/10 to-transparent'
                                        : 'hover:bg-white/5'
                                    }`}
                                  >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                                      childActive
                                        ? 'bg-[#00F5FF]/20'
                                        : 'bg-white/5 group-hover/item:bg-[#00F5FF]/15'
                                    }`}>
                                      <ChildIcon className={`w-4 h-4 ${
                                        childActive ? 'text-[#00F5FF]' : 'text-white/60 group-hover/item:text-[#00F5FF]'
                                      }`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className={`text-sm font-medium ${
                                        childActive ? 'text-[#00F5FF]' : 'text-white/90 group-hover/item:text-white'
                                      }`}>
                                        {child.label}
                                      </div>
                                      {child.description && (
                                        <div className="text-[11px] text-white/45 mt-0.5 leading-relaxed">
                                          {child.description}
                                        </div>
                                      )}
                                    </div>
                                    {childActive && (
                                      <ChevronRight className="w-3.5 h-3.5 text-[#00F5FF] mt-2 flex-shrink-0" />
                                    )}
                                  </Link>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Side — 状态指示 + 用户菜单 + 移动端 */}
            <div className="flex items-center gap-3">
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

              {user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="hidden md:flex items-center gap-2 text-white/80 hover:text-white hover:bg-white/5 px-2.5 h-9"
                    >
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-[11px] font-semibold text-white">
                        {(user.display_name ?? user.username).slice(0, 1).toUpperCase()}
                      </div>
                      <span className="text-[12px] font-medium max-w-[100px] truncate">
                        {user.display_name ?? user.username}
                      </span>
                      {user.is_admin && (
                        <Shield className="w-3 h-3 text-[#FFB800]" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-56 border-[#00F5FF]/15 bg-[#0A2540]/95 text-white/90 backdrop-blur-xl"
                  >
                    <DropdownMenuLabel className="flex items-center gap-2 text-white/60 text-xs font-normal">
                      <UserIcon className="w-3.5 h-3.5" />
                      已登录为 <span className="text-cyan-300 font-medium">{user.username}</span>
                    </DropdownMenuLabel>
                    {user.email && (
                      <div className="px-2 pb-2 text-[11px] text-white/40 truncate">{user.email}</div>
                    )}
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="cursor-pointer focus:bg-red-500/10 focus:text-red-300"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      退出登录
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Mobile Menu */}
              <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild className="lg:hidden">
                  <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/5">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="border-l border-[#00F5FF]/10 w-[320px] p-0 overflow-y-auto"
                  style={{
                    background: 'linear-gradient(180deg, rgba(10, 37, 64, 0.98) 0%, rgba(6, 23, 40, 0.98) 100%)',
                    backdropFilter: 'blur(20px)',
                  }}
                >
                  <div className="p-6 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <img src="/logo.png" alt="嘉本科技" className="h-8 w-auto" />
                      <div>
                        <span className="text-sm font-semibold text-white/90 block">霍普金森杆</span>
                        <span className="text-[10px] text-[#00F5FF]/70 font-medium tracking-wider">TESTING SYSTEM</span>
                      </div>
                    </div>
                  </div>

                  {/* 移动端导航 — 分组展示 */}
                  <div className="flex flex-col gap-2 p-3 mt-2">
                    {navSections.map((section) => {
                      const sectionActive = isSectionActive(section, location.pathname);
                      const SectionIcon = section.icon;
                      return (
                        <div key={section.label} className="rounded-xl overflow-hidden"
                          style={sectionActive ? {
                            background: 'linear-gradient(135deg, rgba(0, 245, 255, 0.06) 0%, rgba(139, 92, 246, 0.03) 100%)',
                            border: '1px solid rgba(0, 245, 255, 0.1)',
                          } : { border: '1px solid transparent' }}
                        >
                          <div className="flex items-center gap-2.5 px-3 py-2.5">
                            <SectionIcon className={`w-4 h-4 ${sectionActive ? 'text-[#00F5FF]' : 'text-white/50'}`} />
                            <span className={`text-xs font-semibold tracking-wider uppercase ${
                              sectionActive ? 'text-[#00F5FF]' : 'text-white/45'
                            }`}>
                              {section.label}
                            </span>
                          </div>
                          <div className="flex flex-col gap-0.5 px-2 pb-2">
                            {section.children.map((child) => {
                              const childActive = location.pathname === child.path;
                              const ChildIcon = child.icon;
                              return (
                                <Link
                                  key={child.path}
                                  to={child.path}
                                  onClick={() => setIsOpen(false)}
                                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                                    childActive
                                      ? 'text-[#00F5FF] bg-[#00F5FF]/5'
                                      : 'text-white/70 hover:text-white hover:bg-white/5'
                                  }`}
                                >
                                  <ChildIcon className={`w-4 h-4 ${childActive ? 'text-[#00F5FF]' : 'text-white/40'}`} />
                                  <span className="flex-1">{child.label}</span>
                                  {childActive && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#00F5FF]"
                                      style={{ boxShadow: '0 0 6px rgba(0, 245, 255, 0.5)' }}
                                    />
                                  )}
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {user && (
                    <div className="px-3 mt-4 pt-4 border-t border-white/5">
                      <div className="flex items-center gap-3 px-3 py-2 mb-2">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-xs font-semibold text-white">
                          {(user.display_name ?? user.username).slice(0, 1).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white/90 truncate">{user.display_name ?? user.username}</div>
                          <div className="text-[10px] text-white/40 truncate">{user.email ?? user.username}</div>
                        </div>
                        {user.is_admin && <Shield className="w-3.5 h-3.5 text-[#FFB800]" />}
                      </div>
                      <button
                        onClick={() => { setIsOpen(false); handleLogout(); }}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-300 hover:bg-red-500/10 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        退出登录
                      </button>
                    </div>
                  )}

                  <div className="px-6 py-4 mt-4 border-t border-white/5">
                    <div className="flex items-center justify-between text-[10px] text-white/30">
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

export { allPaths as navAllPaths };
