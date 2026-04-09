# 开发环境搭建

---

## 一、前置条件

| 工具 | 版本要求 | 说明 |
|------|---------|------|
| Node.js | >= 20.0.0 | 推荐使用 LTS 版本 |
| npm | >= 10.0.0 | Node.js 自带 |
| Git | 任意现代版本 | 代码版本控制 |
| 现代浏览器 | Chrome / Edge 最新 | 开发与测试 |

### 验证安装

```bash
node --version    # v20.x.x 或更高
npm --version     # 10.x.x 或更高
git --version
```

## 二、克隆项目

```bash
git clone https://github.com/qianban139/Hopkinson-Web.git
cd Hopkinson-Web
```

## 三、安装依赖

```bash
npm install
```

> 首次安装约需 1-3 分钟（取决于网络），将下载约 500+ 依赖包。

### 国内加速

如下载缓慢，可使用淘宝镜像：

```bash
npm config set registry https://registry.npmmirror.com
npm install
```

## 四、配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入你的 API Key：

```env
VITE_LLM_PROVIDER=deepseek
VITE_LLM_API_KEY=sk-your-actual-key-here
VITE_LLM_MODEL=deepseek-chat
```

详见 [环境变量参考](environment-variables.md)。

## 五、启动开发服务器

```bash
npm run dev
```

输出示例：

```
  VITE v7.2.4  ready in 856 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

打开浏览器访问 `http://localhost:5173/`。

### 局域网访问

```bash
npm run dev -- --host
```

可让局域网内其他设备访问。

## 六、其他命令

```bash
# 生产构建
npm run build

# 预览构建结果
npm run preview

# 代码规范检查
npm run lint
```

## 七、常用开发流程

### 7.1 修改前端代码

Vite HMR（热模块替换）会自动重新加载，无需手动刷新。

### 7.2 添加新依赖

```bash
npm install <package-name>
npm install -D <dev-package-name>
```

### 7.3 添加 shadcn/ui 组件

```bash
npx shadcn-ui@latest add <component-name>
```

### 7.4 类型检查

TypeScript 严格模式已启用，VS Code 会实时显示类型错误。

## 八、推荐 IDE 配置

### VS Code 插件

- **ESLint** — 实时代码规范检查
- **Tailwind CSS IntelliSense** — Tailwind 类名补全
- **TypeScript Vue Plugin (Volar)** — TypeScript 增强
- **Error Lens** — 内联错误显示
- **Pretty TypeScript Errors** — 友好的类型错误显示

### settings.json 推荐

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ]
}
```

## 九、常见问题

### Q: `npm install` 报错？
A: 删除 `node_modules` 和 `package-lock.json` 重试，或使用淘宝镜像。

### Q: 端口 5173 被占用？
A: 使用 `npm run dev -- --port 3000` 指定其他端口。

### Q: TypeScript 错误太多？
A: 项目启用了 strict 模式，所有警告都需修复。可在 `tsconfig.app.json` 临时调整。

### Q: AI 助手无响应？
A: 检查 `.env` 中的 `VITE_LLM_API_KEY` 是否配置正确并验证有效。

### Q: 视频不播放？
A: 视频托管在阿里云 OSS，需要网络连接。本地开发也需要联网。
