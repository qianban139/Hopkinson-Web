"""
SQLAdmin 管理视图 — 所有模型的 CRUD 管理界面

访问地址: /admin/
"""
from fastapi import FastAPI
from sqladmin import Admin, ModelView

from core.settings import get_session_secret
from db.engine import get_engine
from db.models import (
    User,
    Material,
    Experiment,
    WaveformData,
    MonitorSnapshot,
    Device,
    Report,
    AIOperationLog,
    AuditLog,
)
from .auth import AdminAuth


# =============================================
# 各模型的管理视图
# =============================================

class UserAdmin(ModelView, model=User):
    name = "用户"
    name_plural = "用户管理"
    icon = "fa-solid fa-users"

    column_list = [User.id, User.username, User.email, User.is_admin, User.display_name, User.created_at, User.last_login]
    column_searchable_list = [User.username, User.email, User.display_name]
    column_sortable_list = [User.created_at, User.last_login, User.username]
    column_default_sort = ("created_at", True)

    form_excluded_columns = [User.experiments, User.reports]
    # 密码哈希字段不在列表中显示
    column_details_exclude_list = [User.password_hash]

    can_create = True
    can_edit = True
    can_delete = True
    can_export = True


class MaterialAdmin(ModelView, model=Material):
    name = "材料"
    name_plural = "材料数据库"
    icon = "fa-solid fa-atom"

    column_list = [Material.id, Material.name, Material.category, Material.sub_category, Material.johnson_cook, Material.updated_at]
    column_searchable_list = [Material.name, Material.category, Material.id]
    column_sortable_list = [Material.name, Material.category]
    column_default_sort = "name"

    form_excluded_columns = [Material.experiments]

    can_create = True
    can_edit = True
    can_delete = True
    can_export = True


class ExperimentAdmin(ModelView, model=Experiment):
    name = "实验"
    name_plural = "实验记录"
    icon = "fa-solid fa-flask"

    column_list = [
        Experiment.id, Experiment.material_id, Experiment.mode,
        Experiment.phase, Experiment.progress, Experiment.created_at,
        Experiment.started_at, Experiment.completed_at,
    ]
    column_searchable_list = [Experiment.id, Experiment.material_id, Experiment.mode]
    column_sortable_list = [Experiment.created_at, Experiment.phase, Experiment.progress]
    column_default_sort = ("created_at", True)

    form_excluded_columns = [Experiment.waveforms, Experiment.reports, Experiment.user, Experiment.material]

    can_create = False  # 实验只能通过 API 创建
    can_edit = True
    can_delete = True
    can_export = True


class WaveformAdmin(ModelView, model=WaveformData):
    name = "波形"
    name_plural = "波形数据"
    icon = "fa-solid fa-wave-square"

    column_list = [WaveformData.id, WaveformData.experiment_id, WaveformData.channel, WaveformData.sample_rate_hz, WaveformData.timestamp]
    column_searchable_list = [WaveformData.experiment_id, WaveformData.channel]
    column_sortable_list = [WaveformData.timestamp]
    column_default_sort = ("timestamp", True)

    # 波形数据量大，不在列表显示 samples
    column_details_exclude_list = []

    can_create = False
    can_edit = False
    can_delete = True
    can_export = True
    page_size = 50


class MonitorSnapshotAdmin(ModelView, model=MonitorSnapshot):
    name = "监控"
    name_plural = "监控快照"
    icon = "fa-solid fa-chart-line"

    column_list = [
        MonitorSnapshot.id, MonitorSnapshot.timestamp,
        MonitorSnapshot.voltage, MonitorSnapshot.current,
        MonitorSnapshot.temperature, MonitorSnapshot.emi,
        MonitorSnapshot.safe,
    ]
    column_sortable_list = [MonitorSnapshot.timestamp, MonitorSnapshot.safe]
    column_default_sort = ("timestamp", True)

    can_create = False
    can_edit = False
    can_delete = True
    can_export = True
    page_size = 100


class DeviceAdmin(ModelView, model=Device):
    name = "设备"
    name_plural = "设备管理"
    icon = "fa-solid fa-microchip"

    column_list = [Device.id, Device.name, Device.type, Device.status, Device.last_heartbeat, Device.calibration_due]
    column_searchable_list = [Device.name, Device.type, Device.id]
    column_sortable_list = [Device.last_heartbeat, Device.status]

    can_create = True
    can_edit = True
    can_delete = True


class ReportAdmin(ModelView, model=Report):
    name = "报告"
    name_plural = "实验报告"
    icon = "fa-solid fa-file-pdf"

    column_list = [Report.id, Report.title, Report.report_type, Report.format, Report.experiment_id, Report.created_at]
    column_searchable_list = [Report.title, Report.report_type]
    column_sortable_list = [Report.created_at, Report.report_type]
    column_default_sort = ("created_at", True)

    can_create = False
    can_edit = True
    can_delete = True
    can_export = True


class AIOperationLogAdmin(ModelView, model=AIOperationLog):
    name = "AI日志"
    name_plural = "AI 操作日志"
    icon = "fa-solid fa-robot"

    column_list = [
        AIOperationLog.id, AIOperationLog.operation, AIOperationLog.model,
        AIOperationLog.tokens_in, AIOperationLog.tokens_out,
        AIOperationLog.duration_ms, AIOperationLog.created_at,
    ]
    column_sortable_list = [AIOperationLog.created_at, AIOperationLog.operation]
    column_default_sort = ("created_at", True)

    can_create = False
    can_edit = False
    can_delete = True
    can_export = True
    page_size = 50


class AuditLogAdmin(ModelView, model=AuditLog):
    name = "审计"
    name_plural = "审计日志"
    icon = "fa-solid fa-shield-halved"

    column_list = [
        AuditLog.id, AuditLog.action, AuditLog.target_type,
        AuditLog.target_id, AuditLog.ip_address, AuditLog.created_at,
    ]
    column_searchable_list = [AuditLog.action, AuditLog.target_type, AuditLog.target_id]
    column_sortable_list = [AuditLog.created_at, AuditLog.action]
    column_default_sort = ("created_at", True)

    can_create = False
    can_edit = False
    can_delete = True
    can_export = True
    page_size = 50


# =============================================
# 安装函数 — 在 main.py 中调用
# =============================================

def setup_admin(app: FastAPI, engine=None) -> Admin:
    """将 SQLAdmin 挂载到 FastAPI 应用

    注意：SessionMiddleware 必须在 app 启动前添加，由 main.py 负责。
    engine 参数允许延迟传入（lifespan 阶段 engine 才就绪时使用）。
    """
    # 创建 Admin 实例
    admin = Admin(
        app,
        engine=engine or get_engine(),
        authentication_backend=AdminAuth(secret_key=get_session_secret()),
        title="Hopkinson 管理后台",
        base_url="/admin",
    )

    # 注册所有管理视图
    admin.add_view(UserAdmin)
    admin.add_view(MaterialAdmin)
    admin.add_view(ExperimentAdmin)
    admin.add_view(WaveformAdmin)
    admin.add_view(MonitorSnapshotAdmin)
    admin.add_view(DeviceAdmin)
    admin.add_view(ReportAdmin)
    admin.add_view(AIOperationLogAdmin)
    admin.add_view(AuditLogAdmin)

    return admin
