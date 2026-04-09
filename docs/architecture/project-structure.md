# 项目目录结构

---

## 顶层目录

```
Hopkinson-Web/
├── src/                    # 源代码（核心）
├── api/                    # Vercel Serverless Functions
├── public/                 # 静态资源
├── docs/                   # 项目文档
├── .env.example            # 环境变量模板
├── .env                    # 环境变量（不提交到 Git）
├── package.json            # 依赖配置
├── vite.config.ts          # Vite 构建配置
├── tsconfig.json           # TypeScript 配置
├── tailwind.config.js      # Tailwind CSS 主题
├── eslint.config.js        # ESLint 规则
├── components.json         # shadcn/ui 配置
├── vercel.json             # Vercel 部署配置
├── index.html              # HTML 入口
├── LICENSE                 # MIT 开源许可
├── CONTRIBUTING.md         # 贡献指南
└── CHANGELOG.md            # 更新日志
```

## 源码结构 (src/)

```
src/
├── pages/                      # 页面组件（7 个路由页面）
│   ├── Home.tsx                # /        首页概览
│   ├── VirtualLab.tsx          # /lab     虚拟实验室
│   ├── AIControl.tsx           # /ai      AI 智能控制
│   ├── MultiField.tsx          # /multifield  多场耦合
│   ├── MaterialAnalysis.tsx    # /analysis    材料力学分析
│   ├── SystemMonitor.tsx       # /monitor     系统监控
│   └── Teaching.tsx            # /teaching    教学系统
│
├── features/                   # 功能模块（业务域分离）
│   ├── ai-assistant/           # AI 智能助手
│   │   ├── components/         #   UI 组件
│   │   ├── hooks/              #   useAIOrchestrator, useVoiceInteraction 等
│   │   ├── services/           #   对话管理、意图解析、TTS、安全守护等
│   │   └── utils/              #   音效工具
│   ├── experiment-2d/          # 2D SHPB 可视化
│   │   ├── renderers/          #   Canvas 渲染器（打击杆、电容器、电磁线圈等）
│   │   └── hooks/              #   渲染循环、Canvas 尺寸
│   ├── experiment-3d/          # 3D SHPB 数字孪生
│   │   └── HopkinsonBar3D.tsx  #   Three.js 3D 场景
│   └── teaching-system/        # 教学系统
│       ├── knowledgeData.ts    #   知识图谱数据
│       ├── KnowledgeGraph.tsx  #   可视化知识图谱
│       ├── QuizPanel.tsx       #   在线测验
│       ├── LearningPaths.tsx   #   学习路径
│       └── StudyView.tsx       #   学习视图
│
├── components/                 # 共享 UI 组件
│   ├── ui/                     #   shadcn/ui 原子组件（40+）
│   │   ├── button.tsx, card.tsx, dialog.tsx ...
│   └── [业务组件]               #   实验控制、波形图、安全面板等
│       ├── Navbar.tsx          #   导航栏
│       ├── ExperimentControlBar.tsx  # 全局实验控制条
│       ├── MonitorStrip.tsx    #   全局状态监控条
│       ├── WaveformChart.tsx   #   波形图表
│       ├── AICommandCenter.tsx #   AI 控制中心面板
│       └── ...
│
├── shared/                     # 跨模块共享组件
│   └── components/
│       ├── RealtimeWaveformPanel.tsx  # 实时波形面板
│       ├── ExperimentResultCharts.tsx # 实验结果图表
│       └── ...
│
├── store/                      # Zustand 状态管理
│   ├── useAppStore.ts          # 全局应用状态
│   ├── useExperimentDataBus.ts # 跨模块数据总线
│   └── experimentWorkflow.ts   # 实验工作流状态机
│
├── services/                   # 业务逻辑与 API
│   ├── shpbPhysicsEngine.ts    # SHPB 物理仿真引擎
│   ├── optimizationEngine.ts   # AI 三级优化引擎
│   ├── llmService.ts           # LLM 多模型服务
│   ├── safetyCheck.ts          # 安全检查逻辑
│   └── exportService.ts        # 数据导出（PDF/JSON/CSV）
│
├── hooks/                      # 全局自定义 Hooks
│   ├── useExperimentAnimation.ts  # 实验动画编排
│   └── use-mobile.ts           # 移动端检测
│
├── types/                      # TypeScript 类型定义
│   └── index.ts                # Material, ExperimentParams 等全局类型
│
├── data/                       # 静态数据
│   ├── materials.json          # 30+ 材料参数数据库
│   └── waveformData.ts         # 波形采样数据
│
├── lib/                        # 工具函数
│   └── utils.ts                # cn() 等通用工具
│
├── App.tsx                     # 根组件（路由 + 全局布局）
└── main.tsx                    # React 入口
```

## 模块命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 组件文件 | PascalCase | `WaveformChart.tsx` |
| Hook 文件 | camelCase, use 前缀 | `useAppStore.ts` |
| Service 文件 | camelCase | `shpbPhysicsEngine.ts` |
| 目录 | kebab-case | `ai-assistant/`, `experiment-2d/` |
| 类型定义 | PascalCase | `Material`, `ExperimentParams` |

## 路由配置

所有页面（除 Home）使用 `React.lazy()` 懒加载 + `Suspense` 骨架屏 fallback：

```typescript
const VirtualLab = lazy(() => import('./pages/VirtualLab'));
const AIControl = lazy(() => import('./pages/AIControl'));
// ...

<Route path="/lab" element={<VirtualLab />} />
```
