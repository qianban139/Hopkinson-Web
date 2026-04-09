# 多场耦合实验指南

> 热-力-电磁耦合的动态测试

---

## 一、什么是多场耦合

真实工程结构往往同时承受多种物理场作用。单一力场实验无法表征材料的真实行为，需要在加载力场的同时叠加其他物理场：

| 场 | 典型场景 | 平台范围 |
|----|---------|---------|
| 热场 (Thermal) | 发动机部件、热变形 | 25 ~ 1000 °C |
| 力场 (Mechanical) | 围压、冲击 | 0 ~ 600 MPa |
| 电磁场 (EM) | EMI 环境、电磁辐射 | 0 ~ 120 dB |

## 二、平台实现

### 源文件

- 页面：`src/pages/MultiField.tsx`
- 数据流：`useExperimentDataBus.publishMultiFieldExperiment()`
- 类型：`MultiFieldExperimentResult` (in `src/types/index.ts`)

## 三、热场加载

### 实现原理

通过加热装置（电阻丝、感应加热）将试件加热到目标温度，再进行 SHPB 冲击。

### 平台参数

| 参数 | 范围 | 单位 |
|------|------|------|
| 目标温度 | 25 ~ 1000 | °C |
| 升温速率 | 1 ~ 50 | °C/s |
| 保温时间 | 0 ~ 600 | s |

### 物理效应

J-C 模型的热软化项：

```
σ = ... × (1 - T*ᵐ)
T* = (T - T_room) / (Tm - T_room)
```

温度越高，材料强度越低（趋向熔点时归零）。

## 四、力场加载（围压）

### 实现原理

试件外加套筒并充入高压气体或液体，提供围压条件。

### 平台参数

| 参数 | 范围 | 单位 |
|------|------|------|
| X 轴围压 | 0 ~ 200 | MPa |
| Y 轴围压 | 0 ~ 200 | MPa |
| Z 轴围压 | 0 ~ 200 | MPa |

### 物理效应

围压改变材料的破坏机制：
- **岩石**：从脆性破坏 → 延性流动
- **混凝土**：抑制裂纹扩展
- **金属**：抑制颈缩，提高均匀塑性

## 五、电磁场加载

### 实现原理

在试件周围放置电磁辐射源，研究 EMI 对材料力学行为的影响（特别是导电材料）。

### 平台参数

| 参数 | 范围 | 单位 |
|------|------|------|
| 电磁场强度 | 0 ~ 120 | dB |
| 频率 | 1 kHz ~ 1 MHz | Hz |
| 持续时间 | 0 ~ 100 | ms |

## 六、同步控制

多场耦合的关键是各场的**纳秒级同步触发**：

```
触发信号
   │
   ├──► 加热系统（保持温度）
   ├──► 围压系统（保持压力）
   ├──► 电磁场（开始辐射）
   └──► SHPB 冲击（同步触发）
```

平台通过 `useExperimentWorkflow` 状态机协调各模块：

```typescript
phase: 'execution' →
  init → charge → ready → 
  [同步触发] → 
  launch → capture → process → result
```

## 七、数据结构

```typescript
interface MultiFieldExperimentResult {
  thermalParams: {
    temperature: number;     // °C
    duration: number;        // s
  };
  mechanicalParams: {
    stress: number;          // MPa
    confinementPressure: number; // MPa
  };
  emParams: {
    fieldStrength: number;   // dB
    frequency: number;       // Hz
  };
  results: SHPBSimulationResult;  // 标准 SHPB 结果
  couplingEffects: {
    thermalSoftening: number;       // 热软化贡献
    confinementStrengthening: number; // 围压强化贡献
    emInfluence: number;            // 电磁影响
  };
}
```

## 八、典型实验组合

| 组合 | 应用场景 |
|------|---------|
| 高温 + 冲击 | 航空发动机部件 |
| 围压 + 冲击 | 地下岩石工程 |
| 高温 + 围压 + 冲击 | 深部地下空间结构 |
| 电磁 + 冲击 | 雷达环境结构件 |
| 全场耦合 | 极端工况评估 |

## 九、可视化

MultiField 页面提供：
- **3 个独立控制面板**：热/力/电磁参数
- **实时云图**：显示场分布
- **耦合效应分解图**：各场贡献占比
- **同步时序图**：纳秒级触发可视化

## 十、与单场实验的对比

| 维度 | 单场 SHPB | 多场耦合 |
|------|-----------|---------|
| 实验数据真实度 | 中 | 高（接近真实工况） |
| 实验复杂度 | 低 | 高（需多设备协调） |
| 数据分析难度 | 低 | 高（需解耦各场贡献） |
| 适用场景 | 基础研究 | 工程应用研究 |
