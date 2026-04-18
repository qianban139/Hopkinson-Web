# 前端框架 — 工业级类型安全 SPA

> PPT 用：每个 `##` 标题 = 一张幻灯片。表格、要点已为 16:9 投影优化。

---

## 一句话定位

> **React 19 + TypeScript 5.9 严格模式 + Vite 7,150+ 文件零 `any`,4 个 Zustand Store 解耦全局状态,Three.js 1:1 数字孪生,ECharts 全量物理可视化。**

---

## 技术栈全景

| 层级 | 技术 | 版本 | 用途 |
|:--|:--|:--|:--|
| UI 框架 | React | 19.x | 组件化 UI |
| 类型系统 | TypeScript | 5.9 (strict) | 编译期类型安全 |
| 构建工具 | Vite | 7.x | 极速 HMR + Tree Shaking |
| 路由 | React Router | 6.x | SPA 路由 |
| 状态管理 | Zustand | 4 个独立 store | 取代 Redux/Context |
| UI 库 | shadcn/ui + Radix | 最新 | 可定制原子组件 |
| 样式 | Tailwind CSS | 3.x | 工具类样式 |
| 动画 | Framer Motion | 11.x | 路由 + 元素级动画 |
| 数据可视化 | Apache ECharts | 5.x | 应力-应变曲线 / 波形图 |
| 3D 引擎 | Three.js + React Three Fiber | r161 | 数字孪生 |
| 图标 | Lucide React | 最新 | 1000+ 矢量图标 |
| HTTP | 原生 fetch + 自封装 httpClient | — | 统一 Authorization 注入 |

---

## 严格类型 — 凭什么"工业级"

```jsonc
// tsconfig.app.json
{
  "compilerOptions": {
    "strict": true,                    // 8 项严格检查全开
    "noUncheckedIndexedAccess": true,  // 数组访问必须判 undefined
    "erasableSyntaxOnly": true,        // 禁用运行时类型语法
    "noUnusedLocals": true             // 未用变量编译失败
  }
}
```

**实测数据**：
- 项目 **150+** 个 `.ts/.tsx` 文件
- 全局搜索 `: any` → **0 处**
- 启动时间 < 800ms（Vite HMR）
- 生产构建 13 秒内完成

---

## 4 个 Zustand Store(职责清晰切分)

| Store | 文件 | 职责 |
|:--|:--|:--|
| `useAppStore` | `src/store/useAppStore.ts` | 主题、UI 状态、当前材料 |
| `useExperimentDataBus` | `src/store/useExperimentDataBus.ts` | 跨模块数据总线(波形/曲线/统计) |
| `useExperimentWorkflow` | `src/store/experimentWorkflow.ts` | 实验流程状态机(空闲→准备→采集→完成) |
| `useAuthStore` | `src/store/useAuthStore.ts` | JWT token + 用户信息 + hydrate 流程 |

**关键设计**：**不使用 React Context** — Zustand 选择性订阅,组件粒度精准重渲染。

---

## 路由架构 + 权限守卫

```
未登录 ─ /login, /register                    [BARE_ROUTES]
        │
登录后 ─ <ProtectedRoute>
            ├─ /              首页 Home
            ├─ /lab           虚拟实验室 VirtualLab
            ├─ /analysis      材料分析 MaterialAnalysis
            ├─ /monitor       系统监控 SystemMonitor
            └─ /teaching      教学系统 Teaching
```

- **`<ProtectedRoute>`** 自动重定向未登录用户至 `/login`,保留 `from` 路径
- **`adminOnly`** 属性可限制超管页面
- **hydrate 阶段** 显示骨架屏,无白屏闪烁

---

## 7 大功能模块(7 个独立路由)

| 页面 | 文件 | 核心功能 |
|:--|:--|:--|
| Home | `src/pages/Home.tsx` | 系统门户 + 4 大入口 |
| VirtualLab | `src/pages/VirtualLab.tsx` | 5 阶段实验流程 + 3D 数字孪生 |
| AIControl | `src/pages/AIControl.tsx` | AI 自主实验 + LLM 规划 |
| MaterialAnalysis | `src/pages/MaterialAnalysis.tsx` | 49 种材料 J-C 参数库 |
| SystemMonitor | `src/pages/SystemMonitor.tsx` | 实时硬件监控 |
| Teaching | `src/pages/Teaching.tsx` | 教学系统 + 题目 + 视频 |
| Login/Register | `src/pages/Login.tsx` | 账号注册登录 |

---

## 数据可视化 — Apache ECharts

**用途**:
- 应力-应变曲线(支持多本构模型对比)
- 入射 / 反射 / 透射 三波信号双层渲染
- 应变率-时间历程
- AI 优化收敛曲线
- 信号 FFT 频谱

**关键特性**:
- 浏览器端渲染(Canvas 2D / WebGL),60fps
- 数据更新走 `setOption` 增量,不重建图表
- 主题与项目深色科技蓝统一

---

## 数字孪生 — Three.js + R3F

```
src/features/experiment-3d/
├── HopkinsonBarScene.tsx      场景根
├── components/                 各组件(撞击杆/试样/支座/传感器)
├── animations/                 实验动画(打击/应变/破坏)
└── public/models/              GLTF 模型资产
    └── new_hopkinson.gltf      主模型 17MB + 25MB bin
```

- React Three Fiber:声明式 Three.js
- @react-three/drei:OrbitControls / Environment / Lighting 工具集
- 支持 OBJ / FBX / GLTF / glTF-Draco 导入
- **客户端 WebGL 渲染**,服务器零负担

---

## AI 助手集成

```
src/features/ai-assistant/
├── llmService.ts               4 LLM 统一抽象(智谱/Moonshot/DeepSeek/OpenAI)
├── intentRouter.ts             意图识别 + 工具调用
├── voiceInput/                 Web Speech API 语音输入
├── ttsService.ts               火山引擎 TTS / Web Speech 降级
└── components/
    ├── AssistantPanel.tsx      聊天面板
    └── ParameterAnimator.tsx   参数自动填充动画
```

**亮点**:同一个抽象层支持 4 家 LLM,**评委体验"换提供商不换代码"**。

---

## 关键数据(评委记忆点)

| 指标 | 数值 |
|:--|:--|
| TypeScript 文件数 | **150+** |
| `any` 类型出现次数 | **0** |
| Zustand Store 数 | **4** 个独立切分 |
| 路由页面数 | **7** 个 |
| 材料数据库 | **49** 种 J-C 参数 |
| 本构模型数 | **5** 种(J-C / C-S / Z-A / Power Law / Bilinear) |
| 信号处理算法 | **5** 步(弥散/基线/对齐/平衡/补偿) |
| LLM 提供商支持 | **4** 家 |
| 首屏加载 | **< 2 秒**(Vite + 路由懒加载) |
| 生产构建时间 | **13 秒** |

---

## 现场可打开演示的代码位置

| 演示重点 | 打开文件 |
|:--|:--|
| 严格类型配置 | `tsconfig.app.json` |
| Auth Store 完整流程 | `src/store/useAuthStore.ts` |
| HTTP 统一鉴权 | `src/services/api/httpClient.ts` |
| 物理引擎(11 个导出函数) | `src/services/shpbPhysicsEngine.ts` |
| 3D 数字孪生 | `src/features/experiment-3d/` |
| 路由守卫 | `src/components/ProtectedRoute.tsx` |
