# 宝塔面板部署指南

> 目标:在宝塔面板上跑起 PostgreSQL 16 + FastAPI + Vite 静态前端 + Nginx 反代,绑定 HTTPS 域名。

---

## 0. 前置假设

- Linux 服务器(CentOS 7+ / Ubuntu 20.04+),已装宝塔面板 7.x+
- 公网域名已解析到本机 IP
- 服务器至少 2C/4G/40G,**`torch` CPU 包占 ~800MB 磁盘**
- 已有项目代码可 git clone(或手动上传)

---

## 1. 软件准备(宝塔 → 软件商店)

| 软件 | 版本 | 备注 |
|:--|:--|:--|
| Nginx | 1.24+ | 反向代理 + 静态文件托管 |
| PostgreSQL | 16 | 安装后用宝塔配置端口 5432 |
| Python 项目管理器 | 最新 | 拉 Python 3.11 |
| Node.js 版本管理器 | 最新 | 拉 Node 20+ 用于前端构建 |
| pgAdmin 4 | (可选) | PG 图形管理;或装 phpPgAdmin |

---

## 2. 创建数据库

宝塔 → 数据库 → PostgreSQL → **添加数据库**:

- 数据库名:`hopkinson`
- 用户:`hopkinson_user`
- 密码:`openssl rand -base64 24` 生成强密码
- 编码:`UTF8`

记下 `DATABASE_URL`:
```
postgresql+asyncpg://hopkinson_user:<password>@127.0.0.1:5432/hopkinson
```

---

## 3. 创建网站 + SSL

宝塔 → 网站 → **添加站点**:

- 域名:`hopkinson.<your-domain>`
- 根目录:`/www/wwwroot/hopkinson/Hopkinson-Web/dist`(后面会建)
- PHP 版本:**纯静态**(我们不用 PHP)

申请 SSL:**网站设置 → SSL → Let's Encrypt → 申请** → 强制 HTTPS

---

## 4. 拉代码 + 构建前端

```bash
cd /www/wwwroot
git clone <repo> hopkinson
cd hopkinson/Hopkinson-Web

# 前端
echo "VITE_BACKEND_URL=https://hopkinson.<your-domain>" > .env.production
npm ci
npm run build
# → 产物在 dist/
```

---

## 5. 部署后端

```bash
cd /www/wwwroot/hopkinson/Hopkinson-Web/hopkinson-backend

# 创建 venv
python3.11 -m venv .venv
source .venv/bin/activate

# 装依赖(torch CPU 单独装,小一倍)
pip install --index-url https://download.pytorch.org/whl/cpu torch
pip install -r requirements.txt

# 写 .env(生产)
cat > .env <<EOF
DATABASE_URL=postgresql+asyncpg://hopkinson_user:<password>@127.0.0.1:5432/hopkinson
JWT_SECRET=$(openssl rand -base64 48)
SESSION_SECRET=$(openssl rand -base64 48)
ADMIN_PASSWORD=$(openssl rand -base64 16)
CORS_ORIGINS=https://hopkinson.<your-domain>
ENV=production
EOF
chmod 600 .env

# 建表(走 Alembic,不用 create_all)
alembic upgrade head

# 种子数据(21 种材料 + admin)
python -m db.seed

# 训练 ML 模型(LSTM ~3s + PPO ~10s,~65 KB checkpoint)
python -m ml.training all
```

---

## 6. systemd 守护(推荐)

新建 `/etc/systemd/system/hopkinson-api.service`:

```ini
[Unit]
Description=Hopkinson Backend API
After=network.target postgresql.service

[Service]
Type=simple
User=www
WorkingDirectory=/www/wwwroot/hopkinson/Hopkinson-Web/hopkinson-backend
EnvironmentFile=/www/wwwroot/hopkinson/Hopkinson-Web/hopkinson-backend/.env
ExecStart=/www/wwwroot/hopkinson/Hopkinson-Web/hopkinson-backend/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=3
StandardOutput=append:/var/log/hopkinson-api.log
StandardError=append:/var/log/hopkinson-api.err.log

[Install]
WantedBy=multi-user.target
```

启动:
```bash
systemctl daemon-reload
systemctl enable --now hopkinson-api
systemctl status hopkinson-api
```

> **注意**:不要同时用宝塔 Python 项目管理器和 systemd 启动同一个进程,会抢端口。二选一,推荐 systemd。

---

## 7. Nginx 反代配置

宝塔 → 网站 → 选站点 → **配置文件**,在 `server { ... }` 内追加:

```nginx
# 前端静态(SPA fallback)
location / {
    root /www/wwwroot/hopkinson/Hopkinson-Web/dist;
    try_files $uri $uri/ /index.html;
}

# REST API
location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# WebSocket(实验波形 + 监控)
location /ws/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}

# 管理后台
location /admin {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

保存 → 重载 Nginx。

---

## 8. 计划任务 — 每日数据库备份

宝塔 → 计划任务 → **添加 Shell 脚本**:

- 任务类型:Shell 脚本
- 任务名:`hopkinson-db-backup`
- 执行周期:每天 03:00
- 脚本:
  ```bash
  BACKUP_DIR=/www/backup/hopkinson
  mkdir -p $BACKUP_DIR
  pg_dump -U hopkinson_user -h 127.0.0.1 hopkinson > $BACKUP_DIR/hopkinson-$(date +\%F).sql
  # 只保留最近 30 天
  find $BACKUP_DIR -name "hopkinson-*.sql" -mtime +30 -delete
  ```

---

## 9. 验收清单

```bash
# 健康检查
curl https://hopkinson.<domain>/api/health
# → {"status":"ok","version":"0.9.0",...}

# 注册 + 登录
curl -X POST https://hopkinson.<domain>/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"Demo1234","email":"d@d.com"}'

# ML 推理
TOKEN=...  # 从上面响应里拿
curl -X POST https://hopkinson.<domain>/api/optimization/suggest \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"material_id":"metal-01","current_voltage":2000,"current_pulse_width":500,"objective":"balanced"}'
# → 响应包含 "model_version":"v1.0.0-shpb-physics"

# 管理后台
# 浏览器打开 https://hopkinson.<domain>/admin/
# admin / 上面 .env 里的 ADMIN_PASSWORD
```

---

## 10. 常见问题

**Q: torch 装到一半磁盘满?**
A:`pip install --index-url https://download.pytorch.org/whl/cpu torch` 只装 CPU 版,~200MB;
完整版含 CUDA 是 800MB+。或改装更小的 `torch-cpu`(社区构建)。

**Q: WebSocket 连不上?**
A:Nginx 必须有 `Upgrade` / `Connection` 头转发。检查 location /ws/ 配置;
还要确保 `proxy_read_timeout` ≥ 3600s,否则 WS 长连接会被超时切断。

**Q: 401 但 token 看着没问题?**
A:可能是 `JWT_SECRET` 在 .env 改过但 systemd 没重启:`systemctl restart hopkinson-api`。

**Q: alembic upgrade head 报 "Target database is not up to date"?**
A:检查 `alembic_version` 表当前版本号 vs `alembic/versions/` 下的最新版本号。
新建库直接 `alembic upgrade head` 即可;已有数据库需用 `alembic stamp <version>` 标记当前版本后再升级。
