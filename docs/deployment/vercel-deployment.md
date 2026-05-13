# Vercel 部署指南

---

## 一、Vercel 部署优势

| 优势 | 说明 |
|------|------|
| 零配置部署 | Vite 项目自动识别构建命令 |
| 自动 CI/CD | Git push 触发自动部署 |
| 免费 HTTPS | 自动签发 SSL 证书 |
| 全球 CDN | 边缘节点加速访问 |
| Serverless Functions | 支持后端 API（如 TTS 代理） |
| 预览部署 | 每个 PR 生成预览 URL |

## 二、首次部署

### 2.1 Fork / Clone 项目到自己的 GitHub

```bash
git clone https://github.com/qianban139/Hopkinson-Web.git
cd Hopkinson-Web
git remote set-url origin https://github.com/your-username/Hopkinson-Web.git
git push -u origin master
```

### 2.2 在 Vercel 导入项目

1. 访问 https://vercel.com
2. 用 GitHub 账号登录
3. 点击「Add New Project」
4. 选择你的 Hopkinson-Web 仓库
5. Vercel 会自动识别为 Vite 项目

### 2.3 配置构建参数

| 选项 | 值 |
|------|------|
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |
| Node Version | 20.x |

### 2.4 配置环境变量

参见 [环境变量参考](environment-variables.md)。

在 Vercel 项目 Settings → Environment Variables 中添加：

- `VITE_LLM_PROVIDER`
- `VITE_LLM_API_KEY`
- `VITE_LLM_MODEL`
- `VITE_VOLCANO_APP_ID`
- `VITE_VOLCANO_ACCESS_TOKEN`
- `VITE_VOLCANO_VOICE_TYPE`
- `VITE_VOLCANO_CLUSTER`

### 2.5 部署

点击「Deploy」，Vercel 自动构建并部署。

预计 2-5 分钟完成。

## 三、vercel.json 配置

项目根目录的 `vercel.json` 包含：

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*\\.(js|css|woff2|png|jpg|svg|ico))",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

### 关键配置

- **SPA 路由 fallback**：所有非 API 请求 fallback 到 `index.html`，让 React Router 处理路由
- **API 路由**：`/api/*` 路由到 Vercel Serverless Functions
- **静态资源缓存**：1 年长缓存（带 hash 文件名）

## 四、Serverless Functions

### TTS 代理

`api/tts.ts` 是 Vercel Serverless Function，用于代理火山引擎 TTS 请求（避免浏览器 CORS 问题）。

请求路径：`/api/tts/v3`

## 五、自动部署

### Git Hooks

| 触发条件 | 部署类型 |
|---------|---------|
| Push 到 master | 生产部署（Production） |
| Push 到其他分支 | 预览部署（Preview） |
| 创建 PR | 预览部署 + PR 评论 |

### 部署 URL

- **生产**：`https://hopsinsonbar-qianban139s-projects.vercel.app`
- **预览**：`https://hopsinsonbar-git-{branch}-qianban139s-projects.vercel.app`

## 六、构建优化

### 6.1 减小包体积

- 大视频文件使用阿里云 OSS 外部托管
- 第三方库使用 ESM 按需引入
- Vite 自动 code splitting

### 6.2 视频外部托管

视频文件（>10MB）不适合直接打包，使用 OSS 托管：
- 配置 CORS 允许 Vercel 域名
- 使用 `crossOrigin="anonymous"` 属性

### 6.3 字体优化

KaTeX 字体使用 CDN 加载，避免增加包体积。

## 七、监控与日志

### Vercel Dashboard

- **Deployments**：所有部署历史
- **Analytics**：访问统计、性能数据
- **Logs**：Serverless Function 日志
- **Speed Insights**：Core Web Vitals

### 错误追踪

可集成 Sentry 等错误追踪工具：

```bash
npm install @sentry/react
```

## 八、回滚与重新部署

### 回滚到旧版本

1. 进入 Vercel Deployments
2. 找到目标版本
3. 点击「⋯」→ Promote to Production

### 强制重新部署

1. Deployments → Latest → ⋯ → Redeploy
2. 选择 「Use existing Build Cache」或 「Redeploy with new build」

## 九、常见问题

### Q: 部署失败显示 TypeScript 错误？
A: `vite build` 默认不运行 `tsc`，但仍可能因严格模式失败。检查本地 `npm run build` 是否成功。

### Q: 环境变量不生效？
A: 修改环境变量后需要触发新部署才会生效。

### Q: 404 错误？
A: 确认 `vercel.json` 包含 SPA fallback rewrites。

### Q: 构建超时？
A: Vercel 免费版构建时长上限 45 分钟。检查依赖是否过多，考虑优化。
