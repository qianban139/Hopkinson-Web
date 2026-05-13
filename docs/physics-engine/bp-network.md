# BP-ANN 本构预测

> 论文来源：龙旭 等（2021）"基于人工神经网络的混凝土类材料 SHPB 动态压缩性能预测"
> 实现位置：`src/services/bpNetwork.ts` + `src/services/bpShpbPredictor.ts`
> UI 入口：MaterialAnalysis → 参数拟合 Tab → 模型选择 → BP-ANN

## 算法

### 网络结构

- **输入层**：3 维 `(应变 ε, 应变率 ε̇, 温度 T)`
- **隐层**：默认 12 个神经元，tansig 激活（`tanh(x)`）
- **输出层**：1 维 `应力 σ` (MPa)，purelin 线性激活
- **权重初始化**：Xavier，方差 `2 / (in + out)`
- **归一化**：输入与输出均用 Min-Max 独立归一化，推理时反归一化

### 训练

- **优化器**：小批量 SGD
- **学习率衰减**：`lr / sqrt(1 + 0.02·epoch)`
- **默认参数**：hiddenDim=12 / epochs=120 / lr=0.15 / batchSize=8
- **样本来源**：
  1. 选定材料的 `stressStrainSample`（典型 10–20 点）作为基准
  2. 用材料 J-C 参数 + 应变率扰动 (×/÷ 2.5 倍) + 温度扰动 (±50°C) 合成 `augmentFactor × 原始点数` 个样本

### 预测

```ts
const sigma: number = net.predict([strain, strainRate, temperature])[0];
```

返回的 σ 已反归一化为 MPa。

## 与传统本构对比

| 维度 | J-C / C-S / Z-A 等传统模型 | BP-ANN |
|---|---|---|
| 物理意义 | 强 — 每个参数有物理含义 | 弱 — 权重不可解释 |
| 拟合精度 | 受模型形式约束 | 可逼近任意非线性 |
| 外推能力 | 弱（外推应变率往往失真） | 受训练样本分布约束 |
| 训练成本 | 几次最小二乘 | 100–300 epochs |

## 局限（必读）

1. **本实现是 J-C 的可微近似器，不是独立本构**：训练样本（除原始实验点外）全部由 J-C 公式合成，BP 学到的本质就是 J-C 的非线性映射。因此泛化上限即 J-C 模型本身的物理表达力。**严禁**声称比传统本构"更准"——它的真实价值在于：
   - 提供 J-C 在任意 (ε, ε̇, T) 输入下的可微近似（梯度可向后端 ML pipeline 传播）；
   - 演示"传统本构 → 数据驱动"的方法学过渡。
2. **训练在 Web Worker 内执行（v1.2 audit BP-4 修复后）**：训练循环搬到 `src/services/bpWorker.ts` 独立线程，主线程不再冻结。Worker 通过 postMessage 每 epoch 回报 loss / R²；训练结束后回传 `BPNetworkSnapshot`，主线程用 `BPNetwork.fromState()` 重建网络进行预测。300 epoch 的训练对 UI 零影响。
3. **无验证集**：当前是过拟合训练集的 R²，不是 hold-out 性能。
4. **augment 已 seeded**（audit BP-3 修复后）：相同 `seed` 下 `buildTrainingSet` 输出可复现。

## 参考

- 龙旭, 等. 基于人工神经网络的混凝土类材料 SHPB 动态压缩性能预测[J]. 南京航空航天大学学报, 2021, 53(5).
