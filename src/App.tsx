import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Lenis from 'lenis';
import Navbar from '@/components/Navbar';
import NeuralNetworkBackground from '@/components/NeuralNetworkBackground';
import GridOverlay from '@/components/GridOverlay';
import { AICommandCenter } from '@/features/ai-assistant';
import AINotificationToast from '@/features/ai-assistant/AINotificationToast';
import AISuggestionBar from '@/features/ai-assistant/AISuggestionBar';
import MonitorStrip from '@/components/MonitorStrip';
import ExperimentControlBar from '@/components/ExperimentControlBar';
import AIAmbientGlow from '@/components/AIAmbientGlow';
import PageLoadingSkeleton from '@/components/PageLoadingSkeleton';
import ProtectedRoute from '@/components/ProtectedRoute';
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import Register from '@/pages/Register';

// 路由懒加载 - 首屏只加载Home
const VirtualLab = lazy(() => import('@/pages/VirtualLab'));
const MaterialAnalysis = lazy(() => import('@/pages/MaterialAnalysis'));
const SystemMonitor = lazy(() => import('@/pages/SystemMonitor'));
const Teaching = lazy(() => import('@/pages/Teaching'));
const MultiField = lazy(() => import('@/pages/MultiField'));
const AIControl = lazy(() => import('@/pages/AIControl'));

/** 不渲染主壳的路由(独立全屏页面) */
const BARE_ROUTES = new Set(['/login', '/register']);

function AppShell() {
  const location = useLocation();
  const isBare = BARE_ROUTES.has(location.pathname);

  // Lenis 平滑滚动 — 全站惯性滚轮(登录/注册裸页面不启用)
  useEffect(() => {
    if (isBare) return;
    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, [isBare]);

  // 登录/注册: 全屏裸页面,不挂 Navbar / MonitorStrip / AI 助手
  if (isBare) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    );
  }

  return (
    <div
      className="relative min-h-screen"
      style={{ background: 'linear-gradient(135deg, #0A2540 0%, #0D1B3C 40%, #0F1A35 70%, #061728 100%)' }}
    >
      <NeuralNetworkBackground />
      <GridOverlay />
      <AIAmbientGlow />
      <Navbar />

      <main className="relative z-10">
        <Suspense fallback={<PageLoadingSkeleton />}>
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
              <Route path="/lab" element={<ProtectedRoute><VirtualLab /></ProtectedRoute>} />
              <Route path="/analysis" element={<ProtectedRoute><MaterialAnalysis /></ProtectedRoute>} />
              <Route path="/monitor" element={<ProtectedRoute><SystemMonitor /></ProtectedRoute>} />
              <Route path="/teaching" element={<ProtectedRoute><Teaching /></ProtectedRoute>} />
              <Route path="/multifield" element={<ProtectedRoute><MultiField /></ProtectedRoute>} />
              <Route path="/ai-control" element={<ProtectedRoute><AIControl /></ProtectedRoute>} />
            </Routes>
          </AnimatePresence>
        </Suspense>
      </main>

      <ExperimentControlBar />
      <MonitorStrip />
      <AINotificationToast />
      <AISuggestionBar />
      <AICommandCenter />
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}

export default App;
