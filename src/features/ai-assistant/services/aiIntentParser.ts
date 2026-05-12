// src/features/ai-assistant/services/aiIntentParser.ts
// AI意图解析器 - 结合快速正则 + LLM Function Calling
import { getToolDefinitions } from './aiActionRegistry';
import type { LLMFunctionCall, LLMToolDefinition } from '../types';

// ═══════════════════════════════════════════════
// 快速意图匹配（正则，无需LLM）
// ═══════════════════════════════════════════════

interface QuickIntent {
  patterns: RegExp[];
  actionId: string;
  extractParams: (match: RegExpMatchArray, input: string) => Record<string, unknown>;
}

const QUICK_INTENTS: QuickIntent[] = [
  // --- 自主实验（优先级最高，避免与 lab.pauseExperiment 等冲突）---
  // 触发自主实验规划
  {
    patterns: [
      /(?:帮我|请|AI)?(?:自主|自动)(?:研究|做|进行|执行|实验).*/i,
      /(?:启动|开始|做一次?)\s*(?:AI)?自主实验/i,
      /(?:帮我|请)?(?:研究|探究|调查).*(?:应变率|温度|对比|参数|优化|扫描)(?:效应|影响|特性|规律)?/i,
      /(?:帮我|请)?(?:比较|对比).*(?:和|与|跟).*(?:哪个|哪种)?(?:强|好|高|优)/i,
      /找到?.*(?:最佳|最优|最好).*(?:参数|条件)/i,
    ],
    actionId: 'autonomous.plan',
    extractParams: (_, input) => ({ goal: input }),
  },
  // 自主实验控制
  {
    patterns: [/(?:暂停|停一下)自主实验/i, /pause\s*autonomous/i],
    actionId: 'autonomous.pause',
    extractParams: () => ({}),
  },
  {
    patterns: [/(?:继续|恢复)自主实验/i, /resume\s*autonomous/i],
    actionId: 'autonomous.resume',
    extractParams: () => ({}),
  },
  {
    patterns: [/(?:终止|停止|取消)自主实验/i, /abort\s*autonomous/i],
    actionId: 'autonomous.abort',
    extractParams: () => ({}),
  },
  {
    patterns: [
      /(?:批准|同意|确认)(?:自主)?(?:实验)?计划/i,
      /^(?:开始|启动)执行(?:实验|计划|吧)?$/i,
      /^(?:批准|同意)(?:执行|了|吧)?$/i,
    ],
    actionId: 'autonomous.approve',
    extractParams: () => ({}),
  },
  {
    patterns: [/(?:拒绝|否决|驳回)(?:自主)?(?:实验)?计划/i],
    actionId: 'autonomous.reject',
    extractParams: () => ({}),
  },

  // 导航
  {
    patterns: [/(?:去|打开|进入|跳转到?)(?:虚拟)?实验室/i, /go\s*(?:to\s*)?lab/i],
    actionId: 'navigate.toPage',
    extractParams: () => ({ page: 'lab' }),
  },
  // /ai 和 /multifield 已整合到 /lab，统一重定向
  {
    patterns: [/(?:去|打开|进入|跳转到?)(?:AI|人工智能)(?:智能)?控制/i, /go\s*(?:to\s*)?ai/i],
    actionId: 'navigate.toPage',
    extractParams: () => ({ page: 'lab' }),
  },
  {
    patterns: [/(?:去|打开|进入|跳转到?)(?:多场|耦合|极端环境)/i],
    actionId: 'navigate.toPage',
    extractParams: () => ({ page: 'lab' }),
  },
  {
    patterns: [/(?:去|打开|进入|跳转到?)(?:材料|力学)?分析/i],
    actionId: 'navigate.toPage',
    extractParams: () => ({ page: 'analysis' }),
  },
  {
    patterns: [/(?:去|打开|进入|跳转到?)(?:系统)?监控/i],
    actionId: 'navigate.toPage',
    extractParams: () => ({ page: 'monitor' }),
  },
  {
    patterns: [/(?:去|回到?)首页/i, /go\s*home/i],
    actionId: 'navigate.toPage',
    extractParams: () => ({ page: 'home' }),
  },

  // 设置电压
  {
    patterns: [/(?:设置|调整|改|设)电压[为到]?\s*(\d+)\s*V?/i, /voltage\s*(?:to\s*)?(\d+)/i],
    actionId: 'lab.setVoltage',
    extractParams: (match) => ({ voltage: parseInt(match[1]) }),
  },

  // 设置电流
  {
    patterns: [/(?:设置|调整|改|设)电流[为到]?\s*(\d+(?:\.\d+)?)\s*(?:kA|千安)?/i],
    actionId: 'lab.setCurrent',
    extractParams: (match) => {
      let val = parseFloat(match[1]);
      if (val < 100) val *= 1000; // 如果值<100，假设单位是kA
      return { current: val };
    },
  },

  // 设置脉宽
  {
    patterns: [/(?:设置|调整|改|设)脉宽[为到]?\s*(\d+)\s*(?:μs|微秒)?/i],
    actionId: 'lab.setPulseWidth',
    extractParams: (match) => ({ pulseWidth: parseInt(match[1]) }),
  },

  // 选择材料
  {
    patterns: [/(?:选择|使用|换成?|用)\s*(Q235钢?|6061铝合金|Ti-6Al-4V钛?合金|花岗岩|C50混凝土|氧化铝陶瓷|环氧树脂|铝泡沫)/i],
    actionId: 'lab.selectMaterial',
    extractParams: (match) => ({ materialName: match[1] }),
  },
  {
    patterns: [/(?:选择|使用|换成?|用)(.{2,10})(?:作为|做|来)(?:测试)?材料/i],
    actionId: 'lab.selectMaterial',
    extractParams: (match) => ({ materialName: match[1].trim() }),
  },

  // 直接启动实验（仅默认/快速模式才直接执行）
  {
    patterns: [/(?:用?默认参数?|快速)(?:启动|开始|做)实验/i, /默认实验/i],
    actionId: 'lab.startExperiment',
    extractParams: () => ({}),
  },
  // 注意："开始实验"等一般性表述不再直接执行，而是走对话引导流程（见 useAIOrchestrator）

  // 启动AI优化
  {
    patterns: [/(?:启动|开始|运行)AI(?:智能)?优化/i, /(?:一键)?AI优化/i, /start\s*(?:ai\s*)?optimi/i],
    actionId: 'ai.startOptimization',
    extractParams: () => ({}),
  },

  // 多场耦合场景选择(-40~200°C)
  {
    patterns: [/(?:选择|切换|模拟)\s*极地(?:工程)?(?:场景)?/i, /低温脆性(?:实验)?/i],
    actionId: 'multifield.selectScenario',
    extractParams: () => ({ scenario: 'polar' }),
  },
  {
    patterns: [/(?:选择|切换|模拟)\s*(?:冷链|冷藏)(?:运输)?(?:场景)?/i],
    actionId: 'multifield.selectScenario',
    extractParams: () => ({ scenario: 'cold-chain' }),
  },
  {
    patterns: [/(?:选择|切换|模拟)\s*(?:海洋)?深潜(?:器)?(?:场景)?/i],
    actionId: 'multifield.selectScenario',
    extractParams: () => ({ scenario: 'deep-sub' }),
  },
  {
    patterns: [/(?:选择|切换|模拟)\s*(?:常温|室温|基准|动测基准)(?:场景)?/i],
    actionId: 'multifield.selectScenario',
    extractParams: () => ({ scenario: 'room-temp' }),
  },
  {
    patterns: [/(?:选择|切换|模拟)\s*(?:高铁|轨道|铁路)(?:场景)?/i],
    actionId: 'multifield.selectScenario',
    extractParams: () => ({ scenario: 'rail' }),
  },
  {
    patterns: [/(?:选择|切换|模拟)\s*(?:电动汽车|EV|电池)(?:碰撞|热失控)?(?:场景)?/i],
    actionId: 'multifield.selectScenario',
    extractParams: () => ({ scenario: 'ev-crash' }),
  },
  {
    patterns: [/(?:选择|切换|模拟)\s*(?:石油)?(?:钻井|钻探)(?:场景)?/i],
    actionId: 'multifield.selectScenario',
    extractParams: () => ({ scenario: 'oil-drill' }),
  },

  // 运行耦合仿真
  {
    patterns: [/(?:运行|启动|开始)(?:耦合)?仿真/i, /run\s*coupling/i, /run\s*simulation/i],
    actionId: 'multifield.startCoupling',
    extractParams: () => ({}),
  },

  // 安全检查
  {
    patterns: [/(?:执行|运行|开始|做)安全检查/i, /safety\s*check/i],
    actionId: 'monitor.runSafetyCheck',
    extractParams: () => ({}),
  },

  // 导出报告
  {
    patterns: [/(?:导出|生成|下载)(?:实验)?报告/i, /export\s*report/i],
    actionId: 'analysis.exportReport',
    extractParams: () => ({ format: 'pdf' }),
  },

  // 切换视图
  {
    patterns: [/(?:切换|换到?|显示)\s*2D\s*(?:视图|模型)?/i],
    actionId: 'lab.switchView',
    extractParams: () => ({ viewMode: '2d' }),
  },
  {
    patterns: [/(?:切换|换到?|显示)\s*3D\s*(?:视图|视频|模型)?/i],
    actionId: 'lab.switchView',
    extractParams: () => ({ viewMode: '3d' }),
  },

  // 暂停实验
  {
    patterns: [/(?:暂停|停止|中断)实验/i, /pause\s*experiment/i],
    actionId: 'lab.pauseExperiment',
    extractParams: () => ({}),
  },

  // 重置实验
  {
    patterns: [/(?:重置|重新开始|初始化|重启)实验/i, /reset\s*experiment/i],
    actionId: 'lab.resetExperiment',
    extractParams: () => ({}),
  },

  // 应用预设方案
  {
    patterns: [/(?:标准|常规)(?:预设|方案|模式|测试)/i],
    actionId: 'lab.setPreset',
    extractParams: () => ({ preset: 'standard' }),
  },
  {
    patterns: [/(?:高速|高应变率)(?:预设|方案|模式|冲击)/i],
    actionId: 'lab.setPreset',
    extractParams: () => ({ preset: 'highSpeed' }),
  },
  {
    patterns: [/(?:岩石|岩体)(?:预设|方案|模式|破碎)/i],
    actionId: 'lab.setPreset',
    extractParams: () => ({ preset: 'rock' }),
  },
  {
    patterns: [/(?:低速|低应变率|准静态)(?:预设|方案|模式|加载)/i],
    actionId: 'lab.setPreset',
    extractParams: () => ({ preset: 'lowSpeed' }),
  },

  // 切换AI算法Tab
  {
    patterns: [/(?:查看|展示|切换到?|显示)\s*LSTM/i],
    actionId: 'ai.switchAlgorithm',
    extractParams: () => ({ algorithm: 'lstm' }),
  },
  {
    patterns: [/(?:查看|展示|切换到?|显示)\s*WGAN/i],
    actionId: 'ai.switchAlgorithm',
    extractParams: () => ({ algorithm: 'wgan' }),
  },
  {
    patterns: [/(?:查看|展示|切换到?|显示)\s*PPO/i],
    actionId: 'ai.switchAlgorithm',
    extractParams: () => ({ algorithm: 'ppo' }),
  },

  // 应用AI优化参数
  {
    patterns: [/(?:应用|使用)(?:AI)?优化(?:的)?参数/i, /apply\s*optim/i],
    actionId: 'ai.applyOptimizedParams',
    extractParams: () => ({}),
  },

  // AI材料预测
  {
    patterns: [/(?:AI)?(?:材料)?(?:预测|开始预测|智能预测)/i, /start\s*predict/i],
    actionId: 'analysis.startAIPrediction',
    extractParams: () => ({}),
  },

  // 导出数据
  {
    patterns: [/(?:导出|下载)\s*CSV/i],
    actionId: 'analysis.exportData',
    extractParams: () => ({ format: 'csv' }),
  },
  {
    patterns: [/(?:导出|下载)\s*JSON/i],
    actionId: 'analysis.exportData',
    extractParams: () => ({ format: 'json' }),
  },
  {
    patterns: [/(?:导出|下载)\s*(?:PNG|图片|截图)/i],
    actionId: 'analysis.exportData',
    extractParams: () => ({ format: 'png' }),
  },

  // 帮助
  {
    patterns: [/(?:帮助|怎么用|使用说明|功能介绍|你能做什么)/i, /^help$/i],
    actionId: 'general.showHelp',
    extractParams: () => ({}),
  },

  // 系统状态
  {
    patterns: [/(?:当前|系统|设备)(?:状态|怎么样|如何)/i, /system\s*status/i],
    actionId: 'general.getSystemStatus',
    extractParams: () => ({}),
  },

  // 描述当前页面
  {
    patterns: [/(?:这是|这个|当前)(?:什么)?页面/i, /(?:介绍|描述)(?:一下)?(?:这个|当前)?页面/i],
    actionId: 'general.describeCurrentPage',
    extractParams: () => ({}),
  },

  // --- 系统监控新增 ---
  // 紧急停机
  {
    patterns: [/紧急停(?:机|止)/i, /emergency\s*stop/i],
    actionId: 'monitor.emergencyStop',
    extractParams: () => ({}),
  },
  // 开关监控
  {
    patterns: [/(?:开启|打开|启动)监控/i],
    actionId: 'monitor.toggleMonitoring',
    extractParams: () => ({ enabled: true }),
  },
  {
    patterns: [/(?:关闭|停止|暂停)监控/i],
    actionId: 'monitor.toggleMonitoring',
    extractParams: () => ({ enabled: false }),
  },
  // 设置告警阈值（通用匹配）
  {
    patterns: [/(?:设置|调整)(?:电压)(?:警告|预警)(?:阈值)?[为到]?\s*(\d+)\s*V?/i],
    actionId: 'monitor.setAlertThreshold',
    extractParams: (match) => ({ rule: 'voltageWarning', value: parseInt(match[1]) }),
  },
  {
    patterns: [/(?:设置|调整)(?:电压)(?:危险|上限)(?:阈值)?[为到]?\s*(\d+)\s*V?/i],
    actionId: 'monitor.setAlertThreshold',
    extractParams: (match) => ({ rule: 'voltageDanger', value: parseInt(match[1]) }),
  },
  {
    patterns: [/(?:设置|调整)(?:温度)(?:警告|预警)(?:阈值)?[为到]?\s*(\d+)\s*°?C?/i],
    actionId: 'monitor.setAlertThreshold',
    extractParams: (match) => ({ rule: 'tempWarning', value: parseInt(match[1]) }),
  },
  {
    patterns: [/(?:设置|调整)(?:温度)(?:危险|上限)(?:阈值)?[为到]?\s*(\d+)\s*°?C?/i],
    actionId: 'monitor.setAlertThreshold',
    extractParams: (match) => ({ rule: 'tempDanger', value: parseInt(match[1]) }),
  },

  // --- 虚拟实验室新增 ---
  // 围压
  {
    patterns: [/(?:设置|调整)围压[为到]?\s*(\d+)\s*MPa/i],
    actionId: 'lab.setConfiningPressure',
    extractParams: (match) => ({ x: parseInt(match[1]), y: parseInt(match[1]), z: parseInt(match[1]) }),
  },
  {
    patterns: [/(?:启用|开启|打开)围压/i],
    actionId: 'lab.toggleConfining',
    extractParams: () => ({ enabled: true }),
  },
  {
    patterns: [/(?:关闭|禁用)围压/i],
    actionId: 'lab.toggleConfining',
    extractParams: () => ({ enabled: false }),
  },

  // --- AI控制新增 ---
  // 训练算法
  {
    patterns: [/(?:启动|开始|训练)\s*LSTM/i],
    actionId: 'ai.toggleAlgorithmTraining',
    extractParams: () => ({ algorithm: 'lstm', action: 'start' }),
  },
  {
    patterns: [/(?:启动|开始|训练)\s*WGAN/i],
    actionId: 'ai.toggleAlgorithmTraining',
    extractParams: () => ({ algorithm: 'wgan', action: 'start' }),
  },
  {
    patterns: [/(?:启动|开始|训练)\s*PPO/i],
    actionId: 'ai.toggleAlgorithmTraining',
    extractParams: () => ({ algorithm: 'ppo', action: 'start' }),
  },
  {
    patterns: [/(?:停止|暂停)\s*LSTM/i],
    actionId: 'ai.toggleAlgorithmTraining',
    extractParams: () => ({ algorithm: 'lstm', action: 'stop' }),
  },
  {
    patterns: [/(?:停止|暂停)\s*WGAN/i],
    actionId: 'ai.toggleAlgorithmTraining',
    extractParams: () => ({ algorithm: 'wgan', action: 'stop' }),
  },
  {
    patterns: [/(?:停止|暂停)\s*PPO/i],
    actionId: 'ai.toggleAlgorithmTraining',
    extractParams: () => ({ algorithm: 'ppo', action: 'stop' }),
  },

  // --- 多场耦合新增 ---
  // 物理效应开关
  {
    patterns: [/(?:启用|开启|打开)热软化/i],
    actionId: 'multifield.toggleEffect',
    extractParams: () => ({ effect: 'thermalSoftening', enabled: true }),
  },
  {
    patterns: [/(?:关闭|禁用)热软化/i],
    actionId: 'multifield.toggleEffect',
    extractParams: () => ({ effect: 'thermalSoftening', enabled: false }),
  },
  {
    patterns: [/(?:启用|开启|打开)(?:绝热升温|绝热)/i],
    actionId: 'multifield.toggleEffect',
    extractParams: () => ({ effect: 'adiabaticHeating', enabled: true }),
  },
  {
    patterns: [/(?:关闭|禁用)(?:绝热升温|绝热)/i],
    actionId: 'multifield.toggleEffect',
    extractParams: () => ({ effect: 'adiabaticHeating', enabled: false }),
  },
  {
    patterns: [/(?:启用|开启|打开)涡流/i],
    actionId: 'multifield.toggleEffect',
    extractParams: () => ({ effect: 'eddyCurrentLoss', enabled: true }),
  },
  {
    patterns: [/(?:关闭|禁用)涡流/i],
    actionId: 'multifield.toggleEffect',
    extractParams: () => ({ effect: 'eddyCurrentLoss', enabled: false }),
  },
  // 重置仿真
  {
    patterns: [/(?:重置|清除|初始化)仿真/i, /reset\s*simulation/i],
    actionId: 'multifield.reset',
    extractParams: () => ({}),
  },
  // 发送到分析
  {
    patterns: [/(?:发送|传送)(?:到|至)分析/i, /send\s*to\s*analysis/i],
    actionId: 'multifield.sendToAnalysis',
    extractParams: () => ({}),
  },

  // --- 材料分析新增 ---
  // 设置应变率
  {
    patterns: [/(?:设置|调整)应变率[为到]?\s*(\d+)/i],
    actionId: 'analysis.setPredictionParams',
    extractParams: (match) => ({ strainRate: parseInt(match[1]) }),
  },
  // 开关对比模式
  {
    patterns: [/(?:启用|开启|打开)对比(?:模式)?/i],
    actionId: 'analysis.toggleCompareMode',
    extractParams: () => ({ enabled: true }),
  },
  {
    patterns: [/(?:关闭|禁用)对比(?:模式)?/i],
    actionId: 'analysis.toggleCompareMode',
    extractParams: () => ({ enabled: false }),
  },
  // 图表缩放
  {
    patterns: [/(?:放大|zoom\s*in)图表/i],
    actionId: 'analysis.zoomChart',
    extractParams: () => ({ action: 'in' }),
  },
  {
    patterns: [/(?:缩小|zoom\s*out)图表/i],
    actionId: 'analysis.zoomChart',
    extractParams: () => ({ action: 'out' }),
  },
  {
    patterns: [/(?:重置|还原)(?:图表)?缩放/i],
    actionId: 'analysis.zoomChart',
    extractParams: () => ({ action: 'reset' }),
  },
];

/**
 * 尝试快速正则匹配意图
 * @returns 匹配到的function calls，或null表示需要走LLM
 */
export function quickIntentMatch(input: string): LLMFunctionCall[] | null {
  const calls: LLMFunctionCall[] = [];

  for (const intent of QUICK_INTENTS) {
    for (const pattern of intent.patterns) {
      const match = input.match(pattern);
      if (match) {
        calls.push({
          name: intent.actionId,
          arguments: intent.extractParams(match, input),
        });
        break; // 每个intent只匹配一次
      }
    }
  }

  return calls.length > 0 ? calls : null;
}

/**
 * 构建LLM Function Calling的系统提示
 */
export function buildFunctionCallingSystemPrompt(): string {
  return `你是"数智化电磁驱动霍普金森杆多场耦合动态测试系统"的AI助手"小智"。

你的核心能力：
1. 通过调用工具函数来**操控网站**——导航页面、设置参数、执行实验、分析数据
2. 用专业且友好的语气与用户对话
3. 当用户需求不明确时，主动询问细节

操控规则（极其重要）：
- 收到任何操作指令时，你**必须**使用[ACTION:actionId(params)]标记来执行操作，**绝对不能**只用文字描述操作步骤而不执行
- 例如：用户说"设置电压3000V"→回复"好的。[ACTION:lab.setVoltage(voltage=3000)]"
- 例如：用户说"去实验室"→回复"好的。[ACTION:navigate.toPage(page=lab)]"
- 例如：用户说"设置电压危险阈值4200V"→回复"好的。[ACTION:monitor.setAlertThreshold(rule=voltageDanger,value=4200)]"
- 收到模糊需求时先询问细节
- **再次强调**：用户指令明确时，**必须**包含[ACTION:]标记

可用的全部操作ID：
【导航】navigate.toPage(page=home/lab/ai/multifield/analysis/monitor), lab.switchView(viewMode=2d/3d)
【实验参数】lab.setVoltage(voltage), lab.setCurrent(current), lab.setPulseWidth(pulseWidth), lab.setWaveform(waveform=sine/square/triangle/pulse), lab.setAllParams(voltage,current,pulseWidth), lab.setPreset(preset=standard/highSpeed/rock/lowSpeed)
【实验操作】lab.startExperiment, lab.pauseExperiment, lab.resetExperiment, lab.selectMaterial(materialName), lab.jumpToStage(stage=charging/coilAccel/strikerLaunch/wavePropagate/deformation/dataCollect)
【围压】lab.setConfiningPressure(x,y,z), lab.toggleConfining(enabled)
【AI优化】ai.startOptimization, ai.switchAlgorithm(algorithm=lstm/wgan/ppo), ai.applyOptimizedParams, ai.toggleAlgorithmTraining(algorithm,action=start/stop), ai.setHyperParam(algorithm,param=learningRate/hiddenLayers/batchSize/epochs/generatorLayers/clipRatio/policyIter,value)
【多场耦合】multifield.selectScenario(scenario=polar/cold-chain/deep-sub/room-temp/rail/ev-crash/oil-drill), multifield.setFields(temperature,stress,emField), multifield.startCoupling, multifield.toggleEffect(effect=thermalSoftening/adiabaticHeating/eddyCurrentLoss,enabled), multifield.reset, multifield.sendToAnalysis
【材料分析】analysis.selectMaterial(materialId), analysis.startAIPrediction, analysis.setPredictionParams(strainRate,temperature,confiningPressure), analysis.toggleCompareMode(enabled), analysis.zoomChart(action=in/out/reset), analysis.exportData(format=csv/json/png), analysis.exportReport
【系统监控】monitor.runSafetyCheck, monitor.setAlertRule(type=voltage/current/temperature/energy,threshold), monitor.setAlertThreshold(rule=voltageWarning/voltageDanger/tempWarning/tempDanger/emiWarning/emiDanger/capacitanceLow,value), monitor.toggleMonitoring(enabled), monitor.emergencyStop
【通用】general.showHelp, general.getSystemStatus, general.describeCurrentPage

领域知识：
- SHPB(分离式霍普金森压杆)实验用于测量材料在高应变率(10²~10⁴/s)下的动态力学性能
- 本系统使用电磁驱动替代传统气体枪，实现更精确的加载控制
- 三级AI优化: LSTM时序预测 → WGAN-GP波形生成 → PPO强化学习
- 安全阈值: 电压≤4000V、电流≤50kA、储能≤36kJ、温度≤80°C
- Johnson-Cook本构模型: σ = (A + Bεⁿ)(1 + Cln(ε̇/ε̇₀))(1 - T*ᵐ)

对话风格（极其重要，必须严格遵守）：
- **每次回复只问一个问题**，绝对禁止在一条消息里问两个或以上的问题
- 用户需求不完整时，按优先级逐一询问：材料 → 实验类型 → 参数 → 确认执行
- 收到用户回答后先确认理解，再问下一个问题
- 每条回复不超过80字，简洁友好
- 像朋友聊天一样自然，不要生硬地罗列选项

示例对话：
用户：帮我做个实验
助手：好的！请问您想使用什么材料？比如Q235钢、Ti-6Al-4V等。
用户：Q235钢
助手：收到，Q235钢。请问需要设置多大的电压？默认280V。
用户：300V
助手：好的，Q235钢、300V。我现在帮您配置并启动实验，可以吗？
用户：可以
助手：正在为您操作...`;
}

/**
 * 获取LLM工具定义列表
 */
export function getLLMTools(): LLMToolDefinition[] {
  return getToolDefinitions();
}

/**
 * 检测复合意图（用户在一句话中包含多个操作）
 * 如: "用Q235钢设置电压300V然后开始实验"
 */
export function detectCompoundIntent(input: string): boolean {
  const actionKeywords = ['然后', '接着', '之后', '再', '并且', '同时', 'then', 'and then'];
  return actionKeywords.some((kw) => input.includes(kw));
}
