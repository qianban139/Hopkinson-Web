// src/services/llmService.ts
// 统一LLM服务层 - 支持多个大模型提供商，流式输出

export type MessageContent = string | Array<{
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string; detail?: 'low' | 'high' | 'auto' };
}>;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: MessageContent;
}

export interface LLMTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// 系统Prompt - 霍普金森杆实验AI助手
const SYSTEM_PROMPT = `你是"数智化电磁驱动霍普金森杆多场耦合动态测试系统"的AI助手。

你的职责：
1. 回答关于霍普金森杆实验的专业问题
2. 引导用户逐步完成实验设置（材料选择→参数配置→安全检查→实验执行）
3. 解释实验结果和数据含义
4. 在实验前检查参数安全性

你掌握的核心知识：
- SHPB(分离式霍普金森压杆)实验原理和一维应力波理论
- Johnson-Cook本构模型：σ = (A + Bεⁿ)(1 + C·ln(ε̇/ε̇₀))(1 - T*ᵐ)
- 电磁驱动原理：可调谐RLC链式电路、锥形次级线圈产生轴向电磁力
- 三级AI闭环算法：LSTM时序预测 → WGAN-GP波形生成 → PPO强化学习
- 7大类材料(金属、矿石、混凝土、陶瓷、高分子、泡沫吸能、生物仿生)的动态力学特性
- 安全阈值：电压≤4000V、电流≤50kA、储能≤36kJ、温度≤80°C

当用户说"开始实验"时，告知用户系统会引导他们完成实验设置。

对话规则（必须严格遵守）：
- 每次回复只问一个问题，不要一次性列出所有需要确认的内容
- 引导用户按步骤完成：先确认材料 → 再确认参数 → 最后确认执行
- 回复控制在80字以内，像朋友聊天一样简洁友好
- 收到用户回答后先确认理解，再问下一个问题`;

// 提供商配置
interface ProviderConfig {
  name: string;
  baseUrl: string;
  modelName: string;
  formatBody: (messages: ChatMessage[], model: string, tools?: LLMTool[]) => object;
  extractContent: (data: any) => string;
  extractStreamContent: (line: string) => string | null;
}

const PROVIDERS: Record<string, ProviderConfig> = {
  zhipu: {
    name: '智谱AI',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    modelName: 'glm-4-flash',
    formatBody: (messages, model, tools) => ({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 500,
      stream: false,
      ...(tools && tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
    }),
    extractContent: (data) => data.choices?.[0]?.message?.content || '',
    extractStreamContent: (line) => {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') return null;
      try {
        const json = JSON.parse(line.slice(6));
        // Skip tool call chunks — handled in non-streaming path
        if (json.choices?.[0]?.delta?.tool_calls) return null;
        return json.choices?.[0]?.delta?.content || null;
      } catch { return null; }
    },
  },
  moonshot: {
    name: 'Moonshot Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    modelName: 'moonshot-v1-8k',
    formatBody: (messages, model, tools) => ({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 500,
      stream: false,
      ...(tools && tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
    }),
    extractContent: (data) => data.choices?.[0]?.message?.content || '',
    extractStreamContent: (line) => {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') return null;
      try {
        const json = JSON.parse(line.slice(6));
        // Skip tool call chunks — handled in non-streaming path
        if (json.choices?.[0]?.delta?.tool_calls) return null;
        return json.choices?.[0]?.delta?.content || null;
      } catch { return null; }
    },
  },
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    modelName: 'deepseek-chat',
    formatBody: (messages, model, tools) => ({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 500,
      stream: false,
      ...(tools && tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
    }),
    extractContent: (data) => data.choices?.[0]?.message?.content || '',
    extractStreamContent: (line) => {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') return null;
      try {
        const json = JSON.parse(line.slice(6));
        // Skip tool call chunks — handled in non-streaming path
        if (json.choices?.[0]?.delta?.tool_calls) return null;
        return json.choices?.[0]?.delta?.content || null;
      } catch { return null; }
    },
  },
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    modelName: 'gpt-4o-mini',
    formatBody: (messages, model, tools) => ({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 500,
      stream: false,
      ...(tools && tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
    }),
    extractContent: (data) => data.choices?.[0]?.message?.content || '',
    extractStreamContent: (line) => {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') return null;
      try {
        const json = JSON.parse(line.slice(6));
        // Skip tool call chunks — handled in non-streaming path
        if (json.choices?.[0]?.delta?.tool_calls) return null;
        return json.choices?.[0]?.delta?.content || null;
      } catch { return null; }
    },
  },
};

// 信创合规守卫:生产环境禁用境外 LLM provider
// Why: 国赛评委 Q3 严评指出 GDPR/数据安全法/信创合规缺失,生产环境必须强制约束
// 仅允许 zhipu / moonshot / deepseek 等国产 provider 在 PROD 运行
const FOREIGN_PROVIDERS = new Set(['openai']);

function assertCompliantProvider(provider: string): void {
  if (import.meta.env.PROD && FOREIGN_PROVIDERS.has(provider)) {
    throw new Error(
      `[信创合规] 生产环境禁用境外 LLM provider "${provider}",请改用 zhipu / moonshot / deepseek。` +
      `详见 docs/deployment/environment-variables.md 合规章节。`
    );
  }
}

// 读取环境变量配置
function getConfig() {
  const provider = import.meta.env.VITE_LLM_PROVIDER || '';
  const apiKey = import.meta.env.VITE_LLM_API_KEY || '';
  const model = import.meta.env.VITE_LLM_MODEL || '';
  const baseUrl = import.meta.env.VITE_LLM_BASE_URL || '';
  if (provider) assertCompliantProvider(provider);
  return { provider, apiKey, model, baseUrl };
}

// 获取当前提供商配置
function getProviderConfig(): { config: ProviderConfig; apiKey: string; model: string; baseUrl: string } | null {
  const { provider, apiKey, model, baseUrl } = getConfig();
  if (!provider || !apiKey) return null;

  const providerConfig = PROVIDERS[provider];
  if (!providerConfig) return null;

  return {
    config: providerConfig,
    apiKey,
    model: model || providerConfig.modelName,
    baseUrl: baseUrl || providerConfig.baseUrl,
  };
}

// 对话历史管理
class ConversationHistory {
  private messages: ChatMessage[] = [];
  private maxRounds = 10;

  add(role: 'user' | 'assistant', content: string) {
    this.messages.push({ role, content });
    // 保留最近N轮 (每轮2条)
    if (this.messages.length > this.maxRounds * 2) {
      this.messages = this.messages.slice(-this.maxRounds * 2);
    }
  }

  getMessages(): ChatMessage[] {
    return [
      { role: 'system', content: SYSTEM_PROMPT },
      ...this.messages,
    ];
  }

  clear() {
    this.messages = [];
  }
}

// 全局对话历史实例
const conversationHistory = new ConversationHistory();

/**
 * 调用LLM API获取回复（非流式）
 * @param userMessage - 用户消息字符串，或完整的消息数组（含system/user/assistant）
 */
export async function chatWithLLM(
  userMessage: string | ChatMessage[],
  tools?: LLMTool[],
): Promise<string | null> {
  const providerInfo = getProviderConfig();
  if (!providerInfo) return null;

  const { config, apiKey, model, baseUrl } = providerInfo;

  let messages: ChatMessage[];
  if (Array.isArray(userMessage)) {
    // 直接使用传入的消息数组（来自useAIOrchestrator）
    messages = userMessage;
  } else {
    // 字符串模式：使用内部对话历史
    conversationHistory.add('user', userMessage);
    messages = conversationHistory.getMessages();
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(config.formatBody(messages, model, tools)),
    });

    if (!response.ok) {
      let errorDetail = '';
      try { errorDetail = await response.text(); } catch {}
      console.error(`LLM API error: ${response.status} ${response.statusText}`, errorDetail);
      return null;
    }

    const data = await response.json();
    const content = config.extractContent(data);

    if (content) {
      conversationHistory.add('assistant', content);
    }

    return content || null;
  } catch (error) {
    console.error('LLM API call failed:', error);
    return null;
  }
}

/**
 * 调用LLM API获取流式回复
 * @param userMessage - 用户消息字符串，或完整的消息数组（含system/user/assistant）
 * @param onChunk 每次收到新内容时回调
 * @returns 完整的回复文本
 */
export async function chatWithLLMStream(
  userMessage: string | ChatMessage[],
  onChunk: (chunk: string, accumulated: string) => void,
  tools?: LLMTool[],
): Promise<string | null> {
  const providerInfo = getProviderConfig();
  if (!providerInfo) return null;

  const { config, apiKey, model, baseUrl } = providerInfo;

  let messages: ChatMessage[];
  if (Array.isArray(userMessage)) {
    messages = userMessage;
  } else {
    conversationHistory.add('user', userMessage);
    messages = conversationHistory.getMessages();
  }

  try {
    // 流式模式不发送tools（部分提供商不支持 tools+stream 组合）
    const body = config.formatBody(messages, model);
    (body as any).stream = true;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok || !response.body) {
      let errorDetail = '';
      try { errorDetail = await response.text(); } catch {}
      console.error(`LLM stream error: ${response.status}`, errorDetail);
      return null;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const content = config.extractStreamContent(trimmed);
        if (content) {
          accumulated += content;
          onChunk(content, accumulated);
        }
      }
    }

    if (accumulated) {
      conversationHistory.add('assistant', accumulated);
    }

    return accumulated || null;
  } catch (error) {
    console.error('LLM stream call failed:', error);
    return null;
  }
}

/**
 * 检查LLM是否已配置
 */
export function isLLMConfigured(): boolean {
  return getProviderConfig() !== null;
}

/**
 * 获取当前LLM提供商名称
 */
export function getLLMProviderName(): string {
  const info = getProviderConfig();
  return info?.config.name || '未配置';
}

/**
 * 清除对话历史
 */
export function clearConversationHistory() {
  conversationHistory.clear();
}
