import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, VolumeX, Send, Sparkles, Bot, User, Settings, ChevronDown, FlaskConical } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useExperimentWorkflow, type ExperimentResults } from '@/store/experimentWorkflow';
import { chatWithLLM, chatWithLLMStream, isLLMConfigured, getLLMProviderName } from '@/services/llmService';
import AIInquiryFlow from './AIInquiryFlow';
import SafetyCheckPanel from './SafetyCheckPanel';
import ExperimentExecutionPanel from './ExperimentExecutionPanel';

// 消息类型扩展：支持嵌入式组件
type MessageWidget = 'inquiry' | 'safetyCheck' | 'execution' | 'results' | null;

interface Message {
  id: string;
  type: 'user' | 'ai';
  text: string;
  timestamp: number;
  widget?: MessageWidget;         // 嵌入的组件类型
  results?: ExperimentResults;    // 实验结果数据
}

interface VoiceOption {
  name: string;
  lang: string;
  voiceURI: string;
}

// 扩展知识库 - 覆盖更多专业领域
const knowledgeBase: Record<string, string> = {
  '什么是电磁驱动霍普金森杆': '电磁驱动霍普金森杆是一种基于电磁力驱动原理的动态材料测试设备。它通过可调谐RLC链式电路产生高强度脉冲电流，驱动锥形次级线圈产生轴向电磁力，推动撞击杆对试样进行高应变率加载。相比传统气炮驱动，具有波形可控、重复性好、无污染等优势。',
  '系统的四层技术架构是什么': '系统采用四层技术架构：\n1. 物理层：电磁驱动霍普金森杆主体，包含可调谐RLC链式电路、锥形次级线圈、多场耦合加载模块\n2. 数字孪生层：基于Maxwell-Simplorer-Simulink联合仿真，实现虚实映射\n3. 智能控制层：LSTM+WGAN-GP+PPO三级AI闭环算法\n4. 数据分析层：改进Johnson-Cook本构模型与小波变换融合分析',
  'AI三级闭环算法是什么': '三级AI闭环包括：\n1. LSTM时序预测：预测应力波在杆件中的传播特性\n2. WGAN-GP波形生成：生成最优电磁驱动波形\n3. PPO强化学习：在线优化控制策略，最大化实验效果\n三级闭环协同实现波形自适应调控。',
  '什么是WGAN-GP算法': 'WGAN-GP（Wasserstein GAN with Gradient Penalty）是一种生成对抗网络的改进版本。它使用Wasserstein距离替代JS散度，并引入梯度惩罚项解决训练不稳定问题。在本系统中用于学习从材料特性到最优驱动波形的映射关系。',
  '什么是LSTM': 'LSTM（Long Short-Term Memory，长短期记忆网络）是一种特殊的循环神经网络，能够有效处理时序数据中的长期依赖关系。在本系统中用于预测应力波在霍普金森杆中的传播特性。',
  '什么是PPO算法': 'PPO（Proximal Policy Optimization，近端策略优化）是一种强化学习算法，通过限制策略更新的幅度来保证训练的稳定性。在本系统中用于在线优化电磁驱动控制策略。',
  '系统支持哪些材料测试': '系统支持7大类材料：\n1. 金属材料（Q235钢、铝合金、钛合金等）\n2. 矿石与岩土（花岗岩、砂岩等）\n3. 混凝土与水泥基材料\n4. 陶瓷与玻璃\n5. 高分子聚合物\n6. 泡沫与吸能材料\n7. 生物与仿生材料',
  '什么是Johnson-Cook模型': 'Johnson-Cook模型是描述材料在高应变率和高温条件下流动应力的经典本构方程：\nσ = (A + Bεⁿ)(1 + C·ln(ε̇/ε̇₀))(1 - T*ᵐ)\n其中A为初始屈服应力，B为硬化系数，n为硬化指数，C为应变率敏感系数，m为温度软化指数。',
  '什么是应变率': '应变率（Strain Rate）是应变随时间的变化率，单位为s⁻¹。在高应变率测试中，应变率通常在10²-10⁴ s⁻¹范围。应变率越高，材料的屈服强度通常越高，这是材料的应变率强化效应。',
  '什么是热-力-电多场耦合': '热-力-电多场耦合指在材料测试中同时考虑热场（温度）、力场（应力/应变）、电场（电磁驱动）的相互作用。系统通过同步控制实现三场的精准耦合加载，更真实地模拟极端环境条件下的材料响应特性。',
  '围压控制的作用': '围压控制通过XYZ三轴独立加载，模拟深部地应力环境。系统支持0-200MPa的围压范围，用于研究岩石、混凝土等材料在三向应力状态下的动态响应特性。',
  '系统的电压电流范围': '系统电压范围220-350V，最大输出电流50kA。通过调节电容储能（最大36kJ）和放电电压，可实现0-50kA的精准电流输出控制。电流上升时间小于100μs。',
  '高速采集系统的帧率': '系统采用XTDIC高速视觉传感器，支持最高10万fps（100,000帧/秒）的高速采集，配合多物理场传感器实现微秒级数据同步。',
  '霍普金森杆实验的基本原理': '霍普金森杆实验基于一维应力波理论：\n1. 撞击杆以一定速度撞击入射杆，产生应力波\n2. 应力波沿入射杆传播至试样\n3. 部分波反射，部分波透射过试样进入透射杆\n4. 通过应变片测量入射波、反射波、透射波\n5. 根据一维应力波理论计算材料的应力-应变关系',
  '如何计算材料的动态应力-应变曲线': '根据一维应力波理论：\n• 试样应力：σ(t) = (A_b/A_s) · E_b · ε_T(t)\n• 试样应变率：ε̇(t) = (2C_0/L_s) · [ε_I(t) - ε_T(t)]\n• 试样应变：ε(t) = ∫ε̇(t)dt\n其中A_b为杆截面积，A_s为试样截面积，E_b为杆弹性模量，C_0为杆中波速，L_s为试样长度。',
  '虚拟实验室怎么用': '虚拟实验室使用步骤：\n1. 从左侧材料库选择测试材料\n2. 在右侧参数面板设置电压、电流、脉宽等参数\n3. 点击"开始仿真"按钮启动实验\n4. 观察2D/3D动画演示实验过程\n5. 查看实时波形数据\n6. 导出实验结果进行分析',
  '如何设置围压': '围压设置方法：\n1. 在参数面板启用"围压控制"开关\n2. 分别设置X、Y、Z三轴围压值（0-200MPa）\n3. 围压将模拟深部地应力环境\n4. 适用于岩石、混凝土等地质材料的测试',
  'AI智能控制怎么用': 'AI智能控制使用步骤：\n1. 选择要使用的AI算法（LSTM/WGAN-GP/PPO）\n2. 在"参数调优"标签页调整超参数\n3. 点击"开始训练"启动模型训练\n4. 在"训练监控"标签页查看训练进度\n5. 训练完成后，AI模型将自动优化实验参数',
  '如何调整AI参数': 'AI参数调整建议：\n• LSTM：隐藏层单元数(64-256)，时间步长(10-100)，学习率(0.0001-0.01)\n• WGAN-GP：生成器层数(2-8)，判别器层数(2-6)，梯度惩罚系数(1-50)\n• PPO：折扣因子γ(0.9-0.999)，裁剪系数ε(0.1-0.3)，价值系数(0.1-1.0)',
  '系统监控怎么看': '系统监控面板说明：\n• 仪表盘区：显示电压、电流、电容储能、温度、EMI强度的实时值\n• 实时趋势图：展示各参数随时间的变化曲线\n• 预警中心：显示系统异常警告信息\n• 历史日志：记录所有实验事件\n• 紧急停止按钮：在危险情况下立即停止系统',
  '如何设置预警阈值': '预警阈值设置方法：\n1. 在左侧预警面板找到"预警阈值设置"\n2. 拖动滑块调整电压警告值、电压危险值、电容低限值\n3. 当参数超过阈值时，系统将自动发出警告',
  '材料力学分析怎么用': '材料力学分析使用步骤：\n1. 从左侧材料列表选择要分析的材料\n2. 查看应力-应变曲线了解材料力学性能\n3. 查看性能雷达图对比各项性能指标\n4. 使用AI预测功能预测不同条件下的材料性能\n5. 查看Johnson-Cook本构模型参数\n6. 导出数据或分享结果',
  'AI力学性能预测怎么用': 'AI力学性能预测使用方法：\n1. 选择要预测的材料\n2. 设置应变率（100-10000 s⁻¹）\n3. 设置温度（25-800°C）\n4. 点击"预测"按钮\n5. 查看预测的应力、应变和置信度',
  '多场耦合实验怎么用': '多场耦合实验使用步骤：\n1. 在场加载控制区启用需要加载的场（热场/力场/电场）\n2. 调整耦合强度（0-100%）\n3. 在高级设置中调整各场的同步时序\n4. 点击"开始实验"启动多场耦合加载\n5. 观察三场可视化效果和耦合时序曲线\n6. 实验完成后导出数据',
  '如何调整同步时序': '同步时序调整方法：\n1. 展开"同步时序设置"面板\n2. 分别设置热场、力场、电场的延迟时间（0-200ns）\n3. 系统将按照设定的时序精确同步三场加载\n4. 同步精度可达±5ns',
};

// 模糊匹配获取回答
function findAnswer(question: string): string | null {
  const normalizedQuestion = question.toLowerCase().replace(/[？?。.,\s]/g, '');

  for (const [key, value] of Object.entries(knowledgeBase)) {
    const normalizedKey = key.toLowerCase().replace(/[？?。.,\s]/g, '');
    if (normalizedQuestion.includes(normalizedKey) || normalizedKey.includes(normalizedQuestion)) {
      return value;
    }
  }

  const keywords: Record<string, string[]> = {
    '霍普金森': ['霍普金森', 'hopkinson', '杆', '设备', '系统'],
    '架构': ['架构', '技术', '四层', '结构'],
    'AI': ['ai', '算法', '智能', 'lstm', 'wgan', 'ppo', '预测', '训练'],
    '材料': ['材料', '金属', '聚合物', '陶瓷', '测试'],
    'Johnson': ['johnson', 'cook', '本构', '模型', '参数'],
    '耦合': ['耦合', '多场', '热', '力', '电'],
    '围压': ['围压', '三轴', '地应力'],
    '采集': ['采集', '帧率', '高速', '传感器'],
    '电压': ['电压', '电流', '参数', '范围'],
    '虚拟实验室': ['虚拟', '实验室', '仿真', '怎么用'],
    '监控': ['监控', '预警', '阈值', '状态'],
    '分析': ['分析', '力学', '应力', '应变'],
  };

  for (const [topic, words] of Object.entries(keywords)) {
    if (words.some(w => normalizedQuestion.includes(w))) {
      const key = Object.keys(knowledgeBase).find(k => k.includes(topic));
      if (key) return knowledgeBase[key];
    }
  }

  return null;
}

// 大模型API调用 - 优先流式，降级非流式，最后本地知识库
async function callLLMAPI(question: string): Promise<string | null> {
  if (!isLLMConfigured()) return null;

  try {
    // 先尝试非流式调用（流式在组件内处理）
    return await chatWithLLM(question);
  } catch {
    return null;
  }
}

// 实验结果卡片组件
function ExperimentResultsCard({ results }: { results: ExperimentResults }) {
  const items = [
    { label: '峰值应力', value: `${results.peakStress} MPa`, color: 'text-[#00F5FF]' },
    { label: '实际应变率', value: `${results.strainRate} /s`, color: 'text-[#00F5FF]' },
    { label: '屈服强度', value: `${results.yieldStrength} MPa`, color: 'text-emerald-400' },
    { label: '最大应变', value: `${results.maxStrain}%`, color: 'text-amber-400' },
    { label: '能量吸收', value: `${results.energyAbsorption} J/m³`, color: 'text-purple-400' },
    { label: '持续时间', value: `${results.duration} μs`, color: 'text-white/70' },
    { label: '入射波峰值', value: `${results.incidentWavePeak} MPa`, color: 'text-blue-400' },
    { label: '反射波峰值', value: `${results.reflectedWavePeak} MPa`, color: 'text-red-400' },
    { label: '透射波峰值', value: `${results.transmittedWavePeak} MPa`, color: 'text-green-400' },
  ];

  return (
    <div className="rounded-xl bg-[#051020] border border-[#00F5FF]/20 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-400/10 to-transparent border-b border-emerald-400/20">
        <FlaskConical className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-semibold text-emerald-400">实验结果</span>
      </div>
      <div className="grid grid-cols-3 gap-px bg-white/5">
        {items.map(item => (
          <div key={item.label} className="px-3 py-2.5 bg-[#051020]">
            <div className="text-xs text-white/40 mb-0.5">{item.label}</div>
            <div className={`text-sm font-mono font-semibold ${item.color}`}>{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 意图识别 - 判断用户是否要启动实验相关功能
function detectIntent(text: string): 'startExperiment' | 'safetyCheck' | 'stopExperiment' | 'chat' {
  const normalized = text.toLowerCase().replace(/\s/g, '');
  if (/开始实验|启动实验|run\s*experiment|start\s*experiment|做个实验|做实验|自动实验/.test(normalized)) return 'startExperiment';
  if (/安全检查|safety\s*check|检查安全|安检/.test(normalized)) return 'safetyCheck';
  if (/停止|stop|紧急停止|终止实验|取消实验/.test(normalized)) return 'stopExperiment';
  return 'chat';
}

export default function AIAssistantPanel() {
  const { setAssistantStatus, setAssistantMode } = useAppStore();
  const workflow = useExperimentWorkflow();

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption | null>(null);
  const [speechRate, setSpeechRate] = useState(1);
  const [speechPitch, setSpeechPitch] = useState(1);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const speakTextRef = useRef<(text: string) => void>(() => {});

  // 同步状态到全局store
  useEffect(() => {
    if (isListening) setAssistantStatus('listening');
    else if (isLoading) setAssistantStatus('processing');
    else if (isSpeaking) setAssistantStatus('speaking');
    else setAssistantStatus('idle');
  }, [isListening, isLoading, isSpeaking, setAssistantStatus]);

  // 加载可用语音
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      const chineseVoices = availableVoices
        .filter(v => v.lang.includes('zh'))
        .map(v => ({ name: v.name, lang: v.lang, voiceURI: v.voiceURI }));
      setVoices(chineseVoices);
      if (chineseVoices.length > 0 && !selectedVoice) {
        setSelectedVoice(chineseVoices[0]);
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // 自动滚动
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 初始化语音识别
  const initSpeechRecognition = useCallback(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = 'zh-CN';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        handleUserInput(transcript);
      };
      recognition.onerror = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, []);

  // 添加AI消息（带可选widget）
  const addAIMessage = useCallback((text: string, widget?: MessageWidget, results?: ExperimentResults) => {
    const msg: Message = {
      id: (Date.now() + Math.random()).toString(),
      type: 'ai',
      text,
      timestamp: Date.now(),
      widget,
      results,
    };
    setMessages(prev => [...prev, msg]);
    speakTextRef.current(text);
  }, []);

  // 实验流程回调：inquiry完成 → 进入安全检查
  const handleInquiryComplete = useCallback(() => {
    addAIMessage(
      `好的，参数已确认。正在对 ${workflow.requirements.materialName} 的${
        workflow.requirements.testType === 'compression' ? '压缩' :
        workflow.requirements.testType === 'tension' ? '拉伸' : '剪切'
      }测试进行预实验安全检查...`,
      'safetyCheck'
    );
  }, [workflow.requirements, addAIMessage]);

  // 安全检查完成 → 进入执行或报错
  const handleSafetyCheckComplete = useCallback((passed: boolean) => {
    if (passed) {
      workflow.setPhase('execution');
      addAIMessage('安全检查通过！正在启动实验...请注意观察实验进度。', 'execution');
    } else {
      workflow.setPhase('idle');
      addAIMessage('安全检查未通过，存在危险参数。请调整实验参数后重试。您可以说"开始实验"重新配置。');
    }
  }, [workflow, addAIMessage]);

  // 实验执行完成 → 显示结果
  const handleExecutionComplete = useCallback((results: ExperimentResults) => {
    workflow.setExperimentResults(results);
    workflow.setPhase('complete');
    setAssistantMode('chat');
    addAIMessage(
      `实验完成！以下是 ${workflow.requirements.materialName} 动态${
        workflow.requirements.testType === 'compression' ? '压缩' :
        workflow.requirements.testType === 'tension' ? '拉伸' : '剪切'
      }测试结果：`,
      'results',
      results
    );
  }, [workflow, addAIMessage, setAssistantMode]);

  // 处理用户输入
  const handleUserInput = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      text,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');

    // 意图识别
    const intent = detectIntent(text);

    if (intent === 'startExperiment') {
      setAssistantMode('experiment');
      workflow.startWorkflow();
      addAIMessage('好的，让我们开始配置实验。请按步骤选择实验参数：', 'inquiry');
      return;
    }

    if (intent === 'stopExperiment') {
      workflow.resetWorkflow();
      setAssistantMode('chat');
      addAIMessage('实验已停止。如需重新开始，请说"开始实验"。');
      return;
    }

    if (intent === 'safetyCheck') {
      if (workflow.phase === 'idle') {
        addAIMessage('请先启动实验流程（说"开始实验"），设置参数后系统会自动执行安全检查。');
      } else {
        workflow.setPhase('safetyCheck');
        addAIMessage('正在执行安全检查...', 'safetyCheck');
      }
      return;
    }

    // 普通聊天
    setIsLoading(true);
    try {
      // 1. 先查本地知识库
      const localAnswer = findAnswer(text);
      if (localAnswer) {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'ai',
          text: localAnswer,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, aiMessage]);
        speakTextRef.current(localAnswer);
        setIsLoading(false);
        return;
      }

      // 2. 尝试LLM流式输出（打字机效果）
      if (isLLMConfigured()) {
        const streamMsgId = (Date.now() + 1).toString();
        setMessages(prev => [...prev, {
          id: streamMsgId,
          type: 'ai' as const,
          text: '',
          timestamp: Date.now(),
        }]);
        setIsLoading(false);

        const fullText = await chatWithLLMStream(text, (_chunk, accumulated) => {
          setMessages(prev => prev.map(m =>
            m.id === streamMsgId ? { ...m, text: accumulated } : m
          ));
        });

        // 流式失败，降级为非流式
        if (!fullText) {
          const nonStreamAnswer = await callLLMAPI(text);
          if (nonStreamAnswer) {
            setMessages(prev => prev.map(m =>
              m.id === streamMsgId ? { ...m, text: nonStreamAnswer } : m
            ));
            speakTextRef.current(nonStreamAnswer);
          } else {
            // LLM也失败，使用兜底回复
            const fallback = '抱歉，我暂时无法回答这个问题。您可以尝试询问以下方面：\n• 电磁驱动霍普金森杆系统介绍\n• AI三级闭环算法\n• 材料测试方法\n• 虚拟实验室使用\n• 系统监控和预警\n\n您也可以说"开始实验"来启动自动实验流程。';
            setMessages(prev => prev.map(m =>
              m.id === streamMsgId ? { ...m, text: fallback } : m
            ));
          }
        } else {
          speakTextRef.current(fullText);
        }
        return;
      }

      // 3. LLM未配置，使用兜底回复
      const fallbackAnswer = '抱歉，我暂时无法回答这个问题。您可以尝试询问以下方面：\n• 电磁驱动霍普金森杆系统介绍\n• AI三级闭环算法\n• 材料测试方法\n• 虚拟实验室使用\n• 系统监控和预警\n\n您也可以说"开始实验"来启动自动实验流程。';
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        text: fallbackAnswer,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('获取回答失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 语音合成
  const speakText = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = speechRate;
      utterance.pitch = speechPitch;

      if (selectedVoice) {
        const voice = window.speechSynthesis.getVoices().find(v => v.voiceURI === selectedVoice.voiceURI);
        if (voice) utterance.voice = voice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  }, [speechRate, speechPitch, selectedVoice]);

  // 同步ref
  useEffect(() => {
    speakTextRef.current = speakText;
  }, [speakText]);

  const toggleListening = () => {
    if (!recognitionRef.current) initSpeechRecognition();
    if (isListening) recognitionRef.current?.stop();
    else recognitionRef.current?.start();
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const sampleQuestions = [
    '开始实验',
    '什么是电磁驱动霍普金森杆？',
    'AI三级闭环算法是什么？',
    '系统支持哪些材料测试？',
    '虚拟实验室怎么用？',
  ];

  return (
    <div className="w-[450px] h-[600px] bg-[#0A2540]/95 backdrop-blur-xl rounded-2xl border border-[#00F5FF]/30 shadow-2xl shadow-[#00F5FF]/10 flex flex-col overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-[#00F5FF]/20 bg-gradient-to-r from-[#00F5FF]/10 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#00F5FF] to-[#0080FF] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-[#0A2540]" />
          </div>
          <div>
            <h3 className="text-white font-semibold">AI技术助手</h3>
            <p className="text-xs text-white/50">
              {isListening ? '正在聆听...' : isLoading ? 'AI思考中...' : isSpeaking ? '正在播报...' : (
                isLLMConfigured()
                  ? `${getLLMProviderName()} · 已连接`
                  : '知识库问答 · 实验引导'
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
          {isSpeaking && (
            <button
              onClick={stopSpeaking}
              className="w-8 h-8 rounded-full bg-[#00F5FF]/20 flex items-center justify-center animate-pulse"
            >
              <VolumeX className="w-4 h-4 text-[#00F5FF]" />
            </button>
          )}
        </div>
      </div>

      {/* 设置面板 */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-[#00F5FF]/20 bg-[#051020]/50 overflow-hidden"
          >
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs text-white/50 mb-2 block">选择音色</label>
                <div className="relative">
                  <select
                    value={selectedVoice?.voiceURI || ''}
                    onChange={(e) => {
                      const voice = voices.find(v => v.voiceURI === e.target.value);
                      setSelectedVoice(voice || null);
                    }}
                    className="w-full bg-[#0A2540] border border-[#00F5FF]/30 rounded-lg px-3 py-2 text-sm text-white appearance-none"
                  >
                    {voices.map(voice => (
                      <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-white/50 mb-1">
                  <span>语速</span>
                  <span>{speechRate.toFixed(1)}x</span>
                </div>
                <input type="range" min="0.5" max="2" step="0.1" value={speechRate}
                  onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                  className="w-full h-2 bg-[#0A2540] rounded-lg appearance-none cursor-pointer accent-[#00F5FF]" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-white/50 mb-1">
                  <span>音调</span>
                  <span>{speechPitch.toFixed(1)}</span>
                </div>
                <input type="range" min="0.5" max="2" step="0.1" value={speechPitch}
                  onChange={(e) => setSpeechPitch(parseFloat(e.target.value))}
                  className="w-full h-2 bg-[#0A2540] rounded-lg appearance-none cursor-pointer accent-[#00F5FF]" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-white/40 py-8">
            <div className="w-16 h-16 rounded-full bg-[#00F5FF]/10 flex items-center justify-center mx-auto mb-4">
              <Bot className="w-8 h-8 text-[#00F5FF]" />
            </div>
            <p className="mb-2 text-lg text-white/60">您好！我是AI技术助手</p>
            <p className="text-sm">可以问我关于电磁驱动霍普金森杆的任何问题</p>
            <p className="text-xs text-[#00F5FF]/60 mt-1">说"开始实验"启动自动实验流程</p>
            <div className="mt-6 space-y-2">
              <p className="text-xs text-white/30 mb-3">试试这些问题：</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {sampleQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleUserInput(q)}
                    className="px-3 py-1.5 text-xs bg-[#00F5FF]/10 border border-[#00F5FF]/30 rounded-full text-[#00F5FF] hover:bg-[#00F5FF]/20 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex items-start gap-2 ${msg.widget ? 'max-w-[95%]' : 'max-w-[85%]'} ${msg.type === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                msg.type === 'user' ? 'bg-[#00F5FF]/20' : 'bg-gradient-to-r from-[#00F5FF] to-[#0080FF]'
              }`}>
                {msg.type === 'user' ? <User className="w-4 h-4 text-[#00F5FF]" /> : <Bot className="w-4 h-4 text-[#0A2540]" />}
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className={`p-3 rounded-2xl text-sm whitespace-pre-wrap ${
                  msg.type === 'user'
                    ? 'bg-[#00F5FF] text-[#0A2540] rounded-br-md'
                    : 'bg-white/10 text-white rounded-bl-md border border-white/10'
                }`}>
                  {msg.text}
                </div>

                {/* 嵌入式组件 */}
                {msg.widget === 'inquiry' && (
                  <AIInquiryFlow onComplete={handleInquiryComplete} />
                )}
                {msg.widget === 'safetyCheck' && (
                  <SafetyCheckPanel onComplete={handleSafetyCheckComplete} />
                )}
                {msg.widget === 'execution' && (
                  <ExperimentExecutionPanel onComplete={handleExecutionComplete} />
                )}
                {msg.widget === 'results' && msg.results && (
                  <ExperimentResultsCard results={msg.results} />
                )}
              </div>
            </div>
          </motion.div>
        ))}

        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="flex items-start gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#00F5FF] to-[#0080FF] flex items-center justify-center">
                <Bot className="w-4 h-4 text-[#0A2540]" />
              </div>
              <div className="p-3 rounded-2xl bg-white/10 text-white rounded-bl-md border border-white/10">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-[#00F5FF] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-[#00F5FF] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-[#00F5FF] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="p-4 border-t border-[#00F5FF]/20 bg-[#051020]/50">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputText.trim() && !isLoading) {
                handleUserInput(inputText);
              }
            }}
            placeholder="输入问题或点击麦克风..."
            disabled={isLoading}
            className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#00F5FF]/50 disabled:opacity-50"
          />
          <button
            onClick={() => inputText.trim() && !isLoading && handleUserInput(inputText)}
            disabled={!inputText.trim() || isLoading}
            className="w-10 h-10 rounded-full bg-[#00F5FF] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#00F5FF]/90 transition-colors"
          >
            <Send className="w-4 h-4 text-[#0A2540]" />
          </button>
          <button
            onClick={toggleListening}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              isListening ? 'bg-red-500 animate-pulse' : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4 text-white" />}
          </button>
        </div>
        {isListening && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-xs text-[#00F5FF] mt-2">
            正在聆听，请说话...
          </motion.p>
        )}
      </div>
    </div>
  );
}
