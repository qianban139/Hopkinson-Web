# Cloudflare Tunnel 部署执行清单

> 适用场景:阿里云国内 ECS 未 ICP 备案,无法开 80/443,但需要让 Vercel HTTPS 前端调到本机后端。
>
> 原理:cloudflared 进程从服务器**主动出站**连 Cloudflare 边缘,把 `https://api.hopkinson-lab.com` 反向暴露到本机 8000 端口。**不开放任何入站端口、不需要备案、Cloudflare 自动颁 HTTPS 证书**。

---

## 当前部署目标

| 项 | 值 |
|---|---|
| 服务器 | 阿里云 ECS `47.114.88.130`,Ubuntu 22.04,2C4G,到期 **2026-05-18** |
| 域名 | `hopkinson-lab.com`(已购,DNS 待迁 Cloudflare) |
| 后端入口 | `https://api.hopkinson-lab.com` |
| 前端 | `https://hopkinson-bar.vercel.app`(已部署,只需改环境变量) |

---

## Phase 1:域名迁 NS 到 Cloudflare(30 min)

1. 浏览器打开 https://dash.cloudflare.com → 注册免费账号
2. 仪表盘 → **Add a Site** → 输入 `hopkinson-lab.com` → 选 **Free Plan**
3. Cloudflare 给两个 NS,形如:
   ```
   xxx.ns.cloudflare.com
   yyy.ns.cloudflare.com
   ```
4. 登录原 DNS 商(阶司/阿里云/腾讯云域名管理) → 把域名 NS 改成上面两个
5. 等 5-30 分钟,然后在本地终端验证:
   ```bash
   nslookup -type=NS hopkinson-lab.com
   # 输出应包含 cloudflare.com 相关记录
   ```
6. 回 Cloudflare 仪表盘,域名状态会从 Pending 变成 Active

---

## Phase 2:服务器初始化(1 h)

```bash
# 1. SSH 进服务器(用阿里云控制台「远程连接」或本地 ssh)
ssh root@47.114.88.130

# 2. 装 Docker(一键)
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
docker --version           # 验证

# 3. 关阿里云安全组所有公网入站,仅留 22(SSH)
#    去阿里云控制台 → 安全组 → 配置规则 → 删除 80/443/8000/3306 等入站规则
#    保留:入站 22 端口、出站全放行(cloudflared 需要出站)

# 4. 拉代码到 /opt/hopkinson
mkdir -p /opt/hopkinson && cd /opt/hopkinson
git clone <你的 repo URL> .
#   如未公开,用 git clone https://<token>@github.com/<user>/Hopkinson-Web.git

cd hopkinson-backend
```

---

## Phase 3:后端启动(2 h)

### 3.1 写 `.env`(生产配置)

```bash
cd /opt/hopkinson/Hopkinson-Web/hopkinson-backend

# 生成随机密钥
PG_PWD=$(openssl rand -base64 24 | tr -d '=+/' | cut -c1-32)
JWT=$(openssl rand -base64 48)
SES=$(openssl rand -base64 48)
ADMIN=$(openssl rand -base64 12)

cat > .env <<EOF
APP_ENV=production

DATABASE_URL=postgresql+asyncpg://hopkinson:${PG_PWD}@postgres:5432/hopkinson
POSTGRES_PASSWORD=${PG_PWD}

JWT_SECRET=${JWT}
SESSION_SECRET=${SES}
ADMIN_PASSWORD=${ADMIN}

CORS_ORIGINS=https://hopkinson-bar.vercel.app,https://hopkinson-lab.com,https://api.hopkinson-lab.com

DB_ECHO=false
EOF
chmod 600 .env

# 抄一份 admin 密码到本机记事本(后续登录后台要用)
grep ADMIN_PASSWORD .env
```

### 3.2 构建 + 启动

```bash
docker compose up -d --build

# 等 ~3 min 后看日志(首次构建拉 Torch CPU 包约 800MB)
docker compose logs -f backend
# 看到 [DB] 数据库连接已建立 即就绪,Ctrl+C 退出 logs

# 建表
docker compose exec backend alembic upgrade head

# 种子(21 材料 + admin + 3 评委 + 8 条预置实验)
docker compose exec backend python -m db.seed

# 训练 LSTM + PPO 模型(约 15s,生成 ~65KB checkpoint)
docker compose exec backend python -m ml.training all

# 健康检查
curl http://127.0.0.1:8000/api/health
# 期望:{"status":"ok","version":"0.9.0","mode":"mock"}
```

---

## Phase 4:Cloudflare Tunnel(1 h)

### 4.1 装 cloudflared

```bash
curl -L \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb \
  -o /tmp/cloudflared.deb
dpkg -i /tmp/cloudflared.deb
cloudflared --version
```

### 4.2 登录 + 创建 Tunnel

```bash
cloudflared tunnel login
# 会输出一个 URL,**复制到本地浏览器**(已登录 Cloudflare 的浏览器)
# 选择 hopkinson-lab.com → Authorize
# 终端会自动收到证书

cloudflared tunnel create hopkinson-api
# 输出形如:
#   Tunnel credentials written to /root/.cloudflared/<UUID>.json
#   Created tunnel hopkinson-api with id <UUID>
# 把 <UUID> 抄下来
```

### 4.3 写配置文件

```bash
TUNNEL_ID=$(ls /root/.cloudflared/*.json | xargs -I{} basename {} .json)
cat > /root/.cloudflared/config.yml <<EOF
tunnel: ${TUNNEL_ID}
credentials-file: /root/.cloudflared/${TUNNEL_ID}.json

ingress:
  - hostname: api.hopkinson-lab.com
    service: http://localhost:8000
    originRequest:
      noTLSVerify: true
  - service: http_status:404
EOF
```

### 4.4 自动建 DNS CNAME + 守护

```bash
# 自动在 Cloudflare DNS 加 CNAME api.hopkinson-lab.com → <UUID>.cfargotunnel.com
cloudflared tunnel route dns hopkinson-api api.hopkinson-lab.com

# 装 systemd 守护
cloudflared service install
systemctl enable --now cloudflared
systemctl status cloudflared        # 应显示 active (running)

# 浏览器/curl 测试
curl https://api.hopkinson-lab.com/api/health
# 期望:{"status":"ok",...}
```

---

## Phase 5:Vercel 前端切换(30 min)

1. 打开 https://vercel.com/dashboard → 找到 Hopkinson 项目 → **Settings → Environment Variables**
2. 添加(或修改)以下变量,**全部三个环境(Production / Preview / Development)都勾选**:

   ```
   VITE_BACKEND_URL = https://api.hopkinson-lab.com
   ```

3. **可选**(仅在主链路挂掉时启用游客降级):
   ```
   VITE_DEMO_MODE = false   # 默认 false,挂了改 true 触发 redeploy
   ```

4. **Deployments** 标签 → 最新一次部署右上角 ⋯ → **Redeploy**(或 git push 触发)

5. 等 2-3 min 部署完成,打开 https://hopkinson-bar.vercel.app
6. F12 DevTools → Network 验证:
   - `https://api.hopkinson-lab.com/api/health` 返回 200 ✓
   - 登录页用 `judge1` / `Judge@2026` 一键登录,跳转工作台 ✓
   - 进虚拟实验室,看到 `wss://api.hopkinson-lab.com/ws/monitor` 连接 ✓

---

## Phase 6:演示加固(1 h)

- 登录页已加好 3 个评委账号快捷按钮(`judge1` / `judge2` / `judge3`,密码 `Judge@2026`)
- 录一份 5 分钟演示视频,作为现场断网兜底
- 演示前 10 分钟用手机 4G 打开 hopkinson-bar.vercel.app,跑一次端到端流程确认在线
- **续费提醒**:服务器 5/18 到期,在日历 5/15 加提醒续费

---

## 端到端验证清单

```bash
# 在你的 Windows / Mac 本地执行
nslookup api.hopkinson-lab.com           # 应解析到 Cloudflare IP(104.x / 172.x)
curl -I https://api.hopkinson-lab.com/api/health  # 200 OK
```

打开 https://hopkinson-bar.vercel.app:

- [ ] DevTools Network 无 Mixed Content / CORS 报错
- [ ] 登录页 3 个评委按钮可一键填充并登录
- [ ] 进虚拟实验室,WebSocket `wss://...` 连接成功,实时波形 1Hz 推送
- [ ] 触发 AI 优化,`/api/optimization/run` 返回真 LSTM/PPO 结果
- [ ] 导出报告 PDF 成功
- [ ] 三个评委账号登录后看到不同的预置实验记录(judge1=3 条,judge2=2 条,judge3=0 条)
- [ ] 后台管理 `https://api.hopkinson-lab.com/admin` 可用 admin / `<.env 的 ADMIN_PASSWORD>` 登录

---

## 故障排查

### `cloudflared tunnel login` 卡住
- 检查服务器能否出站访问 cloudflare.com:`curl -I https://cloudflare.com`
- 可能阿里云出站策略限制,改安全组「出站」全放行

### `https://api.hopkinson-lab.com` 返回 1033 / 502
- `systemctl status cloudflared` 看 tunnel 是否在跑
- `docker compose ps` 看 backend 是否健康
- `curl http://127.0.0.1:8000/api/health` 本机能否通

### 前端报 CORS
- 检查 `.env` 里 `CORS_ORIGINS` 是否包含 `https://hopkinson-bar.vercel.app`
- 改完 `.env` 后:`docker compose restart backend`

### Vercel 前端缓存了旧 URL
- Settings → Environment Variables → 改完后必须 **Redeploy**(改环境变量不会自动重建)

### 游客降级模式不工作
- Vercel 设 `VITE_DEMO_MODE=true` 后**必须 Redeploy**(Vite 环境变量编译时注入)
- 登录页底部会出现「游客离线演示」按钮

---

## Phase 7：前端自定义域名绑定（www.hopkinson-lab.com → Vercel）

> 适用场景:已购的 `hopkinson-lab.com` 不只用作后端 API,还要让前端用上品牌域名(替代 `hopkinson-bar.vercel.app`),避免演示时出现奇怪的子域。

### 7.1 排坑前情

**典型错误现象**(都指向同一个根因):
- 浏览器 `ERR_CONNECTION_REFUSED` —— DNS 还没生效或残留旧记录指向 ECS
- Vercel `404: NOT_FOUND` + `Code: DEPLOYMENT_NOT_FOUND` —— DNS 已到 Vercel 边缘,但**域名没绑定到具体项目**

**根因**:Vercel 账号顶层 Domains 列表里的域名(标 "Third Party")只是注册到了账号,**不会自动绑到任何项目**。必须从项目内部 Settings → Domains 主动添加,Vercel 才会把请求路由到对应 deployment。

### 7.2 Vercel 项目侧操作(5 min)

1. https://vercel.com/dashboard → 点进 `hopkinson-bar` 项目
2. **Settings → Domains** → 输入 `www.hopkinson-lab.com` → **Add**
3. 再输入 apex `hopkinson-lab.com` → **Add**
   - 二选一重定向方向,推荐 apex → 308 → www(主域 = www)
4. Vercel 显示需要的 DNS 记录:
   - `www` → CNAME → `cname.vercel-dns.com`
   - apex → A → `76.76.21.21`(apex 不能用 CNAME)

### 7.3 Cloudflare DNS 侧操作(5 min)

到 https://dash.cloudflare.com → `hopkinson-lab.com` → **DNS → Records**:

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `www` | `cname.vercel-dns.com` | ⚠️ **DNS only(灰云)** |
| A | `@` | `76.76.21.21` | ⚠️ **DNS only(灰云)** |
| CNAME | `api` | `<UUID>.cfargotunnel.com` | 橙云(原有,**不要碰**) |

⚠️ **`www` 和 `@` 必须灰云**:Vercel 边缘自己签 Let's Encrypt 证书并需要看到原始 Host 头,走 Cloudflare 代理会出现双重 CDN / 证书握手问题。

⚠️ **删除任何旧的 `www` / `@` 指向 `47.114.88.130` 的 A 记录** —— 那是 `ERR_CONNECTION_REFUSED` 的元凶。

### 7.4 后端 CORS 白名单追加(5 min)

```bash
ssh root@47.114.88.130
cd /opt/hopkinson/Hopkinson-Web/hopkinson-backend

# 编辑 .env,把 CORS_ORIGINS 改为(原本就有 hopkinson-lab.com,这次新增 www 子域):
CORS_ORIGINS=https://hopkinson-bar.vercel.app,https://hopkinson-lab.com,https://www.hopkinson-lab.com,https://api.hopkinson-lab.com

docker compose restart backend
docker compose logs --tail 30 backend   # 确认无 RuntimeError
```

`core/settings.py` 在生产环境强制要求 CORS_ORIGINS 是显式域名列表,不允许 `*`,所以新前端域名必须加进来,否则浏览器会被预检拦截。

### 7.5 验证(3-15 min,等 DNS 生效)

```bash
# 本地终端
nslookup www.hopkinson-lab.com 1.1.1.1
# 期望:解析到 76.76.21.x 类的 Vercel IP

curl -I https://www.hopkinson-lab.com
# 期望:200 OK 或 308(如果设了 apex→www 重定向)
```

浏览器开 `https://www.hopkinson-lab.com`:
- [ ] 看到 Hopkinson 首页(不是 404)
- [ ] 地址栏锁标志正常,证书 Issuer = Let's Encrypt
- [ ] F12 Network → 任一 `/api/*` 请求 Response Headers 含 `Access-Control-Allow-Origin: https://www.hopkinson-lab.com`
- [ ] WebSocket `wss://api.hopkinson-lab.com/ws/monitor` 连接成功
- [ ] 直接访问 apex `https://hopkinson-lab.com` → 308 跳到 www

---

## Phase 8：国内访问加速 —— 宝塔托管前端(IP + 8080)

> 适用场景:Vercel/Cloudflare 边缘在国内骨干网长期不稳定(`ERR_CONNECTION_REFUSED` / TLS RST / 偶发 5xx),即便灰云直连 Vercel 也只能开 VPN 才稳。**根因:出口在境外,流量走 GFW**。
>
> 方案:本机 `npm run build` 出 dist → 上传到 ECS → **宝塔面板创建静态站点监听 8080 端口** → 国内用户用 `http://47.114.88.130:8080` 直连。**8080 是非备案端口,无需 ICP**;Vercel 主域 `www.hopkinson-lab.com` 留给海外评委。
>
> 本项目不用 Docker,所有运维通过宝塔 GUI 完成。

### 8.1 本机构建 dist(5 min,Windows)

在仓库根 `C:\Users\Lenovo\Desktop\work\Hopkinson-Web` 创建 `.env.production`(Vite 编译生产构建时自动读取),内容:

```env
VITE_BACKEND_URL=https://api.hopkinson-lab.com
VITE_LLM_PROVIDER=deepseek
VITE_LLM_API_KEY=<填你的 DeepSeek key>
VITE_LLM_MODEL=deepseek-chat
VITE_VOLCANO_APP_ID=<填火山 App ID>
VITE_VOLCANO_ACCESS_TOKEN=<填火山 Token>
VITE_VOLCANO_VOICE_TYPE=zh_male_jieshuoxiaoming_moon_bigtts
VITE_VOLCANO_CLUSTER=volcano_mega_tts
```

> ⚠️ `.env.production` 已在 `.gitignore` 里(同 `.env`),不会被提交。

构建:
```powershell
npm install            # 如果之前没装过依赖
npm run build          # 输出到 dist/,约 30s
```

`dist/` 目录大小约 5-10MB。

### 8.2 阿里云安全组开 8080(2 min)

阿里云控制台 → 实例 `47.114.88.130` → 安全组 → 配置规则 → 添加入站规则:

| 协议 | 端口 | 源 | 备注 |
|---|---|---|---|
| TCP | 8080 | `0.0.0.0/0` | 宝塔前端站点 |

### 8.3 宝塔创建静态站点(5 min)

打开宝塔面板(默认 `http://47.114.88.130:8888`,首次安装后改过端口的用改后端口)→ 登录。

1. 左侧 **网站** → **添加站点**
2. 表单填:
   - **域名**:`47.114.88.130:8080`(直接用 IP+端口当域名,宝塔支持)
   - **根目录**:留默认 `/www/wwwroot/hopkinson-frontend` 或自定义
   - **PHP 版本**:**纯静态**(下拉选,绝不要选 PHP)
   - **数据库**:不创建
   - **FTP**:不创建
3. 点 **提交**
4. 列表里找到刚创建的站点 → 点 **设置** → 进入站点管理弹窗

### 8.4 上传 dist(5 min)

**方法 A(推荐,宝塔内置 ZIP 解压)**:
1. 本机把 dist 目录打包成 `dist.zip`(右键 → 发送到 → 压缩文件夹)
2. 宝塔站点设置 → **网站目录** 标签页(或左侧菜单 **文件**)→ 进入 `/www/wwwroot/hopkinson-frontend/`
3. **上传** `dist.zip` → 上传完成后 **解压** → 把解压出的 `dist/` 内的所有文件**剪切**到当前目录(`/www/wwwroot/hopkinson-frontend/`),**不要保留 dist 这层目录**
4. 删除 `dist.zip` 和空的 `dist/` 文件夹
5. 确认根目录下能看到 `index.html` 和 `assets/` 子目录

**方法 B(命令行)**:
```bash
# 本机
scp -r dist/* root@47.114.88.130:/www/wwwroot/hopkinson-frontend/
```

### 8.5 改站点端口为 8080(3 min)

宝塔默认网站监听 80。要改成 8080:

1. 站点 → **设置** → **配置文件** 标签页(直接编辑 nginx 配置)
2. 找到 `listen 80;` 一行,改成 `listen 8080;`
3. 同时把 `listen [::]:80;` 改成 `listen [::]:8080;`(如果有)
4. 点 **保存** → 宝塔自动 `nginx -t && nginx -s reload`,日志面板会显示成功

### 8.6 配置 SPA 路由 fallback(2 min)

React Router 是前端路由,刷新非根路径(如 `/login`)默认会 nginx 404。需加 fallback。

1. 站点 → **设置** → **伪静态** 标签页 → **自定义模板**(下拉选最底)
2. 文本框粘贴:
   ```nginx
   location / {
       try_files $uri $uri/ /index.html;
   }

   # Vite 输出的带 hash 文件名,可以永久缓存
   location /assets/ {
       expires 1y;
       access_log off;
       add_header Cache-Control "public, immutable";
   }

   # index.html 不缓存,确保拿到最新版本
   location = /index.html {
       add_header Cache-Control "no-cache, no-store, must-revalidate";
   }
   ```
3. **保存** → 自动 reload

### 8.7 后端 CORS 白名单追加(2 min,SSH)

```bash
ssh root@47.114.88.130

# 编辑后端项目的 .env(具体路径以宝塔 Python 项目管理器里看到的为准,常见在 /www/wwwroot/<后端目录>/.env)
# 找到 CORS_ORIGINS 这一行,改成:
CORS_ORIGINS=https://hopkinson-bar.vercel.app,https://hopkinson-lab.com,https://www.hopkinson-lab.com,https://api.hopkinson-lab.com,http://47.114.88.130:8080

# 重启 FastAPI(宝塔 → Python 项目管理器 → 找到 hopkinson-backend → 点击重启)
# 或命令行:
supervisorctl restart hopkinson-backend   # 名字以宝塔实际配置的为准
# 或:
systemctl restart hopkinson-backend
```

### 8.8 验证

```bash
# ECS 本地
curl -I http://localhost:8080/        # 期望 200,Server: nginx

# 本地 Windows
curl.exe -I http://47.114.88.130:8080/   # 期望 200
```

浏览器开 `http://47.114.88.130:8080`(地址栏会有"不安全"灰标 — HTTP 无证书,**功能完全正常**):

- [ ] 首页正常加载,无白屏
- [ ] **手动刷新 `/login`、`/virtual-lab` 等子路由不报 404**(伪静态生效)
- [ ] 登录页 `judge1` / `Judge@2026` 一键登录
- [ ] F12 Network 看到:
  - REST 调 `https://api.hopkinson-lab.com/api/*` 200
  - WebSocket `wss://api.hopkinson-lab.com/ws/monitor` 连接成功(HTTP 页面访问 https/wss 资源浏览器允许,**与 mixed content 反向无关**)
  - 无 CORS 报错
- [ ] **关掉 VPN 重新测一遍** —— 国内访问的关键验证

### 8.9 演示当天的"双 URL"策略

| 场景 | 给评委的 URL |
|---|---|
| 现场 / 国内评委 / 校园网 | **`http://47.114.88.130:8080`**(稳,但 URL 难看) |
| 远程演示 / 海外评委 | `https://www.hopkinson-lab.com`(优雅,但需对方网络好) |
| 断网终极兜底 | 本机离线 dev server + 5 分钟演示视频 |

> ⚠️ HTTP 无证书 → 浏览器地址栏"不安全"灰标不可避免。如需正式 HTTPS,要走 ICP 备案 + 国内 CDN(20 天)或买已备案域名(灰产,不推荐)。

### 8.10 后续更新前端的流程

每次改前端代码后:
```powershell
# 本机
npm run build              # 重新打包
Compress-Archive dist\* dist.zip -Force   # 打 zip
```

宝塔文件管理器 → 删除 `/www/wwwroot/hopkinson-frontend/` 下旧文件 → 上传 `dist.zip` → 解压 → 完成。

> 提示:如频繁更新,可考虑写个一键脚本用 scp + ssh 远程 unzip,本文略。

### 8.11 已知限制

- **HTTP 页面**:浏览器锁标志变灰,部分用户感知"不安全"。功能不受影响(JWT 在 localStorage,不是 cookies)
- **8080 端口**:大多数公网放行,**少数严格的企业/校园出口可能拦**。备用:换 8443 / 9000 / 18080(同步改 阿里云安全组、宝塔站点 listen、CORS_ORIGINS)
- **VITE_LLM_API_KEY 被编译进 JS bundle**:本身就是这样(Vercel 部署也一样),F12 可看到。如要保护需改后端代理,本次不做

---

## 维护命令速查

```bash
# 重启后端
cd /opt/hopkinson/Hopkinson-Web/hopkinson-backend
docker compose restart backend

# 拉新代码 + 重建
cd /opt/hopkinson/Hopkinson-Web
git pull
cd hopkinson-backend
docker compose up -d --build

# 看实时日志
docker compose logs -f backend
journalctl -u cloudflared -f

# 备份数据库
docker compose exec postgres pg_dump -U hopkinson hopkinson > /opt/hopkinson/backup-$(date +%Y%m%d).sql
```
