# Hopkinson-Web 开发指引

> Claude Code 在此项目中的工作约定

---

## 项目概述

**数智化电磁驱动霍普金森杆多场耦合动态测试系统** — 软硬件一体化智能实验平台。

- **平台定位**：真实设备 + 真实数据 + AI 智能 + 教学/科研双用途
- **技术栈**：React 19 + TypeScript 5.9 (strict) + Vite 7
- **当前版本**：0.9.0
- **生产环境**：https://hopkinson-bar.vercel.app

## 关键文件路径

### 物理引擎与算法

- `src/services/shpbPhysicsEngine.ts` — SHPB 一维应力波 + Johnson-Cook 本构
- `src/services/optimizationEngine.ts` — LSTM + WGAN-GP + PPO 三级优化
- `src/services/llmService.ts` — 多模型 LLM 抽象层
- `src/services/safetyCheck.ts` — 安全阈值与预警
- `src/services/signalProcessing/` — 信号处理引擎（弥散校正/滤波/对齐/平衡判据）
- `src/services/constitutiveFitting.ts` — 5 种本构模型拟合（J-C / C-S / Z-A / Power Law / Bilinear）
- `src/services/reportGenerator.ts` — 4 种实验报告生成 + 多格式导出

### 状态管理（3 个 Zustand Store）

- `src/store/useAppStore.ts` — 全局应用状态
- `src/store/useExperimentDataBus.ts` — 跨模块数据总线
- `src/store/experimentWorkflow.ts` — 实验工作流状态机

### 核心模块

- `src/pages/` — 7 个路由页面（Home / VirtualLab / AIControl / MultiField / MaterialAnalysis / SystemMonitor / Teaching）
- `src/features/ai-assistant/` — AI 智能助手（包含语音、TTS、意图解析）
- `src/features/experiment-2d/` — 2D Canvas 渲染器
- `src/features/experiment-3d/` — Three.js 3D 数字孪生
- `src/features/teaching-system/` — 教学系统
- `src/data/materials.json` — 30+ 材料 J-C 参数数据库
- `src/types/index.ts` — 全局 TypeScript 类型

## 开发命令

```bash
npm run dev      # 启动开发服务器（HMR）
npm run build    # 生产构建
npm run preview  # 预览构建结果
npm run lint     # ESLint 代码检查
```

## 开发约定

### 语言与类型

- **TypeScript strict 模式**，避免 `any`，必要时用 `unknown`
- **函数组件 + Hooks**，不使用 Class 组件
- **代码注释使用中文**，物理公式必须有说明
- **JSDoc 注释**必加于公开 API

### 命名规范

| 类型 | 规范 |
|------|------|
| 组件文件 | PascalCase (`WaveformChart.tsx`) |
| Hook 文件 | camelCase, use 前缀 (`useAppStore.ts`) |
| Service 文件 | camelCase (`shpbPhysicsEngine.ts`) |
| 目录 | kebab-case (`ai-assistant/`) |

### 样式与组件

- **Tailwind CSS** 优先，避免内联 style
- **shadcn/ui + Radix UI** 作为原子组件库
- **Framer Motion** 用于页面切换与交互动画
- **ECharts** 用于所有数据可视化（应力-应变曲线、波形图等）

### 状态管理决策

- 全局共享状态 → `useAppStore`
- 跨模块数据流 → `useExperimentDataBus`
- 实验工作流 → `useExperimentWorkflow`
- 局部状态 → `useState`
- **避免使用 React Context**

### 物理计算

- 所有物理计算应通过 `shpbPhysicsEngine.ts` 的导出函数
- 不要直接 `Math.random()` 生成"实验数据"，必须基于物理模型
- J-C 模型公式：σ = (A + Bεⁿ)(1 + C·ln(ε̇/ε̇₀))(1 - T*ᵐ)

### 安全约束（硬上限）

- 电压 ≤ 4000V
- 电流 ≤ 50kA
- 储能 ≤ 36kJ
- 温度 ≤ 80°C
- EMI ≤ 95dB

任何修改物理引擎或安全检查的代码都需要保持这些上限。

## 环境变量

详见 `docs/deployment/environment-variables.md`。

必需变量：
- `VITE_LLM_PROVIDER` — LLM 提供商（zhipu / moonshot / deepseek / openai）
- `VITE_LLM_API_KEY` — API 密钥
- `VITE_LLM_MODEL` — 模型名称

可选变量：
- `VITE_VOLCANO_*` — 火山引擎 TTS（不配置则降级为 Web Speech API）

## 文档引用

修改代码时，相应文档也应更新：

- 修改物理引擎 → 更新 `docs/physics-engine/`
- 修改 AI 系统 → 更新 `docs/ai-system/`
- 修改 UI/可视化 → 更新 `docs/visualization/`
- 添加新页面 → 更新 `docs/application/user-guide.md`
- 修改环境变量 → 更新 `.env.example` 和 `docs/deployment/environment-variables.md`

## 已知事项

- `.env` 文件已被加入 `.gitignore`，不提交真实 API Key
- 历史提交中存在已泄露的 API Key（DeepSeek + 火山引擎），如需保密应轮换密钥
- `vite build` 不运行 `tsc`（避免 Vercel 部署失败），但 IDE 的 TS 检查仍生效
- 视频文件托管在阿里云 OSS，本地开发也需要联网
- 项目暂无单元测试和 CI 流程

## 文档导航

- 顶层 README → `README.md`
- 贡献指南 → `CONTRIBUTING.md`
- 更新日志 → `CHANGELOG.md`
- 完整文档 → `docs/README.md`
