# 文档中心

> 数智化电磁驱动霍普金森杆多场耦合动态测试系统 — 技术文档

---

## 文档导航

### 系统架构

| 文档 | 说明 |
|------|------|
| [系统架构总览](architecture/overview.md) | 四层系统架构设计与模块关系 |
| [技术栈详解](architecture/tech-stack.md) | 框架选型与依赖说明 |
| [项目目录结构](architecture/project-structure.md) | 源码组织与模块划分 |
| [状态管理设计](architecture/state-management.md) | Zustand Store 设计与数据流 |

### 物理仿真引擎

| 文档 | 说明 |
|------|------|
| [SHPB 原理与应力波理论](physics-engine/shpb-theory.md) | 分离式霍普金森压杆实验原理 |
| [Johnson-Cook 本构模型](physics-engine/johnson-cook-model.md) | J-C 模型实现与参数含义 |
| [材料参数数据库](physics-engine/material-database.md) | 30+ 材料的 J-C 参数与力学属性 |
| [仿真流程](physics-engine/simulation-pipeline.md) | 端到端实验仿真计算流程 |

### AI 智能系统

| 文档 | 说明 |
|------|------|
| [AI 子系统总览](ai-system/ai-overview.md) | AI 架构、模块关系与能力矩阵 |
| [三级优化引擎](ai-system/optimization-engine.md) | LSTM + WGAN-GP + PPO 管线 |
| [多模型 LLM 服务](ai-system/llm-integration.md) | 多 LLM 提供商抽象层 |
| [AI 对话助手](ai-system/ai-assistant.md) | 意图解析、动作注册、对话管理 |
| [语音交互管线](ai-system/voice-interaction.md) | 唤醒词、语音识别、TTS 合成 |
| [安全检查系统](ai-system/safety-guardian.md) | 安全阈值、分级预警、紧急停止 |
| [AI 自主实验](ai-system/autonomous-experiment.md) | 全流程自主规划、执行、分析、报告 |

### 数据可视化

| 文档 | 说明 |
|------|------|
| [3D 数字孪生](visualization/3d-digital-twin.md) | Three.js 3D 场景与交互 |
| [2D 示意图渲染](visualization/2d-schematic.md) | Canvas 2D 组件渲染系统 |
| [数据图表系统](visualization/data-charts.md) | ECharts 实验数据可视化 |

### 应用与实践

| 文档 | 说明 |
|------|------|
| [用户操作指南](application/user-guide.md) | 平台功能介绍与操作流程 |
| [实验工作流](application/experiment-workflow.md) | 完整实验执行流程详解 |
| [教学系统指南](application/teaching-system.md) | 知识图谱、学习路径、在线测验 |
| [应用场景](application/use-cases.md) | 五大行业应用案例 |
| [多场耦合实验](application/multifield-coupling.md) | 热-力-电磁耦合实验指南 |

### 部署与开发

| 文档 | 说明 |
|------|------|
| [开发环境搭建](deployment/setup.md) | 本地开发环境配置 |
| [环境变量参考](deployment/environment-variables.md) | 所有环境变量说明 |
| [Vercel 部署指南](deployment/vercel-deployment.md) | 生产环境部署流程 |

---

## 快速链接

- [项目 README](../README.md)
- [贡献指南](../CONTRIBUTING.md)
- [更新日志](../CHANGELOG.md)
- [开源许可证](../LICENSE)
