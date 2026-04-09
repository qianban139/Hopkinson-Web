# 多模型 LLM 服务

> 统一抽象层支持 4 家 LLM 提供商

---

## 一、源文件

`src/services/llmService.ts`

## 二、支持的提供商

| 提供商 | 配置值 | 默认模型 | 申请地址 |
|--------|--------|---------|---------|
| 智谱 AI | `zhipu` | glm-4-flash | https://open.bigmodel.cn/ |
| Moonshot | `moonshot` | moonshot-v1-8k | https://platform.moonshot.cn/ |
| DeepSeek | `deepseek` | deepseek-chat | https://platform.deepseek.com/ |
| OpenAI | `openai` | gpt-4o-mini | https://platform.openai.com/ |

## 三、抽象层设计

### ProviderConfig 接口

```typescript
interface ProviderConfig {
  name: string;
  baseUrl: string;
  modelName: string;
  formatBody: (messages, model, tools?) => object;
  extractContent: (data: any) => string;
  extractStreamContent: (line: string) => string | null;
}
```

每个提供商通过该接口适配自身的 API 格式差异。

### 切换提供商

```env
# .env 文件
VITE_LLM_PROVIDER=deepseek
VITE_LLM_API_KEY=your_key
VITE_LLM_MODEL=deepseek-chat
```

## 四、消息格式

### 多模态消息

```typescript
type MessageContent = string | Array<{
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string; detail?: 'low' | 'high' | 'auto' };
}>;
```

支持文本 + 图像混合输入（用于实验照片分析）。

### Chat 消息

```typescript
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: MessageContent;
}
```

## 五、Tool Calling 支持

```typescript
interface LLMTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}
```

LLM 可调用前端注册的工具函数，实现：
- 程序化页面导航
- 实验参数修改
- 数据查询

## 六、System Prompt 设计

平台为 LLM 注入的 System Prompt 包含：

1. **角色定位**：「数智化电磁驱动霍普金森杆多场耦合动态测试系统」AI 助手
2. **职责说明**：
   - 回答 SHPB 实验专业问题
   - 引导用户完成实验设置
   - 解释实验结果和数据含义
   - 检查参数安全性
3. **领域知识**：
   - SHPB 一维应力波理论
   - Johnson-Cook 本构方程
   - 电磁驱动原理
   - 三级 AI 闭环算法
   - 7 大类材料动态力学特性
   - 安全阈值（电压 ≤ 4000V，电流 ≤ 50kA，储能 ≤ 36kJ）
4. **对话规则**：
   - 每次只问一个问题
   - 按步骤引导（材料 → 参数 → 执行）
   - 回复控制在 80 字以内
   - 简洁友好的语气

## 七、流式输出

所有提供商支持 Server-Sent Events (SSE) 流式输出，提升对话响应速度。
`extractStreamContent` 函数适配各提供商的流式数据格式。

## 八、降级策略

| 失败情况 | 降级方案 |
|---------|---------|
| API Key 未配置 | 使用预设回复 |
| 网络超时 | 显示重试提示 |
| 速率限制 | 切换备用提供商 |
| 模型不支持图像 | 仅处理文本部分 |
