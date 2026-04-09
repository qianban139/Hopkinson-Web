# 数据图表系统

> ECharts 驱动的科研级数据可视化

---

## 一、技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| ECharts | 6.0.0 | 主图表引擎 |
| echarts-for-react | 3.0.6 | React 封装 |
| Recharts | 2.15.4 | 辅助图表 |

## 二、图表类型

### 2.1 应力-应变曲线

**用途**：展示材料动态响应主曲线

**特性**：
- 多曲线对比（不同应变率）
- 标注关键点（屈服点、峰值、断裂）
- 数据点交互（悬停显示数值）
- 支持导出 PNG/SVG

**源文件**：`src/components/ExperimentResultCharts.tsx`

### 2.2 三波波形图

**用途**：展示入射波、反射波、透射波时域信号

**特性**：
- 三轴时间对齐
- 波峰自动标注
- 应力平衡判据可视化
- 缩放与平移

**源文件**：`src/components/WaveformChart.tsx`

### 2.3 实时波形面板

**用途**：实验执行过程中的实时波形显示

**特性**：
- 流式数据更新
- 可暂停/恢复
- 滑动窗口显示
- FPS 控制

**源文件**：`src/shared/components/RealtimeWaveformPanel.tsx`

### 2.4 性能雷达图

**用途**：6 维度评价材料综合性能

**维度**：
- 强度 (Strength)
- 韧性 (Toughness)
- 刚度 (Stiffness)
- 应变率敏感性 (Rate Sensitivity)
- 温度敏感性 (Thermal Sensitivity)
- 吸能能力 (Energy Absorption)

**用于**：MaterialAnalysis 页面材料对比

### 2.5 趋势监控图

**用途**：系统监控数据的时序展示

**指标**：
- 电压 (V)
- 电流 (kA)
- 温度 (°C)
- 电容 (%)
- EMI (dB)

**源文件**：`src/components/MonitorStrip.tsx`、`src/components/GaugeMonitor.tsx`

### 2.6 AI 训练曲线

**用途**：可视化 LSTM/WGAN/PPO 三阶段优化过程

**特性**：
- LSTM Loss 递减曲线
- WGAN 生成质量曲线
- PPO Reward 递增曲线
- 阶段切换动画

**用于**：AIControl 页面

## 三、ECharts 配置规范

### 主题色彩

遵循平台主题：
- 主色：青蓝（应力数据）
- 辅色：紫色（应变率数据）
- 警告：橙色（异常数据）
- 危险：红色（超阈值）

### 通用配置

```typescript
const baseOption = {
  backgroundColor: 'transparent',
  textStyle: { fontFamily: 'system-ui' },
  grid: { left: 40, right: 30, top: 30, bottom: 40 },
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'value', axisLine: { lineStyle: { color: '#888' } } },
  yAxis: { type: 'value', axisLine: { lineStyle: { color: '#888' } } },
};
```

## 四、数据导出

`src/services/exportService.ts` 支持以下格式：

| 格式 | 用途 |
|------|------|
| PNG | 图表截图（ECharts 内置） |
| SVG | 矢量图（论文使用） |
| CSV | 原始数据 |
| JSON | 结构化数据 |
| PDF | 完整实验报告 |

## 五、性能优化

1. **大数据量降采样**：超过 5000 点时自动降采样
2. **离屏 Canvas**：使用 OffscreenCanvas 加速
3. **节流更新**：实时图表更新频率限制 30 fps
4. **按需渲染**：图表仅在可视区域内渲染
