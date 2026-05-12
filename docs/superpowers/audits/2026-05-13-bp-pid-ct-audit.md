# v1.1 BP / PID / CT 三模块 Agent 审计报告（2026-05-13）

> 派 3 个 general-purpose agents 并行审计，本文为汇总 + 用户决策表。
> 审计模式：只读，agents 不修改代码。

---

## Agent-BP 报告

> 输入：`bpNetwork.ts` + `bpShpbPredictor.ts` + `BPPredictionPanel.tsx`

```
[P0] bpShpbPredictor.ts:66 — `1 + C·ln(max(rate/ε̇₀,1))` 截断了 rate<1 时的对数（负值变 0），偏离 J-C 标准式 — 改为 `1 + C·ln(rate/ε̇₀)` 且 ε̇₀ 用材料标定值，不要 clip。
[P1] bpShpbPredictor.ts:36 — 合成样本即用 J-C 公式生成，BP 上限就是 J-C 复刻，无新增物理信息 — 文档/UI 须显式声明"BP 是 J-C 的可微近似器，非独立本构"。
[P1] bpShpbPredictor.ts:62 — `Math.random()` 未用 seed，augment 不可复现，与 `seed: 42` 的承诺矛盾 — 改用 `seededRandom(cfg.seed)`。
[P1] bpNetwork.ts:167 — 每 5 epoch 让出主线程，300 epoch × 单次 forward N 次仍可冻结 UI 数秒 — 改为每 epoch 都 `await setTimeout(0)` 或用 Web Worker。
[P1] bpNetwork.ts:279 — 当 outputDim>1 时 `ssTot` 跨维度累加但 mean 各维独立计算正确，但 R² 把所有输出维合并算一个值，对单输出（本项目 outputDim=1）OK，多输出会误导 — 建议按维度算 R² 再平均。
[P2] bpNetwork.ts:98 — `applyNorm` 在 `max==min` 时返回 0 而非 0.5，反归一化会丢失常数信息 — 改返回 0.5 或保留原值。
[P2] bpNetwork.ts:174 — `predict` 已检测 xNorm 未训练抛错，但未处理 `range==0` 退化，配合上一项一并修。
[P2] bpShpbPredictor.ts:119 — `Math.max(0, sigma)` 静默裁负值，掩盖网络外推失败 — 应在 UI 上标注或返回 NaN。

Xavier 方差、tansig 导数（`hidden[j]` 即 tanh 输出，`1-y²` 正确）、SGD 符号、`fitNorm` 除零保护均正确。
```

---

## Agent-PID 报告

> 输入：`pidController.ts` + `confiningPressureSimulator.ts` + `PIDServoPanel.tsx`

```
[P1] pidController.ts:113 — Anti-windup 条件 `Math.sign(error) === Math.sign(ki*error)` 在 ki>0 时永远成立，等价于"任何饱和都冻结积分"，没有区分饱和方向（输出顶到 outMax 但 error<0 时本应让积分回退）— 应改为 `Math.sign(error) === Math.sign(output - unsaturated)` 或仅当 error 与饱和方向同向时才冻结。
[P1] confiningPressureSimulator.ts:91 — PID 输出已映射为 MPa（outMax=K=200），再除以 K 截到 [0,1]，使 Kp 实际等效缩小 200 倍，导致预设增益的"物理量纲"与公式显示 `u=Kp·e` 不一致，易误导评委 — 建议改 outMax=1 并在 PID 内部直接出归一化开度。
[P1] PIDServoPanel.tsx:34 — 经典 ZN 预设 Kp=0.42/Ki=0.70/Kd=0.025 是按"输出单位 MPa"反推的，对 K=200/τ=0.35/ζ=0.45 的真 ZN 整定（Ku≈0.7、Tu≈0.4 量级）量级偏低一档；因 outMax=K 的耦合（见上）刚好"看起来合适"，但理论上不是该系统的 ZN 整定值 — 应与第二条一并重做整定。
[P2] confiningPressureSimulator.ts:77 — `delaySteps=0` 时 `uBuffer` 长度=1，push 后 shift 拿到的是上一拍 u，等价于固定 1 步时滞，无法真正退化为无时滞 — 当 deadTime=0 时跳过缓冲或长度设为 0。
[P2] confiningPressureSimulator.ts:205-211 — 若 measured 始终在 ±2% 带内，循环不会触发 break，`settleIdx=0` → settlingTime=0；语义上"从未离开"应返回 0 是合理的，但与"最后一次越过的时刻"措辞不符 — 文档化即可。
[P2] pidController.ts:97 — 矩形左点累加且按 dt 缩放，OK；但 setGains 后未对积分重定标，运行时调 Ki 会留有残余 bias — 建议同步 `integral *= kiOld/kiNew` 或重置。
```

---

## Agent-CT 报告

> 输入：`ctFissureExtractor.ts` + `CTFissureExtractorPanel.tsx`

```
[P1] ctFissureExtractor.ts:257 — `erode` 边缘越界时直接置 0（zero-pad），导致图像最外圈像素被腐蚀，多次开运算会侵蚀边界裂隙 — 建议越界视为前景（reflect/copy-edge）或在 ROI 外做忽略。
[P1] ctFissureExtractor.ts:172-179 — `mpa` 与 `miou` 当 GT 中无裂隙（tp+fn=0）时分母用 `max(1,…)` 兜底会把前景类 IoU 算成 0 并拉低均值 — 建议该类不存在时跳过该类参与均值（标准 mIoU 做法）。
[P1] ctFissureExtractor.ts:283-294 — DFS 用数组 `stack` 在 1000×1000 强连通图上可膨胀至数百万项且重复入栈（先 push 再判 visited），内存与速度均差 — 建议入栈前查 `labels[i]`，或改为扫描行 BFS / Union-Find。
[P2] ctFissureExtractor.ts:378-397 — `generateSyntheticGT` 与 `generateSyntheticCT` 的裂隙曲线参数一致，但合成 CT 用 `gray=40/45/55` 的渐变灰度+噪声，GT 是硬掩膜，二者半径完全一致下边缘像素会因抗锯齿/噪声形成 1-2 px 系统性偏差，导致 Recall 天花板偏低 — 建议 GT 半径 +0.5 px 容差或注释说明。
[P2] CTFissureExtractorPanel.tsx:137 — 标题仅标"王登科 (2024)"，未声明"非论文 MCSN，本实现为 Otsu+形态学经典 pipeline" — 建议在副标题或 tooltip 中显式区分。
[P2] ctFissureExtractor.ts:428-432 — `drawCurve` 中 `isMask` 两个分支代码完全相同 — 建议删除冗余分支。

Otsu 阈值实现（累计直方图 + 类间方差）、`invert` 逻辑、上传无 GT 时 metrics 正确隐藏（Panel:64,79-81）均无误。
```

---

## 用户决策表

> 用户审阅后逐条勾选 FIX / SKIP / DEFER。Claude 据勾选执行修复轮次。

| ID | 模块 | 严重度 | 文件:行 | 一句话 | 决策 |
|---|---|---|---|---|---|
| BP-1 | BP | **P0** | bpShpbPredictor.ts:66 | J-C 应变率项对 rate<1 做 `max(…, 1)` clip 偏离标准式 | ☐ FIX  ☐ SKIP  ☐ DEFER |
| BP-2 | BP | P1 | bpShpbPredictor.ts:36 | BP 训练数据本质源自 J-C，文档需声明"可微近似器" | ☐ FIX  ☐ SKIP  ☐ DEFER |
| BP-3 | BP | P1 | bpShpbPredictor.ts:62 | `Math.random()` 未用 seed，与 `seed:42` 承诺矛盾 | ☐ FIX  ☐ SKIP  ☐ DEFER |
| BP-4 | BP | P1 | bpNetwork.ts:167 | 每 5 epoch 让出主线程仍可冻结数秒 | ☐ FIX  ☐ SKIP  ☐ DEFER |
| BP-5 | BP | P1 | bpNetwork.ts:279 | 多输出 R² 合并计算（单输出 OK，多输出会误导） | ☐ FIX  ☐ SKIP  ☐ DEFER |
| BP-6 | BP | P2 | bpNetwork.ts:98 | `max==min` 时 `applyNorm` 返 0，反归一化丢常数 | ☐ FIX  ☐ SKIP  ☐ DEFER |
| BP-7 | BP | P2 | bpNetwork.ts:174 | predict 未处理 range==0 退化 | ☐ FIX  ☐ SKIP  ☐ DEFER |
| BP-8 | BP | P2 | bpShpbPredictor.ts:119 | `Math.max(0,sigma)` 静默裁负，掩盖外推失败 | ☐ FIX  ☐ SKIP  ☐ DEFER |
| PID-1 | PID | P1 | pidController.ts:113 | anti-windup 条件不区分饱和方向 | ☐ FIX  ☐ SKIP  ☐ DEFER |
| PID-2 | PID | P1 | confiningPressureSimulator.ts:91 | outMax=K 导致 Kp 量纲与公式显示不一致 | ☐ FIX  ☐ SKIP  ☐ DEFER |
| PID-3 | PID | P1 | PIDServoPanel.tsx:34 | ZN 预设与 outMax=K 耦合，理论上不是真 ZN 整定值 | ☐ FIX  ☐ SKIP  ☐ DEFER |
| PID-4 | PID | P2 | confiningPressureSimulator.ts:77 | deadTime=0 时仍固定 1 步时滞 | ☐ FIX  ☐ SKIP  ☐ DEFER |
| PID-5 | PID | P2 | confiningPressureSimulator.ts:205-211 | settlingTime 在从未离开 ±2% 时语义模糊 | ☐ FIX  ☐ SKIP  ☐ DEFER |
| PID-6 | PID | P2 | pidController.ts:97 | setGains 后积分项未重定标 | ☐ FIX  ☐ SKIP  ☐ DEFER |
| CT-1 | CT | P1 | ctFissureExtractor.ts:257 | erode 边界 zero-pad 侵蚀图像最外圈 | ☐ FIX  ☐ SKIP  ☐ DEFER |
| CT-2 | CT | P1 | ctFissureExtractor.ts:172-179 | mpa/miou 在某类不存在时拉低均值 | ☐ FIX  ☐ SKIP  ☐ DEFER |
| CT-3 | CT | P1 | ctFissureExtractor.ts:283-294 | DFS 在大连通图上 stack 膨胀 + 重复入栈 | ☐ FIX  ☐ SKIP  ☐ DEFER |
| CT-4 | CT | P2 | ctFissureExtractor.ts:378-397 | 合成 CT 与 GT 边缘有 1-2 px 系统性偏差 | ☐ FIX  ☐ SKIP  ☐ DEFER |
| CT-5 | CT | P2 | CTFissureExtractorPanel.tsx:137 | UI 未显式声明"非论文 MCSN"避免评委误判 | ☐ FIX  ☐ SKIP  ☐ DEFER |
| CT-6 | CT | P2 | ctFissureExtractor.ts:428-432 | `drawCurve` isMask 两个分支代码相同（冗余） | ☐ FIX  ☐ SKIP  ☐ DEFER |

---

## 严重度统计

- **P0** = 1 项（BP-1）
- **P1** = 11 项（BP × 4 + PID × 3 + CT × 3 + 文档 BP-2 + 1 个边界）
- **P2** = 8 项

---

## 修复轮次约定

用户勾选 **FIX** 的项进入修复轮：

- 每项一个 commit，message 引用 audit ID：`fix(<scope>): <audit-id> — <一句话>`
- 修复后 Claude 再跑 `npm run build` 验证
- **SKIP** 与 **DEFER** 项不动代码，但应在本 md 增补理由（DEFER 需追加目标版本号）
