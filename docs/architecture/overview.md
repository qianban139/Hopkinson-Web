# 系统架构总览

> 四层架构设计：物理层 → 数字孪生层 → AI 控制层 → 数据分析层

---

## 一、架构设计理念

本平台采用**四层分离架构**，每一层独立职责、松耦合交互，实现从真实物理实验到智能分析的全链路覆盖。

```
┌─────────────────────────────────────────────────────────┐
│                   数据分析层 (L4)                        │
│     材料力学分析 · 本构拟合 · 报告生成 · 数据导出         │
├─────────────────────────────────────────────────────────┤
│                   AI 控制层 (L3)                         │
│   LSTM预测 · WGAN-GP增强 · PPO优化 · AI对话助手          │
├─────────────────────────────────────────────────────────┤
│                  数字孪生层 (L2)                         │
│  3D场景渲染 · 2D示意图 · 实时波形 · 实验动画 · 教学系统   │
├─────────────────────────────────────────────────────────┤
│                   物理层 (L1)                            │
│  SHPB物理引擎 · Johnson-Cook模型 · 材料数据库 · 安全系统  │
└─────────────────────────────────────────────────────────┘
```

## 二、模块关系图

```
                    ┌──────────┐
                    │   Home   │
                    │  首页概览  │
                    └────┬─────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   ┌────▼────┐    ┌──────▼──────┐   ┌─────▼─────┐
   │VirtualLab│    │  AIControl  │   │ MultiField │
   │ 虚拟实验室 │    │  AI智能控制  │   │  多场耦合   │
   └────┬─────┘    └──────┬──────┘   └─────┬──────┘
        │                │                │
        └────────┬───────┘                │
                 │                        │
          ┌──────▼──────┐                 │
          │  DataBus    │◄────────────────┘
          │  数据总线    │
          └──────┬──────┘
                 │
        ┌────────┼────────┐
        │                 │
   ┌────▼─────┐    ┌──────▼──────┐
   │ Material │    │   System    │
   │ Analysis │    │   Monitor   │
   │ 材料分析  │    │  系统监控    │
   └──────────┘    └─────────────┘
```

## 三、各层详解

### L1 物理层

物理层是整个系统的计算基础，提供科学精确的 SHPB 实验仿真能力。

| 模块 | 源文件 | 职责 |
|------|--------|------|
| SHPB 物理引擎 | `src/services/shpbPhysicsEngine.ts` | 一维应力波计算、电磁驱动仿真 |
| 材料数据库 | `src/data/materials.json` | 30+ 材料的 J-C 参数与物理属性 |
| 安全检查 | `src/services/safetyCheck.ts` | 参数阈值验证与分级预警 |
| 类型系统 | `src/types/index.ts` | 全局 TypeScript 类型定义 |

### L2 数字孪生层

数字孪生层将物理层的计算结果转化为直观的视觉呈现。

| 模块 | 源文件 | 职责 |
|------|--------|------|
| 3D 数字孪生 | `src/features/experiment-3d/` | Three.js 实验装置 3D 渲染 |
| 2D 示意图 | `src/features/experiment-2d/` | Canvas 精细 2D 组件渲染 |
| 教学系统 | `src/features/teaching-system/` | 知识图谱、学习路径、在线测验 |
| 实验动画 | `src/hooks/useExperimentAnimation.ts` | 实验过程动画编排 |

### L3 AI 控制层

AI 控制层为实验全流程提供智能辅助。

| 模块 | 源文件 | 职责 |
|------|--------|------|
| 优化引擎 | `src/services/optimizationEngine.ts` | LSTM → WGAN-GP → PPO 三级优化 |
| LLM 服务 | `src/services/llmService.ts` | 多模型 LLM 对话服务 |
| AI 助手 | `src/features/ai-assistant/` | 意图解析、语音交互、对话管理 |
| 实验工作流 | `src/store/experimentWorkflow.ts` | AI 引导实验状态机 |

### L4 数据分析层

数据分析层将实验结果转化为科学结论。

| 模块 | 源文件 | 职责 |
|------|--------|------|
| 材料力学分析 | `src/pages/MaterialAnalysis.tsx` | 应力-应变分析、本构拟合 |
| 数据导出 | `src/services/exportService.ts` | PDF/JSON/CSV 格式导出 |
| 数据可视化 | `src/shared/components/` | ECharts 图表组件 |

## 四、数据流架构

系统采用 **Zustand 分布式 Store + 数据总线** 模式管理状态：

```
用户操作
  │
  ├──► useAppStore (全局状态)
  │     ├── selectedMaterial     ──► 物理引擎计算
  │     ├── experimentParams     ──► 实验参数配置
  │     ├── monitorData          ──► 系统监控数据
  │     └── aiState              ──► AI 优化状态
  │
  ├──► useExperimentDataBus (跨模块数据)
  │     ├── lastLabExperiment    ──► 实验结果流转
  │     ├── lastMultiFieldExperiment ──► 耦合结果流转
  │     ├── aiOptimizedParams    ──► AI 优化参数
  │     ├── safetyChecklist      ──► 安全检查状态
  │     └── dataFlowLog          ──► 数据流日志
  │
  └──► useExperimentWorkflow (实验工作流)
        ├── phase                ──► 工作流阶段
        ├── requirements         ──► 实验需求
        ├── executionSteps       ──► 执行步骤
        └── liveParameters       ──► 实时参数
```

## 五、技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 前端框架 | React 19 | 生态最完善，Three.js/ECharts 集成成熟 |
| 类型系统 | TypeScript strict | 科研平台对数据准确性要求高 |
| 状态管理 | Zustand | 轻量、TypeScript 友好、分布式 Store |
| 构建工具 | Vite 7 | 极速 HMR、ESM 原生支持 |
| 3D 渲染 | React Three Fiber | React 声明式 3D 开发 |
| 数据可视化 | ECharts | 科研级图表支持（应力-应变曲线等） |
| UI 组件 | shadcn/ui + Radix | 无样式冲突、完全可定制 |
| 样式方案 | Tailwind CSS | 原子化 CSS、与 shadcn/ui 天然配合 |
