/**
 * 实验报告生成器
 *
 * 支持 4 种报告类型：
 *   1. 学习总结 (1-2 页) — 学生作业
 *   2. 实验记录 (3-5 页) — 日常实验记录
 *   3. 研究报告 (8-15 页) — 论文准备级
 *   4. 完整论文 (20+ 页) — 学术发表级
 *
 * 支持 4 种导出格式：Markdown / LaTeX / HTML / JSON
 * （PDF / Word 由前端通过浏览器打印 HTML 或保存 Markdown 后转换）
 */

import type { Material } from '@/types';

export type ReportType = 'summary' | 'record' | 'research' | 'thesis';
export type ExportFormat = 'markdown' | 'latex' | 'html' | 'json';

export interface ReportInputs {
  type: ReportType;
  material: Material;
  jcParams: { A: number; B: number; n: number; C: number; m: number; Tm: number };
  fitR2: number;
  strainRate: number;
  temperature: number;
  aiResult?: { sigma: number; epsilon: number; r2: number } | null;
  experimentNotes?: string;
}

export interface ReportSection {
  title: string;
  level: number; // 1 = h1, 2 = h2, ...
  body: string;
}

export interface GeneratedReport {
  meta: {
    type: ReportType;
    title: string;
    author: string;
    date: string;
    pageEstimate: string;
  };
  sections: ReportSection[];
}

const TYPE_META: Record<ReportType, { title: string; pages: string }> = {
  summary: { title: '学习总结', pages: '1-2 页' },
  record: { title: '实验记录', pages: '3-5 页' },
  research: { title: '研究报告', pages: '8-15 页' },
  thesis: { title: '完整论文', pages: '20+ 页' },
};

/* ============================================================
 * 章节内容生成（按报告类型逐级丰富）
 * ============================================================ */

function buildSections(inp: ReportInputs): ReportSection[] {
  const { type, material, jcParams, fitR2, strainRate, temperature, aiResult } = inp;
  const sections: ReportSection[] = [];

  // 1. 实验目的（所有类型）
  sections.push({
    title: '一、实验目的',
    level: 2,
    body:
      `本次实验采用电磁驱动 SHPB（分离式霍普金森压杆）系统，对 ${material.name} 进行动态力学性能测试。` +
      `通过测量入射波、反射波、透射波的应变信号，计算试件在高应变率（${strainRate} /s）和温度（${temperature}°C）条件下的应力-应变响应，` +
      `并采用 Johnson-Cook 本构模型对材料动态行为进行拟合，为${material.subCategory === 'metal' ? '金属冲击设计' : '材料动态响应研究'}提供数据支撑。`,
  });

  // 2. 设备与试件
  if (type !== 'summary') {
    sections.push({
      title: '二、实验装置与试件',
      level: 2,
      body:
        `**SHPB 装置参数**\n` +
        `- 入射杆 / 透射杆：直径 29 mm，长度 1500 mm，材质 18Ni 马氏体时效钢，弹性波速 ≈ 5172 m/s\n` +
        `- 撞击杆：长度 200 mm，由电磁驱动器加速\n` +
        `- 应变片：贴于杆中央，灵敏系数 2.13，桥压 5 V\n` +
        `- 数据采集：高速 DAQ，采样率 1 MHz，触发同步\n\n` +
        `**试件信息**\n` +
        `- 材料：${material.name}（${material.category}）\n` +
        `- 密度：${(material.density / 1000).toFixed(2)} g/cm³\n` +
        `- 弹性模量：${(material.elasticModulus / 1e9).toFixed(1)} GPa\n` +
        `- 屈服强度：${(material.yieldStrength / 1e6).toFixed(0)} MPa\n` +
        `- 试件尺寸：Φ8 × 4 mm 圆柱`,
    });
  }

  // 3. 实验原理（research / thesis）
  if (type === 'research' || type === 'thesis') {
    sections.push({
      title: '三、实验原理',
      level: 2,
      body:
        `**3.1 一维应力波理论**\n\n` +
        `根据 Kolsky 假设，试件的应变率 ε̇(t)、应变 ε(t)、应力 σ(t) 由三波信号计算：\n\n` +
        `$$\\dot\\varepsilon(t) = -\\frac{2c_0}{l_s}\\varepsilon_r(t)$$\n\n` +
        `$$\\varepsilon(t) = -\\frac{2c_0}{l_s}\\int_0^t \\varepsilon_r(\\tau)d\\tau$$\n\n` +
        `$$\\sigma(t) = \\frac{A_b E}{A_s}\\varepsilon_t(t)$$\n\n` +
        `其中 c₀ 为杆中弹性波速，l_s 为试件初始长度，A_b、A_s 分别为杆与试件横截面积。\n\n` +
        `**3.2 Johnson-Cook 本构模型**\n\n` +
        `$$\\sigma = (A + B\\varepsilon^n)(1 + C\\ln\\dot\\varepsilon^*)(1 - T^{*m})$$\n\n` +
        `其中：\n` +
        `- A：屈服强度 (MPa)\n` +
        `- B、n：应变硬化系数与指数\n` +
        `- C：应变率敏感系数\n` +
        `- m：温度软化指数\n` +
        `- T*：归一化温度 (T - T_room)/(T_melt - T_room)`,
    });
  }

  // 4. 实验结果
  sections.push({
    title: type === 'summary' ? '二、实验结果' : type === 'record' ? '三、实验结果' : '四、实验结果',
    level: 2,
    body:
      `**应力-应变曲线**\n` +
      `共采集 ${material.stressStrainSample.length} 个数据点，最大应变 ${(Math.max(...material.stressStrainSample.map(p => p.strain)) * 100).toFixed(1)}%，` +
      `最大应力 ${Math.max(...material.stressStrainSample.map(p => p.stress)).toFixed(0)} MPa。\n\n` +
      `**Johnson-Cook 拟合参数**\n` +
      `| 参数 | 数值 | 单位 | 含义 |\n` +
      `|------|------|------|------|\n` +
      `| A | ${jcParams.A.toFixed(0)} | MPa | 准静态屈服强度 |\n` +
      `| B | ${jcParams.B.toFixed(0)} | MPa | 应变硬化系数 |\n` +
      `| n | ${jcParams.n.toFixed(3)} | — | 应变硬化指数 |\n` +
      `| C | ${jcParams.C.toFixed(4)} | — | 应变率敏感系数 |\n` +
      `| m | ${jcParams.m.toFixed(2)} | — | 温度软化指数 |\n\n` +
      `**拟合优度**：R² = ${fitR2.toFixed(4)}` +
      (aiResult ? `\n\n**AI 预测结果**：σ = ${aiResult.sigma} MPa，ε = ${aiResult.epsilon}，R² = ${aiResult.r2}` : ''),
  });

  // 5. 讨论（research / thesis）
  if (type === 'research' || type === 'thesis') {
    sections.push({
      title: '五、结果讨论',
      level: 2,
      body:
        `本实验在应变率 ${strainRate} /s、温度 ${temperature}°C 条件下取得 R² = ${fitR2.toFixed(4)} 的拟合精度，` +
        `表明 Johnson-Cook 模型能较好描述 ${material.name} 的动态本构行为。\n\n` +
        `**应变率敏感性**：C = ${jcParams.C.toFixed(4)}，` +
        `${jcParams.C > 0.03 ? '材料表现出较强的应变率敏感性，应变率提高将显著提升流动应力。' : '材料应变率敏感性较弱，可视为应变率不敏感材料。'}\n\n` +
        `**温度影响**：m = ${jcParams.m.toFixed(2)}，` +
        `${jcParams.m > 0.8 ? '热软化效应明显，高温下强度衰减显著。' : '热软化效应较弱，材料在中等温度区间保持较高强度。'}\n\n` +
        `**微观机制**：在低应变率下，位错滑移主导塑性变形；在高应变率（10⁴/s）下，试件可能形成绝热剪切带，导致局部失稳。`,
    });
  }

  // 6. 完整论文：摘要 + 结论 + 参考文献
  if (type === 'thesis') {
    sections.push({
      title: '六、结论',
      level: 2,
      body:
        `1. 成功获取 ${material.name} 在 ${strainRate} /s 应变率下的动态应力-应变曲线\n` +
        `2. Johnson-Cook 模型拟合精度 R² = ${fitR2.toFixed(4)}，参数物理意义明确\n` +
        `3. 材料应变率敏感系数 C = ${jcParams.C.toFixed(4)}，温度软化指数 m = ${jcParams.m.toFixed(2)}\n` +
        `4. 实验结果可为该材料在动态载荷下的工程应用提供本构参数支撑`,
    });
    sections.push({
      title: '七、参考文献',
      level: 2,
      body:
        `[1] Johnson G R, Cook W H. A constitutive model and data for metals subjected to large strains, high strain rates and high temperatures[C]. Proceedings of the 7th International Symposium on Ballistics, 1983.\n\n` +
        `[2] Kolsky H. An investigation of the mechanical properties of materials at very high rates of loading[J]. Proceedings of the Physical Society, 1949, 62(11): 676-700.\n\n` +
        `[3] Tyas A, Watson A J. An investigation of frequency domain dispersion correction of pressure bar signals[J]. International Journal of Impact Engineering, 2001, 25(1): 87-101.`,
    });
  } else {
    // 简单结论
    sections.push({
      title: type === 'summary' ? '三、结论' : type === 'record' ? '四、结论' : '六、结论',
      level: 2,
      body:
        `本实验完成 ${material.name} 在 ${strainRate} /s 应变率下的 SHPB 动态力学测试，` +
        `Johnson-Cook 模型拟合 R² = ${fitR2.toFixed(4)}，` +
        `${fitR2 > 0.95 ? '拟合效果良好' : fitR2 > 0.85 ? '拟合效果一般，建议增加数据点' : '拟合效果较差，建议检查数据'}。`,
    });
  }

  return sections;
}

/* ============================================================
 * 报告生成入口
 * ============================================================ */

export function generateReport(inp: ReportInputs): GeneratedReport {
  const meta = TYPE_META[inp.type];
  return {
    meta: {
      type: inp.type,
      title: `${inp.material.name} 动态力学性能测试 — ${meta.title}`,
      author: 'Hopkinson-Web 实验平台',
      date: new Date().toLocaleDateString('zh-CN'),
      pageEstimate: meta.pages,
    },
    sections: buildSections(inp),
  };
}

/* ============================================================
 * 多格式导出
 * ============================================================ */

export function exportToMarkdown(report: GeneratedReport): string {
  const lines: string[] = [];
  lines.push(`# ${report.meta.title}\n`);
  lines.push(`**作者**：${report.meta.author}  \n**日期**：${report.meta.date}  \n**类型**：${TYPE_META[report.meta.type].title}（${report.meta.pageEstimate}）\n`);
  lines.push('---\n');
  for (const section of report.sections) {
    lines.push(`## ${section.title}\n`);
    lines.push(`${section.body}\n`);
  }
  return lines.join('\n');
}

export function exportToLatex(report: GeneratedReport): string {
  const lines: string[] = [];
  lines.push('\\documentclass[12pt,a4paper]{article}');
  lines.push('\\usepackage[UTF8]{ctex}');
  lines.push('\\usepackage{amsmath, amssymb}');
  lines.push('\\usepackage{graphicx}');
  lines.push('\\usepackage{hyperref}');
  lines.push(`\\title{${report.meta.title}}`);
  lines.push(`\\author{${report.meta.author}}`);
  lines.push(`\\date{${report.meta.date}}`);
  lines.push('\\begin{document}');
  lines.push('\\maketitle');

  for (const section of report.sections) {
    lines.push(`\\section{${section.title.replace(/^[一二三四五六七八九十]+、/, '')}}`);
    // 简单转换 markdown 至 latex
    const body = section.body
      .replace(/\*\*(.+?)\*\*/g, '\\textbf{$1}')
      .replace(/\$\$(.+?)\$\$/gs, '\\[$1\\]')
      .replace(/\$(.+?)\$/g, '$$$1$$')
      .replace(/\| (.+) \|/g, '$1');
    lines.push(body);
    lines.push('');
  }

  lines.push('\\end{document}');
  return lines.join('\n');
}

export function exportToHtml(report: GeneratedReport): string {
  const sectionsHtml = report.sections
    .map(
      (s) =>
        `<h2>${s.title}</h2><div>${s.body
          .replace(/\n\n/g, '</p><p>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\n/g, '<br/>')}</div>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${report.meta.title}</title>
  <style>
    body { font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.7; color: #1a1a1a; }
    h1 { font-size: 24px; border-bottom: 3px solid #00838f; padding-bottom: 10px; }
    h2 { font-size: 18px; color: #00838f; margin-top: 30px; }
    .meta { background: #f5f5f5; padding: 12px; border-left: 4px solid #00838f; margin: 20px 0; }
    .meta strong { color: #00838f; }
    p { margin: 12px 0; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f0f9fa; }
  </style>
</head>
<body>
  <h1>${report.meta.title}</h1>
  <div class="meta">
    <strong>作者：</strong>${report.meta.author}<br/>
    <strong>日期：</strong>${report.meta.date}<br/>
    <strong>报告类型：</strong>${TYPE_META[report.meta.type].title}（${report.meta.pageEstimate}）
  </div>
  ${sectionsHtml}
</body>
</html>`;
}

export function exportToJson(report: GeneratedReport): string {
  return JSON.stringify(report, null, 2);
}

export function exportReport(report: GeneratedReport, format: ExportFormat): string {
  switch (format) {
    case 'markdown':
      return exportToMarkdown(report);
    case 'latex':
      return exportToLatex(report);
    case 'html':
      return exportToHtml(report);
    case 'json':
      return exportToJson(report);
  }
}

/** 辅助：触发浏览器下载 */
export function downloadReport(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
