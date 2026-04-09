# 数智化电磁驱动霍普金森杆多场耦合动态测试系统

> Hopkinson-Web — 软硬件一体化智能实验平台

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6.svg)](https://www.typescriptlang.org/)
[![Vite 7](https://img.shields.io/badge/Vite-7-646cff.svg)](https://vitejs.dev/)
[![Vercel](https://img.shields.io/badge/Deployed-Vercel-black.svg)](https://hopkinson-bar.vercel.app)

---

## 🎯 项目简介

本项目是一个面向**材料动态力学测试**领域的现代化 Web 平台，将 SHPB（分离式霍普金森压杆）实验数字化、智能化、教学化。

**核心定位**：与传统纯仿真平台不同，本平台致力于成为**真实设备 + 真实数据 + AI 智能**的一体化实验环境：

- 🔌 **可连接真实霍普金森杆装置**采集实测数据
- 🤖 **AI 智能助手**全流程辅助实验设计、执行与分析
- 🎓 **教学 + 科研双用途**，服务初学者和资深研究员
- 📊 **多场耦合**：热-力-电磁同步加载

---

## ✨ 核心特性

| 特性 | 说明 |
|------|------|
| 🧮 **SHPB 物理仿真引擎** | 基于一维应力波理论 + Johnson-Cook 本构模型 |
| 🧠 **三级 AI 优化** | LSTM 参数扫描 → WGAN-GP 数据增强 → PPO 精细搜索 |
| 💬 **AI 智能助手「小智」** | 多模态对话 + 语音唤醒 + 意图执行 |
| 🎨 **3D 数字孪生** | Three.js 渲染的实验装置 + 精细 2D 示意图 |
| 🌡️ **多场耦合实验** | 25-1000°C 温度场 + 0-200MPa 围压 + EMI 场 |
| 📚 **30+ 材料数据库** | 7 大类材料 J-C 参数与物理属性 |
| 🎓 **智能教学系统** | 知识图谱 + 学习路径 + 在线测验 |
| 🛡️ **实时安全监控** | 三级预警 + 7 项安全检查 + 紧急停止 |

---

## 🚀 在线演示

🔗 **生产环境**：[https://hopkinson-bar.vercel.app](https://hopkinson-bar.vercel.app)

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                   数据分析层 (L4)                        │
│     材料力学分析 · 本构拟合 · 报告生成 · 数据导出         │
├─────────────────────────────────────────────────────────┤
│                   AI 控制层 (L3)                         │
│   LSTM预测 · WGAN-GP增强 · PPO优化 · AI对话助手          │
├─────────────────────────────────────────────────────────┤
│                  数字孪生层 (L2)                         │
│  3D场景渲染 · 2D示意图 · 实时波形 · 实验动画 · 教学系统   │
├─────────────────────────────────────────────────────────┤
│                   物理层 (L1)                            │
│  SHPB物理引擎 · Johnson-Cook模型 · 材料数据库 · 安全系统  │
└─────────────────────────────────────────────────────────┘
```

详见 [架构文档](docs/architecture/overview.md)。

---

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | React 19 + TypeScript 5.9 (strict) |
| 构建工具 | Vite 7 |
| 路由 | React Router 7 |
| 状态管理 | Zustand 5（3 个分布式 Store） |
| 3D 渲染 | Three.js + React Three Fiber + Drei |
| 数据可视化 | ECharts 6 + Recharts |
| UI 组件 | shadcn/ui + Radix UI（40+ 组件） |
| 样式 | Tailwind CSS 3 + Framer Motion |
| 表单 | React Hook Form + Zod |
| AI 集成 | DeepSeek / 智谱 / Moonshot / OpenAI |
| 语音 | 火山引擎 TTS + Picovoice Porcupine + Web Speech API |
| 数学公式 | KaTeX + react-katex |
| 部署 | Vercel + 阿里云 OSS（视频） |

详见 [技术栈文档](docs/architecture/tech-stack.md)。

---

## 🚀 快速开始

### 前置条件

- Node.js >= 20
- npm >= 10
- 现代浏览器（Chrome / Edge 最新）

### 安装与运行

```bash
# 1. 克隆仓库
git clone https://github.com/qianban139/Hopkinson-Web.git
cd Hopkinson-Web

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 填入 API Key

# 4. 启动开发服务器
npm run dev

# 5. 浏览器访问
# http://localhost:5173/
```

### 可用命令

```bash
npm run dev      # 启动开发服务器（HMR）
npm run build    # 生产构建
npm run preview  # 预览生产构建
npm run lint     # ESLint 代码检查
```

详见 [开发环境搭建](docs/deployment/setup.md)。

---

## 📂 项目结构

```
Hopkinson-Web/
├── src/
│   ├── pages/                  # 7 个路由页面
│   ├── features/               # 业务模块
│   │   ├── ai-assistant/       #   AI 智能助手
│   │   ├── experiment-2d/      #   2D 渲染器
│   │   ├── experiment-3d/      #   3D 数字孪生
│   │   └── teaching-system/    #   教学系统
│   ├── components/             # 共享 UI 组件
│   ├── shared/                 # 跨模块共享
│   ├── store/                  # Zustand Stores
│   ├── services/               # 业务逻辑层
│   ├── hooks/                  # 自定义 Hooks
│   ├── types/                  # TypeScript 类型
│   ├── data/                   # 静态数据（材料数据库）
│   ├── lib/                    # 工具函数
│   ├── App.tsx                 # 根组件
│   └── main.tsx                # 入口
├── api/                        # Vercel Serverless Functions
├── public/                     # 静态资源
├── docs/                       # 项目文档
├── .env.example                # 环境变量模板
└── package.json
```

详见 [项目结构文档](docs/architecture/project-structure.md)。

---

## 📑 页面导览

| 路径 | 页面 | 功能 |
|------|------|------|
| `/` | 首页 | 平台概览与功能入口 |
| `/lab` | 虚拟实验室 | SHPB 实验配置、2D/3D 动画、波形显示 |
| `/ai` | AI 智能控制 | LSTM/WGAN/PPO 三级优化引擎 |
| `/multifield` | 多场耦合 | 热-力-电磁多场同步实验 |
| `/analysis` | 材料力学分析 | 本构拟合、应力应变分析、报告生成 |
| `/monitor` | 系统监控 | 实时 KPI、安全检查、预警系统 |
| `/teaching` | 教学系统 | 知识图谱、学习路径、在线测验 |

---

## 📚 文档

完整文档请访问 [docs/](docs/) 目录：

- 📐 [系统架构](docs/architecture/overview.md)
- 🧮 [物理引擎与公式](docs/physics-engine/shpb-theory.md)
- 🤖 [AI 子系统](docs/ai-system/ai-overview.md)
- 🎨 [可视化系统](docs/visualization/3d-digital-twin.md)
- 🎯 [应用场景](docs/application/use-cases.md)
- 🚀 [部署指南](docs/deployment/setup.md)

---

## 🤝 贡献指南

欢迎贡献！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解：

- 开发环境搭建
- 代码规范（ESLint + TypeScript strict）
- 分支策略与提交规范
- Pull Request 流程

---

## 📜 更新日志

详见 [CHANGELOG.md](CHANGELOG.md)。

---

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。

---

## 🙏 致谢

感谢以下技术与服务：

- [React](https://react.dev/) · [Vite](https://vitejs.dev/) · [TypeScript](https://www.typescriptlang.org/)
- [Three.js](https://threejs.org/) · [ECharts](https://echarts.apache.org/) · [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/) · [Radix UI](https://www.radix-ui.com/)
- [DeepSeek](https://www.deepseek.com/) · [智谱 AI](https://www.zhipuai.cn/) · [Moonshot](https://www.moonshot.cn/)
- [火山引擎](https://www.volcengine.com/) TTS 语音合成
- [Vercel](https://vercel.com/) 部署平台

---

<p align="center">Made with ❤️ by the Hopkinson-Web Team</p>
