# 贡献指南

感谢你考虑为 Hopkinson-Web 项目贡献代码！本文档说明如何参与项目开发。

---

## 📋 目录

- [开发环境搭建](#开发环境搭建)
- [代码规范](#代码规范)
- [分支策略](#分支策略)
- [提交信息规范](#提交信息规范)
- [Pull Request 流程](#pull-request-流程)
- [项目架构概览](#项目架构概览)

---

## 🛠️ 开发环境搭建

### 前置条件

- Node.js >= 20
- npm >= 10
- Git

### 步骤

```bash
# 1. Fork 项目到自己的 GitHub
# 2. Clone 你的 Fork
git clone https://github.com/<your-username>/Hopkinson-Web.git
cd Hopkinson-Web

# 3. 添加上游仓库
git remote add upstream https://github.com/qianban139/Hopkinson-Web.git

# 4. 安装依赖
npm install

# 5. 配置环境变量
cp .env.example .env
# 编辑 .env 填入你的 API Key

# 6. 启动开发服务器
npm run dev
```

详见 [开发环境搭建文档](docs/deployment/setup.md)。

---

## 📐 代码规范

### TypeScript

- **必须使用 TypeScript**，不使用 JavaScript
- **strict 模式**已启用，所有类型必须明确
- **避免使用 `any`**，确实需要时使用 `unknown` 替代
- 所有函数参数和返回值必须有类型标注
- 接口使用 `interface`，类型别名使用 `type`

### React

- **仅使用函数组件 + Hooks**，不使用 Class 组件
- 组件文件使用 `.tsx` 扩展名
- Props 必须定义 TypeScript 接口
- 大列表使用 `React.memo` 优化性能

### 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 组件文件 | PascalCase | `WaveformChart.tsx` |
| Hook 文件 | camelCase, use 前缀 | `useAppStore.ts` |
| Service 文件 | camelCase | `shpbPhysicsEngine.ts` |
| 目录 | kebab-case | `ai-assistant/`, `experiment-2d/` |
| 类型/接口 | PascalCase | `Material`, `ExperimentParams` |
| 常量 | UPPER_SNAKE_CASE | `SHPB_CONFIG` |
| 函数/变量 | camelCase | `runSHPBSimulation`, `peakStress` |

### 注释

- **代码注释使用中文**，与项目主语言一致
- 复杂物理公式必须有注释说明
- 公开 API 必须有 JSDoc 注释

```typescript
/**
 * Johnson-Cook 本构方程
 * σ = (A + Bεⁿ)(1 + C·ln(ε̇/ε̇₀))(1 − T*ᵐ)
 *
 * @param strain 等效塑性应变
 * @param strainRate 应变率 (/s)
 * @returns 流动应力 (MPa)
 */
export function johnsonCookStress(...) {}
```

### 样式

- **使用 Tailwind CSS**，避免内联 style
- **使用 shadcn/ui 组件**，避免重复造轮子
- 自定义组件保持与项目主题一致

### 状态管理

- **简单状态** → Zustand
- **跨模块数据** → `useExperimentDataBus`
- **实验工作流** → `useExperimentWorkflow`
- **避免使用 React Context**（性能问题）

### Lint 检查

提交前必须通过：

```bash
npm run lint
```

---

## 🌳 分支策略

### 分支命名

| 类型 | 命名 | 示例 |
|------|------|------|
| 功能 | `feature/<name>` | `feature/ai-voice-input` |
| 修复 | `fix/<name>` | `fix/safety-check-validation` |
| 重构 | `refactor/<name>` | `refactor/extract-physics-engine` |
| 文档 | `docs/<name>` | `docs/update-readme` |
| 样式 | `style/<name>` | `style/improve-monitor-strip` |

### 工作流

```
master (生产分支)
   │
   ├── feature/your-feature  ← 你的功能分支
   │       │
   │       └─► PR → master
```

---

## 📝 提交信息规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/) 中文版：

### 格式

```
<类型>: <描述>

[可选正文]

[可选脚注]
```

### 类型

| 类型 | 含义 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档更新 |
| `style` | 代码格式（不影响功能） |
| `refactor` | 重构（无新功能或修复） |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `build` | 构建系统或依赖 |
| `ci` | CI 配置 |
| `chore` | 杂项 |
| `revert` | 回滚 |

### 示例

```
feat: 添加 PPO 强化学习优化阶段

实现了三级优化引擎的第三阶段，使用爬山搜索
进一步精细化最优参数。包括：
- 6 方向搜索策略
- 步长递减机制
- 早停条件

Refs: #42
```

```
fix: 修复 AI 助手面板拖拽到屏幕外的问题

将定位策略从 right/bottom 改为 left/top，
确保面板始终在可视区域内。
```

```
docs: 更新 Johnson-Cook 模型文档

补充了温度软化项的物理意义说明，添加典型材料参数表。
```

---

## 🔄 Pull Request 流程

### 1. 创建分支

```bash
git checkout master
git pull upstream master
git checkout -b feature/your-feature
```

### 2. 开发与提交

```bash
# 修改代码
npm run lint            # 确保通过
npm run build           # 确保构建成功

git add <files>
git commit -m "feat: 你的功能描述"
```

### 3. 推送到 Fork

```bash
git push origin feature/your-feature
```

### 4. 创建 PR

在 GitHub 上创建 Pull Request 到 `qianban139/Hopkinson-Web` 的 `master` 分支。

PR 模板应包含：

```markdown
## 改动内容
<简要描述你的改动>

## 改动原因
<为什么要做这个改动>

## 测试方法
- [ ] 本地 `npm run dev` 验证
- [ ] 本地 `npm run build` 构建成功
- [ ] 相关功能手动测试通过
- [ ] 不影响其他模块功能

## 截图（如适用）
<UI 改动请附截图>
```

### 5. Code Review

- 维护者会进行 Code Review
- 根据反馈修改代码
- 通过后合并

---

## 🏗️ 项目架构概览

详细架构请参见 [docs/architecture/overview.md](docs/architecture/overview.md)。

### 关键模块

| 模块 | 职责 |
|------|------|
| `src/services/shpbPhysicsEngine.ts` | SHPB 物理仿真核心 |
| `src/services/optimizationEngine.ts` | 三级 AI 优化引擎 |
| `src/services/llmService.ts` | 多模型 LLM 服务 |
| `src/features/ai-assistant/` | AI 智能助手 |
| `src/store/useAppStore.ts` | 全局应用状态 |
| `src/store/useExperimentDataBus.ts` | 跨模块数据总线 |
| `src/store/experimentWorkflow.ts` | 实验工作流状态机 |

### 添加新页面的步骤

1. 在 `src/pages/` 创建新组件
2. 在 `src/App.tsx` 注册路由（使用 `lazy()` 懒加载）
3. 在 `src/components/Navbar.tsx` 添加导航入口
4. 创建相关文档到 `docs/`

### 添加新材料的步骤

1. 编辑 `src/data/materials.json`
2. 按现有格式添加完整材料数据
3. 包含 J-C 参数和物理属性
4. 验证 `src/services/shpbPhysicsEngine.ts` 计算正常

---

## ❓ 问题反馈

- **Bug 报告**：在 GitHub Issues 中提交，附复现步骤
- **功能建议**：在 Issues 中标注 `enhancement`
- **使用咨询**：在 Discussions 中提问

---

## 📜 行为准则

- 友好对待所有贡献者
- 接受建设性反馈
- 关注项目目标和用户价值
- 尊重不同意见，理性讨论

---

感谢你的贡献！🎉
