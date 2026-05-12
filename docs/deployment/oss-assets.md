# 阿里云 OSS 资产托管

> 大体积视频/模型等静态资产**不**进 Vercel 构建产物，统一托管阿里云 OSS。

## Bucket 信息

| 字段 | 值 |
|---|---|
| Bucket | `hopkinson-assets` |
| Region | 杭州（cn-hangzhou） |
| Endpoint | `https://hopkinson-assets.oss-cn-hangzhou.aliyuncs.com` |
| 访问权限 | 公开读 |
| 鉴权 | 无（前端直引） |

## 目录结构

```
oss://hopkinson-assets/
├── videos/        # 实验演示视频 (.mp4, ≤ 50 MB / 文件)
└── models/        # 备用 3D 模型 (.gltf + .bin)（首选仍在 public/models/）
```

## 现有引用

| 资产 URL | 引用位置 |
|---|---|
| `videos/3Dmodel.mp4` | `src/pages/VirtualLab.tsx:1543` |
| `videos/xiaotiao.mp4` | `src/pages/Home.tsx:391` |

## 上传规范

1. 文件命名：小写英文 + 短横，禁止空格与中文。
2. 视频压缩：H.264 / 1080p / 2-5 Mbps / .mp4。
3. 上传后在 OSS 控制台确认 ACL = 公开读。
4. 前端引用统一写绝对 URL：
   ```ts
   const VIDEO_URL = 'https://hopkinson-assets.oss-cn-hangzhou.aliyuncs.com/videos/<file>.mp4';
   ```
5. 不要把视频原文件放到 `public/assets/videos/`（已加 `.gitignore`）。

## 跨域

- 当前为静态资源直引（`<video>` / `<img>` / `<link>`），**无跨域问题**。
- 若未来要 `fetch()` OSS 资源，需在 OSS 控制台为 bucket 配置 CORS 规则，允许 Vercel 域名 GET。

## 故障排查

- 视频加载 403：检查 ACL 是否被改成"私有"。
- 跨区域延迟高：考虑开启 OSS CDN 加速（`cdn.oss-cn-hangzhou.aliyuncs.com`），本次不做。
