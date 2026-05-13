# 煤岩 Micro-CT 裂隙智能提取

> 论文参考：王登科 等（2024）"基于深度学习的煤岩 Micro-CT 裂隙智能提取与应用"
> 实现位置：`src/services/imageProcessing/ctFissureExtractor.ts`
> UI 入口：MaterialAnalysis → CT 裂隙提取 Tab

## **与论文的差异声明（必读）**

论文原方法使用 **MCSN（U-Net + VGG16 迁移学习 + DCAC 空洞卷积）**，需要 GPU 离线训练 + 标注数据集。

本项目为**纯前端浏览器演示版本**，**不是**论文原方法的复现，而是采用工程上经典的"传统+现代"混合 pipeline：

1. Otsu 自适应阈值（无监督二值化）
2. 形态学闭运算（连接细裂隙）
3. 形态学开运算（去噪点）
4. 连通域分析（按面积过滤）
5. 评价指标对比 Ground Truth（仅合成 CT 有 GT）

适用场景：教学演示、快速预览、无需 GPU。不适合代替 MCSN 的真实工程应用。

## Pipeline 细节

### 1. Otsu 阈值

最大化类间方差：

```
σ_B²(t) = w0(t)·w1(t)·(μ0(t) - μ1(t))²
t* = argmax_t σ_B²(t)
```

### 2. 形态学

- **闭运算**：膨胀 → 腐蚀，连接断裂的裂隙线段
- **开运算**：腐蚀 → 膨胀，去除孤立小噪点
- 默认 3×3 方形 kernel，可在 UI 调到 9×9，闭/开各 0–4 次迭代
- **边界处理**（audit CT-1 修复后）：腐蚀越界视为前景（border-replicate），避免最外圈像素被无意义腐蚀掉

### 3. 连通域

DFS（深度优先搜索）遍历二值掩膜，每个连通分量计算面积，小于 `minArea`（默认 20 px）丢弃。
**audit CT-3 修复后**：入栈前查 visited + 标前景，避免大连通图上 stack 膨胀与重复入栈，最坏栈深度从 O(4N) 降到 O(N)。

### 4. 评价指标

仅在合成 CT（有 GT）时计算：

| 指标 | 公式 |
|---|---|
| Pixel Accuracy | `(TP + TN) / (TP + TN + FP + FN)` |
| Precision | `TP / (TP + FP)` |
| Recall | `TP / (TP + FN)` |
| F1 | `2·P·R / (P + R)` |
| MIoU | mean over classes of `TP / (TP + FP + FN)` |
| MPA | mean over classes of `TP / (TP + FN)` |

**audit CT-2 修复后**：MIoU / MPA 仅对"GT 中存在的类"取平均，不存在的类不参与（标准做法）。例如 GT 全是背景时，前景类被跳过，避免拉低均值。

## UI 行为

- 上传任意 PNG/JPG → 缩放到 ≤ 320 px → 显示原图，无评价指标
- 点 **"生成演示 CT"** → 合成 320×320 灰度图（含裂隙状黑色随机曲线 + 椒盐噪声）+ 对应 GT
- 调形态学参数 + 反转开关 → 点 **"提取裂隙"** → 三联图（原图/掩膜/叠加）+ 评价指标 + 直方图（含 Otsu 阈值标线）

## 参考

- 王登科, 等. 基于深度学习的煤岩 Micro-CT 裂隙智能提取与应用[J]. 2024.
