# AI 自主实验系统

> 让 AI 代替用户完成「规划 → 审批 → 执行 → 分析 → 报告」全流程的动态力学实验

---

## 1. 设计目标

传统虚拟实验需要用户手动：选材料、调参数、点启动、等结果、重复、再对比。AI 自主实验将这一循环交给 AI：用户只需给出**研究目标**（自然语言），系统自动拆解为多组实验、顺序执行、期间分析、最终生成结构化报告。

**典型用例：**

- 「研究 Q235 钢在不同应变率下的力学响应」→ 自动生成 5 个电压点扫描
- 「对比铝合金和钛合金的冲击性能」→ 自动匹配两种材料各 2-3 组实验
- 「找到 5A06 铝合金的最佳冲击参数」→ 粗扫描 + 细化搜索两阶段

---

## 2. 架构分层

```
┌─────────────────────────────────────────────┐
│  UI 层  (src/features/autonomous-experiment) │
│  ├─ AutonomousSidebar   右侧侧边栏           │
│  ├─ PlanReviewPanel     计划审批（可编辑）   │
│  ├─ ExperimentTimeline  执行进度时间线       │
│  ├─ IntermediateAnalysisCard  中间分析卡片   │
│  └─ AutoExperimentReport      最终报告      │
├─────────────────────────────────────────────┤
│  Store 层  (useAutonomousExperimentStore)   │
│  12 种状态 + 生命周期/执行/编辑/分析方法     │
├─────────────────────────────────────────────┤
│  Service 层  (ai-assistant/services)         │
│  ├─ autonomousExperimentService  主控制器   │
│  ├─ experimentPlanStrategies     4 种策略   │
│  └─ autoReportExporter           报告序列化 │
├─────────────────────────────────────────────┤
│  依赖服务                                    │
│  useExperimentWorkflow / useAppStore         │
│  runSHPBSimulation / performSafetyCheck      │
│  chatWithLLM (可选 LLM 增强)                 │
└─────────────────────────────────────────────┘
```

---

## 3. 状态机

```
idle ──planExperiments──▶ planning ──生成成功──▶ ready
                              │                    │
                              │                    ├─ approvePlan ──▶ running
                              │                    └─ rejectPlan  ──▶ idle
                              └─ 生成失败 ──▶ error
running ──每 3 个实验──▶ analyzing ──▶ running
running ──pause──▶ paused ──resume──▶ running
running/paused ──abort──▶ aborted ──▶ 部分报告
running ──全部完成──▶ generating_report ──▶ complete
```

**12 种状态**：`idle / planning / ready / running / paused / analyzing / adjusting / generating_report / complete / aborted / error`

---

## 4. 实验策略（4 种）

| 策略 ID | 触发关键词 | 生成规则 |
|---------|-----------|---------|
| `strain_rate_sweep` | 应变率 / 不同电压 | 固定材料，5 档电压（1500 → 3500V） |
| `temperature_sweep` | 温度 / 热软化 | 固定材料 + 电压，5 档温度（25 → 800°C） |
| `material_comparison` | 对比 / 比较 | 2-4 种材料各 1 组标准参数 |
| `parameter_optimization` | 最佳 / 最优 | 3 档粗扫描 + 2 档细化（由中间分析追加） |

策略匹配由 `detectStrategy(goal, allMaterials)` 基于正则 + 关键词完成；未能匹配且用户有已选材料时降级为默认应变率扫描。

---

## 5. 执行循环

`startAutonomousExecution` 主循环（`autonomousExperimentService.ts:412`）：

1. **取下一个 pending 实验**，合并 `userEdits`
2. **安全检查**：调用 `performSafetyCheck`；`danger` → 跳过并记录原因
3. **驱动工作流**：依次执行 init / charge / ready / launch / capture / process / result 七步，每步有独立 progress，2D/3D 视图自动同步（因为这些组件订阅同一 `useExperimentWorkflow`）
4. **物理仿真**：`runSHPBSimulation` 返回真实 J-C 计算结果
5. **发布数据总线**：下游材料分析页可见
6. **中间分析检查点**：每 `ANALYSIS_INTERVAL = 3` 个实验后触发
7. **实验间延时** 800ms，继续下一个

### 暂停/终止

- `pause()` 设 `isPausedByUser = true`，步骤循环轮询 `waitForResume()`
- `abort()` 将所有 pending 标记为 skipped，生成部分报告

---

## 6. 中间分析（两阶段）

**阶段一 — 规则分析**（`experimentPlanStrategies.ts` 中 4 个 `analyze*` 函数）：

- 应变率扫描：检查单调性、计算敏感性百分比
- 温度扫描：检测热软化拐点
- 材料对比：排序、找出最强/最吸能材料
- 参数优化：识别最佳电压区间 → **自动追加 2 个细化实验**

**阶段二 — LLM 润色**（`enhanceAnalysisWithLLM`）：

若 `isLLMConfigured()` 为真，将规则分析的 `observation` 字段送给 LLM 用物理机制解释重写。8 秒超时，失败时保留规则输出。无需额外配置，自动复用 `VITE_LLM_*` 环境变量。

---

## 7. 用户入口

**入口 1 — VirtualLab 按钮**：顶部模式切换栏紫色「🤖 AI 自主实验」按钮 → 弹出目标输入框 → `planExperiments(goal)`

**入口 2 — AI 聊天**：`aiIntentParser.ts` 中 `QUICK_INTENTS` 的自主实验模式优先级最高，匹配：
- `(?:帮我|请|AI)?(?:自主|自动)(?:研究|做|...)`
- `(?:启动|开始|做一次?)(?:AI)?自主实验`
- `找到?.*(?:最佳|最优).*(?:参数|条件)`
- 控制指令：`暂停自主实验` / `继续自主实验` / `终止自主实验`

**入口 3 — AI 动作 API**：`aiActionRegistry.ts` 注册 6 个动作供 LLM 调用：`autonomous.plan / approve / reject / pause / resume / abort`

---

## 8. 报告与导出

`generateReport()` 汇总：
- 完成 / 跳过 / 失败统计
- 关键发现（最大应力、最大能量吸收、平均应变率）
- 后续建议（按策略类型差异化）
- 所有中间分析记录

**导出**：`AutoExperimentReport` 的「导出报告」按钮同时下载：
- `autonomous-experiment-<timestamp>.md` — 人类可读的 Markdown
- `autonomous-experiment-<timestamp>.json` — 机器可读的完整结构

由 `autoReportExporter.ts::buildAutoExperimentMarkdown` + `reportGenerator.ts::downloadReport` 实现。

---

## 9. 安全上限

主循环内置保护：
- `MAX_EXPERIMENTS = 20` — 防止 LLM/追加逻辑无限扩展
- 每实验必跑 `performSafetyCheck` — 电压/电流/储能/温度/EMI 硬上限由 `safetyCheck.ts` 统一管理
- `danger` 级别不执行，`warning` 级别继续但在报告中标注

---

## 10. 相关文件

| 路径 | 作用 |
|------|------|
| `src/store/useAutonomousExperimentStore.ts` | 状态管理 |
| `src/features/ai-assistant/services/autonomousExperimentService.ts` | 主控制器 |
| `src/features/ai-assistant/services/experimentPlanStrategies.ts` | 4 种策略生成 + 规则分析 |
| `src/features/ai-assistant/services/autoReportExporter.ts` | 报告 Markdown 序列化 |
| `src/features/autonomous-experiment/*.tsx` | UI 层 5 个组件 |
| `src/pages/VirtualLab.tsx` | Sidebar 挂载点 + 入口按钮 |
