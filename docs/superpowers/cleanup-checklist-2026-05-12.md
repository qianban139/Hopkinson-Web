# v1.1 仓库清理 Checklist（2026-05-12）

> 由 Claude 生成，用户审核后**手动**执行。每项打勾后再提交。

## 建议删除（约 706 MB）

- [x] `public/界面设计.png` — 6.7 MB UI 设计稿，非生产资产 ✅ 已删 (2026-05-13)
- [x] `public/实验图片.gif` — 11 KB 早期演示 ✅ 已 `git rm` (2026-05-13)
- [x] `public/assets/videos/` 整目录 — 699 MB ✅ 用户手动移走 (2026-05-13)。视频走阿里云 OSS（详见 `docs/deployment/oss-assets.md`）。

## 验证结果

- `public/` 总大小：746 MB → 41 MB（仅剩 GLTF 3D 模型 + logo + qr）
- 共释放 **705 MB** 仓库本地存储
- git ls-files 中 `public/` 仅 8 个文件被跟踪（logo/background/models/qr×4）

> `context/` 与 `.claude/` 目录已被 `.gitignore` 忽略，**不在仓库中**，无需删除。

## 不动（保留）

- `public/models/new_hopkinson.bin + .gltf` — 41 MB，3D 数字孪生在用（`GLTFModel.tsx`）
- `dist/` — 已在 `.gitignore`
- `node_modules/` — 已在 `.gitignore`

## 评估后再决定

无。
