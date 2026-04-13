// src/features/ai-assistant/services/autoReportExporter.ts
// 自主实验报告导出 — 将 AutoExperimentReport 序列化为 Markdown
import type { AutoExperimentReport } from '@/types';

const STRATEGY_NAMES: Record<string, string> = {
  strain_rate_sweep: '应变率扫描',
  temperature_sweep: '温度扫描',
  material_comparison: '材料对比',
  parameter_optimization: '参数优化',
  custom: '自定义',
};

const DECISION_NAMES: Record<string, string> = {
  continue: '继续执行',
  add_experiments: '追加实验',
  abort: '建议终止',
};

export function buildAutoExperimentMarkdown(report: AutoExperimentReport): string {
  const { plan, completedExperiments, analyses, summary, findings, recommendations, generatedAt } = report;
  const skipped = plan.experiments.filter(e => e.status === 'skipped');
  const failed = plan.experiments.filter(e => e.status === 'failed');

  const lines: string[] = [];
  lines.push(`# AI 自主实验报告`);
  lines.push('');
  lines.push(`**策略**：${STRATEGY_NAMES[plan.strategy] ?? plan.strategy}  `);
  lines.push(`**研究目标**：${plan.goal}  `);
  lines.push(`**生成时间**：${new Date(generatedAt).toLocaleString('zh-CN')}  `);
  lines.push(`**统计**：规划 ${plan.experiments.length} / 完成 ${completedExperiments.length}` +
    (skipped.length ? ` / 跳过 ${skipped.length}` : '') +
    (failed.length ? ` / 失败 ${failed.length}` : ''));
  lines.push('');
  lines.push('---');
  lines.push('');

  // 1. 摘要
  lines.push('## 一、研究摘要');
  lines.push('');
  lines.push(summary);
  lines.push('');

  // 2. 策略说明
  lines.push('## 二、实验策略');
  lines.push('');
  lines.push(plan.rationale);
  lines.push('');

  // 3. 实验结果表
  if (completedExperiments.length > 0) {
    lines.push('## 三、实验结果');
    lines.push('');
    lines.push('| # | 材料 | 电压 (V) | 温度 (°C) | 峰值应力 (MPa) | 应变率 (/s) | 能量吸收 (J/m³) |');
    lines.push('|---|------|---------:|----------:|---------------:|------------:|-----------------:|');
    completedExperiments.forEach((e, i) => {
      const r = e.result!;
      lines.push(`| ${i + 1} | ${e.materialName} | ${e.voltage} | ${e.temperature} | ${r.peakStress.toFixed(1)} | ${r.strainRate.toFixed(0)} | ${r.energyAbsorption.toFixed(0)} |`);
    });
    lines.push('');
  }

  // 4. 关键发现
  if (findings.length > 0) {
    lines.push('## 四、关键发现');
    lines.push('');
    findings.forEach(f => lines.push(`- ${f}`));
    lines.push('');
  }

  // 5. 后续建议
  if (recommendations.length > 0) {
    lines.push('## 五、后续建议');
    lines.push('');
    recommendations.forEach(r => lines.push(`- ${r}`));
    lines.push('');
  }

  // 6. AI 中间分析
  if (analyses.length > 0) {
    lines.push('## 六、AI 中间分析记录');
    lines.push('');
    analyses.forEach((a, i) => {
      lines.push(`### 第 ${i + 1} 次分析（第 ${a.afterExperimentIndex + 1} 个实验后）`);
      lines.push('');
      lines.push(`- **决策**：${DECISION_NAMES[a.decision] ?? a.decision}`);
      lines.push(`- **观察**：${a.observation}`);
      lines.push(`- **依据**：${a.reasoning}`);
      if (a.addedExperiments && a.addedExperiments.length > 0) {
        lines.push(`- **追加实验**：${a.addedExperiments.length} 个`);
        a.addedExperiments.forEach(exp => {
          lines.push(`  - ${exp.materialName} @ ${exp.voltage}V — ${exp.rationale}`);
        });
      }
      lines.push('');
    });
  }

  // 7. 跳过/失败
  if (skipped.length + failed.length > 0) {
    lines.push('## 七、未完成实验');
    lines.push('');
    [...skipped, ...failed].forEach(e => {
      const tag = e.status === 'skipped' ? '跳过' : '失败';
      lines.push(`- **[${tag}]** ${e.materialName} @ ${e.voltage}V — ${e.failReason ?? '未知原因'}`);
    });
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('*由 Hopkinson-Web AI 自主实验系统自动生成*');
  return lines.join('\n');
}
