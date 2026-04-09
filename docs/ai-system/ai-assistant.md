# AI 对话助手

> 意图解析 + 动作注册 + 对话管理 + 安全守护

---

## 一、模块结构

```
src/features/ai-assistant/
├── AICommandCenter.tsx          # 主面板（可拖拽/缩放/全屏）
├── AIFloatingOrb.tsx            # 浮动入口球
├── services/
│   ├── aiConversationManager.ts # 对话管理
│   ├── aiIntentParser.ts        # 意图解析
│   ├── safetyGuardian.ts        # 安全守护
│   ├── memoryService.ts         # 对话记忆
│   └── proactiveAssistant.ts    # 主动建议
└── hooks/
    └── useAIOrchestrator.ts     # 系统编排
```

## 二、对话流程

```
用户输入
   │
   ▼
┌──────────────┐
│ 意图解析       │ ──► 命令型 / 询问型 / 闲聊型
│ aiIntentParser│
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 安全守护       │ ──► 危险动作拦截
│ safetyGuardian│
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 动作执行       │ ──► 页面导航 / 参数设置 / 工作流启动
│  或 LLM 对话   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 对话管理       │ ──► 历史记录 / 上下文维护
│ Conversation │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 渲染响应       │ ──► Markdown + 数学公式 + 语音播报
│ MarkdownMessage│
└──────────────┘
```

## 三、AICommandCenter 组件

主对话面板，特性：
- **可拖拽**：通过 Drag handle 移动位置
- **可缩放**：从最小尺寸到全屏
- **位置持久化**：localStorage 保存上次位置
- **多模式**：popup（弹出）/ sidebar（侧栏）/ fullscreen（全屏）

### 状态管理

由 `useAppStore` 管理：
- `isAssistantOpen` — 开关
- `assistantMode` — 工作模式（chat / experiment）
- `assistantDisplayMode` — 显示模式
- `assistantStatus` — 状态（idle / listening / speaking / processing）

## 四、意图解析

`aiIntentParser.ts` 将自然语言映射到平台动作：

| 用户输入示例 | 解析结果 |
|------------|---------|
| "打开虚拟实验室" | `navigate: /lab` |
| "选择 5A06 铝合金" | `setMaterial: metal-01` |
| "电压调到 2500" | `setParam: voltage=2500` |
| "开始实验" | `startWorkflow` |
| "解释一下 J-C 模型" | `chat` (调用 LLM) |

## 五、对话记忆

`memoryService.ts` 维护多轮对话上下文：
- 最近 N 轮对话历史
- 当前实验参数快照
- 用户偏好（如简洁模式）

## 六、主动建议

`proactiveAssistant.ts` 在以下时机主动给出建议：
- 用户长时间未操作
- 实验参数异常
- 实验完成后引导分析
- 安全风险出现时

## 七、动作类型

| 类型 | 示例 | 处理方式 |
|------|------|---------|
| 导航 | "打开 X 页面" | `useAppStore.setNavigateTo()` |
| 参数设置 | "电压设为 X" | `useAppStore.setExperimentParams()` |
| 工作流控制 | "开始/暂停/停止实验" | `useExperimentWorkflow.*` |
| 数据查询 | "查看上次结果" | 读取 `useExperimentDataBus` |
| 知识问答 | "什么是 SHPB" | LLM 调用 |
