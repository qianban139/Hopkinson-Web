// src/components/WorkflowProgressBar.tsx
// 导航栏下方实验流程指示器
import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Beaker, BarChart3, Check, ChevronRight } from 'lucide-react';
import { useExperimentDataBus } from '@/store/useExperimentDataBus';

type StepStatus = 'completed' | 'current' | 'pending';

interface WorkflowStep {
  id: string;
  label: string;
  path: string;
  icon: React.ElementType;
  color: string;
}

const STEPS: WorkflowStep[] = [
  { id: 'monitor', label: '安全检查', path: '/monitor', icon: Shield, color: '#10B981' },
  { id: 'lab', label: '虚拟实验', path: '/lab', icon: Beaker, color: '#00F5FF' },
  { id: 'analysis', label: '材料分析', path: '/analysis', icon: BarChart3, color: '#F472B6' },
];

export default function WorkflowProgressBar() {
  const location = useLocation();
  const safetyCompleted = useExperimentDataBus(s => s.safetyChecklistCompleted);
  const hasLabData = useExperimentDataBus(s => s.lastLabExperiment !== null);
  const stepStatuses = useMemo((): Record<string, StepStatus> => {
    const pageMap: Record<string, string> = {
      '/monitor': 'monitor', '/lab': 'lab', '/analysis': 'analysis',
    };
    const currentPage = pageMap[location.pathname] || '';

    const statuses: Record<string, StepStatus> = {};
    for (const step of STEPS) {
      if (step.id === currentPage) {
        statuses[step.id] = 'current';
      } else if (
        (step.id === 'monitor' && safetyCompleted) ||
        (step.id === 'lab' && hasLabData)
      ) {
        statuses[step.id] = 'completed';
      } else {
        statuses[step.id] = 'pending';
      }
    }
    return statuses;
  }, [location.pathname, safetyCompleted, hasLabData]);

  // Don't show on home page
  if (location.pathname === '/') return null;

  return (
    <div className="h-8 bg-[#051020]/80 backdrop-blur-sm border-b border-[#00F5FF]/10 flex items-center justify-center gap-0.5 px-4">
      {STEPS.map((step, idx) => {
        const status = stepStatuses[step.id];
        const Icon = step.icon;

        return (
          <div key={step.id} className="flex items-center">
            <Link
              to={step.path}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-200 ${
                status === 'current'
                  ? 'bg-[#00F5FF]/10 text-[#00F5FF]'
                  : status === 'completed'
                    ? 'text-white/60 hover:text-white/80'
                    : 'text-white/30 hover:text-white/50'
              }`}
            >
              {status === 'completed' ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${step.color}25` }}
                >
                  <Check className="w-2.5 h-2.5" style={{ color: step.color }} />
                </motion.div>
              ) : status === 'current' ? (
                <motion.div
                  animate={{ boxShadow: [`0 0 0px ${step.color}00`, `0 0 8px ${step.color}60`, `0 0 0px ${step.color}00`] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${step.color}20`, border: `1px solid ${step.color}60` }}
                >
                  <Icon className="w-2.5 h-2.5" style={{ color: step.color }} />
                </motion.div>
              ) : (
                <div className="w-4 h-4 rounded-full flex items-center justify-center bg-white/5 border border-white/10">
                  <Icon className="w-2.5 h-2.5 text-white/30" />
                </div>
              )}
              <span className="hidden xl:inline">{step.label}</span>
            </Link>

            {/* Arrow connector */}
            {idx < STEPS.length - 1 && (
              <ChevronRight
                className="w-3 h-3 mx-0.5 flex-shrink-0"
                style={{
                  color: stepStatuses[STEPS[idx + 1].id] === 'completed' || stepStatuses[step.id] === 'completed'
                    ? `${step.color}50`
                    : 'rgba(255,255,255,0.1)',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
