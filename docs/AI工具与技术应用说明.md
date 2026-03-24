## 1. 文档概述

### 1.1 项目简介

**数智化电磁驱动霍普金森杆多场耦合动态测试系统**（Hopkinson-Web）是一个科研级 Web 平台，用于材料在高应变率（10²~10⁴/s）条件下的动态力学性能测试。系统采用电磁驱动替代传统气体枪驱动，实现更精确的加载控制，并深度集成 AI 技术，实现从实验设计到数据分析的全流程智能化。

### 1.2 文档目的

本文档详细说明项目在**设计、开发、测试、运营**各环节中使用的 AI 工具、平台和技术，以及这些技术方案在真实科研场景中解决的具体问题。

---

## 2. AI技术全景图

| 项目环节 | AI工具/技术 | 类型 | 解决的核心问题 |
|---------|------------|------|--------------|
| 设计 | Anthropic Claude Code | AI辅助架构设计 | 快速生成项目架构、组件规范、领域知识文档 |
| 开发 | DeepSeek / OpenAI / 智谱AI / Moonshot | 大语言模型(LLM) | 实验引导对话、专业知识问答、参数推荐 |
| 开发 | 火山引擎 TTS（字节跳动） | 语音合成大模型 | 高质量中文语音输出，支持实验语音播报 |
| 开发 | Web Speech API | 浏览器语音识别 | 免手操作的语音指令输入 |
| 开发 | 意图解析引擎（正则+LLM Function Calling） | NLU自然语言理解 | 将自然语言转化为系统可执行操作 |
| 开发 | AI Orchestrator 编排引擎 | AI Agent | 协调意图解析、动作执行、反馈闭环 |
| 开发 | LSTM / WGAN-GP / PPO | 深度学习算法 | 应力波预测、最优波形生成、实验参数自适应优化 |
| 开发 | Kimi Plugin Inspect React | AI调试插件 | 组件状态可视化调试 |
| 测试 | TypeScript 严格模式 + ESLint | 静态类型分析 | AI生成代码的质量保障与类型安全 |
| 运营 | AI安全阈值监控 | 智能监控 | 实时参数异常检测与分级预警 |

---

## 3. 设计阶段：AI辅助架构设计

### 3.1 使用工具：Anthropic Claude Code

**工具说明：** Claude Code 是 Anthropic 官方的 AI 编程助手 CLI 工具，集成于项目开发环境中，用于辅助系统架构设计、代码规范制定和领域知识整理。

**在项目中的应用：**

- **项目自定义指令**（`.claude/Hopkinson_Bar_Web_Custom_Instructions.md`）：定义了完整的技术栈约束、代码规范、项目结构、领域知识和 AI 助手对话设计原则，作为 Claude Code 的上下文指令使用
- **项目上下文文档**（`.claude/context.md`）：项目摘要信息，辅助 AI 快速理解项目全貌
- **架构设计文档生成**（`context/WEBSITE_DESIGN_LOGIC.md`）：网站5大核心模块的完整架构逻辑
- **开发手册体系**（`docs/01~05`系列文档）：页面规格、实验流程、后端方案等

**解决的真实问题：**

| 问题 | AI解决方案 |
|------|----------|
| 霍普金森杆领域专业性强，开发者需快速掌握领域知识 | Claude Code 内嵌 SHPB 原理、公式、安全阈值等领域知识，确保代码实现的学术准确性 |
| 前端架构设计需同时考虑3D渲染、数据可视化、语音交互等多维需求 | AI辅助生成模块化架构方案，明确6个页面的职责分工和数据流 |
| 团队协作需统一代码规范 | 自动生成命名规范、组件结构规范、TypeScript 规则等 |

---

## 4. 开发阶段：AI技术深度集成

### 4.1 大语言模型（LLM）多模型集成

**技术文件：** `src/services/llmService.ts`

**集成的LLM平台：**

| 平台 | 模型 | API端点 | 特点 |
|------|------|--------|------|
| **DeepSeek**（当前默认） | deepseek-chat | `api.deepseek.com/v1` | 性价比高，中文理解能力强 |
| **OpenAI** | gpt-4o-mini | `api.openai.com/v1` | 通用能力强，多语言支持 |
| **智谱AI** | glm-4-flash | `open.bigmodel.cn/api/paas/v4` | 国产大模型，响应速度快 |
| **Moonshot Kimi** | moonshot-v1-8k | `api.moonshot.cn/v1` | 长上下文理解，适合实验文档分析 |

**技术实现要点：**

- **统一接口层**：通过 `ProviderConfig` 抽象层统一4家平台的请求/响应格式，业务层无感切换
- **流式输出**：`chatWithLLMStream()` 支持 SSE 流式响应，实时展示 AI 回复过程
- **对话历史管理**：`ConversationHistory` 类维护最近10轮对话上下文，保证连续对话的连贯性
- **环境变量配置**：通过 `.env` 文件中的 `VITE_LLM_PROVIDER`、`VITE_LLM_API_KEY`、`VITE_LLM_MODEL` 灵活切换模型
- **专业系统提示词**：内嵌 SHPB 实验原理、Johnson-Cook 本构模型公式、安全阈值等领域知识

**解决的真实问题：**

| 问题 | AI解决方案 |
|------|----------|
| 实验操作复杂，新手用户难以独立完成参数配置 | LLM 以对话方式逐步引导用户完成：材料选择 → 参数配置 → 安全检查 → 实验执行 |
| 不同材料的实验参数差异大，需要专业知识 | LLM 内嵌7大类材料的动态力学特性知识，提供智能参数推荐 |
| 实验结果解读需专业背景 | AI 自动解释应力-应变曲线含义、Johnson-Cook模型参数物理意义 |
| 单一模型可能不稳定或不可用 | 多模型架构保障服务可用性，可随时切换到备用模型 |

---

### 4.2 AI语音交互系统

#### 4.2.1 语音合成：火山引擎TTS

**技术文件：** `src/features/ai-assistant/services/volcanoTTS.ts`

**平台说明：** 火山引擎（Volcano Engine）是字节跳动旗下的云服务平台，其 TTS 服务基于大模型语音合成技术（`volcano_mega_tts` 集群），提供高质量、自然度极高的中文语音。

**技术实现：**

- **接口协议**：V3 HTTP Chunked 流式接口（`openspeech.bytedance.com/api/v3/tts`）
- **音色配置**：`zh_male_jieshuoxiaoming_moon_bigtts`（男性解说音色）
- **音频参数**：MP3格式、24kHz采样率、支持语速/音量/音调调节
- **流式处理**：逐块接收音频数据并合并，支持长文本实时播报
- **降级策略**：火山引擎不可用时自动降级到 Web Speech API

**配置参数（.env）：**
```
VITE_VOLCANO_APP_ID=6371804148
VITE_VOLCANO_VOICE_TYPE=zh_male_jieshuoxiaoming_moon_bigtts
VITE_VOLCANO_CLUSTER=volcano_mega_tts
```

#### 4.2.2 语音识别：Web Speech API

**技术文件：** `src/features/ai-assistant/hooks/useVoiceInteraction.ts`

**技术实现：**

- **识别引擎**：浏览器原生 `SpeechRecognition` API
- **唤醒词**：支持"小智"唤醒词检测（`useWakeWordListener.ts`）
- **连续监听**：`continuousMode` 支持持续语音输入
- **语音选择**：智能选择最佳中文语音（优先 Microsoft Online Natural 神经语音）
- **TTS优先级**：火山引擎 > Microsoft 在线神经语音 > 本地语音

**解决的真实问题：**

| 问题 | AI解决方案 |
|------|----------|
| 实验操作时双手被占用，无法使用键盘鼠标 | 语音指令控制实验全流程，解放双手 |
| 传统TTS机器感强，长时间使用体验差 | 火山引擎大模型语音合成，接近真人发音 |
| 实验环境嘈杂，语音识别准确率下降 | 唤醒词机制过滤噪音，降级方案保障可用性 |

---

### 4.3 自然语言意图解析引擎

**技术文件：** `src/features/ai-assistant/services/aiIntentParser.ts`

**架构设计：双层解析策略**

```
用户输入 → 快速正则匹配（<10ms）→ 命中？→ 直接执行
                                    ↓ 未命中
                              LLM Function Calling → 解析意图 → 执行
```

**第一层：快速正则匹配（`quickIntentMatch`）**

覆盖40+常用指令模式，包括：

| 指令类别 | 示例 | 对应动作 |
|---------|------|---------|
| 页面导航 | "去实验室"、"打开AI控制" | `navigate.toPage` |
| 参数设置 | "设置电压3000V"、"调整电流20kA" | `lab.setVoltage`, `lab.setCurrent` |
| 材料选择 | "使用Q235钢"、"换成Ti-6Al-4V" | `lab.selectMaterial` |
| 实验操作 | "开始实验"、"暂停实验"、"重置" | `lab.startExperiment` 等 |
| AI算法 | "启动LSTM"、"查看WGAN"、"训练PPO" | `ai.switchAlgorithm` 等 |
| 多场耦合 | "模拟深部矿井"、"运行仿真" | `multifield.selectScenario` 等 |
| 安全监控 | "执行安全检查"、"紧急停机" | `monitor.runSafetyCheck` 等 |

**第二层：LLM Function Calling（`buildFunctionCallingSystemPrompt`）**

- 当正则无法匹配时，将用户输入发送给 LLM 进行意图理解
- 使用 `[ACTION:actionId(params)]` 标记格式执行操作
- 支持复合意图检测（如"用Q235钢设置电压300V然后开始实验"）
- 提供完整的操作ID列表供 LLM 选择（导航、实验参数、AI优化、多场耦合、材料分析、系统监控共50+操作）

**解决的真实问题：**

| 问题 | AI解决方案 |
|------|----------|
| 科研人员表达方式多样，固定命令词难以覆盖 | 正则兜底常用指令，LLM兜底自然语言 |
| 纯LLM解析延迟高（1-3秒），影响操作体验 | 双层策略：正则<10ms响应常用指令，仅复杂语义走LLM |
| 用户可能在一句话中包含多个操作 | 复合意图检测与拆解执行 |

---

### 4.4 AI编排与对话管理

#### AI Orchestrator 编排引擎

**技术文件：** `src/features/ai-assistant/hooks/useAIOrchestrator.ts`

**职责：** 作为 AI 系统的中枢，协调意图解析、动作执行、UI反馈三个环节。

**工作流程：**

```
用户输入（语音/文字）
  → 意图解析（正则 / LLM）
  → 生成操作指令（AIOperation）
  → 执行动作（aiActionRegistry）
  → UI高亮目标元素（data-ai-target）
  → 状态通知（AINotificationToast）
  → 记录操作日志（AIOperationLog）
```

**核心能力：**
- **操作日志**：保留最近20条操作记录，含时间戳、动作ID、参数、执行状态
- **UI高亮**：执行动作时自动高亮目标DOM元素（通过 `data-ai-target` 属性），直观展示AI正在操作的区域
- **状态管理**：`OrbState` 状态机（idle → listening → thinking → executing → success/error）
- **可取消操作**：支持用户中途取消正在执行的操作

#### 对话管理器

**技术文件：** `src/features/ai-assistant/services/aiConversationManager.ts`

- 多轮对话上下文维护
- 系统提示词注入领域知识
- 对话历史滚动窗口（保留最近10轮）

#### 动作注册中心

**技术文件：** `src/features/ai-assistant/services/aiActionRegistry.ts`

- 注册50+可执行动作
- 每个动作映射到具体的 Zustand store 操作或路由跳转
- 支持运行时动态注册新动作

**解决的真实问题：**

| 问题 | AI解决方案 |
|------|----------|
| 传统实验软件交互复杂，学习成本高 | AI Agent 通过自然对话完成操作，零学习成本 |
| 操作过程不透明，用户不知道AI在做什么 | 操作日志 + UI高亮实时展示AI行为 |
| 多步骤实验流程容易遗漏环节 | AI编排引擎自动串联完整流程 |

---

### 4.5 三级AI闭环算法

**技术文件：** `src/pages/AIControl.tsx`

本系统创新性地引入**三级级联AI算法**，实现实验参数的智能优化闭环：

```
数据采集 → LSTM时序预测 → WGAN-GP波形生成 → PPO策略优化 → 输出最优参数
```

#### 第一级：LSTM 时序预测

| 项目 | 说明 |
|------|------|
| **算法** | Long Short-Term Memory（长短期记忆网络） |
| **用途** | 基于历史实验数据预测应力波传播过程 |
| **可调参数** | 学习率(0.0001~0.01)、隐藏层数(64~256)、批大小(16~128)、训练轮数(20~300) |
| **默认精度** | 92.4% |

#### 第二级：WGAN-GP 波形生成

| 项目 | 说明 |
|------|------|
| **算法** | Wasserstein GAN + Gradient Penalty（梯度惩罚Wasserstein生成对抗网络） |
| **用途** | 生成满足目标应变率的最优入射波形 |
| **可调参数** | 学习率(0.00005~0.005)、生成器层数(2~8)、批大小(16~128)、训练轮数(50~500) |
| **默认精度** | 88.1% |

#### 第三级：PPO 策略优化

| 项目 | 说明 |
|------|------|
| **算法** | Proximal Policy Optimization（近端策略优化） |
| **用途** | 强化学习闭环控制，自适应调整电磁驱动参数 |
| **可调参数** | 学习率(0.00005~0.005)、裁剪比率(0.1~0.4)、批大小(16~256)、策略迭代(3~30) |
| **默认精度** | 95.1% |

**解决的真实问题：**

| 问题 | AI解决方案 |
|------|----------|
| 传统实验需要反复试错确定最优参数，耗时耗材 | LSTM 预测减少无效实验次数 |
| 理想入射波形难以通过人工经验获得 | WGAN-GP 自动生成满足约束条件的最优波形 |
| 电磁驱动参数（电压、电流、脉宽）的耦合关系复杂 | PPO 强化学习自动探索最优参数组合 |
| 不同材料需要完全不同的实验策略 | 三级算法联合适应，实现跨材料自适应优化 |

---

### 4.6 AI辅助开发工具链

#### Kimi Plugin Inspect React

**配置文件：** `package.json`（devDependencies）、`vite.config.ts`（plugins）

```typescript
// vite.config.ts
import Inspect from 'kimi-plugin-inspect-react';
plugins: [Inspect(), react()]
```

**说明：** Kimi（月之暗面）提供的 React 组件检查插件，集成于 Vite 开发服务器，支持：
- 组件树可视化
- Props/State 实时查看
- 渲染性能分析

#### Claude Code 辅助编码

- 通过 `.claude/settings.local.json` 配置文件权限白名单
- 允许 Claude Code 直接读写项目源码文件
- 内嵌完整的项目规范和领域知识作为上下文

---

## 5. 测试阶段：AI辅助的质量保障

### 5.1 TypeScript 严格模式

**配置文件：** `tsconfig.app.json`

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  }
}
```

在AI辅助生成代码的场景下，TypeScript 严格模式充当"AI代码审查员"角色：
- 禁止 `any` 类型，确保 AI 生成的代码具有完整类型定义
- 检测未使用的变量和参数，防止 AI 生成冗余代码
- 强制类型检查所有 API 响应和 LLM 返回值

### 5.2 ESLint 静态分析

**配置文件：** `eslint.config.js`

- `react-hooks` 规则确保 Hooks 使用正确（AI常见错误模式）
- `react-refresh` 规则保障热更新兼容性
- `typescript-eslint` 推荐规则集覆盖常见类型问题

### 5.3 构建时类型检查

```json
"build": "tsc -b && vite build"
```

每次构建前强制执行完整的 TypeScript 类型检查，在 CI/CD 流程中拦截类型错误。

---

## 6. 运营阶段：AI驱动的实时监控与安全管理

### 6.1 智能安全阈值监控

**技术文件：** `src/services/safetyCheck.ts`

**监控参数与阈值：**

| 参数 | 警告阈值 | 危险阈值 | 说明 |
|------|---------|---------|------|
| 电压 | 3500V | 4000V | 电容器组充电电压 |
| 电流 | 40kA | 50kA | 线圈峰值电流 |
| 储能 | 30kJ | 36kJ | 电容器组总储能 |
| 温度 | 65°C | 80°C | 系统工作温度 |
| 电磁干扰 | - | 按材料设定 | EMI级别 |
| 应变率 | - | 按材料设定 | 超出材料适用范围 |

**智能特性：**

- **分级预警**：正常(normal) → 警告(warning) → 危险(danger) 三级状态
- **材料自适应**：不同材料的 EMI 阈值和应变率范围自动匹配
- **实时计算**：每次参数变更自动触发安全评估
- **紧急停机**：支持语音指令"紧急停机"触发 `monitor.emergencyStop`

### 6.2 系统监控仪表盘

**技术文件：** `src/pages/SystemMonitor.tsx`

- 实时参数仪表盘（电压、电流、温度、EMI）
- 告警历史记录与事件追踪
- 设备状态实时监测
- AI告警阈值可通过语音指令动态调整

### 6.3 数据总线与模块联动

**技术文件：** `src/store/useExperimentDataBus.ts`

- 实验数据在模块间实时流转
- 数据异常时自动触发安全检查
- 操作历史完整记录，支持事后审计

---

## 7. 真实场景问题解决方案

### 场景一：深部矿井岩石动态力学测试

**问题：** 深部矿井岩石在高围压、高温、高应变率条件下的力学行为复杂，传统实验参数设定困难。

**AI解决方案：**
- LLM 根据岩石类型自动推荐电压、电流、脉宽参数
- 多场耦合模块模拟围压+温度场叠加效应
- LSTM 预测应力波在不同围压下的传播特征
- PPO 自动优化加载方案

### 场景二：航空航天材料高速冲击响应

**问题：** 航空材料（如钛合金Ti-6Al-4V）在极端条件下的动态响应数据获取成本高。

**AI解决方案：**
- WGAN-GP 基于有限实验数据生成更多训练样本
- AI助手引导非专业人员完成复杂实验设置
- 自动生成包含 Johnson-Cook 参数的分析报告

### 场景三：新能源汽车电池碰撞安全评估

**问题：** 电池材料在碰撞冲击下的安全性评估需要大量重复实验。

**AI解决方案：**
- 三级算法优化实验效率，减少物理实验次数
- 多场耦合模拟热-力-电磁联合作用
- AI实时监控实验安全，异常自动停机保护

### 场景四：核反应堆防护材料验证

**问题：** 核环境特种材料测试安全要求极高，操作容错率低。

**AI解决方案：**
- 语音交互解放双手，适应防护装备操作环境
- AI安全检查在实验前自动验证所有参数
- 分级预警机制确保操作安全
- 紧急停机语音指令响应

### 场景五：科研教学与培训

**问题：** 霍普金森杆实验操作复杂，学生上手慢，设备昂贵不允许试错。

**AI解决方案：**
- AI助手作为虚拟教师，逐步引导实验全流程
- 2D/3D虚拟实验环境，零成本反复练习
- AI实时解答专业问题，降低教学负担
- 56条内置FAQ覆盖常见实验问题

---
