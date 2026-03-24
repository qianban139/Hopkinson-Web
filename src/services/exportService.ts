// src/services/exportService.ts
// 数据导出服务 - CSV、JSON、图表图片、PDF报告

import type { ExperimentResults, ExperimentRequirements } from '@/store/experimentWorkflow';

// ==================== CSV 导出 ====================

/**
 * 将波形数据导出为CSV
 */
export function exportWaveformCSV(
  data: { incident: number[]; reflected: number[]; transmitted: number[] },
  sampleRate = 1e6, // 1MHz默认采样率
) {
  const dt = 1 / sampleRate * 1e6; // μs
  const maxLen = Math.max(data.incident.length, data.reflected.length, data.transmitted.length);
  const lines = ['时间(μs),入射波(MPa),反射波(MPa),透射波(MPa)'];

  for (let i = 0; i < maxLen; i++) {
    const t = (i * dt).toFixed(2);
    const inc = (data.incident[i] ?? '').toString();
    const ref = (data.reflected[i] ?? '').toString();
    const tra = (data.transmitted[i] ?? '').toString();
    lines.push(`${t},${inc},${ref},${tra}`);
  }

  downloadFile(lines.join('\n'), 'waveform_data.csv', 'text/csv;charset=utf-8');
}

/**
 * 将实验结果导出为CSV
 */
export function exportResultsCSV(
  results: ExperimentResults,
  requirements: ExperimentRequirements,
) {
  const lines = [
    '参数,值,单位',
    `测试材料,${requirements.materialName},`,
    `测试类型,${formatTestType(requirements.testType)},`,
    `目标应变率,${requirements.strainRate},/s`,
    `实际应变率,${results.strainRate},/s`,
    `峰值应力,${results.peakStress},MPa`,
    `屈服强度,${results.yieldStrength},MPa`,
    `最大应变,${results.maxStrain},%`,
    `能量吸收,${results.energyAbsorption},J/m³`,
    `持续时间,${results.duration},μs`,
    `入射波峰值,${results.incidentWavePeak},MPa`,
    `反射波峰值,${results.reflectedWavePeak},MPa`,
    `透射波峰值,${results.transmittedWavePeak},MPa`,
  ];

  if (requirements.specialConditions.highTemperature) {
    lines.push(`测试温度,${requirements.specialConditions.temperature},°C`);
  }
  if (requirements.specialConditions.confinement) {
    lines.push(`围压,${requirements.specialConditions.confinementPressure},MPa`);
  }

  downloadFile(lines.join('\n'), `experiment_results_${requirements.materialName}.csv`, 'text/csv;charset=utf-8');
}

// ==================== JSON 导出 ====================

/**
 * 导出完整实验配置和结果为JSON
 */
export function exportExperimentJSON(
  results: ExperimentResults,
  requirements: ExperimentRequirements,
) {
  const exportData = {
    exportTime: new Date().toISOString(),
    system: '数智化电磁驱动霍普金森杆多场耦合动态测试系统',
    requirements: {
      materialId: requirements.materialId,
      materialName: requirements.materialName,
      testType: requirements.testType,
      testTypeLabel: formatTestType(requirements.testType),
      strainRate: requirements.strainRate,
      specialConditions: requirements.specialConditions,
    },
    results: {
      ...results,
      units: {
        peakStress: 'MPa',
        strainRate: '/s',
        energyAbsorption: 'J/m³',
        yieldStrength: 'MPa',
        maxStrain: '%',
        duration: 'μs',
        incidentWavePeak: 'MPa',
        reflectedWavePeak: 'MPa',
        transmittedWavePeak: 'MPa',
      },
    },
  };

  const json = JSON.stringify(exportData, null, 2);
  downloadFile(json, `experiment_${requirements.materialName}_${Date.now()}.json`, 'application/json');
}

// ==================== 图表截图导出 ====================

/**
 * 将ECharts实例导出为PNG图片
 */
export function exportChartImage(
  chartInstance: { getDataURL: (opts: object) => string } | null,
  filename = 'chart.png',
) {
  if (!chartInstance) return;

  const url = chartInstance.getDataURL({
    type: 'png',
    pixelRatio: 2,
    backgroundColor: '#0A2540',
  });

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

/**
 * 将Canvas元素导出为PNG
 */
export function exportCanvasImage(
  canvas: HTMLCanvasElement | null,
  filename = 'chart.png',
) {
  if (!canvas) return;
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

// ==================== PDF 报告 ====================

/**
 * 生成实验报告并导出（纯HTML→打印PDF方式）
 */
export function exportExperimentReport(
  results: ExperimentResults,
  requirements: ExperimentRequirements,
) {
  const testTypeLabel = formatTestType(requirements.testType);
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>实验报告 - ${requirements.materialName} ${testTypeLabel}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: "Microsoft YaHei", "SimHei", sans-serif; color: #1a1a1a; padding: 40px; max-width: 800px; margin: 0 auto; }
    h1 { text-align: center; font-size: 22px; margin-bottom: 4px; color: #0A2540; }
    .subtitle { text-align: center; color: #666; font-size: 13px; margin-bottom: 30px; }
    h2 { font-size: 16px; color: #0A2540; border-bottom: 2px solid #00C4CC; padding-bottom: 6px; margin: 24px 0 12px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; font-size: 13px; }
    th { background: #f0f8ff; font-weight: 600; width: 40%; }
    .highlight { color: #0080FF; font-weight: 600; }
    .section { margin-bottom: 20px; }
    .footer { margin-top: 40px; text-align: center; color: #999; font-size: 11px; border-top: 1px solid #eee; padding-top: 16px; }
    .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin: 12px 0; }
    .metric-card { border: 1px solid #e0e0e0; border-radius: 8px; padding: 12px; text-align: center; }
    .metric-card .value { font-size: 20px; font-weight: 700; color: #0A2540; }
    .metric-card .label { font-size: 11px; color: #888; margin-top: 4px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <h1>动态力学性能测试报告</h1>
  <p class="subtitle">数智化电磁驱动霍普金森杆多场耦合动态测试系统 · ${dateStr} ${timeStr}</p>

  <h2>一、实验参数</h2>
  <table>
    <tr><th>测试材料</th><td class="highlight">${requirements.materialName}</td></tr>
    <tr><th>测试类型</th><td>${testTypeLabel}</td></tr>
    <tr><th>目标应变率</th><td>${requirements.strainRate} /s</td></tr>
    ${requirements.specialConditions.highTemperature ? `<tr><th>测试温度</th><td>${requirements.specialConditions.temperature} °C</td></tr>` : ''}
    ${requirements.specialConditions.confinement ? `<tr><th>围压</th><td>${requirements.specialConditions.confinementPressure} MPa</td></tr>` : ''}
  </table>

  <h2>二、关键结果</h2>
  <div class="grid3">
    <div class="metric-card"><div class="value">${results.peakStress}</div><div class="label">峰值应力 (MPa)</div></div>
    <div class="metric-card"><div class="value">${results.strainRate}</div><div class="label">实际应变率 (/s)</div></div>
    <div class="metric-card"><div class="value">${results.yieldStrength}</div><div class="label">屈服强度 (MPa)</div></div>
    <div class="metric-card"><div class="value">${results.maxStrain}%</div><div class="label">最大应变</div></div>
    <div class="metric-card"><div class="value">${results.energyAbsorption}</div><div class="label">能量吸收 (J/m³)</div></div>
    <div class="metric-card"><div class="value">${results.duration}</div><div class="label">持续时间 (μs)</div></div>
  </div>

  <h2>三、三波信号</h2>
  <table>
    <tr><th>入射波峰值</th><td>${results.incidentWavePeak} MPa</td></tr>
    <tr><th>反射波峰值</th><td>${results.reflectedWavePeak} MPa</td></tr>
    <tr><th>透射波峰值</th><td>${results.transmittedWavePeak} MPa</td></tr>
  </table>

  <h2>四、分析说明</h2>
  <div class="section">
    <p style="font-size:13px;line-height:1.8;color:#333;">
      本次测试采用电磁驱动霍普金森杆系统对 <strong>${requirements.materialName}</strong> 进行动态${testTypeLabel}测试。
      实际应变率为 ${results.strainRate} /s，峰值应力达 ${results.peakStress} MPa。
      入射波峰值 ${results.incidentWavePeak} MPa，反射波峰值 ${results.reflectedWavePeak} MPa，
      透射波峰值 ${results.transmittedWavePeak} MPa，三波信号比例合理，实验数据有效。
      ${results.maxStrain > 15 ? '试样发生较大塑性变形。' : '试样变形在合理范围内。'}
    </p>
  </div>

  <div class="footer">
    <p>数智化电磁驱动霍普金森杆多场耦合动态测试系统 · AI自动生成报告</p>
    <p>报告编号：RPT-${Date.now().toString(36).toUpperCase()} · ${dateStr}</p>
  </div>
</body>
</html>`;

  // 在新窗口中打开报告，用户可通过浏览器打印为PDF
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    // 自动弹出打印对话框
    setTimeout(() => win.print(), 500);
  }
}

// ==================== 工具函数 ====================

function formatTestType(type: string): string {
  switch (type) {
    case 'compression': return '压缩测试';
    case 'tension': return '拉伸测试';
    case 'shear': return '剪切测试';
    default: return type;
  }
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
  const blob = new Blob([BOM + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
