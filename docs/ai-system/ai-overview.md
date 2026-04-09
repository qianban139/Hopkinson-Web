# AI 子系统总览

> 三级优化引擎 + 多模态对话助手 + 语音交互

---

## 一、AI 能力矩阵

```
┌─────────────────────────────────────────────────────┐
│                   AI 子系统                          │
├──────────────┬──────────────┬───────────────────────┤
│  优化引擎     │  对话助手     │    语音交互            │
│              │              │                       │
│ LSTM 预测    │ 意图解析      │  唤醒词检测            │
│ WGAN 增强    │ 动作注册      │  语音识别 (ASR)       │
│ PPO 搜索     │ 对话管理      │  语音合成 (TTS)       │
│              │ LLM 服务      │  VAD 活动检测          │
│              │ 安全守护      │                       │
└──────────────┴──────────────┴───────────────────────┘
```

## 二、模块关系

```
用户输入 (文字/语音)
    │
    ▼
┌──────────────────┐     ┌──────────────────┐
│  语音交互管线      │────►│  AI 对话助手       │
│  (ASR/TTS/VAD)   │     │  (意图/对话/LLM)  │
└──────────────────┘     └────────┬─────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
              页面导航       实验控制       参数优化
              navigateTo    workflow     optimization
                                           │
                                    ┌──────▼──────┐
                                    │  优化引擎     │
                                    │ LSTM→WGAN→PPO│
                                    └─────────────┘
```

## 三、文件结构

```
src/features/ai-assistant/
├── AICommandCenter.tsx          # AI 控制中心面板（可拖拽/缩放）
├── AIFloatingOrb.tsx            # 浮动 AI 球（入口动画）
├── AIHighlight.tsx              # UI 高亮引导
├── AINotificationToast.tsx      # AI 通知提示
├── AIOperationLog.tsx           # 操作日志面板
├── MarkdownMessage.tsx          # Markdown 消息渲染（含数学公式）
├── types.ts                     # OrbState 等 AI 类型
│
├── components/                  # AI 专用 UI 组件
├── hooks/
│   ├── useAIOrchestrator.ts     # AI 系统编排器
│   ├── useVoiceInteraction.ts   # 语音交互控制
│   ├── useWakeWordListener.ts   # 唤醒词监听
│   └── useRealtimeVoice.ts      # 实时语音处理
│
├── services/
│   ├── aiConversationManager.ts # 对话状态与历史管理
│   ├── aiIntentParser.ts        # 意图提取与分类
│   ├── safetyGuardian.ts        # 安全约束执行
│   ├── porcupineEngine.ts       # Porcupine 唤醒词引擎
│   ├── volcanoTTS.ts            # 火山引擎 TTS
│   ├── ttsSettings.ts           # TTS 配置（音色、语速）
│   ├── vadService.ts            # 语音活动检测
│   ├── realtimeVoicePipeline.ts # 实时语音管线
│   ├── memoryService.ts         # 对话记忆与上下文
│   ├── i18n.ts                  # 国际化（中/英）
│   ├── collaborationService.ts  # 多用户协作
│   └── proactiveAssistant.ts    # 主动式建议
│
└── utils/
    └── soundEffects.ts          # 音效工具
```

## 四、核心子系统

### 4.1 三级优化引擎

详见 [优化引擎文档](optimization-engine.md)

LSTM 参数扫描 → WGAN-GP 数据增强 → PPO 精细搜索

### 4.2 多模型 LLM 服务

详见 [LLM 集成文档](llm-integration.md)

支持 DeepSeek / 智谱 / Moonshot / OpenAI 四家 LLM 提供商。

### 4.3 AI 对话助手

详见 [AI 助手文档](ai-assistant.md)

意图解析 → 动作注册 → 对话管理 → 安全守护。

### 4.4 语音交互管线

详见 [语音交互文档](voice-interaction.md)

唤醒词 → ASR → 意图解析 → LLM → TTS → 播放。

### 4.5 安全检查系统

详见 [安全系统文档](safety-guardian.md)

三级预警 + 7 项安全检查 + 紧急停止。
