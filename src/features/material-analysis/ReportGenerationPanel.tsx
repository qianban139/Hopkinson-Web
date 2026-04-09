/**
 * 报告生成面板（MaterialAnalysis Tab 5 增强）
 *
 * 功能：
 *   - 4 种报告类型可选（学习总结 / 实验记录 / 研究报告 / 完整论文）
 *   - 实时预览（左侧）
 *   - 一键多格式导出（Markdown / HTML / LaTeX / JSON）
 *   - 浏览器打印（用于 PDF 输出）
 */

import { useMemo, useState } from 'react';
import {
  ClipboardList, Eye, Download, FileText, FileCode2, Globe, Braces, Printer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import GlowCard from '@/shared/components/GlowCard';
import {
  generateReport,
  exportReport,
  downloadReport,
  exportToHtml,
  type ReportType,
  type ExportFormat,
} from '@/services/reportGenerator';
import type { Material } from '@/types';

const REPORT_TYPES: Array<{ id: ReportType; icon: string; type: string; pages: string; desc: string }> = [
  { id: 'summary', icon: '📝', type: '学习总结', pages: '1-2 页', desc: '适合学生作业' },
  { id: 'record', icon: '📋', type: '实验记录', pages: '3-5 页', desc: '日常实验记录' },
  { id: 'research', icon: '📊', type: '研究报告', pages: '8-15 页', desc: '论文准备级' },
  { id: 'thesis', icon: '📄', type: '完整论文', pages: '20+ 页', desc: '学术发表级' },
];

export default function ReportGenerationPanel({
  material, jcParams, fitR2, strainRate, temperature, aiResult,
}: {
  material: Material;
  jcParams: { A: number; B: number; n: number; C: number; m: number; Tm: number };
  fitR2: number;
  strainRate: number;
  temperature: number;
  aiResult?: { sigma: number; epsilon: number; r2: number } | null;
}) {
  const [selectedType, setSelectedType] = useState<ReportType>('record');

  // 实时生成报告
  const report = useMemo(
    () => generateReport({
      type: selectedType,
      material,
      jcParams,
      fitR2,
      strainRate,
      temperature,
      aiResult,
    }),
    [selectedType, material, jcParams, fitR2, strainRate, temperature, aiResult],
  );

  const handleDownload = (format: ExportFormat) => {
    const content = exportReport(report, format);
    const ext = { markdown: 'md', latex: 'tex', html: 'html', json: 'json' }[format];
    const mime = {
      markdown: 'text/markdown',
      latex: 'text/x-tex',
      html: 'text/html',
      json: 'application/json',
    }[format];
    downloadReport(content, `${material.name}_${selectedType}.${ext}`, mime);
  };

  const handlePrint = () => {
    const html = exportToHtml(report);
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  return (
    <div className="p-6 space-y-6">
      <GlowCard glowColor="#F472B6" hoverable={false} className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList className="w-5 h-5 text-[#F472B6]" />
          <h2 className="text-base font-bold">实验报告生成</h2>
          <span className="text-[10px] text-white/40 ml-2">实时预览 · 一键多格式导出</span>
        </div>

        {/* 报告类型选择 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {REPORT_TYPES.map((rpt) => (
            <button
              key={rpt.id}
              onClick={() => setSelectedType(rpt.id)}
              className={`text-left bg-[#051020] rounded-lg p-3 border transition-all ${
                selectedType === rpt.id
                  ? 'border-[#F472B6]/60 ring-1 ring-[#F472B6]/40 bg-[#F472B6]/5'
                  : 'border-white/5 hover:border-[#F472B6]/20'
              }`}
            >
              <div className="text-2xl mb-2">{rpt.icon}</div>
              <div className="text-sm font-medium text-white">{rpt.type}</div>
              <div className="text-[10px] text-white/30 mt-0.5">{rpt.pages}</div>
              <div className="text-[10px] text-white/40 mt-1">{rpt.desc}</div>
            </button>
          ))}
        </div>

        {/* 元信息 */}
        <div className="bg-[#051020] rounded-lg p-4 border border-white/10 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div>
            <div className="text-white/40 text-[10px]">报告标题</div>
            <div className="text-white truncate" title={report.meta.title}>{report.meta.title}</div>
          </div>
          <div>
            <div className="text-white/40 text-[10px]">作者</div>
            <div className="text-white">{report.meta.author}</div>
          </div>
          <div>
            <div className="text-white/40 text-[10px]">日期 · 章节数</div>
            <div className="text-white">{report.meta.date} · {report.sections.length} 章</div>
          </div>
        </div>

        {/* 预览区 */}
        <div className="bg-[#051020] rounded-lg border border-white/10 mb-4 max-h-[480px] overflow-y-auto scrollbar-thin">
          <div className="sticky top-0 bg-[#0A2540]/95 backdrop-blur-sm border-b border-white/10 px-4 py-2 flex items-center gap-2">
            <Eye className="w-3.5 h-3.5 text-[#F472B6]" />
            <span className="text-[11px] text-white/60">实时预览</span>
          </div>
          <div className="p-4 space-y-3">
            <h1 className="text-base font-bold text-white border-b border-white/10 pb-2">{report.meta.title}</h1>
            {report.sections.map((section, idx) => (
              <div key={idx}>
                <h3 className="text-sm font-semibold text-[#F472B6] mt-3 mb-1">{section.title}</h3>
                <pre className="text-[11px] text-white/70 whitespace-pre-wrap font-sans leading-relaxed">{section.body}</pre>
              </div>
            ))}
          </div>
        </div>

        {/* 导出按钮 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Download className="w-3.5 h-3.5 text-[#F472B6]" />
            <span className="text-[11px] text-white/60">导出格式</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Button variant="outline" onClick={() => handleDownload('markdown')}
              className="border-white/15 text-white/70 text-xs h-9 gap-1.5 hover:border-[#F472B6]/40 hover:text-[#F472B6]">
              <FileText className="w-3.5 h-3.5" /> Markdown
            </Button>
            <Button variant="outline" onClick={() => handleDownload('html')}
              className="border-white/15 text-white/70 text-xs h-9 gap-1.5 hover:border-[#F472B6]/40 hover:text-[#F472B6]">
              <Globe className="w-3.5 h-3.5" /> HTML
            </Button>
            <Button variant="outline" onClick={() => handleDownload('latex')}
              className="border-white/15 text-white/70 text-xs h-9 gap-1.5 hover:border-[#F472B6]/40 hover:text-[#F472B6]">
              <FileCode2 className="w-3.5 h-3.5" /> LaTeX
            </Button>
            <Button variant="outline" onClick={() => handleDownload('json')}
              className="border-white/15 text-white/70 text-xs h-9 gap-1.5 hover:border-[#F472B6]/40 hover:text-[#F472B6]">
              <Braces className="w-3.5 h-3.5" /> JSON
            </Button>
            <Button onClick={handlePrint}
              className="bg-gradient-to-r from-[#F472B6] to-[#EC4899] text-white text-xs h-9 gap-1.5">
              <Printer className="w-3.5 h-3.5" /> 打印 / PDF
            </Button>
          </div>
          <p className="text-[10px] text-white/30 mt-2">
            提示：点击「打印 / PDF」会在新窗口打开 HTML 报告并触发系统打印对话框，可保存为 PDF
          </p>
        </div>
      </GlowCard>
    </div>
  );
}
