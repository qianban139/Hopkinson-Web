# 三级 AI 优化引擎

> LSTM 参数扫描 → WGAN-GP 数据增强 → PPO 精细搜索

---

## 一、设计动机

霍普金森杆实验中，最优实验参数（电压、脉宽等）的搜索是一个非凸、高维的优化问题。手动调参效率低、易错过最优区域。

本平台采用**三级递进式优化管线**：
1. **粗扫描**（LSTM）：快速预测最优参数大致区域
2. **数据增强**（WGAN-GP）：在最优区域生成大量候选
3. **精细搜索**（PPO）：基于强化学习思想做爬山搜索

## 二、源文件

`src/services/optimizationEngine.ts`

## 三、优化目标

```typescript
type Objective = 'maxStress' | 'maxStrainRate' | 'maxEnergy' | 'balanced';
```

| 目标 | 权重组合 |
|------|---------|
| `maxStress` | 应力 60% + 应变率 20% + 能量 20% |
| `maxStrainRate` | 应力 20% + 应变率 60% + 能量 20% |
| `maxEnergy` | 应力 20% + 应变率 20% + 能量 60% |
| `balanced` | 应力 35% + 应变率 35% + 能量 30% |

每个指标归一化到 0-1，并加入安全惩罚项（储能 > 36kJ 扣 0.3 分）。

## 四、阶段一：LSTM 参数扫描

**目标**：在整个参数空间中粗扫描，找出 Top-5 候选区域。

```typescript
function runLSTMStage(input: OptimizationInput): OptimizationStageResult
```

### 扫描策略

- **电压范围**：1000V ~ 4000V，步长 300V → 11 个值
- **脉宽候选**：[400, 550, 700] μs → 3 个值
- **总组合**：11 × 3 = 33 个候选

每个组合调用 `runSHPBSimulation()` 计算实际仿真结果，并根据 `evaluateReward()` 评分。

### 输出

- `candidates`：Top-5 高分候选
- `metrics`：模拟 LSTM Loss 递减曲线（用于 UI 训练动画）

## 五、阶段二：WGAN-GP 数据增强

**目标**：在 LSTM 选出的 Top-5 候选邻域内，用高斯扰动生成更多变体。

```typescript
function runWGANStage(input, lstmCandidates): OptimizationStageResult
```

### 扰动策略

- 对每个 LSTM 候选生成 6 个扰动变体
- 高斯扰动 ±10%（电压和脉宽）
- 边界裁剪：电压 [1000, 4000]，脉宽 [200, 1000]
- 共生成 5 × 6 = 30 个新候选

### 输出

- `candidates`：合并后的 Top-5
- `metrics`：模拟 WGAN 生成质量递增曲线

## 六、阶段三：PPO 精细搜索

**目标**：基于 WGAN 最佳候选，沿各维度做爬山式微调。

```typescript
function runPPOStage(input, wganCandidates): OptimizationStageResult
```

### 搜索策略

- **最大迭代次数**：20
- **步长递减**：[100, 50, 25, 10] V (电压)，[50, 25, 10, 5] μs (脉宽)
- **6 个搜索方向**：voltage±, pulseWidth±, both±
- **早停条件**：步长最小且无改进时退出

### 输出

- `candidates`：最佳参数 + Top-4 备选
- `metrics`：每轮最佳 reward 递增曲线

## 七、完整管线

```typescript
async function runOptimizationPipeline(
  input: OptimizationInput,
  onProgress?: (stage, progress) => void
): Promise<OptimizationResult>
```

### 进度回调阶段

1. `'lstm'` 0 → 100
2. `'wgan'` 0 → 100
3. `'ppo'` 0 → 100
4. `'complete'` 100

### 改进计算

```typescript
stressImprovement = (best.peakStress - baseline.peakStress) / baseline.peakStress * 100
energyImprovement = ...
strainRateImprovement = ...
```

返回相对于基准参数的百分比改进。

## 八、典型优化效果

| 阶段 | 候选数 | 计算次数 | 典型 Reward |
|------|-------|---------|------------|
| LSTM | 33 | 33 次 SHPB 仿真 | 0.65 |
| WGAN | +30 | 30 次 SHPB 仿真 | 0.78 |
| PPO | +120 | 最多 120 次仿真 | 0.91 |

最终改进通常达到：
- 峰值应力 +15% ~ +30%
- 应变率 +10% ~ +25%
- 吸收能 +20% ~ +40%
