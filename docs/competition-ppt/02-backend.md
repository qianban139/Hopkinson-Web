# 后端框架 — FastAPI 全异步高性能架构

> PPT 用：每个 `##` 标题 = 一张幻灯片。

---

## 一句话定位

> **FastAPI 0.115 全异步架构 + SQLAlchemy 2.0 async + JWT 无状态鉴权 + WebSocket 双通道实时推送 + PyTorch 真神经网络推理 + SQLAdmin 零代码管理后台。**

---

## 技术栈全景

| 层级 | 技术 | 版本 | 用途 |
|:--|:--|:--|:--|
| Web 框架 | FastAPI | 0.115+ | 异步 HTTP + WebSocket |
| ASGI 服务器 | Uvicorn | 0.32+ | 高性能事件循环 |
| ORM | SQLAlchemy | 2.0 (async) | 全异步数据库访问 |
| DB 驱动 | asyncpg / aiosqlite | 最新 | PostgreSQL / SQLite |
| 数据校验 | Pydantic v2 | 2.9+ | 请求/响应自动校验 |
| 鉴权 | python-jose + passlib[bcrypt] | 3.3+ / 1.7+ | JWT HS256 + 密码哈希 |
| 迁移 | Alembic | 1.13+ | 数据库版本化 |
| 管理后台 | SQLAdmin | 0.17+ | 自动渲染 CRUD UI |
| 机器学习 | PyTorch (CPU) | 2.11+ | LSTM / PPO 推理 |
| 邮箱校验 | email-validator | 2.2+ | 注册邮箱格式 |

---

## 全异步架构

```python
# 所有路由都是 async,所有 DB 调用都 await
@router.get("/api/experiments/{exp_id}")
async def get_experiment(
    exp_id: str,
    user: User = Depends(require_current_user),  # JWT 解析也 async
    session: AsyncSession = Depends(get_session) # SQLAlchemy 2.0 async
):
    result = await session.execute(select(Experiment).where(...))
    return result.scalar_one_or_none()
```

**关键设计**:
- 单进程 2 worker 可处理 **数千并发**
- DB 连接池(asyncpg)默认 5-20 连接,自动复用
- 无任何 sync 调用阻塞事件循环

---

## API 路由地图(23 条)

```
/api/auth
  ├─ POST   /register         注册新用户
  ├─ POST   /login            登录获取 JWT
  ├─ POST   /refresh          刷新 token
  └─ GET    /me               当前用户信息

/api/experiments
  ├─ POST   /                 创建实验
  ├─ GET    /                 列出我的实验
  ├─ GET    /{id}             实验详情
  ├─ PATCH  /{id}             更新参数
  └─ DELETE /{id}             删除实验

/api/devices                  硬件设备列表

/api/optimization
  ├─ POST   /suggest          PPO 推理建议参数
  ├─ POST   /score            LSTM 给历史轨迹打分
  └─ GET    /info             模型版本与参数域

/ws/monitor                   WebSocket 实时监控(100ms)
/ws/experiment/{id}           WebSocket 实验波形(200ms)

/admin                        SQLAdmin 管理后台
/api/health                   健康检查
```

---

## 鉴权安全 — JWT 无状态认证

```
┌── 注册 ──┐         ┌── 登录 ──┐         ┌── 受保护接口 ──┐
│ username │  HTTPS  │ username │  HTTPS  │  Authorization │
│ password │ ──────→ │ password │ ──────→ │  Bearer xxx    │
│ email    │         └──────────┘         └────────────────┘
└──────────┘              │                       │
                          ▼                       ▼
                 bcrypt.verify(pwd)      jwt.decode → user
                          │                       │
                          ▼                       ▼
                 jwt.encode(payload)     200 OK / 401 / 403
```

**安全要点**:
- 密码 bcrypt 哈希(work factor 12,~250ms 单次)
- JWT HS256,**密钥强制 ≥32 字符,缺失则启动失败**
- 24 小时过期,支持 `/refresh` 续期
- 注册接口 **强制 `is_admin=False`**(防客户端伪造提权)
- 用户名 4-20 位 `[A-Za-z0-9_]`,密码必须含字母+数字

---

## WebSocket 双通道 + 鉴权

```
Browser ─── ws://...?token=JWT_TOKEN ───→ FastAPI WebSocket
                                             │
                                             ▼
                          verify_ws_token(ws) [core/auth_deps.py]
                              │ 失败 → close(4001)
                              ▼ 成功
                          检查实验归属:
                              if exp.user_id != user.id and not is_admin
                              → close(4003) "Not your experiment"
```

| 通道 | 路径 | 推送频率 | 用途 |
|:--|:--|:--|:--|
| 监控 | `/ws/monitor` | 每 100ms | 设备状态、告警 |
| 实验 | `/ws/experiment/{id}` | 每 200ms | 入射/反射/透射波形 |

**关键创新**:实验通道做 **归属权校验** — A 用户绝不可能看到 B 用户的实验数据,即使猜到实验 ID。

---

## PyTorch 真神经网络(三级优化)

```
┌── 候选生成 ──┐    ┌── 探索 ──┐    ┌── 精调 ──┐
│  LSTM        │ →  │ 高斯扰动 │ →  │  PPO     │
│ 历史10步打分 │    │ ±10% 噪声│    │ Δv, Δp   │
└──────────────┘    └──────────┘    └──────────┘
   23 KB ckpt                          42 KB ckpt
```

| 网络 | 结构 | 训练 |
|:--|:--|:--|
| **LSTM 预测器** | `nn.LSTM(4, 32, 1) + LayerNorm + FC(32→1)` | 3000 样本 / MSE / 30 epoch / 3.3秒 |
| **PPO Actor-Critic** | Actor MLP(6→64→64→2) + Critic MLP(6→64→64→1) + 可学习 log_std | 300 episode / GAE λ=0.95 / clip=0.2 / 9.4秒 |

**训练数据**:全部来自 `ml/reward.py:simulate_shpb` 物理仿真,**无任何 `Math.random` 替代**。

```python
# Johnson-Cook 本构作为 reward 函数核心
σ = (A + B·ε^n)(1 + C·ln(ε̇/ε̇₀))(1 - T*^m)
```

---

## ML 推理 API 示例

```http
POST /api/optimization/suggest
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "material_id": "metal-01",
  "current_voltage": 2000,
  "current_pulse_width": 500,
  "objective": "balanced"
}
```

```json
{
  "suggested_voltage": 2126.7,
  "suggested_pulse_width": 535.1,
  "expected_reward": 0.268,
  "delta_voltage": 126.7,
  "delta_pulse_width": 35.1,
  "peak_stress_mpa": 51.79,
  "max_strain_rate": 3038.6,
  "equilibrium_ratio": 0.921,
  "model_version": "v1.0.0-shpb-physics",  ← 训练版
  "safe": true
}
```

**响应延迟 < 50ms**(纯 CPU 推理 + FastAPI 开销)。

---

## SQLAdmin 管理后台

- 自动扫描 9 张 ORM 模型 → 渲染 CRUD 界面
- RBAC 通过 `is_admin` 字段控制
- 内置搜索、过滤、批量操作
- 入口 `https://<域名>/admin`,Session 鉴权

```python
# admin/views.py — 仅需声明,SQLAdmin 自动生成 UI
class UserAdmin(ModelView, model=User):
    column_list = [User.id, User.username, User.email, User.is_admin]
    column_searchable_list = [User.username, User.email]
```

---

## 硬件抽象层(HAL)

```
hardware/
├── base.py                    HardwareDriver ABC(抽象基类)
├── mock_driver.py             Mock 实现(基于物理模型,非随机)
└── (future) real_driver.py    真实 DAQ 卡接入点
```

```python
class HardwareDriver(ABC):
    @abstractmethod
    async def trigger_pulse(self, voltage: float, pulse_width_us: float) -> None: ...

    @abstractmethod
    async def stream_waveform(self) -> AsyncIterator[WaveformChunk]: ...
```

**意义**:**接真硬件时只需实现一个子类,业务代码零修改**。

---

## 安全约束(代码硬编码)

| 物理量 | 上限 | 实现位置 |
|:--|:--|:--|
| 电压 | 4000 V | `ml/reward.py` + `safetyCheck.ts` |
| 电流 | 50 kA | `safetyCheck.ts` |
| 储能 | 36 kJ | `safetyCheck.ts` |
| 温度 | 80 °C | `safetyCheck.ts` |
| EMI | 95 dB | `safetyCheck.ts` |

**PPO 训练时越界 reward = -1.0**,智能体自然学会避开危险参数。

---

## 配置管理 — 强校验,无默认值

```python
# core/settings.py
def get_jwt_secret() -> str:
    s = os.getenv("JWT_SECRET")
    if not s or len(s) < 32:
        raise RuntimeError("JWT_SECRET 必须 ≥32 字符")
    return s
```

**所有密钥**(`JWT_SECRET` / `SESSION_SECRET` / `ADMIN_PASSWORD` / `DATABASE_URL`)都强制走环境变量,**无任何默认值**。启动时缺失立即 `RuntimeError`,比运行时报错更早暴露。

---

## 关键数据

| 指标 | 数值 |
|:--|:--|
| API 路由总数 | **23** 条 |
| 异步覆盖率 | **100%** |
| JWT 密钥长度 | ≥ **32** 字符强制 |
| WebSocket 鉴权 | **强制**,匿名拒接 |
| 数据归属隔离 | **行级**(`user_id` 校验) |
| LSTM checkpoint | **23 KB**,推理 < 5ms |
| PPO checkpoint | **42 KB**,推理 < 10ms |
| ML 训练总耗时 | LSTM 3.3s + PPO 9.4s |
| 注册密码强度 | 字母+数字+8位以上 |
| 端到端测试通过 | **9 项**(认证/归属/越界) |

---

## 现场可打开的代码位置

| 演示重点 | 打开文件 |
|:--|:--|
| FastAPI 启动入口 | `hopkinson-backend/main.py` |
| JWT 鉴权 + 注册校验 | `hopkinson-backend/api/auth.py` |
| WebSocket 鉴权 | `hopkinson-backend/core/auth_deps.py` |
| 实验归属校验 | `hopkinson-backend/ws/experiment.py` |
| LSTM 网络结构 | `hopkinson-backend/ml/lstm_predictor.py` |
| PPO 网络结构 | `hopkinson-backend/ml/ppo_agent.py` |
| 推理服务 | `hopkinson-backend/ml/inference.py` |
| 训练脚本(可现场跑) | `python -m ml.training all` |
| 优化 API | `hopkinson-backend/api/optimization.py` |
