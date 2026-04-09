# Hopkinson Backend

> 数智化电磁驱动霍普金森杆测试系统 — 后端服务（Phase 3）

本服务为前端 [Hopkinson-Web](../) 提供：

- **REST API** — 设备管理、实验生命周期
- **WebSocket** — 实时监控数据流、实验执行通道
- **Mock 硬件层** — 无需真实设备即可端到端联调

设计意图详见 `../docs/项目设计规划.md` 第十章「真实设备接口设计」。

---

## 目录结构

```
hopkinson-backend/
├── main.py                 入口（uvicorn 启动）
├── api/
│   ├── devices.py          设备管理 REST
│   └── experiments.py      实验管理 REST
├── ws/
│   ├── monitor.py          实时监控 WebSocket
│   └── experiment.py       实验执行 WebSocket
├── hardware/
│   ├── base.py             硬件抽象基类
│   ├── mock_daq.py         模拟数据采集卡
│   ├── mock_em_driver.py   模拟电磁驱动器
│   └── safety_controller.py 安全阈值守护
├── state.py                进程内状态管理（实验/设备）
├── requirements.txt
└── README.md
```

---

## 快速启动

### 1. 安装依赖

```bash
cd hopkinson-backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux/Mac
source .venv/bin/activate

pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

服务监听 `http://localhost:8000`，自动重载代码变更。

### 3. 健康检查

```bash
curl http://localhost:8000/api/health
# {"status":"ok","version":"0.8.0","mode":"mock"}
```

### 4. 前端连接

在前端 `.env` 中配置：

```
VITE_BACKEND_URL=http://localhost:8000
```

刷新前端，进入「系统监控」页面，点击右上角「连接后端」按钮即可看到真实数据流。

---

## REST API 速查

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/health` | 服务健康检查 |
| GET  | `/api/devices` | 列出所有设备 |
| GET  | `/api/devices/{id}` | 获取单个设备详情 |
| POST | `/api/devices/{id}/health-check` | 触发设备健康检查 |
| POST | `/api/experiments` | 创建实验 |
| POST | `/api/experiments/{id}/start` | 启动实验 |
| POST | `/api/experiments/{id}/pause` | 暂停实验 |
| POST | `/api/experiments/{id}/emergency-stop` | 紧急停机 |
| GET  | `/api/experiments/{id}` | 获取实验详情 |
| GET  | `/api/experiments/{id}/result` | 获取实验结果 |

## WebSocket 通道

| 路径 | 说明 |
|------|------|
| `/ws/monitor` | 实时监控数据（每 100ms 推送） |
| `/ws/experiment/{id}` | 实验执行状态 + 波形数据 |

---

## 当前阶段：模拟模式

本版本使用 `hardware/mock_*.py` 生成基于物理的模拟数据，**无需真实硬件即可运行**。

切换到真实硬件请实现 `hardware/base.py::HardwareDriver` 抽象，并在 `state.py` 中注册。Phase 6 将引入真实 DAQ。

---

## 安全说明

- **本服务仅供内网使用**，未启用 TLS 和 JWT
- 生产部署需配套 nginx + WSS + JWT 鉴权（详见 `docs/项目设计规划.md` 10.5 节）
- 紧急停机端点必须保留物理冗余通道
