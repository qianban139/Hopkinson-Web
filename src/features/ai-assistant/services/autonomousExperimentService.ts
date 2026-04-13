// src/features/ai-assistant/services/autonomousExperimentService.ts
// 自主实验核心控制器 — LLM语义规划 + 全自动执行 + 智能分析 + 报告生成
import { useAutonomousExperimentStore } from '@/store/useAutonomousExperimentStore';
import { useExperimentWorkflow } from '@/store/experimentWorkflow';
import { useExperimentDataBus } from '@/store/useExperimentDataBus';
import { useAppStore } from '@/store/useAppStore';
import { runSHPBSimulation } from '@/services/shpbPhysicsEngine';
// performSafetyCheck 仅用于全局安全检查（SystemMonitor 页面内部调用）
import { chatWithLLM, isLLMConfigured } from '@/services/llmService';
import type { PlannedExperiment, AutoExperimentReport, IntermediateAnalysis, ExperimentPlan } from '@/types';
import type { Material } from '@/types';
import {
  detectStrategy,
  generatePlanFromStrategy,
  analyzeStrainRateSweep,
  analyzeTemperatureSweep,
  analyzeMaterialComparison,
  analyzeParameterOptimization,
} from './experimentPlanStrategies';

// ═══════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════

const MAX_EXPERIMENTS = 20;
const INTER_EXPERIMENT_DELAY = 1500;
const ANALYSIS_INTERVAL = 3;
/** 实验结果图表展示时长 */
const RESULT_DISPLAY_DURATION = 4000;
/** 3D 动画超时上限（防止无限等待） */
const ANIMATION_TIMEOUT = 60000;

// ═══════════════════════════════════════════════
// 辅助工具
// ═══════════════════════════════════════════════

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function emit(event: string, detail?: unknown) {
  window.dispatchEvent(new CustomEvent(event, { detail }));
}

function notify(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
  useAppStore.getState().showAINotification(message, type);
}

/** 语音播报关键状态（纯语音模式下用户可听到进展） */
function speak(text: string) {
  try {
    const clean = text.replace(/[📦⚡🔌📐🌡️🔒✅❌⚠️🚀🔬📊📈🧠📋➕📝🎉🤖━]/g, '').trim();
    if (!clean) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = 'zh-CN';
    utterance.rate = 1.2;
    window.speechSynthesis.speak(utterance);
  } catch { /* 静默降级 */ }
}

/** 等待视频就绪（首次加载可能需要时间） */
function waitForVideoReady(): Promise<boolean> {
  return new Promise(resolve => {
    const timeout = setTimeout(() => {
      window.removeEventListener('ai-video-ready', handler);
      resolve(true);
    }, 5000);

    function handler() {
      clearTimeout(timeout);
      window.removeEventListener('ai-video-ready', handler);
      resolve(true);
    }
    window.addEventListener('ai-video-ready', handler);
  });
}

async function waitForResume(): Promise<boolean> {
  const store = useAutonomousExperimentStore.getState;
  while (store().isPausedByUser) {
    if (store().status === 'aborted') return false;
    await sleep(300);
  }
  return true;
}

function shouldAbort(): boolean {
  const { status } = useAutonomousExperimentStore.getState();
  return status === 'aborted' || status === 'error';
}

/** 等待 3D 动画播放完成（通过监听 VirtualLab 派发的事件） */
function waitForAnimationComplete(): Promise<boolean> {
  return new Promise(resolve => {
    const timeout = setTimeout(() => {
      window.removeEventListener('ai-experiment-animation-complete', handler);
      resolve(true);
    }, ANIMATION_TIMEOUT);

    function handler() {
      clearTimeout(timeout);
      window.removeEventListener('ai-experiment-animation-complete', handler);
      resolve(true);
    }
    window.addEventListener('ai-experiment-animation-complete', handler);
  });
}

// ═══════════════════════════════════════════════
// LLM 智能规划
// ═══════════════════════════════════════════════

function buildMaterialsCatalog(materials: Material[]): string {
  return materials.map(m =>
    `- ${m.name}(ID:${m.id}) | ${m.category}/${m.subcategoryLabel} | J-C参数: A=${m.johnsonCookParams.A}, B=${m.johnsonCookParams.B}, C=${m.johnsonCookParams.C}, n=${m.johnsonCookParams.n}, m=${m.johnsonCookParams.m}, Tm=${m.johnsonCookParams.Tm}°C`
  ).join('\n');
}

async function planWithLLM(
  goal: string,
  materials: Material[],
): Promise<ExperimentPlan | null> {
  if (!isLLMConfigured()) return null;

  const catalog = buildMaterialsCatalog(materials);

  const prompt = `你是SHPB动态力学实验AI规划师。用户给出一个研究目标，你需要生成一组SHPB实验计划。

【实验平台参数范围】
- 电压：1000~4000V（越高 → 应变率越高）
- 电流：由电压自动计算（15000 + voltage/4000 * 35000 A）
- 脉宽：由电压自动计算（800 - voltage/4000 * 400 μs）
- 温度：25~800°C（25为室温）
- 围压：0~300MPa（0为无围压）
- 储能上限：36kJ，电压上限：4000V

【可用材料库】
${catalog}

【用户研究目标】
${goal}

请输出JSON格式的实验计划（不要markdown代码块包裹，直接输出JSON）：
{
  "strategy": "strain_rate_sweep 或 temperature_sweep 或 material_comparison 或 parameter_optimization 或 custom",
  "rationale": "选择该策略的理由（中文，50字以内）",
  "experiments": [
    {
      "materialId": "材料ID（必须来自上面的材料库）",
      "materialName": "材料名称",
      "voltage": 数字(1000-4000),
      "temperature": 数字(25-800),
      "confinementPressure": 数字(0-300),
      "rationale": "这个实验的目的（中文，30字以内）"
    }
  ]
}

规则：
1. 实验数量3~8个，不要太多
2. 电压梯度建议：1500/2000/2500/3000/3500V
3. 温度梯度建议：25/200/400/600/800°C
4. 材料ID必须严格来自上方材料库
5. 直接回答用户问题，设计针对性实验`;

  try {
    const response = await Promise.race([
      chatWithLLM([{ role: 'user', content: prompt }]),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 15000)),
    ]);

    if (!response) return null;

    // 提取 JSON（兼容被 markdown 包裹的情况）
    let jsonStr = response.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    jsonStr = jsonMatch[0];

    // 清洗 LLM 返回的非标准 JSON（尾逗号、单行注释、中文标点等）
    jsonStr = jsonStr
      .replace(/\/\/[^\n]*/g, '')           // 移除单行注释
      .replace(/,\s*([\]}])/g, '$1')        // 移除尾逗号
      .replace(/，/g, ',')                  // 中文逗号→英文
      .replace(/：/g, ':')                  // 中文冒号→英文
      .replace(/"/g, '"').replace(/"/g, '"'); // 中文引号→英文

    const parsed = JSON.parse(jsonStr);
    if (!parsed.experiments || !Array.isArray(parsed.experiments) || parsed.experiments.length === 0) {
      return null;
    }

    // 校验并构建 PlannedExperiment[]
    const experiments: PlannedExperiment[] = [];
    for (let i = 0; i < Math.min(parsed.experiments.length, MAX_EXPERIMENTS); i++) {
      const e = parsed.experiments[i];
      const material = materials.find(m => m.id === e.materialId);
      if (!material) continue;

      const voltage = Math.max(1000, Math.min(4000, Number(e.voltage) || 2500));
      const current = Math.min(50000, Math.round(15000 + (voltage / 4000) * 35000));
      const pulseWidth = Math.round(800 - (voltage / 4000) * 400);

      experiments.push({
        id: `auto-exp-${Date.now()}-${i}`,
        index: i,
        materialId: material.id,
        materialName: material.name,
        voltage,
        current,
        pulseWidth,
        temperature: Math.max(25, Math.min(800, Number(e.temperature) || 25)),
        confinementPressure: Math.max(0, Math.min(300, Number(e.confinementPressure) || 0)),
        rationale: e.rationale || `实验 #${i + 1}`,
        status: 'pending',
        result: null,
        safetyStatus: 'unchecked',
        startedAt: null,
        completedAt: null,
      });
    }

    if (experiments.length === 0) return null;

    const strategy = ['strain_rate_sweep', 'temperature_sweep', 'material_comparison', 'parameter_optimization', 'custom'].includes(parsed.strategy)
      ? parsed.strategy
      : 'custom';

    return {
      id: `plan-${Date.now()}`,
      goal,
      strategy,
      rationale: parsed.rationale || 'AI 根据研究目标智能规划',
      experiments,
      createdAt: Date.now(),
    };
  } catch (err) {
    console.warn('[AutoExperiment] LLM 规划失败，降级为规则匹配', err);
    return null;
  }
}

// ═══════════════════════════════════════════════
// 计划生成（LLM 优先 → 规则降级）
// ═══════════════════════════════════════════════

export async function planExperiments(goal: string): Promise<boolean> {
  const store = useAutonomousExperimentStore.getState();
  const allMaterials = useAppStore.getState().materials;

  store.setStatus('planning');
  store.setSidebarOpen(true);
  store.updateProgress(0, 'AI 正在理解研究目标...');
  notify('AI 正在分析您的需求并规划实验方案...', 'info');

  // ① 优先：LLM 语义规划
  const llmPlan = await planWithLLM(goal, allMaterials);
  if (llmPlan) {
    store.setPlan(llmPlan);
    store.updateProgress(100, '实验计划已生成（AI 智能规划），等待审批');
    notify(`AI 已规划 ${llmPlan.experiments.length} 个实验，请审查后批准执行`, 'success');
    speak(`已规划${llmPlan.experiments.length}个实验，请审查后批准执行`);
    return true;
  }

  // ② 降级：规则策略匹配
  notify('正在使用规则引擎生成实验方案...', 'info');
  const match = detectStrategy(goal, allMaterials);
  if (match) {
    const plan = generatePlanFromStrategy(match, goal, allMaterials);
    if (plan) {
      if (plan.experiments.length > MAX_EXPERIMENTS) {
        plan.experiments = plan.experiments.slice(0, MAX_EXPERIMENTS);
      }
      store.setPlan(plan);
      store.updateProgress(100, '实验计划已生成，等待审批');
      notify(`已生成 ${plan.experiments.length} 个实验方案，请审批`, 'success');
      speak(`已生成${plan.experiments.length}个实验方案，请审批`);
      return true;
    }
  }

  // ③ 兜底：当前选中材料 → 默认应变率扫描
  const selectedMaterial = useAppStore.getState().selectedMaterial;
  if (selectedMaterial) {
    const { generateStrainRateSweep } = await import('./experimentPlanStrategies');
    const plan = generateStrainRateSweep(selectedMaterial, goal);
    store.setPlan(plan);
    store.updateProgress(100, '已使用默认策略生成计划，等待审批');
    notify(`已生成 ${plan.experiments.length} 个实验方案，请审批`, 'success');
    speak(`已生成${plan.experiments.length}个实验方案，请审批`);
    return true;
  }

  store.setError('无法解析研究目标，请尝试更具体的描述。例如：\n- "研究不同应变率下Q235钢的力学响应"\n- "对比铝合金和钛合金的冲击性能"\n- "找到5A06铝合金的最佳冲击参数"');
  notify('无法解析研究目标，请尝试更具体的描述', 'error');
  return false;
}

// ═══════════════════════════════════════════════
// 安全检查（整次自主实验仅执行一次）
// ═══════════════════════════════════════════════

async function runFullSafetyCheck(): Promise<boolean> {
  // 如果本次会话已通过安全检查，跳过（关闭标签页/重新登录才重置）
  if (useExperimentDataBus.getState().safetyChecklistCompleted) {
    notify('✅ 本次会话安全检查已通过，无需重复检查', 'success');
    speak('安全检查已通过，直接开始实验');
    await sleep(500);
    return true;
  }

  notify('正在跳转到系统监控进行安全检查...', 'info');
  speak('正在进行安全检查');

  const dataBus = useExperimentDataBus.getState();
  dataBus.resetSafetyChecklist();
  await sleep(300);

  useAppStore.getState().setNavigateTo('/monitor');

  // 轮询等待 SystemMonitor 页面挂载完成（最多5秒）
  const mountStart = Date.now();
  while (Date.now() - mountStart < 5000) {
    if (document.querySelector('[data-ai-target="monitor-safetyCheck"]')) break;
    await sleep(300);
  }
  await sleep(200);

  emit('ai-auto-safety-check');

  const timeout = 15000;
  const start = Date.now();
  while (!useExperimentDataBus.getState().safetyChecklistCompleted) {
    if (Date.now() - start > timeout) break;
    if (shouldAbort()) return false;
    await sleep(300);
  }

  const passed = useExperimentDataBus.getState().safetyChecklistCompleted;
  if (!passed) {
    notify('安全检查未通过，自主实验终止', 'error');
    return false;
  }

  notify('✅ 安全检查全部通过！正在返回虚拟实验室...', 'success');
  speak('安全检查通过，正在返回虚拟实验室');
  await sleep(1000);

  useAppStore.getState().setNavigateTo('/lab');
  await sleep(1000);
  return true;
}

// ═══════════════════════════════════════════════
// 参数调试动画（像人在操作）
// ═══════════════════════════════════════════════

async function animateParameterSetup(
  experiment: PlannedExperiment,
  material: Material,
): Promise<void> {
  const appStore = useAppStore.getState;

  // 展开左侧参数面板，让用户看到参数变化
  emit('ai-sidebar-open');
  await sleep(300);

  // 第1步：选择材料
  notify(`📦 选择材料：${material.name}`, 'info');
  speak(`选择材料${material.name}`);
  appStore().setSelectedMaterial(material as ReturnType<typeof appStore>['selectedMaterial']!);
  emit('ai-select-material', material.id);
  await sleep(800);

  // 第2步：调节电压
  notify(`⚡ 设置驱动电压：${experiment.voltage}V`, 'info');
  speak(`设置电压${experiment.voltage}伏`);
  appStore().setExperimentParams({
    ...appStore().experimentParams,
    voltage: experiment.voltage,
    materialId: experiment.materialId,
  });
  await sleep(600);

  // 第3步：调节电流
  notify(`🔌 设置电流：${(experiment.current / 1000).toFixed(1)}kA`, 'info');
  appStore().setExperimentParams({
    ...appStore().experimentParams,
    current: experiment.current,
  });
  await sleep(600);

  // 第4步：调节脉宽
  notify(`📐 设置脉冲宽度：${experiment.pulseWidth}μs`, 'info');
  appStore().setExperimentParams({
    ...appStore().experimentParams,
    pulseWidth: experiment.pulseWidth,
    waveform: '梯形',
  });
  await sleep(500);

  // 第5步：温度（如果非室温）
  if (experiment.temperature > 25) {
    notify(`🌡️ 设置温度：${experiment.temperature}°C`, 'info');
    await sleep(500);
  }

  // 第6步：围压（如果有）
  if (experiment.confinementPressure > 0) {
    notify(`🔒 设置围压：${experiment.confinementPressure}MPa`, 'info');
    await sleep(500);
  }

  notify('✅ 参数设置完毕，准备开始实验', 'success');
  // 收起左侧面板，为 3D 视频让出空间
  emit('ai-sidebar-close');
  await sleep(600);
}

// ═══════════════════════════════════════════════
// 单个实验执行（完整人类操作流程）
// ═══════════════════════════════════════════════

async function executeSingleExperiment(
  experiment: PlannedExperiment,
  index: number,
): Promise<boolean> {
  const autoStore = useAutonomousExperimentStore.getState;
  const appStore = useAppStore.getState;
  const workflow = useExperimentWorkflow.getState;

  const plan = autoStore().plan!;
  const total = plan.experiments.length;
  const percent = Math.round((index / total) * 100);
  autoStore().updateProgress(percent, `实验 ${index + 1}/${total}：${experiment.materialName}`);

  notify(`━━━ 实验 ${index + 1}/${total}：${experiment.materialName} @ ${experiment.voltage}V ━━━`, 'info');
  await sleep(500);

  // ① 重置状态，切换到 3D 实验视图
  workflow().resetWorkflow();
  emit('ai-set-view-mode', '3d-exp');
  // 等待视频加载就绪（首次可能需要加载 OSS 资源）
  await waitForVideoReady();
  await sleep(200);

  // ② 查找材料
  const material = appStore().materials.find(m => m.id === experiment.materialId);
  if (!material) {
    autoStore().failExperiment(index, `未找到材料: ${experiment.materialId}`);
    notify(`❌ 未找到材料 ${experiment.materialId}，跳过`, 'error');
    return false;
  }

  // ③ 参数调试动画（像人在操作面板一样逐个设置）
  await animateParameterSetup(experiment, material);
  if (shouldAbort()) return false;

  // 安全检查已在全局执行一次（runFullSafetyCheck），此处标记为通过
  autoStore().editExperiment(index, { safetyStatus: 'pass' });

  // ④ 开始实验 — 播放 3D 动画视频
  autoStore().startExperiment(index);
  notify(`🚀 实验 #${index + 1} 开始！3D 实验动画播放中...`, 'info');
  speak(`实验${index + 1}开始`);
  workflow().setPhase('execution');

  // 触发 3D 动画播放
  emit('ai-auto-play-experiment');

  // ⑥ 等待 3D 动画播放完成
  await waitForAnimationComplete();
  if (shouldAbort()) return false;

  // ⑦ 物理仿真计算
  notify(`🔬 实验 #${index + 1} 正在计算物理仿真结果...`, 'info');
  const simResult = runSHPBSimulation({
    material,
    voltage: experiment.voltage,
    pulseWidth: experiment.pulseWidth,
    temperature: experiment.temperature,
  });

  // ⑧ 写入工作流结果
  workflow().setExperimentResults({
    peakStress: simResult.peakStress,
    strainRate: simResult.strainRate,
    energyAbsorption: simResult.energyAbsorption,
    yieldStrength: simResult.yieldStrength,
    maxStrain: simResult.maxStrain,
    duration: simResult.duration,
    incidentWavePeak: simResult.incidentWavePeak,
    reflectedWavePeak: simResult.reflectedWavePeak,
    transmittedWavePeak: simResult.transmittedWavePeak,
  });
  workflow().setPhase('complete');

  // ⑨ 记录完成
  autoStore().completeExperiment(index, simResult);
  notify(
    `📊 实验 #${index + 1} 完成！峰值应力 ${simResult.peakStress.toFixed(0)}MPa，应变率 ${simResult.strainRate.toFixed(0)}/s`,
    'success',
  );
  speak(`实验${index + 1}完成，峰值应力${simResult.peakStress.toFixed(0)}兆帕`);

  // ⑩ 切换到 2D 视图，展示实验数据图表
  await sleep(500);
  emit('ai-set-view-mode', '2d');
  emit('ai-show-result-charts');
  notify(`📈 正在展示实验 #${index + 1} 的数据图表...`, 'info');
  await sleep(RESULT_DISPLAY_DURATION);

  // ⑪ 发布到数据总线（供材料分析页使用）
  useExperimentDataBus.getState().publishLabExperiment({
    materialId: material.id,
    materialName: material.name,
    params: {
      voltage: experiment.voltage, current: experiment.current,
      pulseWidth: experiment.pulseWidth, waveform: '梯形', materialId: material.id,
    },
    waveformData: {
      incident: Array.from({ length: 50 }, (_, i) =>
        -(experiment.voltage * 0.025) * Math.exp(-Math.pow((i * 0.1 - 2) / 0.8, 2))),
      reflected: Array.from({ length: 50 }, (_, i) =>
        (experiment.voltage * 0.015) * Math.exp(-Math.pow((i * 0.1 - 2.5) / 0.6, 2))),
      transmitted: Array.from({ length: 50 }, (_, i) =>
        -(experiment.voltage * 0.01) * Math.exp(-Math.pow((i * 0.1 - 3) / 0.7, 2))),
      timeAxis: Array.from({ length: 50 }, (_, i) => i * 20),
    },
    peakStress: simResult.peakStress,
    strainRate: simResult.strainRate,
    energyAbsorption: simResult.energyAbsorption,
    yieldStrength: simResult.yieldStrength,
    maxStrain: simResult.maxStrain,
    duration: simResult.duration,
    timestamp: Date.now(),
  });

  return true;
}

// ═══════════════════════════════════════════════
// 中间分析
// ═══════════════════════════════════════════════

function performIntermediateAnalysis(): IntermediateAnalysis | null {
  const { plan } = useAutonomousExperimentStore.getState();
  if (!plan) return null;

  const allMaterials = useAppStore.getState().materials;

  switch (plan.strategy) {
    case 'strain_rate_sweep':
      return analyzeStrainRateSweep(plan.experiments);
    case 'temperature_sweep':
      return analyzeTemperatureSweep(plan.experiments);
    case 'material_comparison':
      return analyzeMaterialComparison(plan.experiments);
    case 'parameter_optimization':
      return analyzeParameterOptimization(plan.experiments, allMaterials);
    default:
      return null;
  }
}

async function enhanceAnalysisWithLLM(
  analysis: IntermediateAnalysis,
  plan: NonNullable<ReturnType<typeof useAutonomousExperimentStore.getState>['plan']>,
): Promise<IntermediateAnalysis> {
  if (!isLLMConfigured()) return analysis;

  const completed = plan.experiments
    .filter(e => e.status === 'complete' && e.result)
    .map(e => `#${e.index + 1} ${e.materialName} ${e.voltage}V ${e.temperature}°C → 峰值应力 ${e.result!.peakStress.toFixed(0)}MPa, 应变率 ${e.result!.strainRate.toFixed(0)}/s, 能量 ${e.result!.energyAbsorption.toFixed(0)}J/m³`)
    .join('\n');

  const prompt =
    `你是 SHPB 动态力学实验分析助手。基于已完成的实验数据与规则分析，给出一段简洁专业的中文评论（2-3 句，50 字左右），解释数据趋势背后的物理机制。\n\n` +
    `【研究目标】${plan.goal}\n【策略】${plan.strategy}\n【已完成实验】\n${completed}\n\n` +
    `【规则观察】${analysis.observation}\n\n请直接输出评论文本，不要 markdown 或前缀。`;

  try {
    const enhanced = await Promise.race([
      chatWithLLM([{ role: 'user', content: prompt }]),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 8000)),
    ]);
    if (enhanced && enhanced.trim().length > 0) {
      return { ...analysis, observation: enhanced.trim() };
    }
  } catch (err) {
    console.warn('[AutoExperiment] LLM 分析润色失败，使用规则输出', err);
  }
  return analysis;
}

// ═══════════════════════════════════════════════
// 报告生成（LLM 深度分析）
// ═══════════════════════════════════════════════

const STRATEGY_CN: Record<string, string> = {
  strain_rate_sweep: '应变率扫描',
  temperature_sweep: '温度扫描',
  material_comparison: '材料对比',
  parameter_optimization: '参数优化',
  custom: 'AI智能规划',
};

function buildDataTable(completed: PlannedExperiment[]): string {
  if (completed.length === 0) return '(无已完成实验)';
  const header = '| # | 材料 | 电压V | 温度°C | 峰值应力MPa | 应变率/s | 能量J/m³ | 屈服强度MPa |';
  const sep =    '|---|------|------:|-------:|------------:|---------:|---------:|------------:|';
  const rows = completed.map((e, i) => {
    const r = e.result!;
    return `| ${i + 1} | ${e.materialName} | ${e.voltage} | ${e.temperature} | ${r.peakStress.toFixed(1)} | ${r.strainRate.toFixed(0)} | ${r.energyAbsorption.toFixed(0)} | ${r.yieldStrength.toFixed(1)} |`;
  });
  return [header, sep, ...rows].join('\n');
}

async function generateLLMReport(
  plan: NonNullable<ReturnType<typeof useAutonomousExperimentStore.getState>['plan']>,
  completed: PlannedExperiment[],
  analyses: IntermediateAnalysis[],
  ruleFindings: string[],
  ruleRecommendations: string[],
): Promise<{ summary: string; findings: string[]; recommendations: string[] }> {
  if (!isLLMConfigured() || completed.length === 0) {
    return { summary: ruleFindings.join('；'), findings: ruleFindings, recommendations: ruleRecommendations };
  }

  const dataTable = buildDataTable(completed);
  const analysisText = analyses.map((a, i) =>
    `第${i + 1}次中间分析(第${a.afterExperimentIndex + 1}实验后)：${a.observation} → 决策：${a.decision} → 依据：${a.reasoning}`
  ).join('\n');

  const prompt = `你是一位 SHPB 动态力学实验领域的资深研究员。现在请基于以下自主实验数据，撰写一份完整的实验分析报告，**直接回答用户的研究问题**。

【用户的研究问题】
${plan.goal}

【实验策略】${STRATEGY_CN[plan.strategy] || plan.strategy}
【策略理由】${plan.rationale}

【实验数据表】
${dataTable}

【AI中间分析记录】
${analysisText || '(无)'}

【规则分析发现】
${ruleFindings.map(f => '- ' + f).join('\n')}

请按以下格式输出（每个部分用 ===SECTION=== 分隔）：

===SUMMARY===
（200-400字的研究摘要：先直接回答用户问题，再总结实验方法、关键数据、核心结论。要用到具体数值。）

===FINDINGS===
（关键发现，每条一行，5-8条。包括：数据趋势分析、物理机制解释、J-C模型参数解读、应变率/温度效应分析、异常点解释等。每条要有具体数据支撑。）

===RECOMMENDATIONS===
（优化建议和后续实验方向，每条一行，3-5条。包括：参数优化建议、后续实验方向、工程应用建议等。）

注意：
1. 用专业但易懂的中文撰写
2. 每个发现和建议必须基于实验数据，引用具体数值
3. 结合 Johnson-Cook 本构模型 σ=(A+Bεⁿ)(1+Cln(ε̇/ε̇₀))(1-T*ᵐ) 进行分析
4. 如果数据显示明显趋势，给出物理解释（位错机制、热软化、绝热剪切等）
5. 直接输出内容，不要多余前缀`;

  try {
    const response = await Promise.race([
      chatWithLLM([{ role: 'user', content: prompt }]),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 30000)),
    ]);

    if (response) {
      const summaryMatch = response.match(/===SUMMARY===\s*([\s\S]*?)(?====FINDINGS===|$)/);
      const findingsMatch = response.match(/===FINDINGS===\s*([\s\S]*?)(?====RECOMMENDATIONS===|$)/);
      const recsMatch = response.match(/===RECOMMENDATIONS===\s*([\s\S]*?)$/);

      const summary = summaryMatch?.[1]?.trim() || ruleFindings.join('；');
      const findings = findingsMatch?.[1]?.trim().split('\n').map(l => l.replace(/^[-•\d.]+\s*/, '').trim()).filter(l => l.length > 0) || ruleFindings;
      const recommendations = recsMatch?.[1]?.trim().split('\n').map(l => l.replace(/^[-•\d.]+\s*/, '').trim()).filter(l => l.length > 0) || ruleRecommendations;

      return { summary, findings, recommendations };
    }
  } catch (err) {
    console.warn('[AutoExperiment] LLM 报告生成失败，降级为规则报告', err);
  }

  return { summary: ruleFindings.join('；'), findings: ruleFindings, recommendations: ruleRecommendations };
}

async function generateReport(): Promise<AutoExperimentReport> {
  const store = useAutonomousExperimentStore.getState();
  const plan = store.plan!;
  const completed = plan.experiments.filter(e => e.status === 'complete');
  const skipped = plan.experiments.filter(e => e.status === 'skipped');
  const failed = plan.experiments.filter(e => e.status === 'failed');

  // 规则发现
  const ruleFindings: string[] = [];
  if (completed.length > 0) {
    const maxStress = Math.max(...completed.map(e => e.result!.peakStress));
    const minStress = Math.min(...completed.map(e => e.result!.peakStress));
    const bestExp = completed.find(e => e.result!.peakStress === maxStress)!;
    ruleFindings.push(`最大峰值应力 ${maxStress.toFixed(1)} MPa（${bestExp.materialName}, ${bestExp.voltage}V）`);
    ruleFindings.push(`应力范围 ${minStress.toFixed(1)} - ${maxStress.toFixed(1)} MPa`);

    const maxEnergy = Math.max(...completed.map(e => e.result!.energyAbsorption));
    const bestEnergyExp = completed.find(e => e.result!.energyAbsorption === maxEnergy)!;
    ruleFindings.push(`最大能量吸收 ${maxEnergy.toFixed(0)} J/m³（${bestEnergyExp.materialName}, ${bestEnergyExp.voltage}V）`);

    const avgStrainRate = completed.reduce((sum, e) => sum + e.result!.strainRate, 0) / completed.length;
    ruleFindings.push(`平均应变率 ${avgStrainRate.toFixed(0)} /s`);
  }
  if (skipped.length > 0) ruleFindings.push(`${skipped.length} 个实验因安全限制跳过`);

  // 规则建议
  const ruleRecommendations: string[] = [];
  if (plan.strategy === 'strain_rate_sweep' && completed.length >= 3) {
    ruleRecommendations.push('可进一步在高应变率区域细化测试点，观察是否存在应变率饱和效应');
    ruleRecommendations.push('建议进行温度扫描实验，研究温度-应变率的耦合效应');
  } else if (plan.strategy === 'temperature_sweep') {
    ruleRecommendations.push('可增加更多温度点进行细化测试，特别是热软化转折区域');
    ruleRecommendations.push('建议在不同应变率下重复温度扫描，建立完整的温度-应变率耦合关系');
  } else if (plan.strategy === 'material_comparison') {
    ruleRecommendations.push('可针对最优材料进行参数优化实验');
    ruleRecommendations.push('建议在不同温度下重复对比测试，评估材料的温度稳定性');
  } else if (plan.strategy === 'parameter_optimization') {
    ruleRecommendations.push('最优参数点附近可进行重复实验验证稳定性');
    ruleRecommendations.push('建议在该最优参数下进行多场耦合分析');
  } else {
    ruleRecommendations.push('可基于本次数据设计更有针对性的后续实验');
    ruleRecommendations.push('建议结合工程应用场景进一步优化测试方案');
  }

  // LLM 深度分析
  notify('🤖 AI 正在分析全部实验数据并生成报告...', 'info');
  const llmResult = await generateLLMReport(plan, completed, store.analyses, ruleFindings, ruleRecommendations);

  const fullSummary = `本次自主实验采用「${STRATEGY_CN[plan.strategy] || 'AI智能规划'}」策略，共规划 ${plan.experiments.length} 个实验，` +
    `完成 ${completed.length} 个` +
    (skipped.length > 0 ? `，跳过 ${skipped.length} 个` : '') +
    (failed.length > 0 ? `，失败 ${failed.length} 个` : '') +
    `。\n\n${llmResult.summary}`;

  return {
    plan,
    completedExperiments: completed,
    analyses: store.analyses,
    summary: fullSummary,
    findings: llmResult.findings,
    recommendations: llmResult.recommendations,
    generatedAt: Date.now(),
  };
}

// ═══════════════════════════════════════════════
// 主执行循环
// ═══════════════════════════════════════════════

export async function startAutonomousExecution(): Promise<void> {
  const store = useAutonomousExperimentStore.getState;

  if (!store().plan) {
    store().setError('没有可执行的实验计划');
    return;
  }

  store().setStatus('running');
  notify('🔬 自主实验开始，首先进行安全检查...', 'info');

  // ━━ 第一步：全局安全检查（跳转系统监控，仅此一次）━━
  const safetyOk = await runFullSafetyCheck();
  if (!safetyOk) {
    store().setError('安全检查未通过，无法开始自主实验');
    return;
  }
  if (shouldAbort()) return;

  notify('🚀 安全检查通过，开始批量执行实验！', 'success');
  speak('安全检查通过，开始批量执行实验');
  await sleep(500);

  // ━━ 第二步：逐个执行实验（无需再做安全检查页面跳转）━━
  const plan = store().plan!;
  let experimentIndex = 0;

  while (experimentIndex < plan.experiments.length) {
    const currentPlan = store().plan;
    if (!currentPlan || shouldAbort()) break;

    const experiment = currentPlan.experiments[experimentIndex];

    if (experiment.status !== 'pending') {
      experimentIndex++;
      continue;
    }

    // 暂停检测
    if (store().isPausedByUser) {
      const resumed = await waitForResume();
      if (!resumed) break;
    }

    if (experimentIndex >= MAX_EXPERIMENTS) {
      store().updateProgress(100, `已达到最大实验数量限制(${MAX_EXPERIMENTS})`);
      break;
    }

    // 合并用户编辑
    const userEdits = store().userEdits[experiment.id];
    const finalExperiment = userEdits ? { ...experiment, ...userEdits } : experiment;

    // 执行单个实验（参数动画 → 3D视频 → 结果展示）
    await executeSingleExperiment(finalExperiment, experimentIndex);

    if (shouldAbort()) break;

    // 中间分析（每完成 ANALYSIS_INTERVAL 个实验执行一次）
    const completedCount = store().plan!.experiments.filter(e => e.status === 'complete').length;
    if (completedCount > 0 && completedCount % ANALYSIS_INTERVAL === 0) {
      store().setStatus('analyzing');
      store().updateProgress(
        Math.round((experimentIndex / currentPlan.experiments.length) * 100),
        'AI 正在分析中间结果...',
      );
      notify('🧠 AI 正在分析已完成的实验数据...', 'info');

      await sleep(1000);

      const rawAnalysis = performIntermediateAnalysis();
      const analysis = rawAnalysis
        ? await enhanceAnalysisWithLLM(rawAnalysis, store().plan!)
        : null;
      if (analysis) {
        store().addAnalysis(analysis);
        notify(`📋 中间分析完成：${analysis.decision === 'add_experiments' ? '追加实验' : '继续执行'}`, 'success');

        if (analysis.decision === 'add_experiments' && analysis.addedExperiments) {
          for (const newExp of analysis.addedExperiments) {
            if (store().plan!.experiments.length < MAX_EXPERIMENTS) {
              store().insertExperiment(store().plan!.experiments.length - 1, newExp);
            }
          }
          notify(`➕ 已追加 ${analysis.addedExperiments.length} 个细化实验`, 'info');
        }

        if (analysis.decision === 'abort') {
          store().updateProgress(100, '中间分析建议终止实验');
          notify('中间分析建议终止实验', 'warning');
          break;
        }
      }

      store().setStatus('running');
    }

    // 实验间歇（下一个实验开始前的缓冲）
    await sleep(INTER_EXPERIMENT_DELAY);
    experimentIndex++;
  }

  // ━━ 第三步：生成最终报告 ━━
  if (store().status !== 'aborted' && store().status !== 'error') {
    store().setStatus('generating_report');
    store().updateProgress(95, '正在生成实验报告（AI 深度分析中）...');
    notify('📝 正在调用 AI 生成详细实验报告...', 'info');

    const report = await generateReport();
    store().setReport(report);
    store().updateProgress(100, '自主实验全部完成');
    notify(`🎉 自主实验完成！共完成 ${report.completedExperiments.length} 个实验，报告已生成`, 'success');
    speak(`自主实验全部完成，共完成${report.completedExperiments.length}个实验，报告已生成`);
  } else if (store().status === 'aborted') {
    const report = await generateReport();
    store().setReport(report);
    notify('实验已终止，已生成部分报告', 'warning');
  }
}

// ═══════════════════════════════════════════════
// 导出 API
// ═══════════════════════════════════════════════

export const autonomousExperimentService = {
  planExperiments,
  startAutonomousExecution,
};
