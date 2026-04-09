# 安全检查系统

> 三级预警 + 7 项安全检查 + 紧急停止

---

## 一、设计理念

霍普金森杆是高能装置，电容储能可达 36kJ，操作不当存在严重风险。本平台构建了**多层次安全防护体系**：

1. **静态阈值检查**：参数硬性上限
2. **动态监控**：实时数据三级预警
3. **AI 安全守护**：LLM 输出过滤
4. **人工确认点**：关键步骤人为复核

## 二、安全阈值

| 参数 | 阈值 | 说明 |
|------|------|------|
| 电压 | ≤ 4000 V | 电容组安全上限 |
| 电流 | ≤ 50 kA | 线圈承受上限 |
| 储能 | ≤ 36 kJ | 总能量上限 |
| 温度 | ≤ 80 °C | 系统散热上限 |
| EMI | ≤ 95 dB | 电磁干扰上限 |
| 背景 EMI | < 50 dB | 屏蔽前提条件 |

## 三、三级预警

```typescript
type WarningLevel = 'normal' | 'yellow' | 'red';
```

| 等级 | 含义 | 视觉反馈 | 动作 |
|------|------|---------|------|
| `normal` | 正常 | 绿色 | 无 |
| `yellow` | 警告 | 黄色闪烁 | 提示 + 建议调整 |
| `red` | 危险 | 红色高亮 | 阻止执行 + 紧急停止 |

阈值规则（参考 `src/services/safetyCheck.ts`）：

```
正常区间 → 黄色警告 (>80% 阈值) → 红色危险 (>95% 阈值)
```

## 四、7 项安全检查清单

`useExperimentDataBus.safetyChecklist`：

| ID | 名称 | 检查内容 | 单位 |
|----|------|---------|------|
| `capacitor` | 电容组状态 | 充放电状态、漏电流 | kJ |
| `cooling` | 冷却系统 | 冷却液流量、基线温度 | °C |
| `emi-shield` | EMI 屏蔽 | 屏蔽完整性、背景 EMI < 50dB | dB |
| `specimen` | 试件对位 | 杆件对位、试件安装 | - |
| `daq` | 数据采集 | 应变片连接、采样率 | fps |
| `emergency` | 紧急系统 | 紧急停止响应时间 | ms |
| `personnel` | 人员安全 | 安全区域清空、PPE 检查 | - |

### 检查状态

```typescript
type SafetyStatus = 'pending' | 'checking' | 'pass' | 'warning' | 'danger';
```

只有所有项目 `pass` 或 `warning` 时才允许进入实验执行阶段。

## 五、AI 安全守护

`safetyGuardian.ts` 在 LLM 输出和动作执行前做安全检查：

1. **参数范围拦截**：用户请求的参数超阈值时拒绝执行
2. **危险动作拦截**：例如「跳过安全检查」会被拒绝
3. **敏感建议过滤**：阻止 LLM 给出违反安全准则的建议
4. **强制确认点**：高风险参数执行前要求二次确认

### 拦截示例

```
用户: "电压设为 5000V"
AI: "电压上限是 4000V，无法设置到 5000V。建议使用 3500-4000V 区间。"

用户: "跳过安全检查直接开始"
AI: "为了你的安全，安全检查不能跳过。我来帮你快速完成所有检查项。"
```

## 六、紧急停止

`useExperimentWorkflow.emergencyStop()` 提供紧急停止能力：

```typescript
emergencyStop: () => set((state) => ({
  isEmergencyStopped: true,
  isPaused: true,
  executionSteps: state.executionSteps.map(s =>
    s.status === 'running' ? { ...s, status: 'error' as const } : s
  ),
}))
```

### 触发方式

- **UI 按钮**：实验执行面板的红色 EMERGENCY 按钮
- **AI 指令**：用户语音「紧急停止」
- **自动触发**：监控数据超红色阈值

### 后续动作

1. 立即标记当前执行步骤为 `error`
2. 阻止后续步骤执行
3. 弹出警告模态框
4. 记录事件到操作日志
5. 要求用户确认后才能复位

## 七、安全监控数据流

```
传感器数据 (后续接入)
    │
    ▼
useAppStore.monitorData
    │
    ▼
SafetyCheck 函数
    │
    ▼
warningLevel (normal/yellow/red)
    │
    ▼
全局 MonitorStrip 显示
```

## 八、相关文件

| 文件 | 职责 |
|------|------|
| `src/services/safetyCheck.ts` | 阈值检查与预警计算 |
| `src/features/ai-assistant/services/safetyGuardian.ts` | AI 安全守护 |
| `src/components/SafetyCheckPanel.tsx` | 安全检查 UI 面板 |
| `src/components/MonitorStrip.tsx` | 全局监控状态条 |
| `src/components/WarningModal.tsx` | 警告/危险模态框 |
| `src/store/useExperimentDataBus.ts` | 安全检查清单状态 |
| `src/store/experimentWorkflow.ts` | 紧急停止状态机 |
