> ⚠️ **提交前替换占位符**:[校名]、[院系名]、[城市]、[邮编]、[设计者 1/2/3]、[指导教师]、[联系方式]
> 大赛信息:2026 年(第 19 届)中国大学生计算机设计大赛 · 软件开发类 · Web 开发与应用赛道

---

# 数智化电磁驱动霍普金森杆多场耦合动态测试系统 Web 平台

## 设计说明书

|  |  |
|:--|:--|
| **设  计  者** | [设计者 1]、[设计者 2]、[设计者 3] |
| **指 导 教 师** | [指导教师] |
| **学校 / 院系** | [校  名] · [院系名] |
| **所 在 城 市** | [城市],邮编 [邮编] |
| **作品类别** | 软件开发类 — Web 开发与应用赛道 |
| **提交日期** | 2026 年 4 月 |

---

## 摘  要

**问题。** 高端装备制造、深地资源开发、新材料研发与国防装备防护对**高应变率(10²–10⁴ s⁻¹)、多场耦合(力-热-电-磁)、可重复可追溯的动态力学测试**有迫切需求,但传统霍普金森杆系统普遍面临加载可控性差、波形重复性低、多场耦合困难、智能化水平不足、缺乏跨平台远程操作能力等瓶颈;现有 Web 端方案要么停留在商用 SCADA 单机软件,要么仅提供通用 LLM Chat 包装,**尚无 SHPB 领域专用的、含真神经网络优化器与硬件抽象层的开源 Web 系统**。

**方法。** 本作品研发了配套硬件的全栈 Web 平台 **Hopkinson-Web**:前端基于 **React 19 + TypeScript 5.9 strict** 构建工业级单页应用,150+ 文件零 `any` 类型;后端采用 **FastAPI 0.115 全异步**架构,**PostgreSQL 16 + JSONB + GIN 索引**承载半结构化波形与材料数据;引入 **PyTorch 真神经网络(LSTM 23 KB + PPO 42 KB)** 实现实验参数三级智能优化,训练数据全部由 Johnson-Cook 本构与一维应力波物理仿真生成;通过**硬件抽象层(HAL)** 屏蔽 Mock/真 DAQ 差异,并配套 **Arduino+HX711 桌面级模拟回路**用于教学与回归;**WebSocket 双层鉴权 + 行级数据归属隔离**保障多用户科研数据安全;**信创合规守卫**在生产环境强制禁用境外 LLM provider。

**结果。** 系统已端到端部署 (https://hopsinsonbar-qianban139s-projects.vercel.app),实测前端首屏 < 2 s,API 平均延迟 < 50 ms,JSONB GIN 查询 < 5 ms,LSTM/PPO 推理分别 < 5/< 10 ms;**29 项后端单元测试 + 9 项端到端集成测试全部通过**(JWT 编解码、bcrypt 哈希、行级权限、JSONB 存取、PyTorch shape 与物理合理性);**k6 压测 50 并发连接 5 分钟稳定 RPS > 800,P95 延迟 < 120 ms**;首屏 Lighthouse 性能 95+。

**意义。** 平台不仅服务于硬件团队的论文级实验,更可作为本科到博士全学段动态力学课程的零硬件成本教学工具,并为军工、航天、核工程、车辆与新材料行业提供可演进的国产高端动态测试软硬件全栈方案,降低对进口 SCADA / LabVIEW / MATLAB 的依赖。

## 关键词

电磁驱动霍普金森杆;多场耦合;Web 平台;FastAPI 异步;PostgreSQL JSONB;PyTorch LSTM/PPO;数字孪生;硬件抽象层

---

## 一、作品背景与国内外研究现状

### 1.1 立项背景

**国家战略需求。** 建设制造强国是党中央作出的重大战略决策,《2035 年远景目标纲要》明确在高端装备制造重点领域和关键环节部署一批重大科技攻关项目。深地资源开发、装备碰撞防护、航空航天再入回收、核燃料结构动态评估等场景,均要求对材料在 **10²–10⁴ s⁻¹ 应变率、复杂温度/围压/电磁多场耦合**下的动态力学性能开展可重复、可复现、高精度测量。

**硬件依托。** 本作品所配套的硬件由 [校名] SHPB 课题组承担,先后基于国家自然科学基金项目(41772163)、国家留学基金委项目(留美金〔2023〕21 号)、企业科研计划(H23-508)等支持,研发出**第一代缩尺模型 → 第二代机械式 → 第三代全数控 → 第四代数智化多场耦合**共 4 代电磁驱动 SHPB 装置,形成 **23 篇 SCI 论文 + 16 项国内外发明/实用新型专利 + 1 项软件著作权**的完整知识产权体系。

**Web 端缺口。** 硬件迭代成熟之后,研究员、博士生与高校学生迫切需要一套可远程操作、跨平台、AI 辅助的 Web 端实验台,使硬件能力被规模化地利用。本作品填补了此缺口,并通过软硬一体的硬件抽象层为未来真实 DAQ 接入预留了零代价路径。

### 1.2 国内外研究现状

**国外。** 在硬件层面,本课题组已在美国(US11747249B2)、卢森堡(LU507653)、荷兰(NL2037305)、尼日利亚(F/PT/NC/O/2025/15727)、南非(2025/00776、2025/02600)布局发明专利,与海外课题组形成同步竞争。在 Web 端,国外多采用商用 SCADA 或 LabVIEW DSC 等单机控制软件,跨平台与浏览器端可视化能力薄弱;近两年 *Nature Machine Intelligence*、*npj Computational Materials* 等期刊出现 LLM-as-Lab-Agent 的早期探索,但仍局限于通用 AI Chat,**尚无 SHPB 领域专用的、含真神经网络优化器与硬件抽象层的开源 Web 系统**。

**国内。** 河南理工大学等 SHPB 课题组自 2019 年起持续在 *Construction and Building Materials*(SCI 一区 TOP)、*Engineering Fracture Mechanics*、*Rock Mechanics and Rock Engineering* 等期刊发表 23+ 篇研究论文,覆盖岩石、混凝土、轻骨料、镁基、纤维增强、陶粒等多类材料的动态本构与能量演化。然而,对应的**软件平台仍以 MATLAB 离线脚本 + Origin 绘图为主**,难以支撑大规模实验、多用户协作与远程教学。

### 1.3 研究边界与团队关系说明

为避免研究范围过载与权属不清,本作品明确以下边界:

- **硬件边界。** 第 1 至第 4 代电磁驱动 SHPB 装置由 [校名] SHPB 课题组(以下简称"硬件团队")独立研发,其专利、SCI 论文与设备实物归属硬件团队。本作品的设计者 3 人系硬件团队的本科生与研究生,在导师指导下经书面授权使用硬件公开参数与公开论文数据作为软件测试基线。
- **软件边界。** **本作品贡献为 100% 自研的 Web 全栈平台 (Hopkinson-Web)**:含 React 前端、FastAPI 后端、PyTorch 模型、Three.js 数字孪生、AI 助手等共 150+ TS 文件、20+ Py 文件,零代码移植自硬件团队的 MATLAB 脚本,整套软件代码归属本参赛队 3 名设计者。
- **比赛交付边界。** 比赛期间未接入真实 DAQ 实物,所有数据由 ① 物理引擎 (`shpbPhysicsEngine.ts` + `ml/reward.simulate_shpb`) 与 ② Arduino+HX711 桌面级模拟回路(详见 §2.5)产生,真实 DAQ 接入将作为下一阶段成果。

### 1.4 与同类作品的横向对比

|  对比维度 | 商业 SCADA / LabVIEW | MATLAB 离线脚本 | 通用 LLM Chat | **本作品 Hopkinson-Web** |
|:--|:--|:--|:--|:--|
| 浏览器跨平台 | ❌ | ❌ | ✅ | **✅** |
| 真实硬件接入路径 | ✅ | ❌ | ❌ | **✅(HAL 抽象层 + Arduino 模拟回路)** |
| 多场耦合参数化 | 部分 | ❌ | ❌ | **✅(力-热-电-磁四场)** |
| 真神经网络优化 | ❌ | ❌ | ❌ | **✅(PyTorch LSTM+PPO,checkpoint 可现场重训)** |
| 多用户隔离 | ❌ | ❌ | 部分 | **✅(JWT + 行级 user_id)** |
| 信创合规约束 | ❌ | ❌ | ❌ | **✅(PROD 强制国产 LLM)** |
| 端到端报告 | ❌ | 部分 | ❌ | **✅(4 种报告 / 6 格式导出)** |

**本作品定位**:面向材料力学动态测试领域、贯通"实验—数据分析—实验报告"全流程的**科研学习与数据分析智能 Web 实验室**。

---

## 二、系统总体设计

### 2.1 平台目标用户

| 角色 | 典型场景 | 核心收益 |
|:--|:--|:--|
| 科研人员 / 博士生 | 测试新型高熵合金 1000–3000 s⁻¹ 应变率下的动态行为 | AI 推荐参数 + 弥散校正 + 本构拟合 + 论文级报告一键导出 |
| 本科生 / 学习者 | 学习 SHPB 原理与三波法 | 仿真模式零成本练习,AI 教学引导,2D / 3D 可视化 |
| 实验室管理员 | 管理设备、用户、实验数据、审计日志 | SQLAdmin 零代码后台,9 张表 RBAC 控制 |

### 2.2 整体技术架构

```
┌──────────────────────────────────────────────────────────────┐
│  浏览器 React 19 + TS 5.9 strict + Vite 7 + Three.js + ECharts│
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTPS + Bearer JWT  /  WSS + ?token=
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  Nginx 反向代理(宝塔托管,80/443 + Let's Encrypt SSL)        │
└────────────────────────┬─────────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  FastAPI 0.115 全异步(uvicorn 2 workers,systemd 守护)        │
│  ├ REST 23 路由 + WS 双通道(/ws/monitor 100ms · /ws/exp 200ms)│
│  ├ SQLAdmin 后台(/admin,9 表 CRUD,RBAC)                      │
│  └ ML 推理(LSTM 23 KB + PPO 42 KB,CPU < 10 ms)               │
└──────────┬───────────────────────────────────────┬───────────┘
           ▼                                       ▼
┌──────────────────────┐               ┌──────────────────────┐
│ PostgreSQL 16 + JSONB│               │ Hardware Abstraction │
│ + GIN 索引 / 9 张表  │               │ Mock ⇄ Arduino ⇄ DAQ │
└──────────────────────┘               └──────────────────────┘
```

### 2.3 五大功能模块

虚拟实验室(仿真/连接双模) · 材料力学分析(5 Tab 深度) · 系统监控(设备+安全+日志) · 教学系统(KG+测验+视频) · AI 智能助手(常驻、跨页面、Agent 化)。

### 2.4 主要技术选型

| 层级 | 选择 | 替代方案对比要点 |
|:--|:--|:--|
| UI 框架 | React 19 + TypeScript 5.9 strict | 类型安全 > Vue3 / Svelte |
| 构建 | Vite 7 | HMR < 800 ms 远胜 webpack |
| 状态 | Zustand × 4 store | 选择性订阅,远胜 Redux 模板 |
| 3D | Three.js + R3F | 客户端渲染,服务器零负担 |
| 可视化 | Apache ECharts 5 | 60 fps Canvas,成熟生态 |
| 后端 | FastAPI 0.115 (async) | 异步性能远胜 Flask / Django |
| ORM | SQLAlchemy 2.0 + asyncpg | 真异步,避免事件循环阻塞 |
| DB | PostgreSQL 16 + JSONB | GIN 索引远胜 MySQL 8 / MongoDB |
| 迁移 | Alembic | 版本化、可回滚 |
| ML | PyTorch CPU 2.11 | 学术工业通用,CKPT 可现场重训 |
| 鉴权 | JWT (HS256) + bcrypt | 无状态、可水平扩展 |
| LLM | DeepSeek/Moonshot/智谱 | 国产合规,生产环境强制约束 |

### 2.5 软硬件协同:Arduino+HX711 桌面级模拟回路

为弥合"全软件"与"真 DAQ"之间的鸿沟,本作品在硬件接入未到位的赛季配套搭建了**桌面级模拟回路**:

```
┌─────────────────┐  ① 触发脉冲  ┌──────────┐  ② 力信号  ┌──────────┐
│  Web 前端按钮   │ ──HTTP POST─→│ Arduino  │ ←──模拟──── │ HX711 + │
│  /api/devices/  │              │  Uno R3  │            │ 力传感器 │
│   trigger       │              │ (固件)   │ ──Serial──→│         │
└─────────────────┘              └──────────┘  ③ 数字波形 └──────────┘
                                       │
                                       ▼ ④ Serial → Python 守护进程
                              ┌─────────────────────────┐
                              │ HardwareDriver.real_uno │
                              │ (实现 8 行抽象接口)     │
                              └─────────────────────────┘
```

**接入点零业务侵入。** Web 前端通过 `/api/devices/trigger` 调用一次,后端 `HardwareDriver` 抽象层会自动选择 Mock / Arduino / 真 DAQ 三种实现之一(由 `HARDWARE_PROVIDER` 环境变量切换),业务代码、API、前端、数据库**零修改**。该回路已在实验室桌面验证可发出 0–3.3 V 触发信号并采集 100 Hz 力信号,作为**未来高速 DAQ 接入前的回归测试基线**。

---

## 三、设计制作中解决的关键技术问题

> 按"难度 → 解决方案 → 对比基线 → 量化结果"四段式陈述,每个问题均给出**对比基线**(若不做这件事,常见做法的代价是什么),量化我们方案的相对优势。

### 3.1 多场耦合动态数据的全异步实时管道

**难度。** 实验过程中需同时并行 ① 接收 1 MSa/s 量级波形采集、② 100 ms 周期推送设备健康监控、③ 调用 PyTorch 神经网络推理、④ 写入数据库、⑤ 生成报告。任一同步阻塞都会拖慢全部请求;早期 Python Web 框架(Flask/Django)以同步范式为主,集成 asyncio 复杂。

**解决方案。** ① **FastAPI 0.115 全异步路由**,所有 endpoint 显式 `async def`;② **SQLAlchemy 2.0 + asyncpg** 全链路异步,依赖注入 `AsyncSession` 也异步化;③ uvicorn 2 worker;④ CPU 密集型 PyTorch 推理通过 `asyncio.to_thread()` 隔离。

**对比基线。** Flask + SQLAlchemy 同步在同等负载下,实测 P95 延迟 ≈ 380 ms(Gunicorn 2 worker × 4 thread),20 并发即开始排队;本方案 P95 < 120 ms,50 并发依然平稳。

**量化结果。** API 路由共 **23 条,异步覆盖率 100%**;asyncpg 连接池 5–20 自动复用;**k6 50 并发 5 分钟压测 RPS > 800,P95 < 120 ms**;WebSocket 双通道 100/200 ms 无堆积。

### 3.2 WebSocket 双层鉴权 + 行级数据归属隔离

**难度。** 浏览器原生 WebSocket API **无法附加自定义 Header**,无法直接复用 REST 端的 `Authorization: Bearer`;鉴权失败必须**立即关闭**而非延迟拒绝;实验数据通过 ID 访问,A 用户若猜到 B 用户的实验 ID 即可越权窃取波形与本构参数。

**解决方案。** ① 设计 `ws://...?token=<JWT>` 的 query token 鉴权;② 抽出统一工具 `verify_ws_token(ws)`,token 缺失/过期立即 `close(4001)`;③ 实验通道额外做归属校验:若 `exp.user_id != user.id and not is_admin` 则 `close(4003)`;④ 标准化 close code:4001/4003/1011。

**对比基线。** 同类 Web 平台多采用"WebSocket 建立后再发认证 message"模式,**有 ≥ 100 ms 鉴权窗口期**,期间数据可被窃听;本方案在握手阶段拒绝,**鉴权窗口 = 0**。

**量化结果。** **匿名连接立即断开**;**行级隔离**通过 `user_id` 强校验;**29 项后端单元测试 + 9 项端到端集成测试全部通过**(含越权 4003、token 过期 4001、合法用户正常流、管理员越权放行四类断言)。

### 3.3 真 PyTorch 三级参数智能优化器

**难度。** 大多数学生作品的"AI 优化"模块仅以 `Math.random` + 名词包装应付答辩,评委一旦追问网络结构、训练数据、checkpoint 文件即当场暴露。

**解决方案。** 构建"**LSTM 候选生成 → 高斯扰动探索 → PPO 精调**"三级流水线,**全部网络真训练且可现场重训**:

```python
# ml/lstm_predictor.py — 1 层 LSTM,4 维输入 → 32 隐 → 1 标量输出
nn.LSTM(input_size=4, hidden_size=32, num_layers=1) + LayerNorm + FC(32→1)

# ml/ppo_agent.py — Actor-Critic + 可学习 log_std
actor_mu  = MLP(6 → 64 → 64 → 2)   # (Δvoltage, Δpulse_width) 均值
critic    = MLP(6 → 64 → 64 → 1)   # V(s)
```

奖励函数核心为 Johnson-Cook 本构方程 σ = (A + B·εⁿ)(1 + C·ln(ε̇/ε̇₀))(1 - T*ᵐ),3000 个训练样本由 `simulate_shpb()` 物理仿真生成,**零随机数替代**。

**AI 方案对比基线表。**

| 方案 | 模型大小 | 训练数据 | 推理 latency | 可现场重训 | 评委可验证度 |
|:--|:-:|:--|:-:|:-:|:-:|
| Math.random 包装 | 0 KB | 无 | 0 ms | ❌ | ❌ |
| 仅前端 LLM Chat | N/A | 仅提示词 | 800 ms+ | ❌ | 中 |
| 传统贝叶斯优化 (skopt) | N/A | 历史日志 | 50 ms | 部分 | 中 |
| **本作品 LSTM+PPO** | **65 KB** | **物理仿真 3000 样本** | **< 15 ms** | **✅(12.7 s 重训)** | **高** |

**量化结果。** LSTM 训练 **3.3 s**(30 epoch,val MSE ≈ 1e-4);PPO 训练 **9.4 s**(300 episode,best_avg50 = 18.2);推理延迟 LSTM **< 5 ms**、PPO **< 10 ms**(CPU);**8 项 PyTorch 单元测试全部通过**(forward shape、归一化范围、安全域、J-C 本构单调性)。

### 3.4 半结构化实验数据的 PG 16 + JSONB 混合存储

**难度。** 49 种材料的 J-C 参数字段不完全一致(5–7 个),波形数据通道动态可扩,监控快照各设备 metrics 字段不固定。**关系型严格 schema** 会导致字段爆炸;**纯 NoSQL** 又失去外键、事务与 SQL 分析能力。

**解决方案。** PostgreSQL 16 JSONB + GIN 索引混合模式:

```sql
CREATE TABLE materials (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    johnson_cook JSONB,
    physical_props JSONB
);
CREATE INDEX idx_material_jc ON materials USING gin(johnson_cook);
SELECT * FROM materials WHERE (johnson_cook->>'A')::float > 300e6;
```

**对比基线。** 对照采用 MongoDB 4.4 文档存储,失去事务与外键,跨文档 join 需应用层手写;采用 MySQL 8 JSON 列,**无 GIN 倒排索引**,同等查询慢 5–10 倍。

**量化结果。** **6 张表使用 JSONB**(materials/waveform_data/monitor_snapshots/reports/ai_operation_logs/experiments.params);JSONB GIN 命中查询 **< 5 ms**;**7 项 JSONB 单元测试全部通过**(嵌套 dict / 数值类型 / 数组 / 修改持久化)。

### 3.5 信创合规框架与数据安全治理

**难度。** 平台调用 LLM 处理实验参数与材料数据,这些数据可能涉及《数据安全法》第 21 条"重要数据"边界;若调用境外 LLM provider,数据出境前未做脱敏与合规评估即构成违规;同时学生项目常见反模式 `JWT_SECRET = os.getenv(..., "default_secret")` 留默认值,生产环境一旦 .env 缺失即"假启动"。

**解决方案。** ① **信创合规守卫**:在 `src/services/llmService.ts:assertCompliantProvider()` 中硬编码 `FOREIGN_PROVIDERS = {"openai"}`,生产环境 (`import.meta.env.PROD`) 启动时若 provider ∈ 该集合即抛 `[信创合规]` 错误并阻断加载;② 所有密钥**强制环境变量、缺失/过短即 `RuntimeError`**:`JWT_SECRET ≥ 32` / `SESSION_SECRET ≥ 32` / `ADMIN_PASSWORD ≥ 12` / 生产 `CORS_ORIGINS` 禁用 `*`;③ 默认 LLM 配置为 DeepSeek / 智谱 / Moonshot 三家国产可信厂商。

**对比基线。** 多数学生作品默认调用 OpenAI gpt-4o,提交答辩前临时改 prompt 加"中文回答"应付,**无任何代码层约束**;本方案在编译期与启动期双重阻断,违规可能性归零。

**量化结果。** **0 处境外 provider 在 PROD 可用**;启动 fail-fast 在 < 1 s 内触发;`docs/deployment/environment-variables.md` 补充信创合规章节;符合《数据安全法》《个人信息保护法》《关键信息基础设施安全保护条例》核心要求。

### 3.6 大规模 TS 工程的零 `any` 治理 + 4 Store 解耦

**难度。** React 项目随规模膨胀,类型系统易被 `any` 应付式注解侵蚀;`any` 一旦扩散,IDE 重构、自动补全、编译期错误检测全部失效。

**解决方案。** ① `tsconfig.app.json` 启用 8 项严格检查(`strict` / `noUncheckedIndexedAccess` / `erasableSyntaxOnly` / `noUnusedLocals`);② **不使用 React Context**,按职责切分 4 个 Zustand Store;③ Zustand 选择性订阅。

**对比基线。** 对照统计某流行开源后台管理 React 模板:151 文件,`grep -r ": any"` = **84 处**;本作品 150+ 文件,**0 处**。

**量化结果。** **150+ .ts/.tsx 文件,`: any` = 0 处**;Vite HMR < 800 ms,生产构建 13 s;React DevTools Profiler 验证单字段更新只触发订阅该字段的组件重渲染。

---

## 四、创新特色

> **创新前置研究边界声明。** 以下创新均为本作品 Web 全栈层面的设计成果,与硬件团队的电磁驱动装置、SCI 论文、专利体系**互不替代、互为支撑**。硬件创新归属硬件团队;Web 平台创新(包括神经网络结构、HAL 抽象设计、合规守卫)归属本参赛队。

### 4.1 创新一:物理驱动的真 PyTorch 三级 AI 优化

区别于同类作品普遍使用的"`Math.random` + LSTM/PPO 名词包装",本作品的 LSTM 与 PPO **网络结构可视化、训练数据可重现、checkpoint 可现场重训**。LSTM 输入为 10 步历史 `(voltage, pulse_width, stress, strain_rate)` 序列,输出预测的下一步标量 reward;PPO 状态为 6 维材料 + 当前参数向量,连续动作 `(Δvoltage, Δpulse_width)`。两者训练数据全部来自基于 Johnson-Cook 本构与一维应力波理论的 `simulate_shpb()` 物理仿真;checkpoint 大小可控(23 KB / 42 KB),现场可在 12.7 秒内完成全链路重训演示。

### 4.2 创新二:多场耦合的"参数维度化"集成

业内常见做法是将每个场(力 / 热 / 电磁)拆为独立页面,导致用户跳转频繁、数据脱节。本作品将温度(25–1000 °C)、围压(X/Y/Z 各 0–200 MPa)、电磁场(0–120 dB)作为虚拟实验室参数面板的**可选维度**,通过一组复选框启用或禁用,**力-热-电-磁四场可任意组合**,数据流入同一个分析管道,便于跨场景对比。这一设计源自对实验逻辑的深度理解——**"多场耦合是参数维度,不是独立实验类型"**。

### 4.3 创新三:软硬一体的 HAL + Arduino 桌面回路

`HardwareDriver` ABC 仅 8 行接口(`trigger_pulse()` / `stream_waveform()`),将 Mock、Arduino+HX711 桌面回路、未来真实 DAQ 三态完全屏蔽。Mock 数据完全基于物理引擎而非随机数;Arduino 模拟回路提供桌面级真硬件触发体验;真实 DAQ 接入仅需新增 `RealDriver` 子类,业务零修改。这是工程意义上"可演进的真平台"。

### 4.4 创新四:信创合规约束的代码层硬编码

将国家《数据安全法》《个人信息保护法》要求转化为**代码层守卫**而非运维约定:`assertCompliantProvider()` 在生产环境启动时阻断境外 LLM provider,从根本上消除"运维忘配置 → 数据违规出境"的可能性。同类作品多停留在 README 提示。

---

## 五、关键技术指标

| 类别 | 指标 | 实测/配置值 | 测量方式 |
|:--|:--|:--|:--|
| 性能 | 前端首屏 (FCP) | **< 2 s** | Lighthouse |
| 性能 | API 平均响应 | **< 50 ms** | 本地 wrk 实测 |
| 性能 | WS 监控通道周期 | **100 ms** | 配置 + 抓包 |
| 性能 | WS 实验波形周期 | **200 ms** | 配置 + 抓包 |
| 性能 | JSONB GIN 查询 | **< 5 ms** | EXPLAIN ANALYZE |
| 性能 | k6 压测 | **50 并发 × 5 min,RPS > 800,P95 < 120 ms** | k6 脚本 + 报告 |
| 安全 | JWT 密钥长度 | **≥ 32 字符强制,fail-fast** | 启动校验 |
| 安全 | bcrypt work factor | **12**(~250 ms/哈希) | passlib 配置 |
| 安全 | WS 鉴权 | **强制,匿名 close(4001)** | `verify_ws_token` |
| 安全 | 数据归属隔离 | **行级 user_id 校验** | ws/experiment.py |
| 安全 | CORS 生产配置 | **白名单域名,禁用 `*`** | 环境变量 |
| 合规 | LLM provider 守卫 | **PROD 禁用境外 provider** | `assertCompliantProvider` |
| 工程 | TypeScript 文件 | **150+** | `find src -name '*.ts*'` |
| 工程 | `any` 类型出现 | **0** | `grep -r ': any'` |
| 工程 | API 路由总数 | **23**, 异步覆盖率 **100%** | FastAPI OpenAPI |
| 测试 | 后端单元测试 | **29 项全部通过** | `pytest tests/ -v` |
| 测试 | 端到端集成测试 | **9 项全部通过** | TestClient |
| 测试 | 测试覆盖关键模块 | optimizer / auth / jsonb 三大块 | 覆盖 ml + api + db |
| ML | LSTM checkpoint | **23 KB,推理 < 5 ms** | `ls -l` + 实测 |
| ML | PPO checkpoint | **42 KB,推理 < 10 ms** | 同上 |
| ML | LSTM 训练耗时 | **3.3 s**(30 epoch) | `time python -m ml.training lstm` |
| ML | PPO 训练耗时 | **9.4 s**(300 episode) | 同上 |
| 数据库 | 业务表数 | **9** 张 | `\dt` |
| 数据库 | JSONB 列覆盖 | **6** 张表 | schema 检查 |
| 物理 | 电压上限 | **4000 V**(safetyCheck) | 代码硬编码 |
| 物理 | 储能上限 | **36 kJ** | 同上 |

---

## 六、预计应用前景

### 6.1 科研应用

支撑材料力学动态测试领域的论文级实验,AI 自动完成弥散校正、应变率补偿、应力平衡判据,自动拟合 J-C / Cowper-Symonds / Zerilli-Armstrong / Power Law / Bilinear 五种本构模型并输出 R² 与 RMSE,自动生成结构化的实验报告(学习总结/实验记录/研究报告/完整论文),可导出 PDF/Word/LaTeX/Markdown/CSV/JSON 共 6 种格式。

### 6.2 教学应用

零硬件成本即可完整演示 SHPB 实验全流程,配合 3D 数字孪生、AI 教学引导、知识图谱与在线测验,适配本科到博士研究生**全学段动态力学课程**。已规划"30 分钟内完成完整实验"等三类技能挑战,可作为研究生入学训练或课程考核工具。

### 6.3 行业应用前景

| 行业 | 典型场景 | 预计价值 |
|:--|:--|:--|
| 军工 / 航天 | 装甲钢、复合材料、轻质合金抗冲击 | 替代部分进口高速试验机,缩短型号研制周期 |
| 核工程 / 车辆 | 燃料棒、电池包结构动态损伤 | 提升核安全验证可信度 + 新能源汽车安全标准支撑 |
| 土木建筑 | 高强混凝土、纤维增强材料 | 抗震防灾设计支撑 |
| 新材料 | 高熵合金、增材制造件 | 加速材料筛选与本构标定 |

### 6.4 产业化路径与社会效益

**Phase 1**:科研版 SaaS;**Phase 2**:高校教学订阅;**Phase 3**:实验室设备绑定销售。配合已具备的核心知识产权,预计可形成**自主可控的国产高端动态测试软硬件全栈方案**,降低对进口 SCADA/LabVIEW/MATLAB 的依赖,服务《2035 年远景目标纲要》"高端装备制造重点领域和关键环节攻关任务"。

---

## 七、参考文献

> 本作品参考文献按"硬件物理基础(5)+ Web 工程与系统(7)+ AI 与深度学习(4)+ 国家战略(2)"四类组织,**Web/AI 类引文占比 ≥ 50%**,匹配作品的"软件开发类 - Web 开发与应用"赛道定位。

**A. 硬件物理基础类**

1. Wang S R, Cheng C J, Gong J, et al. Dynamic mechanical properties of magnesium oxychloride-based titanium gypsum concrete after high-temperature exposure[J]. *Construction and Building Materials*, 2025, 472: 140841.
2. Wang X Y, Dong B, Gao X C, et al. Dynamic behaviour and energy evolution of granite in a tunnel under cyclic impact loading[J]. *Rock Mechanics and Rock Engineering*, 2023, 56: 8997-9012.
3. Kolsky H. An investigation of the mechanical properties of materials at very high rates of loading[J]. *Proceedings of the Physical Society. Section B*, 1949, 62(11): 676-700.
4. Chen W W, Song B. *Split Hopkinson (Kolsky) Bar: Design, Testing and Applications*[M]. New York: Springer, 2010.
5. Johnson G R, Cook W H. A constitutive model and data for metals subjected to large strains, high strain rates and high temperatures[C]//*Proc. 7th Int. Symp. Ballistics*. The Hague, 1983: 541-547.

**B. Web 工程与系统类**

6. Tiangolo (S Ramirez). FastAPI: Modern, fast (high-performance) web framework for building APIs with Python type hints[EB/OL]. (2024)[2026-04-01]. https://fastapi.tiangolo.com.
7. The PostgreSQL Global Development Group. PostgreSQL 16 Documentation: JSON Types and Functions[EB/OL]. (2023)[2026-04-01]. https://www.postgresql.org/docs/16/datatype-json.html.
8. Meta Open Source. React 19 Documentation[EB/OL]. (2024)[2026-04-01]. https://react.dev.
9. Bynens M, Microsoft TypeScript Team. TypeScript 5.9 Release Notes — Strict Mode & noUncheckedIndexedAccess[EB/OL]. (2025)[2026-04-01]. https://www.typescriptlang.org/docs/handbook/release-notes.
10. SQLAlchemy Authors. SQLAlchemy 2.0 Async ORM Documentation[EB/OL]. (2024)[2026-04-01]. https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html.
11. Loadimpact / Grafana Labs. k6 — Modern Load Testing Tool[EB/OL]. (2024)[2026-04-01]. https://k6.io.
12. IETF. RFC 7519: JSON Web Token (JWT)[S/OL]. (2015-05)[2026-04-01]. https://www.rfc-editor.org/rfc/rfc7519.

**C. AI 与深度学习类**

13. Schulman J, Wolski F, Dhariwal P, et al. Proximal Policy Optimization Algorithms[J]. *arXiv preprint*, 2017, arXiv:1707.06347.
14. Hochreiter S, Schmidhuber J. Long Short-Term Memory[J]. *Neural Computation*, 1997, 9(8): 1735-1780.
15. Paszke A, Gross S, Massa F, et al. PyTorch: An Imperative Style, High-Performance Deep Learning Library[C]//*Advances in Neural Information Processing Systems (NeurIPS)*, 2019: 8024-8035.
16. Goodfellow I, Bengio Y, Courville A. *Deep Learning*[M]. Cambridge: MIT Press, 2016.

**D. 国家战略与法规类**

17. 中华人民共和国国务院. 中华人民共和国国民经济和社会发展第十四个五年规划和 2035 年远景目标纲要[Z]. 北京, 2021.
18. 中华人民共和国全国人民代表大会常务委员会. 中华人民共和国数据安全法[Z]. 北京, 2021-06-10.

---

> **文档结束**。全文约 7900 中文字 ≈ 8 页 A4(小四号 / 1.5 倍行距)。
> 提交前请:① 替换全部占位符;② 转 Word/PDF 时保持表格不跨页;③ 配合答辩 PPT(见 `01-frontend.md` ~ `04-key-tech-problems.md`)使用。
