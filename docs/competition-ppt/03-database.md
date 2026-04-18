# 数据库构建 — PostgreSQL 16 + JSONB + Alembic

> PPT 用：每个 `##` 标题 = 一张幻灯片。

---

## 一句话定位

> **PostgreSQL 16 + 9 张业务表,JSONB 列承载半结构化材料/波形/AI 日志,GIN 索引加速 JSON 查询,Alembic 全版本化迁移,宝塔每日 `pg_dump` 计划任务自动备份。**

---

## 技术选型

| 维度 | 选择 | 替代方案对比 |
|:--|:--|:--|
| 数据库 | **PostgreSQL 16** | MySQL 8 / SQLite |
| ORM | SQLAlchemy 2.0 (async) | Django ORM / Tortoise |
| 驱动 | asyncpg | psycopg2(同步)/ pg8000 |
| 迁移 | Alembic | Django migrations |
| 开发 DB | SQLite (aiosqlite) | — |
| 管理工具 | pgAdmin 4 / SQLAdmin / phpPgAdmin | — |
| 备份 | `pg_dump` + 宝塔计划任务 | 物理备份 / 流复制 |

---

## 为什么选 PostgreSQL 不选 MySQL

| 维度 | PostgreSQL 16 | MySQL 8 | 我们的需求 |
|:--|:--|:--|:--|
| **JSONB 支持** | ✅ 原生 + GIN 索引 | ⚠️ JSON 但索引有限 | 6 张表用 JSON 列 |
| **异步驱动** | ✅ asyncpg(原生) | ⚠️ aiomysql(性能弱) | FastAPI 全异步必需 |
| **大字段处理** | ✅ TOAST 自动压缩 | ⚠️ 行外存储复杂 | 波形数据可达 MB 级 |
| **窗口函数** | ✅ 完整支持 | ⚠️ 8.0 后才有 | 时序统计需求 |
| **未来扩展** | ✅ TimescaleDB / PostGIS | — | 监控数据时序化 |
| **行级安全(RLS)** | ✅ 内置 | ❌ 不支持 | 多租户隔离 |

**结论**:对**实验数据 + JSON 半结构化 + 异步全栈**的场景,PG 是无可争议的最优解。

---

## 9 张业务表

| 表名 | 用途 | 关键字段 |
|:--|:--|:--|
| `users` | 用户账号 | username(唯一)、password_hash、is_admin |
| `materials` | 材料数据库 | name、Johnson-Cook 参数(JSONB) |
| `experiments` | 实验主表 | user_id(外键)、material_id、参数、状态 |
| `waveform_data` | 波形数据 | experiment_id、channel、timestamp、values(JSONB) |
| `monitor_snapshots` | 监控快照 | experiment_id、device_id、metrics(JSONB) |
| `devices` | 硬件设备资产 | name、model、status |
| `reports` | 实验报告 | experiment_id、format、content_url |
| `ai_operation_logs` | AI 调用记录 | user_id、provider、prompt_tokens、cost |
| `audit_logs` | 操作审计 | user_id、action、target、ip、timestamp |

---

## E-R 关系图

```
              ┌─────────┐
              │  users  │
              └────┬────┘
                   │ 1:N
       ┌───────────┼─────────────┬─────────────┐
       │           │             │             │
       ▼           ▼             ▼             ▼
┌───────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│experiments│ │ai_op_log │ │audit_logs│ │ reports  │
└─────┬─────┘ └──────────┘ └──────────┘ └──────────┘
      │
      │ 1:N
      ├─────────────────┬─────────────────┐
      ▼                 ▼                 ▼
┌──────────────┐ ┌──────────────────┐ ┌──────────┐
│waveform_data │ │monitor_snapshots │ │ reports  │
└──────────────┘ └─────────┬────────┘ └──────────┘
                           │ N:1
                           ▼
                      ┌─────────┐
                      │ devices │
                      └─────────┘
                      
materials ─────────── experiments  (N:N 通过 material_id)
```

---

## JSONB 实战场景

### 场景 1:Johnson-Cook 参数

```sql
-- materials 表
CREATE TABLE materials (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    johnson_cook JSONB,   -- {"A": 324e6, "B": 114e6, "n": 0.42, ...}
    density REAL,
    elastic_modulus REAL
);

-- GIN 索引加速 JSON 查询
CREATE INDEX idx_material_jc ON materials USING gin(johnson_cook);

-- 查询所有 A > 300MPa 的材料
SELECT * FROM materials
WHERE (johnson_cook->>'A')::float > 300e6;
```

### 场景 2:波形数据

```sql
-- waveform_data 表
CREATE TABLE waveform_data (
    id BIGSERIAL PRIMARY KEY,
    experiment_id VARCHAR NOT NULL,
    channel VARCHAR NOT NULL,        -- 'incident' / 'reflected' / 'transmitted'
    timestamp TIMESTAMP NOT NULL,
    values JSONB NOT NULL            -- [-12.3, -11.8, ..., 0.1]
);
```

**优势**:同一张表存所有通道,Schema 不需变更即可加新通道。

---

## 索引策略

| 索引 | 类型 | 命中场景 |
|:--|:--|:--|
| `users.username` | UNIQUE | 登录查询 |
| `users.email` | UNIQUE | 注册去重 |
| `experiments.user_id` | BTREE | 列出"我的实验" |
| `ix_waveform_exp_channel_ts` | 复合 | 波形分通道按时间检索 |
| `ix_monitor_exp_ts` | 复合 | 监控按实验+时间 |
| `ix_monitor_ts_desc` | 倒序 | 取最新监控 |
| `ix_audit_created_desc` | 倒序 | 审计日志倒序展示 |
| `idx_material_jc` | GIN | JSONB 查询(可选) |

**核心原则**:**写入热点查询路径必须命中索引**,慢查询日志开启,定期 EXPLAIN ANALYZE 复盘。

---

## Alembic 版本化迁移

```
hopkinson-backend/alembic/
├── alembic.ini
├── env.py
└── versions/
    └── 6d4c75651d2c_initial_schema.py    ← 包含全部 9 张表 + 4 个索引
```

```bash
# 命令行流程
alembic revision --autogenerate -m "add_phone_field"  # 生成新版本
alembic upgrade head                                  # 应用到数据库
alembic downgrade -1                                  # 回滚一个版本
alembic current                                       # 查看当前版本
```

**生产环境保护**:
```python
# db/engine.py
if not is_production():
    await conn.run_sync(Base.metadata.create_all)  # 仅开发模式可用
# 生产强制走 Alembic,杜绝"魔改 ORM 直接生效"
```

---

## 双数据库环境

| 环境 | 数据库 | 连接串 |
|:--|:--|:--|
| **开发** | SQLite | `sqlite+aiosqlite:///./hopkinson.db` |
| **生产** | PostgreSQL 16 | `postgresql+asyncpg://hopkinson_user:xxx@127.0.0.1:5432/hopkinson` |

**统一 SQLAlchemy 2.0 抽象**,业务代码 0 改动即可切换。

---

## 安全防护

| 维度 | 措施 |
|:--|:--|
| 密码存储 | bcrypt 哈希(work factor 12,**永不存明文**) |
| SQL 注入 | SQLAlchemy 参数化查询(无字符串拼接) |
| 访问控制 | `user_id` 行级校验 + `is_admin` RBAC |
| 连接加密 | 生产 PG 强制 SSL(宝塔配置) |
| 备份保护 | `chmod 600 backup/*.sql`,只 root 可读 |
| 审计追踪 | `audit_logs` 表记录 IP / action / target |

---

## 备份策略 — 宝塔每日计划任务

```bash
#!/bin/bash
# 每天 03:00 自动执行
BACKUP_DIR=/www/backup/hopkinson
mkdir -p $BACKUP_DIR

pg_dump -U hopkinson_user -h 127.0.0.1 hopkinson \
  > $BACKUP_DIR/hopkinson-$(date +%F).sql

# 只保留最近 30 天
find $BACKUP_DIR -name "hopkinson-*.sql" -mtime +30 -delete
```

**还原**:
```bash
psql -U hopkinson_user hopkinson < /www/backup/hopkinson/hopkinson-2026-04-18.sql
```

---

## 种子数据

```bash
python -m db.seed
```

自动插入:
- **21 种** 主流材料的 J-C 参数(6061-T6 / 304SS / Ti-6Al-4V / ...)
- 1 个 admin 账号(密码从 `ADMIN_PASSWORD` 环境变量读取)
- 默认硬件设备清单

---

## 关键数据

| 指标 | 数值 |
|:--|:--|
| 数据库版本 | **PostgreSQL 16** |
| 业务表数 | **9** 张 |
| JSONB 列覆盖 | **6** 张表 |
| 索引数(初始) | **4** 个复合/倒序索引 |
| 外键约束 | **5** 条 |
| 种子材料数 | **21** 种 |
| 平均响应延迟 | **< 10ms**(本地) |
| 备份频率 | **每天**,保留 30 天 |
| 迁移方式 | Alembic 版本化(可回滚) |
| 字符集 | **UTF8** |

---

## 现场可演示

| 演示动作 | 命令/位置 |
|:--|:--|
| 看 ORM 模型 | `hopkinson-backend/db/models.py` |
| 看迁移脚本 | `alembic/versions/6d4c75651d2c_initial_schema.py` |
| 应用迁移 | `alembic upgrade head` |
| 灌种子数据 | `python -m db.seed` |
| 查实验数据 | 宝塔 → PostgreSQL → phpPgAdmin → `SELECT * FROM experiments` |
| 看 9 张表 | 浏览器 `https://<域名>/admin`(SQLAdmin) |
| 查 JSONB | `SELECT name, johnson_cook->>'A' FROM materials;` |
