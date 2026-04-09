# 状态管理设计

> 基于 Zustand 的分布式 Store 架构

---

## 设计原则

本平台采用 **3 个独立 Zustand Store** 管理状态，按职责域分离：

| Store | 文件 | 职责 |
|-------|------|------|
| `useAppStore` | `src/store/useAppStore.ts` | 全局应用状态 |
| `useExperimentDataBus` | `src/store/useExperimentDataBus.ts` | 跨模块数据总线 |
| `useExperimentWorkflow` | `src/store/experimentWorkflow.ts` | 实验工作流状态机 |

## 一、useAppStore — 全局应用状态

管理全局共享的核心状态。

### 状态字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `selectedMaterial` | `Material \| null` | 当前选中的材料 |
| `experimentParams` | `ExperimentParams` | 实验参数（电压、电流、脉宽、波形） |
| `aiState` | `AIOptimizationState` | AI 优化状态（阶段、进度、奖励值） |
| `monitorData` | `MonitorData` | 系统监控数据（电压、电流、温度、EMI） |
| `warningLevel` | `WarningLevel` | 预警等级（normal / yellow / red） |
| `materials` | `Material[]` | 全部材料列表（从 JSON 加载） |
| `isAssistantOpen` | `boolean` | AI 助手面板开关 |
| `navigateTo` | `string \| null` | AI 程序化导航目标 |

### 典型用法

```typescript
// 读取
const material = useAppStore(s => s.selectedMaterial);
const params = useAppStore(s => s.experimentParams);

// 更新
useAppStore.getState().setExperimentParams({ voltage: 2500 });
useAppStore.getState().setSelectedMaterial(material);
```

## 二、useExperimentDataBus — 跨模块数据总线

连接 VirtualLab、AIControl、MultiField、MaterialAnalysis、SystemMonitor 五大模块的数据通道。

### 核心设计

```
VirtualLab ──publishLabExperiment()──► DataBus ──► MaterialAnalysis
AIControl  ──publishAIOptimization()─► DataBus ──► VirtualLab
MultiField ──publishMultiFieldExperiment()─► DataBus ──► MaterialAnalysis
```

### 状态字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `lastLabExperiment` | `LabExperimentResult \| null` | 最近的虚拟实验结果 |
| `lastMultiFieldExperiment` | `MultiFieldExperimentResult \| null` | 最近的多场耦合结果 |
| `aiOptimizedParams` | `{voltage, current, pulseWidth, improvements}` | AI 优化后的参数 |
| `aiOptimizationHistory` | 数组 | AI 优化历史记录（最近 20 条） |
| `safetyChecklist` | `SafetyChecklistItem[]` | 7 项安全检查清单 |
| `dataFlowLog` | `DataFlowEntry[]` | 模块间数据流日志（最近 50 条） |
| `experimentSession` | `ExperimentSession` | 当前实验会话跟踪 |

### 安全检查项

| ID | 名称 | 说明 |
|----|------|------|
| `capacitor` | 电容组状态 | 充放电状态和漏电流 |
| `cooling` | 冷却系统 | 冷却液流量和基线温度 |
| `emi-shield` | EMI 屏蔽 | 屏蔽完整性，背景 EMI < 50dB |
| `specimen` | 试件对位 | 杆件对位和试件安装 |
| `daq` | 数据采集 | 应变片连接和采样率 |
| `emergency` | 紧急系统 | 紧急停止响应时间 |
| `personnel` | 人员安全 | 安全区域和 PPE |

## 三、useExperimentWorkflow — 实验工作流状态机

管理 AI 引导的自动实验全流程，是一个完整的有限状态机。

### 工作流阶段

```
idle → inquiry → safetyCheck → preparation → execution → dataCollection → analysis → complete
 空闲    AI询问     安全检查       参数确认       实验执行      数据采集       结果分析     完成
```

### inquiry 子步骤

```
material → testType → strainRate → specialConditions → confirm
选择材料    测试类型    应变率目标      特殊条件           确认
```

### execution 执行步骤

| 步骤 | 说明 |
|------|------|
| `init` | 系统初始化，自检传感器 |
| `charge` | 电容组储能充电 |
| `ready` | 参数锁定，等待触发 |
| `launch` | 电磁发射，子弹加速 |
| `capture` | 100,000fps 高速采集 |
| `process` | 小波变换滤波与校准 |
| `result` | 生成应力-应变曲线 |

### 实时控制

| 字段 | 说明 |
|------|------|
| `isPaused` | 暂停状态 |
| `isEmergencyStopped` | 紧急停止 |
| `parameterLocked` | 参数锁定（执行中） |
| `liveParameters` | 实时可调参数（电压、电流、脉宽） |

## 四、数据流向总结

```
用户选择材料 ──► useAppStore.selectedMaterial
                    │
用户设置参数 ──► useAppStore.experimentParams
                    │
AI助手启动 ──► useExperimentWorkflow.startWorkflow()
                    │
            inquiry → safetyCheck → preparation
                    │
            execution (调用 shpbPhysicsEngine)
                    │
            useExperimentDataBus.publishLabExperiment()
                    │
            ├──► MaterialAnalysis 读取并分析
            └──► dataFlowLog 记录流转
```
