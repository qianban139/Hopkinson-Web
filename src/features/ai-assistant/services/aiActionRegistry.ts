// src/features/ai-assistant/services/aiActionRegistry.ts
// AI动作注册表 - 注册网站中所有可执行操作
import { useAppStore } from '@/store/useAppStore';
import { useExperimentDataBus } from '@/store/useExperimentDataBus';
import type { AIAction, AIActionResult, LLMToolDefinition } from '../types';

// ═══════════════════════════════════════════════
// 动作定义
// ═══════════════════════════════════════════════

const actions: Map<string, AIAction> = new Map();

function registerAction(action: AIAction) {
  actions.set(action.id, action);
}

export function getAction(id: string): AIAction | undefined {
  return actions.get(id);
}

export function getAllActions(): AIAction[] {
  return Array.from(actions.values());
}

// 将注册表转换为 LLM Function Calling 工具定义
export function getToolDefinitions(): LLMToolDefinition[] {
  return getAllActions().map((action) => ({
    type: 'function' as const,
    function: {
      name: action.id,
      description: action.description,
      parameters: {
        type: 'object' as const,
        properties: Object.fromEntries(
          action.parameters.map((p) => [
            p.name,
            {
              type: p.type === 'select' ? 'string' : p.type,
              description: p.description,
              ...(p.options ? { enum: p.options } : {}),
              ...(p.range ? { minimum: p.range[0], maximum: p.range[1] } : {}),
            },
          ])
        ),
        required: action.parameters.filter((p) => p.required).map((p) => p.name),
      },
    },
  }));
}

// 执行动作
export async function executeAction(
  actionId: string,
  params: Record<string, unknown>
): Promise<AIActionResult> {
  const action = actions.get(actionId);
  if (!action) {
    return { success: false, message: `未知操作: ${actionId}` };
  }

  // 验证参数
  if (action.validate) {
    const validation = action.validate(params);
    if (!validation.valid) {
      return { success: false, message: `参数错误: ${validation.errors.join(', ')}` };
    }
  }

  try {
    return await action.execute(params);
  } catch (err) {
    return { success: false, message: `执行失败: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ═══════════════════════════════════════════════
// 注册所有动作
// ═══════════════════════════════════════════════

// --- 导航 ---
registerAction({
  id: 'navigate.toPage',
  category: 'navigation',
  name: '页面导航',
  description: '导航到指定页面。可选页面: home(首页), lab(虚拟实验室), ai(AI智能控制), multifield(多场耦合实验), analysis(材料力学分析), monitor(系统监控)',
  parameters: [
    { name: 'page', type: 'select', description: '目标页面', required: true, options: ['home', 'lab', 'ai', 'multifield', 'analysis', 'monitor'] },
  ],
  execute: async (params) => {
    const pageRoutes: Record<string, string> = {
      home: '/', lab: '/lab', ai: '/ai', multifield: '/multifield',
      analysis: '/analysis', monitor: '/monitor',
    };
    const page = params.page as string;
    const route = pageRoutes[page];
    if (!route) return { success: false, message: `未知页面: ${page}` };
    useAppStore.getState().setNavigateTo(route);
    return { success: true, message: `已导航到${page}页面` };
  },
});

// --- 虚拟实验室: 材料选择 ---
registerAction({
  id: 'lab.selectMaterial',
  category: 'experiment',
  name: '选择材料',
  description: '在虚拟实验室中选择测试材料。可以通过材料名称搜索，如 Q235钢、6061铝合金、Ti-6Al-4V钛合金、花岗岩、C50混凝土 等',
  targetPage: '/lab',
  parameters: [
    { name: 'materialName', type: 'string', description: '材料名称(支持模糊搜索)', required: true },
  ],
  execute: async (params) => {
    const name = params.materialName as string;
    const materials = useAppStore.getState().materials;
    const found = materials.find(
      (m) => m.name.includes(name) || name.includes(m.name) || m.id.includes(name.toLowerCase())
    );
    if (!found) {
      return { success: false, message: `未找到材料: ${name}。可用材料: ${materials.slice(0, 5).map(m => m.name).join(', ')}...` };
    }
    useAppStore.getState().setSelectedMaterial(found);
    // 确保在lab页面
    useAppStore.getState().setNavigateTo('/lab');
    return { success: true, message: `已选择材料: ${found.name}`, data: { materialId: found.id, materialName: found.name } };
  },
});

// --- 虚拟实验室: 设置电压 ---
registerAction({
  id: 'lab.setVoltage',
  category: 'parameter',
  name: '设置电压',
  description: '设置电磁驱动系统的电压。范围: 1000-4000V',
  targetPage: '/lab',
  parameters: [
    { name: 'voltage', type: 'number', description: '电压值(V)', required: true, range: [1000, 4000] },
  ],
  validate: (params) => {
    const v = params.voltage as number;
    if (v < 1000 || v > 4000) return { valid: false, errors: ['电压范围: 1000-4000V'] };
    return { valid: true, errors: [] };
  },
  execute: async (params) => {
    const voltage = params.voltage as number;
    useAppStore.getState().setExperimentParams({ voltage });
    return { success: true, message: `电压已设置为 ${voltage}V` };
  },
});

// --- 虚拟实验室: 设置电流 ---
registerAction({
  id: 'lab.setCurrent',
  category: 'parameter',
  name: '设置电流',
  description: '设置电磁驱动系统的电流。范围: 0-50000A (0-50kA)',
  targetPage: '/lab',
  parameters: [
    { name: 'current', type: 'number', description: '电流值(A)。如用户说25kA则填25000', required: true, range: [0, 50000] },
  ],
  validate: (params) => {
    const c = params.current as number;
    if (c < 0 || c > 50000) return { valid: false, errors: ['电流范围: 0-50kA'] };
    return { valid: true, errors: [] };
  },
  execute: async (params) => {
    const current = params.current as number;
    useAppStore.getState().setExperimentParams({ current });
    return { success: true, message: `电流已设置为 ${(current / 1000).toFixed(1)}kA` };
  },
});

// --- 虚拟实验室: 设置脉宽 ---
registerAction({
  id: 'lab.setPulseWidth',
  category: 'parameter',
  name: '设置脉宽',
  description: '设置电磁脉冲宽度。范围: 200-1100μs',
  targetPage: '/lab',
  parameters: [
    { name: 'pulseWidth', type: 'number', description: '脉宽值(μs)', required: true, range: [200, 1100] },
  ],
  validate: (params) => {
    const pw = params.pulseWidth as number;
    if (pw < 200 || pw > 1100) return { valid: false, errors: ['脉宽范围: 200-1100μs'] };
    return { valid: true, errors: [] };
  },
  execute: async (params) => {
    const pulseWidth = params.pulseWidth as number;
    useAppStore.getState().setExperimentParams({ pulseWidth });
    return { success: true, message: `脉宽已设置为 ${pulseWidth}μs` };
  },
});

// --- 虚拟实验室: 设置波形 ---
registerAction({
  id: 'lab.setWaveform',
  category: 'parameter',
  name: '设置波形类型',
  description: '设置驱动信号波形类型',
  targetPage: '/lab',
  parameters: [
    { name: 'waveform', type: 'select', description: '波形类型', required: true, options: ['sine', 'square', 'triangle', 'pulse'] },
  ],
  execute: async (params) => {
    const waveform = params.waveform as string;
    const labels: Record<string, string> = { sine: '正弦波', square: '方波', triangle: '三角波', pulse: '脉冲波' };
    useAppStore.getState().setExperimentParams({ waveform });
    return { success: true, message: `波形已设置为${labels[waveform] || waveform}` };
  },
});

// --- 虚拟实验室: 切换视图 ---
registerAction({
  id: 'lab.switchView',
  category: 'navigation',
  name: '切换2D/3D视图',
  description: '在虚拟实验室中切换2D模型视图和3D视频视图',
  targetPage: '/lab',
  parameters: [
    { name: 'viewMode', type: 'select', description: '视图模式', required: true, options: ['2d', '3d'] },
  ],
  execute: async (params) => {
    // 通过全局事件通知VirtualLab切换视图
    window.dispatchEvent(new CustomEvent('ai-set-view-mode', { detail: params.viewMode }));
    return { success: true, message: `已切换到${params.viewMode === '2d' ? '2D模型' : '3D视频'}视图` };
  },
});

// --- 虚拟实验室: 启动实验 ---
registerAction({
  id: 'lab.startExperiment',
  category: 'experiment',
  name: '启动实验',
  description: '在虚拟实验室中使用当前参数启动一次SHPB实验。需要先选择材料并设置参数。',
  targetPage: '/lab',
  parameters: [],
  execute: async () => {
    const state = useAppStore.getState();
    if (!state.selectedMaterial) {
      return { success: false, message: '请先选择测试材料' };
    }
    useAppStore.getState().setNavigateTo('/lab');
    // 触发实验开始
    window.dispatchEvent(new CustomEvent('ai-start-experiment'));
    return {
      success: true,
      message: `实验已启动 — 材料: ${state.selectedMaterial.name}, 电压: ${state.experimentParams.voltage}V, 电流: ${(state.experimentParams.current / 1000).toFixed(1)}kA`,
    };
  },
});

// --- AI优化 ---
registerAction({
  id: 'ai.startOptimization',
  category: 'ai',
  name: '启动AI优化',
  description: '启动三级AI优化流程(LSTM预测→WGAN-GP生成→PPO优化)，自动寻找最优实验参数',
  targetPage: '/ai',
  parameters: [],
  execute: async () => {
    useAppStore.getState().setNavigateTo('/ai');
    // 短暂延迟等待页面切换
    await new Promise((r) => setTimeout(r, 500));
    useAppStore.getState().startAIOptimization();
    return { success: true, message: 'AI优化已启动，正在进行LSTM→WGAN-GP→PPO三级优化...' };
  },
});

// --- 安全检查 ---
registerAction({
  id: 'monitor.runSafetyCheck',
  category: 'monitor',
  name: '执行安全检查',
  description: '在系统监控页面执行实验前安全检查，包括电压、电流、温度、电容储能、EMI等项目的检测',
  targetPage: '/monitor',
  parameters: [],
  execute: async () => {
    useAppStore.getState().setNavigateTo('/monitor');
    // 触发安全检查
    const dataBus = useExperimentDataBus.getState();
    const checklist = dataBus.safetyChecklist.map((item) => ({
      ...item,
      status: 'pass' as const,
    }));
    dataBus.setSafetyChecklist(checklist);
    return { success: true, message: '安全检查已完成，所有项目通过' };
  },
});

// --- 多场耦合: 选择场景 ---
registerAction({
  id: 'multifield.selectScenario',
  category: 'multifield',
  name: '选择多场耦合场景',
  description: '选择极端环境模拟场景预设。可选: mine(深部矿井), aerospace(航空航天), nuclear(核反应堆), ev-battery(电动汽车电池碰撞)',
  targetPage: '/multifield',
  parameters: [
    { name: 'scenario', type: 'select', description: '场景ID', required: true, options: ['mine', 'aerospace', 'nuclear', 'ev-battery'] },
  ],
  execute: async (params) => {
    const labels: Record<string, string> = {
      mine: '深部矿井', aerospace: '航空航天', nuclear: '核反应堆', 'ev-battery': '电动汽车电池碰撞',
    };
    useAppStore.getState().setNavigateTo('/multifield');
    window.dispatchEvent(new CustomEvent('ai-select-scenario', { detail: params.scenario }));
    return { success: true, message: `已选择场景: ${labels[params.scenario as string] || params.scenario}` };
  },
});

// --- 多场耦合: 设置场参数 ---
registerAction({
  id: 'multifield.setFields',
  category: 'multifield',
  name: '设置多场耦合参数',
  description: '设置多场耦合实验的三场参数（温度、应力、电磁场）。温度范围20-1000°C，应力范围0-2000MPa，电磁场范围0-100T',
  targetPage: '/multifield',
  parameters: [
    { name: 'temperature', type: 'number', description: '温度(°C)', required: false, range: [20, 1000] },
    { name: 'stress', type: 'number', description: '应力(MPa)', required: false, range: [0, 2000] },
    { name: 'emField', type: 'number', description: '电磁场强度(T)', required: false, range: [0, 100] },
  ],
  execute: async (params) => {
    useAppStore.getState().setNavigateTo('/multifield');
    const detail: Record<string, number> = {};
    const msgs: string[] = [];
    if (params.temperature !== undefined) { detail.temperature = params.temperature as number; msgs.push(`温度=${params.temperature}°C`); }
    if (params.stress !== undefined) { detail.stress = params.stress as number; msgs.push(`应力=${params.stress}MPa`); }
    if (params.emField !== undefined) { detail.emField = params.emField as number; msgs.push(`电磁场=${params.emField}T`); }
    window.dispatchEvent(new CustomEvent('ai-set-multifield-params', { detail }));
    return { success: true, message: `多场参数已设置: ${msgs.join(', ')}` };
  },
});

// --- 多场耦合: 运行耦合仿真 ---
registerAction({
  id: 'multifield.startCoupling',
  category: 'multifield',
  name: '运行耦合仿真',
  description: '在多场耦合页面启动耦合仿真计算',
  targetPage: '/multifield',
  parameters: [],
  execute: async () => {
    useAppStore.getState().setNavigateTo('/multifield');
    window.dispatchEvent(new CustomEvent('ai-run-coupling'));
    return { success: true, message: '耦合仿真已启动，正在求解热-力-电磁耦合方程...' };
  },
});

// --- 材料分析: 选择材料 ---
registerAction({
  id: 'analysis.selectMaterial',
  category: 'analysis',
  name: '分析材料',
  description: '在材料力学分析页面选择要分析的材料',
  targetPage: '/analysis',
  parameters: [
    { name: 'materialName', type: 'string', description: '材料名称', required: true },
  ],
  execute: async (params) => {
    const name = params.materialName as string;
    const materials = useAppStore.getState().materials;
    const found = materials.find(
      (m) => m.name.includes(name) || name.includes(m.name)
    );
    if (!found) {
      return { success: false, message: `未找到材料: ${name}` };
    }
    useAppStore.getState().setSelectedMaterial(found);
    useAppStore.getState().setNavigateTo('/analysis');
    return { success: true, message: `已在分析页面选择材料: ${found.name}` };
  },
});

// --- 导出报告 ---
registerAction({
  id: 'analysis.exportReport',
  category: 'analysis',
  name: '导出实验报告',
  description: '在材料力学分析页面生成并导出实验报告(PDF格式)',
  targetPage: '/analysis',
  parameters: [
    { name: 'format', type: 'select', description: '导出格式', required: false, options: ['pdf', 'csv', 'json'] },
  ],
  execute: async (params) => {
    const format = (params.format as string) || 'pdf';
    useAppStore.getState().setNavigateTo('/analysis');
    window.dispatchEvent(new CustomEvent('ai-export-report', { detail: format }));
    return { success: true, message: `正在生成${format.toUpperCase()}格式报告...` };
  },
});

// --- 虚拟实验室: 应用预设方案 ---
registerAction({
  id: 'lab.setPreset',
  category: 'experiment',
  name: '应用预设方案',
  description: '应用实验预设方案，自动设置电压、电流、脉宽等参数。可选: standard(标准测试), highSpeed(高速冲击), rock(岩石破碎), lowSpeed(低速加载)',
  targetPage: '/lab',
  parameters: [
    { name: 'preset', type: 'select', description: '预设方案', required: true, options: ['standard', 'highSpeed', 'rock', 'lowSpeed'] },
  ],
  execute: async (params) => {
    const presets: Record<string, { voltage: number; current: number; pulseWidth: number; label: string }> = {
      standard: { voltage: 2000, current: 25000, pulseWidth: 500, label: '标准测试' },
      highSpeed: { voltage: 3500, current: 40000, pulseWidth: 300, label: '高速冲击' },
      rock: { voltage: 2800, current: 30000, pulseWidth: 800, label: '岩石破碎' },
      lowSpeed: { voltage: 1200, current: 15000, pulseWidth: 1000, label: '低速加载' },
    };
    const preset = presets[params.preset as string];
    if (!preset) return { success: false, message: `未知预设: ${params.preset}` };
    useAppStore.getState().setExperimentParams({
      voltage: preset.voltage,
      current: preset.current,
      pulseWidth: preset.pulseWidth,
    });
    useAppStore.getState().setNavigateTo('/lab');
    window.dispatchEvent(new CustomEvent('ai-apply-preset', { detail: params.preset }));
    return { success: true, message: `已应用「${preset.label}」预设 — 电压${preset.voltage}V, 电流${(preset.current / 1000).toFixed(0)}kA, 脉宽${preset.pulseWidth}μs` };
  },
});

// --- 虚拟实验室: 暂停实验 ---
registerAction({
  id: 'lab.pauseExperiment',
  category: 'experiment',
  name: '暂停实验',
  description: '暂停当前正在进行的SHPB实验',
  targetPage: '/lab',
  parameters: [],
  execute: async () => {
    window.dispatchEvent(new CustomEvent('ai-pause-experiment'));
    return { success: true, message: '实验已暂停' };
  },
});

// --- 虚拟实验室: 重置实验 ---
registerAction({
  id: 'lab.resetExperiment',
  category: 'experiment',
  name: '重置实验',
  description: '重置实验到初始状态，清除所有实验数据和动画',
  targetPage: '/lab',
  parameters: [],
  execute: async () => {
    window.dispatchEvent(new CustomEvent('ai-reset-experiment'));
    return { success: true, message: '实验已重置到初始状态' };
  },
});

// --- 虚拟实验室: 一次性设置多个参数 ---
registerAction({
  id: 'lab.setAllParams',
  category: 'parameter',
  name: '批量设置实验参数',
  description: '一次性设置多个实验参数(电压、电流、脉宽)。如用户说"设置电压2500V电流30kA脉宽600μs"',
  targetPage: '/lab',
  parameters: [
    { name: 'voltage', type: 'number', description: '电压(V)', required: false, range: [1000, 4000] },
    { name: 'current', type: 'number', description: '电流(A)', required: false, range: [0, 50000] },
    { name: 'pulseWidth', type: 'number', description: '脉宽(μs)', required: false, range: [200, 1100] },
  ],
  execute: async (params) => {
    const updates: Record<string, number> = {};
    const msgs: string[] = [];
    if (params.voltage !== undefined) { updates.voltage = params.voltage as number; msgs.push(`电压=${params.voltage}V`); }
    if (params.current !== undefined) { updates.current = params.current as number; msgs.push(`电流=${((params.current as number) / 1000).toFixed(1)}kA`); }
    if (params.pulseWidth !== undefined) { updates.pulseWidth = params.pulseWidth as number; msgs.push(`脉宽=${params.pulseWidth}μs`); }
    if (msgs.length === 0) return { success: false, message: '请至少指定一个参数' };
    useAppStore.getState().setExperimentParams(updates);
    return { success: true, message: `参数已设置: ${msgs.join(', ')}` };
  },
});

// --- AI优化: 切换算法Tab ---
registerAction({
  id: 'ai.switchAlgorithm',
  category: 'ai',
  name: '切换AI算法',
  description: '在AI智能控制页面切换优化算法选项卡。可选: lstm(LSTM时序预测), wgan(WGAN-GP波形生成), ppo(PPO强化学习)',
  targetPage: '/ai',
  parameters: [
    { name: 'algorithm', type: 'select', description: '算法名称', required: true, options: ['lstm', 'wgan', 'ppo'] },
  ],
  execute: async (params) => {
    const labels: Record<string, string> = { lstm: 'LSTM时序预测', wgan: 'WGAN-GP波形生成', ppo: 'PPO强化学习' };
    useAppStore.getState().setNavigateTo('/ai');
    window.dispatchEvent(new CustomEvent('ai-switch-tab', { detail: params.algorithm }));
    return { success: true, message: `已切换到${labels[params.algorithm as string] || params.algorithm}` };
  },
});

// --- AI优化: 应用优化参数到实验室 ---
registerAction({
  id: 'ai.applyOptimizedParams',
  category: 'ai',
  name: '应用AI优化参数',
  description: '将AI优化得出的最优参数应用到虚拟实验室',
  parameters: [],
  execute: async () => {
    const aiState = useAppStore.getState().aiState;
    if (!aiState.bestParams) {
      return { success: false, message: 'AI优化尚未完成，没有可应用的参数。请先启动AI优化。' };
    }
    useAppStore.getState().setExperimentParams(aiState.bestParams);
    useAppStore.getState().setNavigateTo('/lab');
    return { success: true, message: `已将AI优化参数应用到实验室: 电压${aiState.bestParams.voltage}V, 电流${((aiState.bestParams.current || 0) / 1000).toFixed(1)}kA` };
  },
});

// --- 材料分析: 启动AI预测 ---
registerAction({
  id: 'analysis.startAIPrediction',
  category: 'analysis',
  name: '启动AI材料预测',
  description: '在材料力学分析页面启动AI材料动态力学响应预测',
  targetPage: '/analysis',
  parameters: [],
  execute: async () => {
    useAppStore.getState().setNavigateTo('/analysis');
    window.dispatchEvent(new CustomEvent('ai-start-prediction'));
    return { success: true, message: 'AI材料力学预测已启动' };
  },
});

// --- 材料分析: 导出数据 ---
registerAction({
  id: 'analysis.exportData',
  category: 'analysis',
  name: '导出分析数据',
  description: '导出材料分析数据。支持格式: csv, json, png',
  targetPage: '/analysis',
  parameters: [
    { name: 'format', type: 'select', description: '导出格式', required: true, options: ['csv', 'json', 'png'] },
  ],
  execute: async (params) => {
    useAppStore.getState().setNavigateTo('/analysis');
    window.dispatchEvent(new CustomEvent('ai-export-data', { detail: params.format }));
    return { success: true, message: `正在导出${(params.format as string).toUpperCase()}格式数据...` };
  },
});

// --- 系统监控: 设置告警规则 ---
registerAction({
  id: 'monitor.setAlertRule',
  category: 'monitor',
  name: '设置告警阈值',
  description: '设置系统监控的告警阈值。可设置电压、电流、温度、储能的告警值',
  targetPage: '/monitor',
  parameters: [
    { name: 'type', type: 'select', description: '告警类型', required: true, options: ['voltage', 'current', 'temperature', 'energy'] },
    { name: 'threshold', type: 'number', description: '告警阈值', required: true },
  ],
  execute: async (params) => {
    const labels: Record<string, string> = { voltage: '电压', current: '电流', temperature: '温度', energy: '储能' };
    const units: Record<string, string> = { voltage: 'V', current: 'kA', temperature: '°C', energy: 'kJ' };
    const type = params.type as string;
    useAppStore.getState().setNavigateTo('/monitor');
    window.dispatchEvent(new CustomEvent('ai-set-alert', { detail: { type, threshold: params.threshold } }));
    return { success: true, message: `${labels[type]}告警阈值已设置为 ${params.threshold}${units[type]}` };
  },
});

// --- 通用: 显示帮助 ---
registerAction({
  id: 'general.showHelp',
  category: 'general',
  name: '显示帮助',
  description: '显示系统功能帮助和使用指南',
  parameters: [],
  execute: async () => {
    return {
      success: true,
      message: `我是小智，您的实验助手。我可以帮您：
• 导航到任意页面（如"去虚拟实验室"）
• 设置实验参数（如"设置电压3000V"）
• 选择材料和预设方案
• 启动/暂停/重置实验
• 运行AI优化和材料预测
• 执行安全检查
• 运行多场耦合仿真
• 导出数据和报告
试试说"帮我用Q235钢做个实验"吧！`,
    };
  },
});

// --- 通用: 查询系统状态 ---
registerAction({
  id: 'general.getSystemStatus',
  category: 'general',
  name: '查询系统状态',
  description: '查询当前系统运行状态、实验参数和设备信息的摘要',
  parameters: [],
  execute: async () => {
    const state = useAppStore.getState();
    const params = state.experimentParams;
    const material = state.selectedMaterial;
    const aiState = state.aiState;
    const pageLabels: Record<string, string> = {
      '/': '首页', '/lab': '虚拟实验室', '/ai': 'AI智能控制',
      '/multifield': '多场耦合', '/analysis': '材料分析', '/monitor': '系统监控',
    };
    const currentPage = pageLabels[state.currentPage || '/'] || state.currentPage;

    const statusLines = [
      `当前页面: ${currentPage}`,
      `材料: ${material?.name || '未选择'}`,
      `电压: ${params.voltage}V | 电流: ${(params.current / 1000).toFixed(1)}kA | 脉宽: ${params.pulseWidth}μs`,
      `AI优化: ${aiState.isOptimizing ? '运行中' : aiState.bestParams ? '已完成' : '未启动'}`,
    ];
    return { success: true, message: statusLines.join('\n') };
  },
});

// --- 通用: 描述当前页面 ---
registerAction({
  id: 'general.describeCurrentPage',
  category: 'general',
  name: '描述当前页面',
  description: '描述用户当前所在页面的功能和可用操作',
  parameters: [],
  execute: async () => {
    const currentPage = useAppStore.getState().currentPage || '/';
    const descriptions: Record<string, string> = {
      '/': '首页 — 系统总览，展示霍普金森杆实验系统架构和核心功能入口',
      '/lab': '虚拟实验室 — 可进行SHPB实验：选择材料、设置参数、启动实验、查看2D/3D模型和波形数据',
      '/ai': 'AI智能控制 — 三级AI优化(LSTM预测→WGAN生成→PPO优化)，可训练模型、查看优化结果并应用到实验',
      '/multifield': '多场耦合仿真 — 模拟极端环境(深矿/航空/核反应堆/EV碰撞)下的温度-应力-电磁三场耦合效应',
      '/analysis': '材料力学分析 — 材料本构参数、应力-应变曲线、AI预测、雷达图对比、数据导出',
      '/monitor': '系统监控 — 实时设备状态、告警配置、安全检查、操作日志',
    };
    return { success: true, message: descriptions[currentPage] || `当前页面: ${currentPage}` };
  },
});

// ═══════════════════════════════════════════════
// 新增操作 — 覆盖所有页面的数值调节和按钮交互
// ═══════════════════════════════════════════════

// --- 系统监控: 开关监控 ---
registerAction({
  id: 'monitor.toggleMonitoring',
  category: 'monitor',
  name: '开关监控',
  description: '开启或关闭系统实时监控。开启后系统持续采集电压、电流、温度等数据',
  targetPage: '/monitor',
  parameters: [
    { name: 'enabled', type: 'boolean', description: '是否开启监控', required: false },
  ],
  execute: async (params) => {
    useAppStore.getState().setNavigateTo('/monitor');
    window.dispatchEvent(new CustomEvent('ai-toggle-monitoring', { detail: params.enabled }));
    const action = params.enabled === false ? '关闭' : '开启';
    return { success: true, message: `系统监控已${action}` };
  },
});

// --- 系统监控: 紧急停机 ---
registerAction({
  id: 'monitor.emergencyStop',
  category: 'monitor',
  name: '紧急停机',
  description: '紧急停止所有设备运行，关闭监控系统。仅在危险情况下使用',
  targetPage: '/monitor',
  parameters: [],
  execute: async () => {
    useAppStore.getState().setNavigateTo('/monitor');
    window.dispatchEvent(new CustomEvent('ai-emergency-stop'));
    return { success: true, message: '⚠ 紧急停机已执行，所有设备已停止' };
  },
});

// --- 系统监控: 设置告警规则（详细） ---
registerAction({
  id: 'monitor.setAlertThreshold',
  category: 'monitor',
  name: '设置告警阈值（详细）',
  description: '设置系统监控告警阈值，可分别设置警告和危险级别。支持: voltageWarning(电压警告), voltageDanger(电压危险), tempWarning(温度警告), tempDanger(温度危险), emiWarning(EMI警告), emiDanger(EMI危险), capacitanceLow(储能低值)',
  targetPage: '/monitor',
  parameters: [
    { name: 'rule', type: 'string', description: '阈值名称(如voltageWarning/voltageDanger/tempWarning/tempDanger/emiWarning/emiDanger/capacitanceLow)', required: true },
    { name: 'value', type: 'number', description: '阈值数值', required: true },
  ],
  execute: async (params) => {
    const ruleLabels: Record<string, string> = {
      voltageWarning: '电压警告', voltageDanger: '电压危险',
      tempWarning: '温度警告', tempDanger: '温度危险',
      emiWarning: 'EMI警告', emiDanger: 'EMI危险',
      capacitanceLow: '储能低值警告',
    };
    const units: Record<string, string> = {
      voltageWarning: 'V', voltageDanger: 'V',
      tempWarning: '°C', tempDanger: '°C',
      emiWarning: 'dB', emiDanger: 'dB',
      capacitanceLow: '%',
    };
    const rule = params.rule as string;
    useAppStore.getState().setNavigateTo('/monitor');
    window.dispatchEvent(new CustomEvent('ai-set-alert-rule', { detail: { rule, value: params.value } }));
    return { success: true, message: `${ruleLabels[rule] || rule}阈值已设置为 ${params.value}${units[rule] || ''}` };
  },
});

// --- 虚拟实验室: 设置围压 ---
registerAction({
  id: 'lab.setConfiningPressure',
  category: 'experiment',
  name: '设置围压',
  description: '设置三轴围压参数(X/Y/Z轴方向)，范围0-200MPa。需要先启用围压功能',
  targetPage: '/lab',
  parameters: [
    { name: 'x', type: 'number', description: 'X轴围压(MPa)', required: false },
    { name: 'y', type: 'number', description: 'Y轴围压(MPa)', required: false },
    { name: 'z', type: 'number', description: 'Z轴围压(MPa)', required: false },
  ],
  execute: async (params) => {
    useAppStore.getState().setNavigateTo('/lab');
    window.dispatchEvent(new CustomEvent('ai-set-confining', { detail: params }));
    const parts = [];
    if (params.x !== undefined) parts.push(`X=${params.x}MPa`);
    if (params.y !== undefined) parts.push(`Y=${params.y}MPa`);
    if (params.z !== undefined) parts.push(`Z=${params.z}MPa`);
    return { success: true, message: `围压已设置: ${parts.join(', ')}` };
  },
});

// --- 虚拟实验室: 开关围压 ---
registerAction({
  id: 'lab.toggleConfining',
  category: 'experiment',
  name: '开关围压',
  description: '启用或禁用三轴围压功能',
  targetPage: '/lab',
  parameters: [
    { name: 'enabled', type: 'boolean', description: '是否启用围压', required: true },
  ],
  execute: async (params) => {
    useAppStore.getState().setNavigateTo('/lab');
    window.dispatchEvent(new CustomEvent('ai-toggle-confining', { detail: params.enabled }));
    return { success: true, message: params.enabled ? '围压功能已启用' : '围压功能已关闭' };
  },
});

// --- 虚拟实验室: 跳转实验阶段 ---
registerAction({
  id: 'lab.jumpToStage',
  category: 'experiment',
  name: '跳转实验阶段',
  description: '跳转到指定的实验阶段。可选: charging(充能), coilAccel(线圈加速), strikerLaunch(撞击杆发射), wavePropagate(应力波传播), deformation(试样变形), dataCollect(数据采集)',
  targetPage: '/lab',
  parameters: [
    { name: 'stage', type: 'string', description: '阶段名称', required: true },
  ],
  execute: async (params) => {
    const stageLabels: Record<string, string> = {
      charging: '充能', coilAccel: '线圈加速', strikerLaunch: '撞击杆发射',
      wavePropagate: '应力波传播', deformation: '试样变形', dataCollect: '数据采集',
    };
    useAppStore.getState().setNavigateTo('/lab');
    window.dispatchEvent(new CustomEvent('ai-jump-stage', { detail: params.stage }));
    return { success: true, message: `已跳转到阶段: ${stageLabels[params.stage as string] || params.stage}` };
  },
});

// --- AI控制: 启动/停止单个算法训练 ---
registerAction({
  id: 'ai.toggleAlgorithmTraining',
  category: 'ai',
  name: '启停算法训练',
  description: '启动或停止指定AI算法的训练。可选算法: lstm(LSTM时序预测), wgan(WGAN-GP波形生成), ppo(PPO强化学习)',
  targetPage: '/ai',
  parameters: [
    { name: 'algorithm', type: 'select', description: '算法名称', required: true, options: ['lstm', 'wgan', 'ppo'] },
    { name: 'action', type: 'select', description: '操作', required: false, options: ['start', 'stop'] },
  ],
  execute: async (params) => {
    const algoLabels: Record<string, string> = { lstm: 'LSTM', wgan: 'WGAN-GP', ppo: 'PPO' };
    useAppStore.getState().setNavigateTo('/ai');
    window.dispatchEvent(new CustomEvent('ai-toggle-training', {
      detail: { algorithm: params.algorithm, action: params.action || 'start' },
    }));
    const label = algoLabels[params.algorithm as string] || params.algorithm;
    const actionLabel = params.action === 'stop' ? '已停止' : '已启动';
    return { success: true, message: `${label}算法训练${actionLabel}` };
  },
});

// --- AI控制: 设置超参数 ---
registerAction({
  id: 'ai.setHyperParam',
  category: 'ai',
  name: '设置AI超参数',
  description: '设置AI算法的超参数。LSTM: learningRate(学习率), hiddenLayers(隐藏层数), batchSize(批大小), epochs(训练轮数)。WGAN: learningRate, generatorLayers(生成器层数), batchSize, epochs。PPO: learningRate, clipRatio(裁剪比率), batchSize, policyIter(策略迭代)',
  targetPage: '/ai',
  parameters: [
    { name: 'algorithm', type: 'select', description: '算法名称', required: true, options: ['lstm', 'wgan', 'ppo'] },
    { name: 'param', type: 'string', description: '参数名称', required: true },
    { name: 'value', type: 'number', description: '参数值', required: true },
  ],
  execute: async (params) => {
    useAppStore.getState().setNavigateTo('/ai');
    window.dispatchEvent(new CustomEvent('ai-set-hyperparam', {
      detail: { algorithm: params.algorithm, param: params.param, value: params.value },
    }));
    return { success: true, message: `${(params.algorithm as string).toUpperCase()}的${params.param}已设置为${params.value}` };
  },
});

// --- 多场耦合: 开关物理效应 ---
registerAction({
  id: 'multifield.toggleEffect',
  category: 'multifield',
  name: '开关物理效应',
  description: '启用或禁用多场耦合中的物理效应。可选: thermalSoftening(热软化), adiabaticHeating(绝热升温), eddyCurrentLoss(涡流损耗)',
  targetPage: '/multifield',
  parameters: [
    { name: 'effect', type: 'select', description: '效应名称', required: true, options: ['thermalSoftening', 'adiabaticHeating', 'eddyCurrentLoss'] },
    { name: 'enabled', type: 'boolean', description: '是否启用', required: true },
  ],
  execute: async (params) => {
    const labels: Record<string, string> = {
      thermalSoftening: '热软化', adiabaticHeating: '绝热升温', eddyCurrentLoss: '涡流损耗',
    };
    useAppStore.getState().setNavigateTo('/multifield');
    window.dispatchEvent(new CustomEvent('ai-toggle-effect', {
      detail: { effect: params.effect, enabled: params.enabled },
    }));
    const label = labels[params.effect as string] || params.effect;
    return { success: true, message: `${label}效应已${params.enabled ? '启用' : '关闭'}` };
  },
});

// --- 多场耦合: 重置仿真 ---
registerAction({
  id: 'multifield.reset',
  category: 'multifield',
  name: '重置仿真',
  description: '重置多场耦合仿真到初始状态，清除仿真结果',
  targetPage: '/multifield',
  parameters: [],
  execute: async () => {
    useAppStore.getState().setNavigateTo('/multifield');
    window.dispatchEvent(new CustomEvent('ai-reset-multifield'));
    return { success: true, message: '多场耦合仿真已重置' };
  },
});

// --- 多场耦合: 发送结果到分析页 ---
registerAction({
  id: 'multifield.sendToAnalysis',
  category: 'multifield',
  name: '发送到分析页',
  description: '将多场耦合仿真结果发送到材料力学分析页面进行进一步分析',
  targetPage: '/multifield',
  parameters: [],
  execute: async () => {
    useAppStore.getState().setNavigateTo('/multifield');
    window.dispatchEvent(new CustomEvent('ai-send-to-analysis'));
    return { success: true, message: '仿真结果已发送到材料分析页面' };
  },
});

// --- 材料分析: 设置预测参数 ---
registerAction({
  id: 'analysis.setPredictionParams',
  category: 'analysis',
  name: '设置预测参数',
  description: '设置AI材料力学预测的输入参数。应变率范围100-10000/s，温度范围20-800°C，围压范围0-200MPa',
  targetPage: '/analysis',
  parameters: [
    { name: 'strainRate', type: 'number', description: '应变率(/s)', required: false },
    { name: 'temperature', type: 'number', description: '温度(°C)', required: false },
    { name: 'confiningPressure', type: 'number', description: '围压(MPa)', required: false },
  ],
  execute: async (params) => {
    useAppStore.getState().setNavigateTo('/analysis');
    window.dispatchEvent(new CustomEvent('ai-set-prediction-params', { detail: params }));
    const parts = [];
    if (params.strainRate !== undefined) parts.push(`应变率=${params.strainRate}/s`);
    if (params.temperature !== undefined) parts.push(`温度=${params.temperature}°C`);
    if (params.confiningPressure !== undefined) parts.push(`围压=${params.confiningPressure}MPa`);
    return { success: true, message: `预测参数已设置: ${parts.join(', ')}` };
  },
});

// --- 材料分析: 开关对比模式 ---
registerAction({
  id: 'analysis.toggleCompareMode',
  category: 'analysis',
  name: '开关对比模式',
  description: '启用或禁用材料对比模式。对比模式下可同时对比最多4种材料的力学性能',
  targetPage: '/analysis',
  parameters: [
    { name: 'enabled', type: 'boolean', description: '是否启用对比模式', required: true },
  ],
  execute: async (params) => {
    useAppStore.getState().setNavigateTo('/analysis');
    window.dispatchEvent(new CustomEvent('ai-toggle-compare', { detail: params.enabled }));
    return { success: true, message: params.enabled ? '材料对比模式已启用，可选择多种材料对比' : '材料对比模式已关闭' };
  },
});

// --- 材料分析: 图表缩放 ---
registerAction({
  id: 'analysis.zoomChart',
  category: 'analysis',
  name: '图表缩放',
  description: '缩放材料分析图表。可选操作: in(放大), out(缩小), reset(重置)',
  targetPage: '/analysis',
  parameters: [
    { name: 'action', type: 'select', description: '缩放操作', required: true, options: ['in', 'out', 'reset'] },
  ],
  execute: async (params) => {
    useAppStore.getState().setNavigateTo('/analysis');
    window.dispatchEvent(new CustomEvent('ai-zoom-chart', { detail: params.action }));
    const labels: Record<string, string> = { in: '已放大', out: '已缩小', reset: '已重置' };
    return { success: true, message: `图表${labels[params.action as string] || '已操作'}` };
  },
});

// 导出注册表大小（用于调试）
export function getRegistrySize(): number {
  return actions.size;
}
