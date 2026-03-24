import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Navbar from '@/components/Navbar';
import NeuralNetworkBackground from '@/components/NeuralNetworkBackground';
import GridOverlay from '@/components/GridOverlay';
import { AICommandCenter } from '@/features/ai-assistant';
import AINotificationToast from '@/features/ai-assistant/AINotificationToast';
import MonitorStrip from '@/components/MonitorStrip';
import ExperimentControlBar from '@/components/ExperimentControlBar';
import AIAmbientGlow from '@/components/AIAmbientGlow';
import PageLoadingSkeleton from '@/components/PageLoadingSkeleton';
import Home from '@/pages/Home';

// 路由懒加载 - 首屏只加载Home
const VirtualLab = lazy(() => import('@/pages/VirtualLab'));
const AIControl = lazy(() => import('@/pages/AIControl'));
const MultiField = lazy(() => import('@/pages/MultiField'));
const MaterialAnalysis = lazy(() => import('@/pages/MaterialAnalysis'));
const SystemMonitor = lazy(() => import('@/pages/SystemMonitor'));

function App() {
  return (
    <Router>
      <div
        className="relative min-h-screen"
        style={{ background: 'linear-gradient(135deg, #0A2540 0%, #0D1B3C 40%, #0F1A35 70%, #061728 100%)' }}
      >
        {/* 神经网络背景 */}
        <NeuralNetworkBackground />

        {/* 科技感网格叠加层 */}
        <GridOverlay />

        {/* AI环境光效果 */}
        <AIAmbientGlow />

        {/* 导航栏 */}
        <Navbar />

        {/* 主内容区 */}
        <main className="relative z-10">
          <Suspense fallback={<PageLoadingSkeleton />}>
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/lab" element={<VirtualLab />} />
                <Route path="/ai" element={<AIControl />} />
                <Route path="/multifield" element={<MultiField />} />
                <Route path="/analysis" element={<MaterialAnalysis />} />
                <Route path="/monitor" element={<SystemMonitor />} />
              </Routes>
            </AnimatePresence>
          </Suspense>
        </main>

        {/* 全局实验控制栏 */}
        <ExperimentControlBar />

        {/* 全局安全监控条 */}
        <MonitorStrip />

        {/* AI操作通知Toast */}
        <AINotificationToast />

        {/* AI中央控制系统 */}
        <AICommandCenter />
      </div>
    </Router>
  );
}

export default App;
