# 环境变量参考

> 所有环境变量均以 `VITE_` 前缀开头，由 Vite 注入到客户端。

---

## ⚠️ 安全提示

本平台所有环境变量都会被打包到客户端代码中，**任何敏感凭证不应提交到版本控制**。

`.gitignore` 已配置忽略 `.env` 文件，仅提交 `.env.example` 模板。

## 一、LLM 大模型配置

### `VITE_LLM_PROVIDER`

LLM 提供商选择。

| 值 | 提供商 | 信创合规 | 申请地址 |
|----|--------|:------:|---------|
| `zhipu` | 智谱 AI | ✅ 国产 | https://open.bigmodel.cn/ |
| `moonshot` | Moonshot | ✅ 国产 | https://platform.moonshot.cn/ |
| `deepseek` | DeepSeek | ✅ 国产 | https://platform.deepseek.com/ |
| `openai` | OpenAI | ❌ 境外 | https://platform.openai.com/ |

**默认值**:`deepseek`

#### ⚠️ 信创合规约束(2026 年起强制)

依据《数据安全法》《个人信息保护法》《关键信息基础设施安全保护条例》以及国家信创战略要求,本平台在**生产环境**(`import.meta.env.PROD === true`)启用了 LLM provider 强制约束:

- **允许**:`zhipu` / `moonshot` / `deepseek` 等国产大模型
- **禁用**:`openai` 等境外 provider — 启动时由 `src/services/llmService.ts:assertCompliantProvider()` 抛出 `[信创合规]` 错误并阻断加载
- **开发环境**(`npm run dev`)无此限制,便于本地测试

如确需在生产环境对比境外模型(仅限内部研发场景),需:
1. 在 `FOREIGN_PROVIDERS` 集合中临时移除该 provider
2. 通过中国境内代理 / 私有部署网关访问
3. 在数据出境前完成数据脱敏与合规评估

**为什么这样设计**:评委严评(`docs/competition-ppt/06-judge-review.md` Q3)指出 GDPR / 数据安全法 / 信创合规缺失,本守卫将"违规可能性"在代码层硬编码消除,而非依赖运维约定。

### `VITE_LLM_API_KEY`

LLM 提供商的 API 密钥。

**示例**：`sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

**获取方式**：在对应提供商平台注册并创建 API Key。

### `VITE_LLM_MODEL`

模型名称（可选，不填则使用默认）。

| 提供商 | 推荐模型 | 备选模型 |
|--------|---------|---------|
| 智谱 | `glm-4-flash` (免费) | `glm-4-plus` |
| Moonshot | `moonshot-v1-8k` | `moonshot-v1-32k` |
| DeepSeek | `deepseek-chat` | `deepseek-coder` |
| OpenAI | `gpt-4o-mini` | `gpt-4o` |

### `VITE_LLM_BASE_URL`

自定义 API 地址（可选），用于：
- 代理服务器
- 私有部署
- 兼容 OpenAI 接口的其他服务

**示例**：`https://api.proxy.com/v1`

## 二、火山引擎 TTS 配置

火山引擎语音合成服务（ByteDance）。如不配置，自动降级为浏览器原生 Web Speech API。

### `VITE_VOLCANO_APP_ID`

火山引擎应用 ID。

**获取方式**：
1. 访问 https://console.volcengine.com
2. 进入「语音技术 → 语音合成」
3. 创建应用，获取 App ID

### `VITE_VOLCANO_ACCESS_TOKEN`

火山引擎访问令牌。

### `VITE_VOLCANO_VOICE_TYPE`

音色选择。

| 值 | 音色 | 风格 |
|----|------|------|
| `zh_male_jieshuoxiaoming_moon_bigtts` | 解说小明 | 男声，专业 |
| `BV700_V2` | 灿灿 | 活泼女声 |
| `BV406` | 梓梓 | 温柔女声 |
| `BV001` | 通用 | 标准女声 |

更多音色：https://console.volcengine.com/speech/service/10007

### `VITE_VOLCANO_CLUSTER`

集群类型。

| 值 | 说明 |
|----|------|
| `volcano_mega_tts` | 大模型语音合成（推荐） |
| `volcano_tts` | 标准 TTS |

## 三、模板文件

完整的 `.env.example`：

```env
# LLM 配置
VITE_LLM_PROVIDER=deepseek
VITE_LLM_API_KEY=your_api_key_here
VITE_LLM_MODEL=deepseek-chat
VITE_LLM_BASE_URL=

# 火山引擎 TTS 配置
VITE_VOLCANO_APP_ID=your_app_id_here
VITE_VOLCANO_ACCESS_TOKEN=your_access_token_here
VITE_VOLCANO_VOICE_TYPE=zh_male_jieshuoxiaoming_moon_bigtts
VITE_VOLCANO_CLUSTER=volcano_mega_tts
```

## 四、Vercel 部署中配置

在 Vercel 项目设置中添加环境变量：

1. 进入 Vercel 项目 → Settings → Environment Variables
2. 逐项添加上述变量
3. 选择 Environment：Production / Preview / Development
4. 重新部署使变量生效

## 五、本地开发降级行为

| 缺失配置 | 降级行为 |
|---------|---------|
| `VITE_LLM_API_KEY` | AI 助手返回预设回复 |
| `VITE_VOLCANO_*` | TTS 自动切换到 Web Speech API |
| 全部缺失 | 平台仍可运行（仅限基础功能） |
