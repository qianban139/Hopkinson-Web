"""
buildRealWaveforms.py — 一次性预处理脚本

读取 C:\\Users\\Lenovo\\Desktop\\数据\\ 中 4 个代表性 SHPB 实验 xlsx,
用经典 SHPB 公式从已处理的 时间-应力-应变率 反推出杆上应变片信号:
  - 入射杆 (incident bar): 双极 (先负入射 + 后正反射)
  - 透射杆 (transmitted bar): 单极负向

输出: src/data/realBarWaveforms.ts (TypeScript 数组,前端直接 import)
"""
from __future__ import annotations
import os
import sys
import math
from pathlib import Path

import openpyxl

sys.stdout.reconfigure(encoding="utf-8")

# ── 路径 ─────────────────────────────────────────────────────────────
DATA_DIR = Path(r"C:\Users\Lenovo\Desktop\数据")
OUT_FILE = Path(__file__).parent.parent / "src" / "data" / "realBarWaveforms.ts"

# 4 个代表性档位 (按子弹电压 V)
PICKS: dict[str, str] = {
    "2600": "0.5-2600.xlsx",
    "3000": "1.5-3000.xlsx",
    "3300": "1-3300.xlsx",
    "3600": "1-3600.xlsx",
}

# ── SHPB 物理参数 (取自 xlsx 表头) ──────────────────────────────────
E_BAR = 210e9              # Pa, 杆弹模
RHO_BAR = 7930             # kg/m³, 杆密度
C0 = math.sqrt(E_BAR / RHO_BAR)   # ≈ 5145 m/s, 杆波速
L_S = 0.025                # m, 试件长度
L_BAR_INC = 2.000          # m, 入射杆长度
L_GAUGE_INC = 1.010        # m, 入射杆应变片到试件距离
L_GAUGE_TRA = 0.710        # m, 透射杆应变片到试件距离

# 关键时延 (lab time, μs)
T_INC_AT_GAUGE = (L_BAR_INC - L_GAUGE_INC) / C0 * 1e6   # ≈ 192 μs, 入射波首达入射应变片
T_REF_AT_GAUGE = (L_BAR_INC + L_GAUGE_INC) / C0 * 1e6   # ≈ 585 μs, 反射波回到入射应变片
T_TRA_AT_GAUGE = (L_BAR_INC + L_GAUGE_TRA) / C0 * 1e6   # ≈ 527 μs, 透射波到透射应变片


def read_xlsx(path: Path) -> list[tuple[float, float, float]]:
    """返回 [(t_us, σ_MPa, ε̇_xlsx)] 列表; ε̇ 单位是 μϵ/s."""
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    ws = wb.active
    rows: list[tuple[float, float, float]] = []
    for row in ws.iter_rows(min_row=11, values_only=True):
        # 列: 0=None, 1=None, 2=时间, 3=应变, 4=应力, 5=应变率, 6=能量
        if row[2] is None or not isinstance(row[4], (int, float)):
            break
        t = float(row[2])
        sigma = float(row[4])
        eps_dot = float(row[5]) if row[5] is not None else 0.0
        rows.append((t, sigma, eps_dot))
    wb.close()
    return rows


def reconstruct(rows: list[tuple[float, float, float]]) -> tuple[list[list[float]], list[list[float]]]:
    """
    SHPB 公式反推杆上应变片信号 (μϵ).

    透射杆: ε_T = -σ / E_bar       (压缩为负)
    反射波: ε_R = +(L_s/2c0) · ε̇  (拉伸为正,反射后)
    入射波: ε_I = ε_T - ε_R         (压缩为负,幅值最大)

    入射杆应变片显示 = ε_I 在 T_INC_AT_GAUGE 时刻出现 + ε_R 在 T_REF_AT_GAUGE 时刻到达
                  → 形成"先负后正"双极
    透射杆应变片显示 = ε_T 在 T_TRA_AT_GAUGE 时刻出现 → 单极负向
    """
    if not rows:
        return [], []

    # σ MPa→Pa, 转 μϵ: ε = σ_Pa/E ; ε_μϵ = σ_MPa·1e6 / 210e9 · 1e6 = σ_MPa / 0.21
    eps_T_us = [-r[1] / 0.21 for r in rows]
    # ε̇ 在 xlsx 已是 μϵ/s (即 ε̇_real_per_s × 1e6)
    # ε_R_μϵ = (L_s/2c0) · ε̇_real_per_s · 1e6 = (L_s/2c0) · ε̇_xlsx
    coef = L_S / (2 * C0)
    eps_R_us = [coef * r[2] for r in rows]
    eps_I_us = [eps_T_us[i] - eps_R_us[i] for i in range(len(rows))]

    n = len(rows)
    t_max_specimen = rows[-1][0]   # 试件本地时间最大值 (μs)
    lab_t_max = int(T_REF_AT_GAUGE + t_max_specimen + 80)

    # 实验室时间轴 2 μs 步长
    incident_trace: list[list[float]] = []
    transmitted_trace: list[list[float]] = []

    # 微观弥散涟漪 (1% 振幅,模拟应变片真实采样)
    def ripple(t_us: float, seed: float, peak: float) -> float:
        if abs(peak) < 1.0:
            return 0.0
        amp = 0.01 * abs(peak)
        return amp * (
            math.sin(t_us * 0.18 + seed * 1.7) * 0.6
            + math.sin(t_us * 0.42 + seed * 3.1) * 0.3
            + math.sin(t_us * 0.95 + seed * 5.3) * 0.1
        )

    inc_peak = max(abs(min(eps_I_us)), max(eps_R_us))
    tra_peak = abs(min(eps_T_us))

    for lab_t in range(0, lab_t_max + 1, 2):
        # 入射杆通道
        v_inc = 0.0
        # 入射段 (lab_t = T_INC + t_specimen)
        idx_inc = int(lab_t - T_INC_AT_GAUGE)
        if 0 <= idx_inc < n:
            v_inc += eps_I_us[idx_inc]
        # 反射段 (lab_t = T_REF + t_specimen)
        idx_ref = int(lab_t - T_REF_AT_GAUGE)
        if 0 <= idx_ref < n:
            v_inc += eps_R_us[idx_ref]
        # 加涟漪 (仅在波形存在时)
        if abs(v_inc) > 0.5:
            v_inc += ripple(lab_t, 1.3, inc_peak)
        incident_trace.append([lab_t, round(v_inc, 1)])

        # 透射杆通道
        v_tra = 0.0
        idx_tra = int(lab_t - T_TRA_AT_GAUGE)
        if 0 <= idx_tra < n:
            v_tra = eps_T_us[idx_tra]
        if abs(v_tra) > 0.5:
            v_tra += ripple(lab_t, 2.7, tra_peak)
        transmitted_trace.append([lab_t, round(v_tra, 1)])

    return incident_trace, transmitted_trace


def fmt_pairs(pairs: list[list[float]]) -> str:
    """[[0,-1.2],[2,-3.4],...] 紧凑输出."""
    parts = [f"[{int(p[0])},{p[1]}]" for p in pairs]
    return "[" + ",".join(parts) + "]"


def main() -> None:
    print(f"c0 = {C0:.0f} m/s")
    print(f"T_INC_AT_GAUGE = {T_INC_AT_GAUGE:.0f} μs")
    print(f"T_REF_AT_GAUGE = {T_REF_AT_GAUGE:.0f} μs")
    print(f"T_TRA_AT_GAUGE = {T_TRA_AT_GAUGE:.0f} μs")
    print()

    blocks: list[str] = []
    for tier, fname in PICKS.items():
        path = DATA_DIR / fname
        if not path.exists():
            print(f"  [SKIP] {fname} 不存在")
            continue
        rows = read_xlsx(path)
        inc_trace, tra_trace = reconstruct(rows)
        inc_peak = min(p[1] for p in inc_trace)
        ref_peak = max(p[1] for p in inc_trace)
        tra_peak = min(p[1] for p in tra_trace)
        print(
            f"  [{tier} V] {fname}: rows={len(rows)} "
            f"→ 入射杆 {inc_peak:+.0f}/{ref_peak:+.0f} μϵ, 透射杆 {tra_peak:+.0f} μϵ"
        )
        blocks.append(
            f"  '{tier}': {{\n"
            f"    incidentBar: {fmt_pairs(inc_trace)},\n"
            f"    transmittedBar: {fmt_pairs(tra_trace)},\n"
            f"  }}"
        )

    out = (
        "// src/data/realBarWaveforms.ts\n"
        "// 自动生成 — 来源 scripts/buildRealWaveforms.py\n"
        "// 杆上应变片真实信号 (μϵ),从 SHPB 试样应力/应变率反推得到\n"
        "// 入射杆: 双极 (先负入射 + 后正反射), 透射杆: 单极负向\n"
        "// 4 档电压: 2600 / 3000 / 3300 / 3600 V\n"
        "\n"
        "export type WaveformPoint = [number, number]; // [时间μs, 应变μϵ]\n"
        "\n"
        "export interface BarWaveformSet {\n"
        "  incidentBar: WaveformPoint[];\n"
        "  transmittedBar: WaveformPoint[];\n"
        "}\n"
        "\n"
        "export const realBarWaveforms: Record<string, BarWaveformSet> = {\n"
        + ",\n".join(blocks)
        + ",\n};\n\n"
        "const TIERS = [2600, 3000, 3300, 3600] as const;\n"
        "\n"
        "/** 按当前电压选最接近的档位波形 */\n"
        "export function pickWaveformByVoltage(voltage: number): BarWaveformSet {\n"
        "  let best: number = TIERS[0];\n"
        "  let bestDiff = Math.abs(voltage - TIERS[0]);\n"
        "  for (const t of TIERS) {\n"
        "    const diff = Math.abs(voltage - t);\n"
        "    if (diff < bestDiff) { best = t; bestDiff = diff; }\n"
        "  }\n"
        "  return realBarWaveforms[String(best)];\n"
        "}\n"
    )

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(out, encoding="utf-8")
    size_kb = OUT_FILE.stat().st_size / 1024
    print(f"\n→ 写入 {OUT_FILE} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
