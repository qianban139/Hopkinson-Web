# v1.1 仓库清理 Checklist（2026-05-12）

> 由 Claude 生成，用户审核后**手动**执行。每项打勾后再提交。

## 建议删除（约 706 MB）

- [x] `public/界面设计.png` — 6.7 MB UI 设计稿，非生产资产 ✅ 已删 (2026-05-13)
- [x] `public/实验图片.gif` — 11 KB 早期演示 ✅ 已 `git rm` (2026-05-13)
- [ ] `public/assets/videos/` 整目录 — 699 MB；视频走阿里云 OSS（详见 `docs/deployment/oss-assets.md`），代码内零引用（grep `src/` 已确认）。**未跟踪状态，但 Claude 没有 `rm -rf` 权限，由用户手动执行**：
  - Windows 资源管理器：进入 `C:\Users\Lenovo\Desktop\work\Hopkinson-Web\public\assets\videos`，全选 → Shift+Delete 永久删除
  - 或 PowerShell：`Remove-Item -Recurse -Force public\assets\videos`
  - 或 git bash：`rm -rf public/assets/videos`

> `context/` 与 `.claude/` 目录已被 `.gitignore` 忽略，**不在仓库中**，无需删除。

## 不动（保留）

- `public/models/new_hopkinson.bin + .gltf` — 41 MB，3D 数字孪生在用（`GLTFModel.tsx`）
- `dist/` — 已在 `.gitignore`
- `node_modules/` — 已在 `.gitignore`

## 评估后再决定

无。
