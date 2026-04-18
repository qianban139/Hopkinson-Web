# 大赛展示稿 — 四大核心技术

> **赛项**：2026 中国大学生计算机设计大赛
> **作品**：数智化电磁驱动霍普金森杆多场耦合动态测试系统
> **答辩时间**：6 分钟主讲 + 3 分钟问答

本文档用于评委答辩 — 给出每一项技术的"电梯陈述 + 答辩要点 + 可现场打开的代码位置"。

---

## 1. 前端技术 — React 19 工业级类型安全 SPA

### 电梯陈述（30 秒）
> 基于 React 19 + TypeScript 5.9 strict 模式 + Vite 7 构建,150+ 文件零 `any`、4 个 Zustand store 解耦全局状态、Three.js 实现 1:1 数字孪生、ECharts 可视化所有物理量。

### 答辩要点
| 维度 | 落地 |
|:--|:--|
| 类型严格性 | `tsconfig.app.json` `strict: true` + `erasableSyntaxOnly`,IDE 实时校验 |
| 状态管理 | 4 个独立 Store(App / DataBus / Workflow / Auth)按职责切分,无 React Context |
| 路由守卫 | `<ProtectedRoute>` 包裹所有受保护页面,未登录自动跳 `/login` |
| HTTP 客户端 | `httpClient.ts` 统一注入 `Authorization: Bearer`、401 触发 `auth:unauthorized` 事件 |
| WebSocket | URL `?token=xxx` 鉴权,断线自动重连,基于物理引擎生成数据(非 `Math.random`) |
| 数字孪生 | React Three Fiber + 13 个 GLB 资产,可交互 |
| 动画 | Framer Motion 路由级 + 元素级动画 |

### 可打开的代码位置
- **Auth Store**：`src/store/useAuthStore.ts` — Zustand + localStorage 持久化 + hydrate 流程
- **HTTP 客户端**：`src/services/api/httpClient.ts` — 统一 token 注入 + 401 退出
- **路由守卫**：`src/components/ProtectedRoute.tsx`
- **物理引擎(纯 TS)**：`src/services/shpbPhysicsEngine.ts` — 11 个导出函数
- **3D 数字孪生**：`src/features/experiment-3d/`

---

## 2. 后端技术 — FastAPI 全异步 + JWT + WebSocket

### 电梯陈述（30 秒）
> FastAPI 0.115 全异步架构 + SQLAlchemy 2.0 async + JWT 无状态鉴权 + WebSocket 双通道实时推送 + SQLAdmin 零代码管理后台 + 硬件抽象层可无缝替换真实 DAQ。

### 答辩要点
| 维度 | 落地 |
|:--|:--|
| 异步架构 | uvicorn + asyncpg + aiosqlite,无任何 sync 数据库调用 |
| 鉴权安全 | bcrypt 哈希(work factor 12)+ JWT HS256 + 24h 过期;**密钥强制 ≥32 字符,无默认值** |
| WebSocket 鉴权 | `core/auth_deps.verify_ws_token` 解析 query string token,失败 close(4001) |
| 数据归属 | 实验 WS 校验 `exp.user_id == user.id`,B 用户禁访 A 用户实验 |
| 注册策略 | 用户名 4-20 位,密码必须含字母+数字,**强制 `is_admin=False`** |
| CORS | `CORS_ORIGINS` 强制环境变量,生产禁用 `*` |
| 管理后台 | SQLAdmin 自动渲染 9 张表,RBAC 由 `is_admin` 字段控制 |
| 硬件抽象 | `hardware/base.HardwareDriver` ABC,Mock/真硬件可插拔 |

### 可打开的代码位置
- **JWT 鉴权工具**：`hopkinson-backend/api/auth.py` — `_create_token`, `require_current_user`, `require_admin`
- **WebSocket 鉴权 + 归属校验**：`hopkinson-backend/core/auth_deps.py`,`hopkinson-backend/ws/experiment.py`
- **配置强校验**：`hopkinson-backend/core/settings.py` — `get_jwt_secret()` 缺失即抛 `RuntimeError`
- **管理后台**：`hopkinson-backend/admin/views.py`,访问 `/admin`

---

## 3. 数据库构建 — PostgreSQL 16 + JSONB + Alembic

### 电梯陈述（30 秒）
> PostgreSQL 16 + 9 张业务表,JSONB 列承载半结构化材料/波形/AI 日志,GIN 索引加速 JSON 查询,Alembic 全版本化迁移,宝塔每日 `pg_dump` 计划任务。

### 答辩要点
| 维度 | 落地 |
|:--|:--|
| 表结构 | users / materials / experiments / waveform_data / monitor_snapshots / devices / reports / ai_operation_logs / audit_logs |
| 为什么选 PG 不选 MySQL | ① JSONB 原生 + GIN 索引 ② asyncpg 性能 ③ TOAST 自动压缩大字段 ④ 后续可升 TimescaleDB ⑤ 行级安全(RLS)将来支持 |
| 关系模型 | `experiments.user_id → users.id`,`reports.experiment_id → experiments.id`,`waveform_data.experiment_id → experiments.id` |
| 索引策略 | 时序表 `(experiment_id, channel, timestamp)` 复合索引,审计 `(created_at desc)` 倒序索引 |
| 迁移版本化 | `alembic/versions/6d4c75651d2c_initial_schema.py` 包含全部 9 张表,可回滚 |
| 生产建表 | `is_production()` 时禁用 `Base.metadata.create_all`,强制走 Alembic |
| 备份 | 宝塔计划任务 `pg_dump hopkinson > /backup/hopkinson-$(date +%F).sql` |

### E-R 简图

```
users ─┬─< experiments >─── materials
       ├─< ai_operation_logs
       └─< audit_logs

experiments ─┬─< waveform_data
             ├─< monitor_snapshots
             └─< reports

devices    (独立设备资产表,被 monitor_snapshots 关联)
```

### 可打开的代码位置
- **ORM 定义**：`hopkinson-backend/db/models.py` — 9 个 SQLAlchemy 类
- **迁移脚本**：`hopkinson-backend/alembic/versions/6d4c75651d2c_initial_schema.py`
- **种子数据**：`hopkinson-backend/db/seed.py` — 21 种材料 + admin 账号
- **管理后台**：`/admin` 一眼看到所有表

---

## 4. 核心算法 — SHPB 物理 + 三级参数优化(LSTM + 扰动 + PPO)

### 电梯陈述（30 秒）
> 基于一维应力波理论 + Johnson-Cook 本构方程的 SHPB 物理引擎,三级参数优化由 PyTorch LSTM 预测器(候选评分)、高斯邻域扰动(探索)、PPO Actor-Critic 策略网络(精调)组成,所有训练数据来自物理仿真,**无任何 Math.random 代替**。

### 答辩要点

#### 4.1 物理引擎(前端 + 后端各一份)
- **一维应力波**：ε_s = -2c₀/L_s · ∫ε_r dt;σ_s = E·A_b/A_s · ε_t;ε̇_s = -2c₀/L_s · ε_r
- **Johnson-Cook 本构**：σ = (A + B·ε^n)(1 + C·ln(ε̇/ε̇₀))(1 - T*^m)
- **代码**:`src/services/shpbPhysicsEngine.ts`(前端) + `hopkinson-backend/ml/reward.py`(后端)
- 49 种材料 J-C 参数本地数据库 `src/data/materials.json`

#### 4.2 信号处理(前端)
- **弥散校正、基线修正、波形对齐、应力平衡判据、应变率补偿** — SHPB 标准流程
- **本构拟合**:5 种模型(J-C / Cowper-Symonds / Zerilli-Armstrong / Power Law / Bilinear)非线性最小二乘
- 输出 R² 与 RMSE,前端图表实时可视化

#### 4.3 LSTM 预测器(PyTorch,真神经网络)
```python
nn.LSTM(input_size=4, hidden_size=32, num_layers=1, batch_first=True)
nn.LayerNorm(32) → nn.Linear(32 → 1)
```
- **输入**:历史 10 步 (voltage, pulse, stress, strain_rate),归一化到 [0,1]
- **训练**:3000 样本,MSE,Adam lr=1e-3,30 epoch
- **结果**:val MSE ≈ 0.0001(检查点 `ml/checkpoints/lstm_best.pt` 23 KB)
- **用途**:候选生成阶段给 Top-K 参数序列打分

#### 4.4 PPO Actor-Critic(PyTorch,真神经网络)
```python
Actor   MLP(6 → 64 → 64 → 2) + tanh + 可学习 log_std
Critic  MLP(6 → 64 → 64 → 1)
GAE λ=0.95, clip=0.2, lr=3e-4
```
- **状态**:[v_norm, p_norm, stress_norm, strain_rate_norm, equilibrium, material_one_hot]
- **动作**:连续 (Δv, Δp) ∈ (-1, 1),反归一化为 ±400V / ±200μs
- **训练**:300 episode × 30 step,best_avg50 = 18.2(单步 reward 均值 ≈ 0.6)
- **检查点**:`ml/checkpoints/ppo_best.pt` 42 KB

#### 4.5 安全约束(物理硬上限)
- 电压 ≤ 4000V、电流 ≤ 50kA、储能 ≤ 36kJ、温度 ≤ 80°C、EMI ≤ 95dB
- 训练奖励函数 `compute_reward` 越界返回 -1.0,PPO 自然学到避开越界

#### 4.6 ML 推理 API(线上演示)
```http
POST /api/optimization/suggest      PPO 单步推理,返回建议参数
POST /api/optimization/score        LSTM 给一段历史打分
GET  /api/optimization/info         返回模型版本与参数域
```
响应字段 `model_version`:
- `v1.0.0-shpb-physics` = 加载到训练好的 checkpoint
- `fallback-random-init` = checkpoint 缺失,随机权重(冷启动)

### 可打开的代码位置(评委追问"展示网络结构"用)
- **奖励/物理仿真**：`hopkinson-backend/ml/reward.py`
- **LSTM**：`hopkinson-backend/ml/lstm_predictor.py:LSTMPredictor`
- **PPO**：`hopkinson-backend/ml/ppo_agent.py:PPOActorCritic`
- **训练脚本**:`hopkinson-backend/ml/training.py`(`python -m ml.training all`)
- **推理服务**：`hopkinson-backend/ml/inference.py:suggest_next_params`
- **API 路由**：`hopkinson-backend/api/optimization.py`
- **权重文件**:`hopkinson-backend/ml/checkpoints/{lstm,ppo}_best.pt`(总计 ~65 KB)

---

## 5. 6 分钟演示动线

| 时刻 | 内容 | 着重点 |
|:--|:--|:--|
| 00:00-00:30 | 打开 `https://hopkinson.<域名>` → 跳 `/login` | 强制鉴权 + ProtectedRoute |
| 00:30-01:30 | 注册新账号 → 自动登录 → 进 `/lab` | 全栈账号体系闭环 |
| 01:30-03:00 | 选 6061-T6 铝材料 → 启动仿真 → 实时波形 | WebSocket + 物理引擎 + 3D 数字孪生 |
| 03:00-04:00 | 应力-应变曲线 + 5 种本构拟合 R² | 信号处理工程量 |
| 04:00-04:30 | 调用 `POST /api/optimization/suggest` | 真 PyTorch PPO 推理 |
| 04:30-05:00 | 打开宝塔 → PostgreSQL → 看到刚才的 `experiments` 行 | 数据库链路打通 |
| 05:00-05:30 | 打开 `/admin` → SQLAdmin 看 9 张表 | RBAC 管理后台 |
| 05:30-06:00 | 打开 `ml/lstm_predictor.py` 与 `ppo_agent.py` 源码 | 真神经网络结构 |

---

## 6. 评委可能追问的硬核问题 — 备答口径

> **Q1: 三级优化为什么叫 LSTM+扰动+PPO?LSTM 预测什么?**
> A:LSTM 输入是 10 步历史参数序列,输出是预测的下一步标量 reward — 用于候选阶段过滤明显劣解。
> 训练数据 3000 条来自 SHPB 物理仿真,val MSE ≈ 0.0001 表示拟合得好。
> 高斯扰动是探索阶段,在 LSTM 选出的 Top-K 候选周围 ±10% 加噪声扩大搜索半径。
> PPO 是精调阶段,把当前状态(stress / strain_rate / equilibrium)作为输入,输出 (Δv, Δp) 调整动作。
>
> **Q2: 训练数据从哪来?会不会过拟合?**
> A:全部来自 `ml/reward.simulate_shpb` 物理仿真 — 一维应力波 + Johnson-Cook 本构,无随机噪声。
> 数据集分 90% 训练 / 10% 验证,验证集 MSE 同样 ≈ 0,因为物理模型是确定性映射,不存在过拟合。
>
> **Q3: PPO 的 reward 是怎么设计的?**
> A:`compute_reward` 把 (max_strain_rate, peak_stress, equilibrium_ratio) 三项归一化后做几何平均,
> balanced 模式下取三者的立方根 — 鼓励同时拉高三项指标,而不是单维度极端化。
> 越界(电压/脉宽超出安全域)直接返回 -1.0,PPO 自然学到避开。
>
> **Q4: 为什么不用 Stable-Baselines3 而要自己实现 PPO?**
> A:① 体积 — SB3 要带一堆我们用不到的算法和 Gym 适配器,而我们的 SHPB 环境就 30 行代码。
> ② 控制 — 自己实现可以把 Actor 输出的 tanh 范围、动作 clip、log_std 边界全部对准 SHPB 物理域。
> ③ 大赛诚实 — 评委一打开 `ppo_agent.py` 就能看到全部 100 行,而不是黑盒。
>
> **Q5: 推理速度?**
> A:LSTM 单次 < 5ms,PPO 单次 < 10ms,纯 CPU。`/api/optimization/suggest` p99 < 50ms(含 FastAPI 开销)。
>
> **Q6: 测试覆盖率?**
> A:坦率讲,MVP 阶段没做完整单元测试,但有 9 个端到端集成测试覆盖核心鉴权与归属校验路径,
> 通过 TestClient 全部通过。下一迭代会补 pytest 单测。

---

**最终提醒**:答辩时尽量打开真实代码,不要只放 PPT。评委一句"打开看看"就能判断真伪。
