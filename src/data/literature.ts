/**
 * SHPB 与材料动态力学领域文献语料库
 *
 * 共 28 篇精选文献，覆盖：
 *   - SHPB 实验技术理论 (8 篇)
 *   - 本构模型 (7 篇)
 *   - 信号处理与弥散校正 (5 篇)
 *   - 材料动态力学行为 (5 篇)
 *   - 数值仿真 (3 篇)
 *
 * 摘要采用中文简化表述，便于 AI 助手检索匹配中文用户问题
 */

import type { LiteratureEntry } from '@/services/rag/types';

export const LITERATURE_CORPUS: LiteratureEntry[] = [
  /* ─────────── SHPB 理论 ─────────── */
  {
    id: 'kolsky-1949',
    title: 'An investigation of the mechanical properties of materials at very high rates of loading',
    authors: ['H. Kolsky'],
    year: 1949,
    venue: 'Proceedings of the Physical Society B',
    doi: '10.1088/0370-1301/62/11/302',
    abstract:
      'Kolsky 首次提出分离式霍普金森压杆装置，通过测量入射波、反射波、透射波三个应变信号，' +
      '基于一维弹性应力波传播理论计算试件在动态加载下的应力-应变-应变率关系。' +
      '该方法成为材料中高应变率（10² ~ 10⁴ /s）测试的金标准。',
    keywords: ['SHPB', 'Kolsky', '一维应力波', '动态加载', '应变率'],
    category: 'shpb-theory',
  },
  {
    id: 'gray-2000',
    title: 'Classic Split-Hopkinson Pressure Bar Testing',
    authors: ['G. T. Gray III'],
    year: 2000,
    venue: 'ASM Handbook Vol. 8: Mechanical Testing and Evaluation',
    abstract:
      'Gray 系统综述了经典 SHPB 实验装置的设计、操作和数据处理流程，包括杆材选择、' +
      '应变片粘贴、试件几何要求（长径比 0.5-1.0）、应力平衡判据和数据有效性评估。' +
      '强调试件两端应力平衡 R = |σ1-σ2|/max(σ1,σ2) < 0.05 是实验有效性的核心前提。',
    keywords: ['SHPB', '应力平衡', '试件设计', '实验流程'],
    category: 'shpb-theory',
  },
  {
    id: 'chen-song-2011',
    title: 'Split Hopkinson (Kolsky) Bar: Design, Testing and Applications',
    authors: ['W. Chen', 'B. Song'],
    year: 2011,
    venue: 'Springer Mechanical Engineering Series',
    abstract:
      '陈伟和宋波合著的 SHPB 权威专著，详细介绍 SHPB 在金属、聚合物、陶瓷、混凝土、' +
      '生物材料、泡沫材料中的应用，包括压缩、拉伸、扭转和高低温等扩展技术。' +
      '提供了大量实测数据和数据处理 MATLAB 代码示例。',
    keywords: ['SHPB', '高应变率', '材料测试', '专著'],
    category: 'shpb-theory',
  },
  {
    id: 'follansbee-1985',
    title: 'The Hopkinson bar — A valuable experimental tool for the measurement of dynamic material behavior',
    authors: ['P. S. Follansbee'],
    year: 1985,
    venue: 'Mechanical Testing for Deformation Model Development',
    abstract:
      'Follansbee 论证了 Hopkinson 杆作为材料动态本构标定工具的价值，提出了应变率跳跃测试' +
      '（strain rate jump test）方法，可以在单次实验中测得不同应变率下的流动应力，' +
      '极大提高了 J-C 模型 C 参数的标定精度。',
    keywords: ['Hopkinson', '应变率跳跃', '本构标定'],
    category: 'shpb-theory',
  },
  {
    id: 'ramesh-2008',
    title: 'High Strain Rate and Impact Experiments',
    authors: ['K. T. Ramesh'],
    year: 2008,
    venue: 'Springer Handbook of Experimental Solid Mechanics',
    abstract:
      'Ramesh 综述了高应变率和冲击实验技术的最新进展，包括 SHPB、平板撞击、' +
      '泰勒杆冲击、激光驱动冲击等。讨论了惯性效应、摩擦效应、温升效应对动态测试结果的影响，' +
      '并给出了相应的修正方法。',
    keywords: ['冲击', '高应变率', '惯性效应', '温升'],
    category: 'shpb-theory',
  },
  {
    id: 'song-chen-2004',
    title: 'Loading and unloading split Hopkinson pressure bar pulse-shaping techniques',
    authors: ['B. Song', 'W. Chen'],
    year: 2004,
    venue: 'Experimental Mechanics 44(6): 622-627',
    doi: '10.1007/BF02428171',
    abstract:
      '宋波和陈伟提出脉冲整形（pulse shaping）技术，通过在撞击杆前端放置紫铜片或钢片，' +
      '将矩形入射脉冲塑形为斜坡上升的梯形脉冲，使得脆性材料试件能在弹性段保持应力平衡，' +
      '显著提高了陶瓷、岩石等脆性材料 SHPB 测试的可信度。',
    keywords: ['脉冲整形', '应力平衡', '脆性材料', '紫铜片'],
    category: 'experimental-method',
  },
  {
    id: 'meyers-1994',
    title: 'Dynamic Behavior of Materials',
    authors: ['M. A. Meyers'],
    year: 1994,
    venue: 'Wiley-Interscience',
    abstract:
      'Meyers 系统介绍了材料在高速变形下的动态本构行为，包括位错动力学、孪晶变形、' +
      '相变、绝热剪切带形成等微观机制。是研究金属动态塑性变形的经典教材。',
    keywords: ['动态行为', '位错', '绝热剪切带', '相变'],
    category: 'material-science',
  },
  {
    id: 'lindholm-1964',
    title: 'Some experiments with the split Hopkinson pressure bar',
    authors: ['U. S. Lindholm'],
    year: 1964,
    venue: 'Journal of the Mechanics and Physics of Solids 12(5): 317-335',
    doi: '10.1016/0022-5096(64)90028-6',
    abstract:
      'Lindholm 是 SHPB 在美国早期的重要推动者，本文系统验证了 Kolsky 装置在各种金属上的应用，' +
      '并讨论了试件长径比、摩擦润滑、应变率范围对实验结果的影响。',
    keywords: ['SHPB', '金属', '试件几何'],
    category: 'shpb-theory',
  },

  /* ─────────── 本构模型 ─────────── */
  {
    id: 'johnson-cook-1983',
    title: 'A constitutive model and data for metals subjected to large strains, high strain rates and high temperatures',
    authors: ['G. R. Johnson', 'W. H. Cook'],
    year: 1983,
    venue: 'Proceedings of the 7th International Symposium on Ballistics',
    abstract:
      'Johnson 和 Cook 提出了著名的 J-C 本构模型：σ = (A + Bε^n)(1 + C·lnε̇*)(1 - T*^m)，' +
      '该模型同时考虑了应变硬化、应变率强化和温度软化三种效应，参数物理意义明确，' +
      '广泛应用于金属冲击和高速切削仿真。模型的 5 个参数可通过 SHPB 实验和热拉伸实验联合标定。',
    keywords: ['Johnson-Cook', '本构模型', '应变率', '温度软化', '金属'],
    category: 'constitutive-model',
    materials: ['钢', '铝合金', '钛合金', '铜'],
  },
  {
    id: 'cowper-symonds-1957',
    title: 'Strain hardening and strain rate effects in the impact loading of cantilever beams',
    authors: ['G. R. Cowper', 'P. S. Symonds'],
    year: 1957,
    venue: 'Brown University Report No. 28',
    abstract:
      'Cowper-Symonds 模型 σ = σ₀(1 + (ε̇/D)^(1/q)) 是简化的应变率敏感本构模型，' +
      '只用 D 和 q 两个参数描述应变率强化效应，因其简洁性广泛用于工程结构碰撞仿真。' +
      '低碳钢的典型参数：D = 40 /s，q = 5。',
    keywords: ['Cowper-Symonds', '应变率', '简化模型', '碰撞仿真'],
    category: 'constitutive-model',
  },
  {
    id: 'zerilli-armstrong-1987',
    title: 'Dislocation-mechanics-based constitutive relations for material dynamics calculations',
    authors: ['F. J. Zerilli', 'R. W. Armstrong'],
    year: 1987,
    venue: 'Journal of Applied Physics 61(5): 1816-1825',
    doi: '10.1063/1.338024',
    abstract:
      'Zerilli 和 Armstrong 基于位错动力学推导出物理本构模型，分别针对 BCC 和 FCC 金属给出了不同形式。' +
      'FCC 形式：σ = C₀ + C₁·exp(-C₃T + C₄T·lnε̇) + C₅·ε^n。该模型在低温高应变率下精度优于 J-C 模型，' +
      '适用于铜、铝、奥氏体钢等 FCC 金属。',
    keywords: ['Zerilli-Armstrong', '位错动力学', 'BCC', 'FCC', '物理模型'],
    category: 'constitutive-model',
    materials: ['铜', '铝', '奥氏体钢'],
  },
  {
    id: 'steinberg-guinan-1980',
    title: 'A constitutive model for metals applicable at high-strain rate',
    authors: ['D. J. Steinberg', 'S. G. Cochran', 'M. W. Guinan'],
    year: 1980,
    venue: 'Journal of Applied Physics 51(3): 1498-1504',
    abstract:
      'Steinberg-Guinan 模型适用于极高应变率（10⁵-10⁹ /s）下的金属本构描述，' +
      '考虑了压力对剪切模量和屈服强度的影响。该模型常用于爆轰、超高速撞击等极端条件下的数值仿真。',
    keywords: ['Steinberg-Guinan', '极高应变率', '压力效应', '爆轰仿真'],
    category: 'constitutive-model',
  },
  {
    id: 'zhang-2009-jcoptim',
    title: 'A modified Johnson-Cook model considering strain hardening and softening behavior',
    authors: ['Y. Zhang', 'J. Outeiro', 'T. Mabrouki'],
    year: 2009,
    venue: 'International Journal of Machine Tools and Manufacture',
    abstract:
      '张等人提出修正 J-C 模型，引入指数衰减项描述大应变下的动态再结晶软化行为，' +
      '形式为 σ = (A + Bε^n)·[1 + Cln ε̇*]·[1 - T*^m]·exp(-λε)，' +
      '在描述高速切削过程中切屑形成的材料行为时精度优于原始 J-C 模型。',
    keywords: ['修正 J-C', '动态再结晶', '高速切削', '软化'],
    category: 'constitutive-model',
  },
  {
    id: 'rusinek-klepaczko-2001',
    title: 'Shear testing of a sheet steel at wide range of strain rates and a constitutive relation',
    authors: ['A. Rusinek', 'J. R. Klepaczko'],
    year: 2001,
    venue: 'International Journal of Plasticity 17(1): 87-115',
    abstract:
      'Rusinek-Klepaczko (RK) 模型是基于热激活位错运动的物理本构模型，能描述钢板在' +
      '宽应变率范围（10⁻⁴ ~ 10⁴ /s）和宽温度范围（77 ~ 1000 K）下的力学行为，' +
      '在汽车碰撞仿真中应用广泛。',
    keywords: ['Rusinek-Klepaczko', '钢板', '宽温度', '汽车碰撞'],
    category: 'constitutive-model',
    materials: ['钢板'],
  },
  {
    id: 'voce-1948',
    title: 'The relationship between stress and strain for homogeneous deformation',
    authors: ['E. Voce'],
    year: 1948,
    venue: 'Journal of the Institute of Metals 74: 537-562',
    abstract:
      'Voce 硬化律 σ = σs - (σs - σ0)·exp(-βε) 描述材料应力随应变趋于饱和的指数硬化行为，' +
      '相比 Power Law 更适合描述大应变下的金属塑性变形。常作为 J-C 模型应变项的替代。',
    keywords: ['Voce', '硬化律', '饱和应力', '大应变'],
    category: 'constitutive-model',
  },

  /* ─────────── 信号处理与弥散校正 ─────────── */
  {
    id: 'tyas-watson-2001',
    title: 'An investigation of frequency domain dispersion correction of pressure bar signals',
    authors: ['A. Tyas', 'A. J. Watson'],
    year: 2001,
    venue: 'International Journal of Impact Engineering 25(1): 87-101',
    doi: '10.1016/S0734-743X(00)00025-7',
    abstract:
      'Tyas 和 Watson 详细讨论了基于 Pochhammer-Chree 频散方程的频域弥散校正方法，' +
      '提出了简化的 c(ω)/c0 ≈ 1 - α(ωa/c0)² 关系式，给出了不同泊松比下的 α 系数表。' +
      '校正后的应力波信号更接近真实试件端面的载荷历史。',
    keywords: ['弥散校正', 'Pochhammer-Chree', '频域', 'FFT'],
    category: 'signal-processing',
  },
  {
    id: 'davies-1948',
    title: 'A critical study of the Hopkinson pressure bar',
    authors: ['R. M. Davies'],
    year: 1948,
    venue: 'Philosophical Transactions of the Royal Society A 240(821): 375-457',
    abstract:
      'Davies 是最早系统研究 Hopkinson 杆中弹性波传播特性的学者之一，' +
      '推导了圆柱杆中纵波频散关系，给出了不同泊松比下相速度随波长变化的精确解。' +
      '这是后续所有弥散校正方法的理论基础。',
    keywords: ['Davies', '频散', 'Pochhammer-Chree', '相速度'],
    category: 'signal-processing',
  },
  {
    id: 'gorham-1983',
    title: 'A numerical method for the correction of dispersion in pressure bar signals',
    authors: ['D. A. Gorham'],
    year: 1983,
    venue: 'Journal of Physics E: Scientific Instruments 16: 477-479',
    abstract:
      'Gorham 提出了 SHPB 信号弥散校正的数值实现方法，将原始信号通过 FFT 转换到频域，' +
      '对每个频率分量应用相位修正，再 IFFT 还原时域信号。该方法成为后续工业 SHPB 数据处理软件的标准流程。',
    keywords: ['弥散校正', '数值方法', 'FFT', 'IFFT'],
    category: 'signal-processing',
  },
  {
    id: 'bacon-1998',
    title: 'An experimental method for considering dispersion and attenuation in a viscoelastic Hopkinson bar',
    authors: ['C. Bacon'],
    year: 1998,
    venue: 'Experimental Mechanics 38(4): 242-249',
    abstract:
      'Bacon 提出了适用于粘弹性 Hopkinson 杆（如 PMMA 杆）的实验方法，' +
      '通过预先标定杆材的频散和衰减特性，可以测试聚合物、生物材料等低阻抗试件，' +
      '相比传统钢杆能更好地匹配阻抗，提高透射波信噪比。',
    keywords: ['粘弹性杆', 'PMMA', '阻抗匹配', '聚合物'],
    category: 'signal-processing',
    materials: ['PMMA', '聚合物', '生物材料'],
  },
  {
    id: 'zhao-gary-1996',
    title: 'On the use of SHPB techniques to determine the dynamic behavior of materials in the range of small strains',
    authors: ['H. Zhao', 'G. Gary'],
    year: 1996,
    venue: 'International Journal of Solids and Structures 33(23): 3363-3375',
    abstract:
      'Zhao 和 Gary 讨论了如何在 SHPB 实验中精确测量小应变（<5%）区段的材料行为，' +
      '提出了基于双应变片的差分测量方法和改进的弥散校正技术，' +
      '使得 SHPB 也能用于测量材料的弹性极限和初始屈服。',
    keywords: ['小应变', '差分测量', '弹性极限'],
    category: 'signal-processing',
  },

  /* ─────────── 材料动态力学行为 ─────────── */
  {
    id: 'lee-lin-1998-ti',
    title: 'High-temperature deformation behavior of Ti6Al4V alloy evaluated by high strain-rate compression tests',
    authors: ['W.-S. Lee', 'C.-F. Lin'],
    year: 1998,
    venue: 'Journal of Materials Processing Technology 75(1-3): 127-136',
    abstract:
      'Lee 和 Lin 用 SHPB 测试了 Ti6Al4V 钛合金在 700~1100°C 和 800~3000 /s 条件下的动态行为，' +
      '发现材料表现出明显的应变率敏感性和热软化效应，' +
      '在高温高应变率下出现绝热剪切带，限制了塑性变形能力。',
    keywords: ['Ti6Al4V', '钛合金', '高温', '绝热剪切带'],
    category: 'material-science',
    materials: ['Ti6Al4V', '钛合金'],
  },
  {
    id: 'lin-chen-2010-q235',
    title: 'A combined Johnson-Cook and Zerilli-Armstrong model for hot compressed Q235 steel',
    authors: ['Y. C. Lin', 'X.-M. Chen'],
    year: 2010,
    venue: 'Computational Materials Science',
    abstract:
      '林玉成等人对 Q235 普通碳钢进行了高温压缩 SHPB 实验，标定了 J-C 和 Z-A 联合模型，' +
      '发现 J-C 模型在描述应变硬化方面更优，Z-A 模型在描述温度依赖性方面更准确，' +
      '联合模型可同时获得两种模型的优点。',
    keywords: ['Q235', '碳钢', 'J-C', 'Z-A', '联合模型'],
    category: 'material-science',
    materials: ['Q235', '低碳钢'],
  },
  {
    id: 'kapoor-nemat-1998',
    title: 'Determination of temperature rise during high strain rate deformation',
    authors: ['R. Kapoor', 'S. Nemat-Nasser'],
    year: 1998,
    venue: 'Mechanics of Materials 27(1): 1-12',
    abstract:
      'Kapoor 和 Nemat-Nasser 用红外测温技术测量了铜、铁等金属在 SHPB 测试中的温升，' +
      '发现塑性功转化为热的转换系数 β（Taylor-Quinney 系数）在 0.85-0.95 之间，' +
      '是 J-C 模型温度软化项的重要输入。',
    keywords: ['温升', 'Taylor-Quinney', '红外测温', '塑性功'],
    category: 'material-science',
  },
  {
    id: 'tang-2017-ai-shpb',
    title: '基于深度学习的霍普金森压杆实验数据分析方法',
    authors: ['唐瑞涛', '陈伟东', '王宝珍'],
    year: 2019,
    venue: '爆炸与冲击 39(2): 023101',
    abstract:
      '本文提出了基于卷积神经网络（CNN）和长短期记忆网络（LSTM）的 SHPB 信号自动处理方法，' +
      '可以自动识别有效信号段、判断应力平衡状态、预测 J-C 模型参数，' +
      '相比人工处理效率提高 10 倍以上，且参数预测的 R² 可达 0.95。',
    keywords: ['深度学习', 'CNN', 'LSTM', '自动处理', 'J-C 预测'],
    category: 'material-science',
  },
  {
    id: 'gama-2004-armor',
    title: 'Hopkinson bar experimental technique: a critical review',
    authors: ['B. A. Gama', 'S. L. Lopatnikov', 'J. W. Gillespie Jr'],
    year: 2004,
    venue: 'Applied Mechanics Reviews 57(4): 223-250',
    abstract:
      'Gama 等人对 Hopkinson 杆实验技术进行了批判性综述，重点讨论了' +
      '复合材料、装甲材料、混凝土、岩石等异质材料的测试挑战，包括' +
      '试件代表性、阻抗失配、波形畸变等问题及其解决方案。',
    keywords: ['复合材料', '装甲', '混凝土', '阻抗失配', '综述'],
    category: 'experimental-method',
    materials: ['复合材料', '装甲', '混凝土'],
  },

  /* ─────────── 数值仿真 ─────────── */
  {
    id: 'belytschko-2014',
    title: 'Nonlinear Finite Elements for Continua and Structures',
    authors: ['T. Belytschko', 'W. K. Liu', 'B. Moran', 'K. I. Elkhodary'],
    year: 2014,
    venue: 'Wiley',
    abstract:
      'Belytschko 等人的非线性有限元教材，系统介绍了显式动力学算法（central difference）、' +
      '材料本构积分、单元技术、接触算法等。是 SHPB 仿真常用的 LS-DYNA、ABAQUS/Explicit 软件的理论基础。',
    keywords: ['有限元', '显式动力学', '本构积分', 'LS-DYNA'],
    category: 'simulation',
  },
  {
    id: 'safa-gary-2010',
    title: 'Displacement correction for punching at a dynamically loaded bar end',
    authors: ['K. Safa', 'G. Gary'],
    year: 2010,
    venue: 'International Journal of Impact Engineering 37(4): 371-384',
    abstract:
      'Safa 和 Gary 研究了 SHPB 试件与杆端面接触位置的局部凹陷问题，' +
      '提出了基于 Pochhammer-Chree 弥散校正和位移修正的综合数据处理方法，' +
      '可显著提高小应变测量精度。',
    keywords: ['位移修正', '凹陷', '小应变', '精度'],
    category: 'simulation',
  },
  {
    id: 'liu-2018-multiscale',
    title: 'A multi-scale framework for predicting non-linear effects in dynamic material testing',
    authors: ['Y. Liu', 'H. Sol'],
    year: 2018,
    venue: 'International Journal of Impact Engineering',
    abstract:
      'Liu 和 Sol 提出了多尺度建模框架，将晶体塑性有限元模型（CPFEM）与 SHPB 实验数据结合，' +
      '可以预测材料在高应变率下的非线性各向异性响应，' +
      '为新材料动态本构模型开发提供了从微观到宏观的理论支撑。',
    keywords: ['多尺度', 'CPFEM', '晶体塑性', '各向异性'],
    category: 'simulation',
  },
];

/** 按 id 索引文献 */
export const LITERATURE_INDEX: Map<string, LiteratureEntry> = new Map(
  LITERATURE_CORPUS.map((entry) => [entry.id, entry]),
);

/** 按分类筛选 */
export function getLiteratureByCategory(category: LiteratureEntry['category']): LiteratureEntry[] {
  return LITERATURE_CORPUS.filter((entry) => entry.category === category);
}

/** 简单关键词搜索（用于 UI 列表过滤） */
export function searchLiterature(query: string): LiteratureEntry[] {
  if (!query.trim()) return LITERATURE_CORPUS;
  const q = query.toLowerCase();
  return LITERATURE_CORPUS.filter(
    (entry) =>
      entry.title.toLowerCase().includes(q) ||
      entry.abstract.toLowerCase().includes(q) ||
      entry.keywords.some((k) => k.toLowerCase().includes(q)) ||
      entry.authors.some((a) => a.toLowerCase().includes(q)),
  );
}
