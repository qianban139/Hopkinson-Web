# 实验工作流

> AI 引导的端到端实验流程

---

## 一、工作流状态机

```
idle ──► inquiry ──► safetyCheck ──► preparation ──► execution ──► dataCollection ──► analysis ──► complete
空闲     询问需求      安全检查         参数确认         实验执行       数据采集            结果分析       完成
```

每个阶段是有限状态机的一个状态，由 `useExperimentWorkflow` Store 管理。

## 二、阶段详解

### Phase 1: idle（空闲）

**触发**：用户点击「开始实验」或 AI 助手响应「开始实验」指令

**动作**：调用 `startWorkflow()` 跳转到 inquiry 阶段

### Phase 2: inquiry（询问需求）

AI 通过对话引导用户确定实验需求，包含 5 个子步骤：

```
material → testType → strainRate → specialConditions → confirm
```

#### Step 2.1: material（材料选择）

```
AI: "你想测试什么材料？"
用户: "5A06 铝合金"
AI: "好的，5A06 铝合金。你想测什么类型的实验？"
```

#### Step 2.2: testType（测试类型）

```
type TestType = 'compression' | 'tension' | 'shear';
```

| 类型 | 中文 | 适用场景 |
|------|------|---------|
| compression | 压缩 | 大多数金属、岩石、混凝土 |
| tension | 拉伸 | 高分子、薄板材料 |
| shear | 剪切 | 复合材料、层间研究 |

#### Step 2.3: strainRate（应变率）

```
AI: "你想测什么应变率？典型范围是 100 ~ 10000/s"
用户: "1500"
```

应变率决定电压选择：
- 低 (100~500/s): 1000-1500 V
- 中 (500~2000/s): 1500-2500 V
- 高 (2000~5000/s): 2500-3500 V
- 极高 (>5000/s): 3500-4000 V

#### Step 2.4: specialConditions（特殊条件）

```typescript
interface SpecialConditions {
  highTemperature: boolean;
  temperature: number;         // °C
  confinement: boolean;
  confinementPressure: number; // MPa
}
```

询问是否需要：
- 高温环境
- 围压条件

#### Step 2.5: confirm（确认）

显示完整需求摘要，用户确认后进入下一阶段。

### Phase 3: safetyCheck（安全检查）

并行检查 7 项安全项目：

```typescript
interface SafetyCheckItem {
  id: string;
  name: string;
  currentValue: number;
  unit: string;
  warningThreshold: number;
  dangerThreshold: number;
  status: 'pending' | 'pass' | 'warning' | 'danger';
}
```

只有所有项目通过（pass 或 warning）才能进入下一阶段。任何 danger 项都会阻塞流程。

### Phase 4: preparation（参数确认）

显示推荐的实验参数，用户可微调：

```typescript
interface LiveParameters {
  voltage: number;      // V
  current: number;      // A
  pulseWidth: number;   // μs
}
```

锁定参数后进入执行阶段。

### Phase 5: execution（实验执行）

7 个执行步骤顺序执行：

| 步骤 | 标签 | 描述 |
|------|------|------|
| init | 系统初始化 | 初始化电磁驱动系统，自检传感器 |
| charge | 电容充能 | 电容组储能充电中 |
| ready | 系统就绪 | 所有参数已锁定，等待触发信号 |
| launch | 电磁发射 | 电磁驱动子弹加速撞击入射杆 |
| capture | 高速采集 | 100,000 fps 高速采集应变信号 |
| process | 信号处理 | 小波变换滤波与数据校准 |
| result | 结果输出 | 生成应力-应变曲线与分析报告 |

每个步骤具有状态：`pending` → `running` → `complete` / `error`

### Phase 6: dataCollection（数据采集）

调用 `shpbPhysicsEngine.runSHPBSimulation()` 计算并收集数据：
- 三波波形数据
- 应力-应变曲线
- 关键力学参数

### Phase 7: analysis（结果分析）

```typescript
interface ExperimentResults {
  peakStress: number;
  strainRate: number;
  energyAbsorption: number;
  yieldStrength: number;
  maxStrain: number;
  duration: number;
  incidentWavePeak: number;
  reflectedWavePeak: number;
  transmittedWavePeak: number;
}
```

数据通过 `useExperimentDataBus.publishLabExperiment()` 发布到数据总线，MaterialAnalysis 页面可读取并分析。

### Phase 8: complete（完成）

显示完成提示，提供选项：
- 查看详细报告
- 导出数据
- 重新实验
- 进入材料分析

## 三、实时控制

实验执行过程中支持以下控制：

| 操作 | 函数 | 说明 |
|------|------|------|
| 暂停 | `setPaused(true)` | 暂停当前步骤 |
| 继续 | `setPaused(false)` | 恢复执行 |
| 紧急停止 | `emergencyStop()` | 立即终止，标记为 error |
| 跳转阶段 | `jumpToPhase(phase)` | 仅允许跳回之前阶段 |
| 调整参数 | `setLiveParameters(params)` | 修改实时参数（未锁定时） |

## 四、数据流向

```
用户输入 → useExperimentWorkflow.requirements
              │
              ▼
       runSHPBSimulation()
              │
              ▼
useExperimentWorkflow.experimentResults
              │
              ▼
useExperimentDataBus.publishLabExperiment()
              │
              ├──► MaterialAnalysis 页面
              ├──► AIControl 页面（作为优化基线）
              └──► dataFlowLog 审计
```

## 五、错误处理

| 错误 | 处理 |
|------|------|
| 安全检查失败 | 阻止进入 execution，显示具体失败项 |
| 参数超阈值 | 拒绝锁定，提示用户调整 |
| 仿真异常 | 标记当前 step 为 error，触发紧急停止 |
| 用户取消 | 调用 `resetWorkflow()` 回到 idle |
