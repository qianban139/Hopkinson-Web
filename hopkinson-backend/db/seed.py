"""
数据库种子脚本 — 导入初始数据

用法：
  cd hopkinson-backend
  python -m db.seed

功能：
  1. 从 materials.json 导入 30+ 材料到 materials 表
  2. 注册 mock 设备到 devices 表
  3. 创建初始管理员用户(密码从 ADMIN_PASSWORD 环境变量读取,必须强密码)
"""
import asyncio
import json
import sys
from pathlib import Path

# 确保能找到项目模块
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from core.settings import get_admin_password
from db.engine import init_db, get_session, close_db
from db.models import Material, Device, User, Experiment
from passlib.hash import bcrypt as pwd_hash


# 评委演示账号统一密码（演示用，非生产敏感数据）
JUDGE_PASSWORD = "Judge@2026"


def hash_password(pw: str) -> str:
    return pwd_hash.hash(pw)


# ─── 材料数据 JSON 路径 ───
MATERIALS_JSON = Path(__file__).resolve().parent.parent.parent / "src" / "data" / "materials.json"


async def seed_materials(session):
    """从 materials.json 导入材料"""
    if not MATERIALS_JSON.exists():
        print(f"[跳过] 材料文件不存在: {MATERIALS_JSON}")
        return 0

    with open(MATERIALS_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    materials = data.get("materials", [])
    count = 0
    for m in materials:
        # 检查是否已存在
        from sqlalchemy import select
        existing = await session.execute(select(Material).where(Material.id == m["id"]))
        if existing.scalar_one_or_none():
            continue

        mat = Material(
            id=m["id"],
            name=m["name"],
            category=m.get("category", ""),
            sub_category=m.get("subCategory"),
            johnson_cook=m.get("johnsonCookParams", {}),
            physical_props={
                "density": m.get("density"),
                "elasticModulus": m.get("elasticModulus"),
                "yieldStrength": m.get("yieldStrength"),
                "stiffnessK": m.get("stiffnessK"),
                "dampingC": m.get("dampingC"),
                "emiThreshold": m.get("emiThreshold"),
            },
            metadata_={
                "subcategoryLabel": m.get("subcategoryLabel"),
                "examples": m.get("examples"),
                "typicalStrainRate": m.get("typicalStrainRate"),
                "preferredWaveform": m.get("preferredWaveform"),
                "applications": m.get("applications"),
                "stressStrainSample": m.get("stressStrainSample"),
                "destructionTime": m.get("destructionTime"),
                "color": m.get("color"),
                "description": m.get("description"),
            },
        )
        session.add(mat)
        count += 1

    await session.commit()
    return count


async def seed_devices(session):
    """注册 mock 设备"""
    from sqlalchemy import select
    from datetime import datetime, timezone

    devices_data = [
        {
            "id": "daq-001",
            "name": "MockDAQ 数据采集卡",
            "type": "daq",
            "status": "online",
        },
        {
            "id": "em-001",
            "name": "MockEM 电磁驱动器",
            "type": "em-driver",
            "status": "online",
        },
    ]

    count = 0
    for d in devices_data:
        existing = await session.execute(select(Device).where(Device.id == d["id"]))
        if existing.scalar_one_or_none():
            continue
        device = Device(
            id=d["id"],
            name=d["name"],
            type=d["type"],
            status=d["status"],
            last_heartbeat=datetime.now(timezone.utc),
        )
        session.add(device)
        count += 1

    await session.commit()
    return count


async def seed_admin(session):
    """创建初始管理员(ADMIN_PASSWORD 必须从环境变量读取强密码)"""
    from sqlalchemy import select

    admin_password = get_admin_password()  # 缺失或过弱时抛 RuntimeError

    existing = await session.execute(select(User).where(User.username == "admin"))
    if existing.scalar_one_or_none():
        print("[跳过] 管理员用户已存在")
        return False

    admin = User(
        username="admin",
        email="admin@hopkinson.local",
        password_hash=hash_password(admin_password),
        is_admin=True,
        display_name="系统管理员",
    )
    session.add(admin)
    await session.commit()
    return True


async def seed_judges(session):
    """
    创建 3 个评委演示账号 + 预置实验数据

    用途:演示日评委可一键登录,看到完整的实验工作流而无需自助注册。
    密码统一为 JUDGE_PASSWORD,登录页提供快捷填充按钮。
    """
    from sqlalchemy import select
    from datetime import timezone

    judges_data = [
        {
            "username": "judge1",
            "display_name": "评委一号",
            "experiments": [
                {"material_id": "metal-01", "mode": "simulation", "phase": "completed",
                 "params": {"voltage": 2400, "current": 18000, "waveform": "rect", "duration_us": 200}},
                {"material_id": "metal-02", "mode": "simulation", "phase": "completed",
                 "params": {"voltage": 3000, "current": 25000, "waveform": "tri", "duration_us": 180}},
                {"material_id": "metal-01", "mode": "real", "phase": "completed",
                 "params": {"voltage": 2800, "current": 22000, "waveform": "rect", "duration_us": 200}},
            ],
        },
        {
            "username": "judge2",
            "display_name": "评委二号",
            "experiments": [
                {"material_id": "metal-03", "mode": "simulation", "phase": "completed",
                 "params": {"voltage": 3200, "current": 28000, "waveform": "rect", "duration_us": 220}},
                {"material_id": "metal-04", "mode": "simulation", "phase": "completed",
                 "params": {"voltage": 2600, "current": 20000, "waveform": "tri", "duration_us": 200}},
            ],
        },
        {
            # 第三个账号空白,供评委自己跑全流程
            "username": "judge3",
            "display_name": "评委三号",
            "experiments": [],
        },
    ]

    user_count = 0
    exp_count = 0

    for jd in judges_data:
        existing = await session.execute(select(User).where(User.username == jd["username"]))
        user = existing.scalar_one_or_none()
        if user is None:
            user = User(
                username=jd["username"],
                email=f"{jd['username']}@hopkinson.demo",
                password_hash=hash_password(JUDGE_PASSWORD),
                is_admin=False,
                display_name=jd["display_name"],
            )
            session.add(user)
            await session.flush()  # 拿 user.id
            user_count += 1

        # 预置实验记录
        for idx, exp_data in enumerate(jd["experiments"], start=1):
            # 用 username + 序号生成稳定 id,重复 seed 不会冲突
            exp_id = f"exp-demo-{jd['username']}-{idx:03d}"
            existing_exp = await session.execute(select(Experiment).where(Experiment.id == exp_id))
            if existing_exp.scalar_one_or_none():
                continue
            exp = Experiment(
                id=exp_id,
                user_id=user.id,
                material_id=exp_data["material_id"],
                mode=exp_data["mode"],
                phase=exp_data["phase"],
                progress=100 if exp_data["phase"] == "completed" else 0,
                params=exp_data["params"],
            )
            session.add(exp)
            exp_count += 1

    await session.commit()
    return user_count, exp_count


async def main():
    print("=" * 50)
    print("  Hopkinson Backend — 数据库种子脚本")
    print("=" * 50)

    await init_db()

    async for session in get_session():
        # 1. 导入材料
        mat_count = await seed_materials(session)
        print(f"[材料] 导入 {mat_count} 种材料")

        # 2. 注册设备
        dev_count = await seed_devices(session)
        print(f"[设备] 注册 {dev_count} 个设备")

        # 3. 创建管理员(密码从 ADMIN_PASSWORD 读取)
        admin_created = await seed_admin(session)
        if admin_created:
            print("[用户] 管理员用户已创建(密码见 .env 的 ADMIN_PASSWORD)")

        # 4. 创建评委演示账号 + 预置实验
        judge_users, judge_exps = await seed_judges(session)
        print(f"[评委] 新建 {judge_users} 个评委账号、{judge_exps} 条预置实验")
        print(f"       密码统一: {JUDGE_PASSWORD}  | 用户名: judge1 / judge2 / judge3")

    await close_db()
    print("\n种子数据导入完成！")


if __name__ == "__main__":
    asyncio.run(main())
