# v1.1 仓库清理 Checklist（2026-05-12）

> 由 Claude 生成，用户审核后**手动**执行。每项打勾后再提交。

## 建议删除（约 706 MB）

- [ ] `public/界面设计.png` — 6.7 MB UI 设计稿，非生产资产
- [ ] `public/实验图片.gif` — 11 KB 早期演示
- [ ] `public/assets/videos/` 整目录 — 699 MB；视频走阿里云 OSS（详见 `docs/deployment/oss-assets.md`），代码内零引用（grep `src/` 已确认）

> `context/` 与 `.claude/` 目录已被 `.gitignore` 忽略，**不在仓库中**，无需删除。

## 一次性执行示例

如确认全部可删，可以：

```bash
# 移除已 untracked 但占空间的视频副本
rm -rf public/assets/videos

# 删除已 tracked 的设计稿
git rm public/界面设计.png public/实验图片.gif

# 提交
git add -A
git commit -m "chore(repo): 清理 706 MB 冗余资产 (视频走 OSS / 删设计稿)"
```

## 不动（保留）

- `public/models/new_hopkinson.bin + .gltf` — 41 MB，3D 数字孪生在用（`GLTFModel.tsx`）
- `dist/` — 已在 `.gitignore`
- `node_modules/` — 已在 `.gitignore`

## 评估后再决定

无。
