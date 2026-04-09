# 更新日志

本项目的所有重要变更将记录在此文件中。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [1.0.0] - 2026-04-09

### 新增（RAG 知识增强 + 知识图谱 · Phase 5）

- **RAG 文献检索子系统** (`src/services/rag/`)
  - `types.ts` — 文献、嵌入文档、检索结果、引用、实验记忆类型定义
  - `embedding.ts` — 中文分词 + TF-IDF 向量化 + 余弦相似度
  - `vectorStore.ts` — 内存向量数据库，支持 top-K 检索
  - `retrievalEngine.ts` — 检索 → 引用构建 → LLM 提示上下文生成
  - `experimentMemory.ts` — 跨实验记忆持久化（localStorage），相似实验召回
- **文献语料库** (`src/data/literature.ts`)
  - 28 篇精选 SHPB 与材料动态力学领域文献
  - 覆盖 6 大类：SHPB 理论 / 本构模型 / 材料科学 / 信号处理 / 实验方法 / 数值仿真
- **AI 助手 RAG 模式集成**
  - `useAIOrchestrator` 在 LLM 调用前自动检索相关文献，注入增强上下文
  - LLM 回复后自动提取 `[1][2]` 引用编号，展示引用文献卡片
  - 无 LLM 配置时，RAG 结果作为补充附在本地知识库回答后
  - 📚 RAG 模式切换按钮（默认开启）
- **文献知识图谱** (`LiteratureKnowledgeGraph.tsx`)
  - Canvas 力导向布局，展示主题 → 文献 → 材料的关联网络
  - 节点可拖拽，悬停显示文献详情，点击跳转详情视图
  - 6 色分类图例 + 材料节点标注
- **文献库浏览面板** (`LiteraturePanel.tsx`)
  - 侧边滑出面板，分类浏览 / 关键词搜索 / 文献详情
  - 列表视图与知识图谱视图双模切换
  - 「引用到对话」一键注入 AI 对话
  - AICommandCenter 头部新增 📖 文献库按钮

### 变更

- `package.json` 版本号 0.9.0 → 1.0.0（首个功能完整里程碑）
- `CLAUDE.md` 版本号同步更新

---

## [0.9.0] - 2026-04-09

### 新增（信号处理 + 本构拟合 + 报告生成 · Phase 4）

- **信号处理引擎** (`src/services/signalProcessing/`)
  - `types.ts` — 共享类型（WaveformData / ThreeWaveDataset / PipelineStep / ProcessingResult）
  - `dispersionCorrection.ts` — Pochhammer-Chree 简化频散校正（DFT 相位修正）
  - `filters.ts` — 移动平均 / 一阶 IIR 双向低通 / 带通 / Haar 小波降噪
  - `baselineCorrection.ts` — 静态零点校正 + 多项式基线扣除（最小二乘 + 高斯消元）
  - `waveAlignment.ts` — 互相关精修的三波时间对齐
  - `strainRateCompensation.ts` — 主加载段应变率向均值收敛
  - `stressEquilibrium.ts` — `R = |σ₁-σ₂|/max(σ₁,σ₂)` 评级（excellent/good/acceptable/poor）
  - `index.ts` — `ALGORITHM_REGISTRY` + `executeStep()` + `runPipeline()` 链式管线 API

- **多本构模型拟合引擎** (`src/services/constitutiveFitting.ts`)
  - 5 种模型：Johnson-Cook、Cowper-Symonds、Zerilli-Armstrong、Power Law、Bilinear
  - 简化非线性最小二乘（坐标下降 + 自适应步长）
  - Power Law 通过对数线性化解析拟合
  - Bilinear 用前 30% 数据估弹性模量、后段拟合切线模量
  - 统一返回 R² / RMSE / 残差序列 / 迭代次数

- **报告生成器** (`src/services/reportGenerator.ts`)
  - 4 种报告类型：学习总结(1-2 页) / 实验记录(3-5 页) / 研究报告(8-15 页) / 完整论文(20+ 页)
  - 4 种导出格式：Markdown / HTML / LaTeX (中文支持) / JSON
  - 章节按报告类型逐级丰富：实验目的 → 装置 → 原理 → 结果 → 讨论 → 结论 → 参考文献
  - HTML 导出 + 浏览器打印对话框 → 用户可保存为 PDF

- **MaterialAnalysis Tab 2 重写** (`src/features/material-analysis/SignalProcessingPanel.tsx`)
  - 顶部状态栏：采样率 / 活动管线步数 / 应力平衡评级
  - 左侧算法库：8 种算法卡片可点击添加
  - 右侧管线编辑器：撤销/重做/清空/执行 + 每步参数滑块 + 启用切换
  - 波形对比图：原始 vs 处理后叠加显示，可切换入射/反射/透射通道
  - 执行日志：每步算法耗时 (ms)

- **MaterialAnalysis Tab 3 增强** (`src/features/material-analysis/ConstitutiveFittingPanel.tsx`)
  - 5 种本构模型选择卡片
  - 一键拟合 + R² / RMSE / 迭代次数指标卡
  - 拟合参数表 + 公式渲染
  - 实验数据 vs 拟合曲线叠加图（散点 + 折线）
  - 残差柱状图（正负残差红绿区分）

- **MaterialAnalysis Tab 5 重写** (`src/features/material-analysis/ReportGenerationPanel.tsx`)
  - 4 种报告类型选择 + 实时预览（左侧）
  - 元信息卡片：标题/作者/日期/章节数
  - 5 种导出按钮：Markdown / HTML / LaTeX / JSON / 打印 PDF
  - 切换报告类型即时更新预览内容

### 变更

- `MaterialAnalysis.tsx` Tab 2/3/5 占位符全部移除，接入新组件
- `package.json` 版本号 0.8.0 → 0.9.0
- `CLAUDE.md` 关键文件路径补充信号处理 / 本构拟合 / 报告生成模块

---

## [0.8.0] - 2026-04-08

### 新增（后端服务 + 设备接口 · Phase 3）

- **Python FastAPI 后端服务** (`hopkinson-backend/`)
  - `main.py` — 入口，CORS 中间件，健康检查 `/api/health`
  - `api/devices.py` — 设备管理 REST API（列表、详情、健康检查）
  - `api/experiments.py` — 实验生命周期 REST API（创建、启动、暂停、紧急停机、结果查询）
  - `ws/monitor.py` — 实时监控 WebSocket（每 100ms 推送电压/电流/电容/温度/EMI）
  - `ws/experiment.py` — 实验执行 WebSocket（阶段进度 + 三波波形流）
  - `hardware/base.py` — 硬件驱动抽象基类
  - `hardware/mock_daq.py` — 模拟 DAQ 数据采集卡（基于物理的伪数据生成）
  - `hardware/mock_em_driver.py` — 模拟电磁驱动器
  - `hardware/safety_controller.py` — 安全阈值守护（实施 5 大硬上限）
  - `state.py` — 进程内设备注册表 + 实验存储
  - `requirements.txt` / `README.md`

- **前端 API 客户端层** (`src/services/api/`)
  - `config.ts` — 后端 URL 配置（`VITE_BACKEND_URL` 环境变量）
  - `types.ts` — 共享类型定义（设备、实验、WS 消息联合类型）
  - `deviceClient.ts` — 设备 REST 客户端
  - `experimentClient.ts` — 实验 REST 客户端
  - `monitorWebSocket.ts` — 监控 WS 客户端（指数退避重连 + 指标订阅）
  - `experimentWebSocket.ts` — 实验 WS 客户端（双向控制命令）

- **连接状态管理** (`src/store/useConnectionStore.ts`)
  - Zustand Store 管理后端连接状态、实验室模式（sim/connected）、设备列表
- **连接管理 Hook** (`src/hooks/useBackendConnection.ts`)
  - 一键 connect/disconnect，自动将 WS 监控数据注入 `useAppStore.monitorData`

- **系统监控页后端连接**（`SystemMonitor.tsx`）
  - 顶部控制栏新增「连接后端」按钮（显示连接状态 + 版本号）
  - 后端连接时切换为真实 WS 数据源，停止本地模拟
  - 设备状态矩阵融合后端真实设备列表

- **虚拟实验室双模式**（`VirtualLab.tsx`）
  - 顶部新增「仿真模式 ⚡ / 连接模式 🔌」Tab 切换器
  - 连接模式自动发起后端连接，显示实时状态指示器
  - 切换到连接模式时自动尝试连接后端，失败则阻止切换

### 变更

- `SystemMonitor.tsx` 导入 `useConnectionStore` + `useBackendConnection`
- `VirtualLab.tsx` 导入 `useConnectionStore` + `useBackendConnection`

---

## [0.7.0] - 2026-04-08

### 新增（AI 助手 2.0 · Phase 2）

- **Agent 多角色协作架构** (`src/features/ai-assistant/agent/`)
  - `agentOrchestrator.ts` 主控编排器：路由 + 多步推理 + 工具调用循环
  - `toolRegistry.ts` 统一工具注册表：按角色白名单 + 4 级风险等级（safe/low/medium/high）
  - `agents.ts` 5 个专业 Agent 角色定义：
    - 🔬 **材料科学家·小研** — Johnson-Cook 本构分析、AI 预测
    - ⚙️ **实验工程师·小工** — 设备操作、参数配置、实验执行
    - 🛡️ **安全员·小卫** — 安全检查、阈值监控、紧急停机
    - 🎓 **教学助理·小师** — 原理讲解、引导教学
    - 📊 **研究员·小博** — 报告生成、对比分析、数据导出
- **跨页面 AI 建议条** (`AISuggestionBar.tsx`)
  - 在所有页面右上角浮动展示上下文相关建议
  - 优先级（高/中/低）三种视觉风格，紧急建议红色高亮
  - 一键执行 + 5 分钟内忽略机制
  - 通过 `ai-suggestion-trigger` 自定义事件与 AI 命令中心联动
- **Agent 推理链可视化** (`AIReasoningChain.tsx`)
  - 时间线形式展示 Agent 5 阶段思考：分析 → 规划 → 工具调用 → 观察 → 结论
  - 每步带阶段图标、时间戳、工具调用参数详情
  - 自动按 Agent 角色高亮主题色
- **AI 助手「深度模式」开关**（AICommandCenter）
  - 输入框旁新增大脑图标按钮，开启后走 Agent 多步推理
  - 处理中显示 "🤖 Agent 推理中..." 提示
  - 推理链直接渲染在对话流中

### 变更

- `useAIOrchestrator` 增加 `useAgentMode` 选项和 `lastThoughts` / `lastAgentRole` 状态
- `aiIntentParser` 中 `/ai` 和 `/multifield` 导航意图重定向到 `/lab`
- `proactiveAssistant` 移除 `/ai` 和 `/multifield` 相关建议，AI 优化建议归属 `/lab`
- `AICommandCenter` 上下文快捷指令移除 `ai` / `multifield` 项，整合到 `lab`

---

## [0.6.0] - 2026-04-08

### 变更（页面整合 · Phase 1）

- **移除 `/ai` 路由**：AI 三级优化（LSTM → WGAN-GP → PPO）整合到虚拟实验室
  - 虚拟实验室新增「AI 三级优化」按钮 + 优化进度 Modal
  - 优化完成后可一键应用推荐参数
- **移除 `/multifield` 路由**：多场耦合参数整合到虚拟实验室
  - 虚拟实验室新增「多场耦合」开关面板（温度场 / 围压 / 电磁场）
  - 围压控制在多场耦合模式下成为子项，独立模式保持原样
- **Navbar 精简**：从 7 个导航项减为 5 个（首页 / 虚拟实验室 / 材料分析 / 系统监控 / 教学系统）
- **MaterialAnalysis 页面重构为 5 Tab 架构**：
  - Tab 1「原始数据」：应力-应变曲线、材料基本参数、数据导出
  - Tab 2「信号处理」：6 种信号处理算法工具箱（框架，Phase 4 实现）
  - Tab 3「参数拟合」：AI 预测、J-C 本构参数、雷达图、微观变形机制
  - Tab 4「对比分析」：多材料曲线叠加、参数对比表
  - Tab 5「报告生成」：4 种报告类型选择、多格式导出
- **工作流进度条精简**：从 5 步减为 3 步（安全检查 → 虚拟实验 → 材料分析）
- **数据总线可视化简化**：移除 AI 优化和多场耦合节点
- **AI 助手指令重定向**：原 `/ai` 和 `/multifield` 相关指令自动重定向到 `/lab`

---

## [0.5.0] - 2026-04-08

### 新增

- 完整的项目文档体系（`docs/` 目录，22 个技术文档）
  - 系统架构、技术栈、项目结构、状态管理设计
  - SHPB 物理引擎、Johnson-Cook 模型、材料数据库、仿真流程
  - AI 子系统总览、优化引擎、LLM 集成、对话助手、语音交互、安全守护
  - 3D 数字孪生、2D 示意图、数据图表系统
  - 用户操作指南、实验工作流、教学系统、应用场景、多场耦合
  - 开发环境搭建、环境变量、Vercel 部署
- `.env.example` 环境变量配置模板
- `LICENSE` MIT 开源许可证
- `CONTRIBUTING.md` 贡献指南（代码规范、提交规范、PR 流程）
- `CHANGELOG.md` 更新日志

### 变更

- 重写 `README.md`，从 Vite 默认模板替换为完整的项目说明
- `package.json` 项目名从 `my-app` 改为 `hopkinson-web`
- 项目版本号更新为 `0.5.0`
- `.gitignore` 移除 `docs/` 排除规则，文档纳入版本管理

---

## [0.4.0] - 2026-04-07

### 新增

- 虚拟实验室添加 "3D 实验" 视图（基于视频的伪 3D 渲染）
- 视频资源迁移至阿里云 OSS，提升加载速度

### 修复

- OSS 视频元素添加 `crossOrigin` 属性解决 CORS 问题
- 修复 Vercel 部署相关的多个构建失败问题
- 移除 Git LFS 配置避免部署冲突

---

## [0.3.0] - 2026-03-28

### 新增

- AI 教学系统模块
  - 知识图谱可视化
  - 学习路径（入门/进阶/高级）
  - 在线测验功能
- AI 助手 P2/P3 升级
- 3D 数字孪生场景
- 2D 视图增强
- 实验结果分析面板（全屏贴合、可折叠）

---

## [0.2.0] - 2026-03-26

### 新增

- 全新 Hero 区域设计
- 现代化耦合关系图
- 实验室主题配色

### 变更

- 统一 Hero 标题样式
- AI 预测按钮渐变色优化
- CTA 按钮改为简约描边胶囊样式
- 调整 hero 标题行高与间距

---

## [0.1.5] - 2026-03-25

### 新增

- AI 助手引导式实验设置流程
- 5 步引导：material → testType → strainRate → specialConditions → confirm

### 修复

- 语音输入系统重大重构
  - 使用 ref 避免闭包陷阱
  - 累积文本后再发送，避免中断
  - 添加重试与延迟机制
- AI 面板拖拽位置切换为 left/top 定位
- 修复侧边栏空白与 2D 模型缩放问题
- 修复材料 Tab 展开与紧凑布局
- 重新设计材料信息 Tab，统一风格
- 2D 模型居中放大优化
- 「开始实验」按钮高亮强化（绿色背景 + 发光阴影）
- 移除 3D 视图待机提示覆盖层

---

## [0.1.0] - 2026-03-24

### 新增

- 初始版本发布
- 5 大核心模块
  - 虚拟实验室（VirtualLab）
  - AI 智能控制（AIControl）
  - 多场耦合（MultiField）
  - 材料力学分析（MaterialAnalysis）
  - 系统监控（SystemMonitor）
- SHPB 物理仿真引擎（基于 Johnson-Cook 本构）
- 三级 AI 优化引擎（LSTM + WGAN-GP + PPO）
- 30+ 材料数据库（7 大类）
- AI 助手「小智」基础对话功能
- 多 LLM 提供商支持（DeepSeek / 智谱 / Moonshot / OpenAI）
- 火山引擎 TTS 集成
- 华丽的 UI 背景（粒子、星云、扫描线、能量波纹）
- 胶囊药丸式导航栏
- Vercel 部署上线

### 修复

- 移除 `tsc` 严格类型检查避免 Vercel 构建失败
- KaTeX 导入顺序调整
- `isSpeaking` 变量声明顺序问题

---

[1.0.0]: https://github.com/qianban139/Hopkinson-Web/releases/tag/v1.0.0
[0.9.0]: https://github.com/qianban139/Hopkinson-Web/releases/tag/v0.9.0
[0.8.0]: https://github.com/qianban139/Hopkinson-Web/releases/tag/v0.8.0
[0.7.0]: https://github.com/qianban139/Hopkinson-Web/releases/tag/v0.7.0
[0.6.0]: https://github.com/qianban139/Hopkinson-Web/releases/tag/v0.6.0
[0.5.0]: https://github.com/qianban139/Hopkinson-Web/releases/tag/v0.5.0
[0.4.0]: https://github.com/qianban139/Hopkinson-Web/releases/tag/v0.4.0
[0.3.0]: https://github.com/qianban139/Hopkinson-Web/releases/tag/v0.3.0
[0.2.0]: https://github.com/qianban139/Hopkinson-Web/releases/tag/v0.2.0
[0.1.5]: https://github.com/qianban139/Hopkinson-Web/releases/tag/v0.1.5
[0.1.0]: https://github.com/qianban139/Hopkinson-Web/releases/tag/v0.1.0
