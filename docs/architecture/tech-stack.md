# 技术栈详解

---

## 核心框架

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.2.0 | UI 框架，函数组件 + Hooks |
| TypeScript | 5.9.3 | 类型安全，strict 模式 |
| Vite | 7.2.4 | 构建工具，ESM 原生支持，极速 HMR |
| React Router | 7.13.1 | 客户端路由，7 个页面懒加载 |

## 状态管理

| 技术 | 版本 | 用途 |
|------|------|------|
| Zustand | 5.0.11 | 轻量状态管理，3 个分布式 Store |

三个 Store 分工：
- `useAppStore` — 全局应用状态（材料、参数、AI、监控）
- `useExperimentDataBus` — 跨模块数据总线（实验结果流转）
- `useExperimentWorkflow` — 实验工作流状态机（AI 引导流程）

## 3D 渲染

| 技术 | 版本 | 用途 |
|------|------|------|
| Three.js | 0.183.2 | WebGL 3D 渲染引擎 |
| React Three Fiber | 9.5.0 | React 声明式 Three.js 封装 |
| Drei | 10.7.7 | R3F 常用 Helper（轨道控制、光照等） |

## 数据可视化

| 技术 | 版本 | 用途 |
|------|------|------|
| ECharts | 6.0.0 | 科研级图表（应力-应变曲线、雷达图等） |
| echarts-for-react | 3.0.6 | ECharts React 封装 |
| Recharts | 2.15.4 | 辅助图表（趋势图、面积图） |

## UI 组件与样式

| 技术 | 版本 | 用途 |
|------|------|------|
| Tailwind CSS | 3.4.19 | 原子化 CSS 框架 |
| shadcn/ui | - | 40+ 可定制组件（基于 Radix UI） |
| Radix UI | - | 无头 UI 原语（Dialog、Select、Tabs 等） |
| Lucide React | 0.562.0 | 图标库 |
| Framer Motion | 12.35.2 | 页面切换与交互动画 |
| tailwindcss-animate | 1.0.7 | CSS 动画插件 |

## 表单与验证

| 技术 | 版本 | 用途 |
|------|------|------|
| React Hook Form | 7.70.0 | 高性能表单管理 |
| Zod | 4.3.5 | 运行时类型验证 |

## 数学公式渲染

| 技术 | 版本 | 用途 |
|------|------|------|
| KaTeX | 0.16.38 | LaTeX 数学公式渲染 |
| react-katex | 3.1.0 | KaTeX React 组件 |
| React Markdown | 10.1.0 | Markdown 渲染（AI 对话消息） |
| remark-math + rehype-katex | - | Markdown 中嵌入数学公式 |

## AI 与语音

| 技术 | 说明 |
|------|------|
| DeepSeek / 智谱 / Moonshot / OpenAI | 多 LLM 提供商支持 |
| 火山引擎 TTS | 大模型语音合成（ByteDance） |
| Picovoice Porcupine | 浏览器端唤醒词检测 |
| Web Speech API | 浏览器原生语音识别（降级方案） |

## 开发工具

| 技术 | 版本 | 用途 |
|------|------|------|
| ESLint | 9.39.1 | 代码规范检查 |
| PostCSS | 8.5.6 | CSS 后处理 |
| Autoprefixer | 10.4.23 | CSS 浏览器前缀自动添加 |

## 部署

| 技术 | 说明 |
|------|------|
| Vercel | 生产环境托管 + 自动部署 |
| 阿里云 OSS | 视频资源 CDN 托管 |

## 依赖关系图

```
React 19
  ├── React Router 7 (路由)
  ├── Zustand 5 (状态)
  ├── React Three Fiber 9 (3D)
  │     └── Three.js 0.183
  ├── ECharts 6 (图表)
  ├── Framer Motion 12 (动画)
  ├── shadcn/ui (组件)
  │     ├── Radix UI (无头原语)
  │     └── Tailwind CSS 3 (样式)
  ├── React Markdown (AI消息)
  │     ├── remark-math
  │     └── rehype-katex → KaTeX
  └── React Hook Form + Zod (表单)
```
