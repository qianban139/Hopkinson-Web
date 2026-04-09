# 语音交互管线

> 唤醒词 → ASR → 意图解析 → LLM → TTS → 播放

---

## 一、完整管线

```
麦克风输入
    │
    ▼
┌─────────────┐
│ 唤醒词检测    │  Picovoice Porcupine "小智"
│ Porcupine   │
└──────┬──────┘
       │ 唤醒
       ▼
┌─────────────┐
│  VAD 检测    │  Voice Activity Detection
│             │  (检测开始/结束说话)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 语音识别 ASR │  Web Speech API / 浏览器原生
│             │  (优先) 或云端 ASR
└──────┬──────┘
       │ 文本
       ▼
┌─────────────┐
│  意图解析     │  aiIntentParser
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  LLM 对话    │  llmService (流式输出)
└──────┬──────┘
       │ 文本
       ▼
┌─────────────┐
│ 语音合成 TTS │  火山引擎 TTS (优先)
│             │  或 Web Speech API (降级)
└──────┬──────┘
       │ 音频
       ▼
   扬声器播放
```

## 二、核心服务

| 服务 | 文件 | 职责 |
|------|------|------|
| 唤醒词引擎 | `porcupineEngine.ts` | Picovoice Porcupine SDK 封装 |
| 唤醒词监听 | `useWakeWordListener.ts` | React Hook，唤醒词激活 |
| VAD 检测 | `vadService.ts` | 静音/说话状态检测 |
| TTS 合成 | `volcanoTTS.ts` | 火山引擎 TTS API |
| TTS 配置 | `ttsSettings.ts` | 音色、语速配置管理 |
| 实时管线 | `realtimeVoicePipeline.ts` | 端到端语音对话管道 |
| 实时语音 Hook | `useRealtimeVoice.ts` | 实时模式 React Hook |
| 语音交互 Hook | `useVoiceInteraction.ts` | 通用语音交互 Hook |

## 三、唤醒词

### 配置

- **引擎**：Picovoice Porcupine（浏览器端）
- **唤醒词**：「小智」
- **响应时间**：< 200ms
- **离线运行**：无需网络

### 工作模式

- **持续监听**：浏览器麦克风权限 + 后台监听
- **激活反馈**：唤醒后播放提示音 + AI 球状态变化

## 四、TTS 语音合成

### 火山引擎 TTS（首选）

- **集群**：`volcano_mega_tts` (大模型语音合成)
- **音色**：`zh_male_jieshuoxiaoming_moon_bigtts` (默认)
- **可选音色**：BV700_V2 (灿灿)、BV406 (梓梓)、BV001 (通用女声)
- **API 代理**：`/api/tts/v3` (Vercel Serverless Function)

### Web Speech API（降级）

当火山引擎未配置或失败时自动降级。

## 五、ASR 语音识别

### Web Speech API（首选）

- **接口**：`webkitSpeechRecognition`
- **语言**：`zh-CN`
- **连续模式**：支持长语音输入
- **临时结果**：实时显示识别中文本

### 降级处理

不支持 Web Speech API 的浏览器降级为文字输入。

## 六、VAD 语音活动检测

`vadService.ts` 检测用户是否在说话：
- **开始说话**：触发录音/识别
- **静音 1 秒**：自动结束识别
- **AI 说话时**：自动暂停 ASR，避免回声

## 七、状态管理

```typescript
type AIAssistantStatus = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';
```

| 状态 | 说明 | 视觉反馈 |
|------|------|---------|
| `idle` | 待机 | AI 球缓慢呼吸 |
| `listening` | 正在听 | AI 球波纹扩散 |
| `thinking` | LLM 处理中 | AI 球旋转 |
| `speaking` | 正在说话 | AI 球音波动画 |
| `error` | 错误 | AI 球红色闪烁 |

## 八、典型对话示例

```
用户: "小智"
[唤醒音] AI 球波纹动画
用户: "我想测试一下 5A06 铝合金"
AI: "好的，5A06 铝合金。你想测什么应变率？"
用户: "1500"
AI: "1500/s 是中等应变率。需要高温环境吗？"
用户: "不用"
AI: "明白。我帮你设置好参数：电压 2200V，脉宽 500μs。要开始安全检查吗？"
```
