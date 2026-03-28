// src/features/teaching-system/knowledgeData.ts
// 霍普金森杆实验知识体系 — 知识图谱 + 学习路径 + 测验题库

// ═══════════════════════════════════════════════
// 知识图谱节点
// ═══════════════════════════════════════════════

export interface KnowledgeNode {
  id: string;
  title: string;
  subtitle?: string;
  category: 'fundamental' | 'equipment' | 'theory' | 'operation' | 'analysis' | 'advanced';
  level: 1 | 2 | 3; // 1=基础 2=进阶 3=高级
  content: string; // Markdown content
  keyFormulas?: string[];
  connections: string[]; // IDs of connected nodes
  estimatedMinutes: number;
}

export const CATEGORY_META: Record<string, { label: string; color: string; icon: string }> = {
  fundamental: { label: '基础原理', color: '#3B82F6', icon: '📐' },
  equipment: { label: '实验设备', color: '#10B981', icon: '🔧' },
  theory: { label: '理论模型', color: '#8B5CF6', icon: '📊' },
  operation: { label: '实验操作', color: '#F59E0B', icon: '⚙️' },
  analysis: { label: '数据分析', color: '#EF4444', icon: '📈' },
  advanced: { label: '前沿拓展', color: '#EC4899', icon: '🚀' },
};

export const KNOWLEDGE_NODES: KnowledgeNode[] = [
  // ─── 基础原理 ───
  {
    id: 'stress-wave',
    title: '应力波基础',
    subtitle: 'Stress Wave Fundamentals',
    category: 'fundamental',
    level: 1,
    content: `## 应力波基础

当固体材料受到快速冲击载荷时，变形不会瞬间传遍整个物体，而是以**应力波**的形式从加载点向外传播。

### 核心概念
- **纵波（P波）**：质点振动方向与波传播方向相同，也叫压缩波
- **横波（S波）**：质点振动方向与波传播方向垂直
- **波速**：c = √(E/ρ)，E为弹性模量，ρ为密度
- **波阻抗**：Z = ρc = √(Eρ)，决定波在界面处的反射/透射

### 钢杆中的波速
对于典型钢材（E=200GPa, ρ=7800kg/m³）：
**c = √(200×10⁹/7800) ≈ 5064 m/s**`,
    keyFormulas: ['c = √(E/ρ)', 'Z = ρc'],
    connections: ['one-d-wave', 'impedance-match', 'shpb-principle'],
    estimatedMinutes: 8,
  },
  {
    id: 'one-d-wave',
    title: '一维应力波理论',
    subtitle: 'One-Dimensional Wave Theory',
    category: 'fundamental',
    level: 1,
    content: `## 一维应力波理论

SHPB实验的理论基础是**一维应力波假设**：

### 基本假设
1. 杆件足够细长（L/D > 20），横向惯性效应可忽略
2. 杆内应力均匀分布在横截面上
3. 杆件处于弹性状态
4. 界面间无摩擦

### 波动方程
$$\\frac{\\partial^2 u}{\\partial t^2} = c^2 \\frac{\\partial^2 u}{\\partial x^2}$$

### 达朗贝尔解
$$u(x,t) = f(x - ct) + g(x + ct)$$

其中 f 为右行波，g 为左行波。`,
    keyFormulas: ['∂²u/∂t² = c²·∂²u/∂x²', 'u(x,t) = f(x-ct) + g(x+ct)'],
    connections: ['stress-wave', 'shpb-principle', 'three-wave'],
    estimatedMinutes: 12,
  },
  {
    id: 'strain-rate',
    title: '应变率效应',
    subtitle: 'Strain Rate Effects',
    category: 'fundamental',
    level: 1,
    content: `## 应变率效应

材料的力学行为随加载速率变化而显著改变：

### 应变率范围
| 范围 (/s) | 类型 | 测试方法 |
|-----------|------|----------|
| 10⁻⁵ ~ 10⁻¹ | 准静态 | 万能试验机 |
| 10⁻¹ ~ 10² | 中应变率 | 落锤、液压 |
| **10² ~ 10⁴** | **高应变率** | **SHPB** |
| 10⁴ ~ 10⁶ | 超高应变率 | 平板撞击 |

### 应变率敏感性
多数金属材料在高应变率下表现出：
- **流动应力升高**（应变率强化）
- **失效应变降低**（脆性倾向）
- **绝热温升**（来不及散热）`,
    keyFormulas: ['ε̇ = dε/dt', 'σ_d/σ_s = 1 + C·ln(ε̇/ε̇₀)'],
    connections: ['johnson-cook', 'shpb-principle', 'dynamic-mechanics'],
    estimatedMinutes: 10,
  },

  // ─── 实验设备 ───
  {
    id: 'shpb-principle',
    title: 'SHPB实验原理',
    subtitle: 'Split Hopkinson Pressure Bar',
    category: 'equipment',
    level: 1,
    content: `## 分离式霍普金森压杆 (SHPB)

### 系统组成
1. **撞击杆（Striker Bar）**：产生应力脉冲
2. **入射杆（Incident Bar）**：传导入射波和反射波
3. **透射杆（Transmitted Bar）**：传导透射波
4. **试样（Specimen）**：夹在入射杆和透射杆之间

### 工作流程
1. 撞击杆高速撞击入射杆端面
2. 产生入射压缩脉冲 σᵢ
3. 脉冲到达试样界面，部分反射（σᵣ），部分透射（σₜ）
4. 通过应变片记录三波信号
5. 由三波公式计算试样应力-应变关系

### 脉冲持续时间
$$T = 2L_s / c_s$$
其中 Ls 为撞击杆长度，cs 为杆中波速`,
    keyFormulas: ['T = 2L_s/c_s'],
    connections: ['stress-wave', 'one-d-wave', 'three-wave', 'em-drive', 'strain-gauge'],
    estimatedMinutes: 15,
  },
  {
    id: 'em-drive',
    title: '电磁驱动原理',
    subtitle: 'Electromagnetic Drive System',
    category: 'equipment',
    level: 2,
    content: `## 电磁驱动系统

本系统采用**电磁驱动**替代传统气炮，具有精确可控的优势。

### RLC充放电回路
电容器组储能后通过可控硅触发放电，产生脉冲大电流。

$$i(t) = \\frac{U_0}{\\omega L} e^{-\\alpha t} \\sin(\\omega t)$$

### 三级电磁线圈
- 锥形次级线圈设计，提高能量转换效率
- 三级顺序激励，实现多级加速
- 电磁力：**F = μ₀NI²A/(2δ²)**

### 优势
- 速度可调范围宽（5-50 m/s）
- 重复性好（<2%偏差）
- 无需压缩气体，更安全
- 波形可编程调控`,
    keyFormulas: ['F = μ₀NI²A/(2δ²)', 'E = ½CU²'],
    connections: ['shpb-principle', 'capacitor-bank', 'waveform-control'],
    estimatedMinutes: 12,
  },
  {
    id: 'capacitor-bank',
    title: '电容器储能系统',
    subtitle: 'Capacitor Energy Storage',
    category: 'equipment',
    level: 2,
    content: `## 电容器储能系统

### 基本参数
- 电容量：C = 3μF（8个电容单元并联）
- 最大电压：4000V
- 最大储能：E = ½CU² = 24kJ
- 安全阈值：36kJ

### 充电过程
充电时间常数 τ = RC，典型充电时间2-5秒。

### 安全保护
- 泄放电阻自动放电
- 过压保护（≤4000V）
- 过流保护（≤50kA）
- 温度监测（≤80°C）
- 绝缘电阻监测（>500MΩ）`,
    keyFormulas: ['E = ½CU²', 'τ = RC'],
    connections: ['em-drive', 'safety'],
    estimatedMinutes: 8,
  },
  {
    id: 'strain-gauge',
    title: '应变测量系统',
    subtitle: 'Strain Measurement',
    category: 'equipment',
    level: 2,
    content: `## 应变测量系统

### 电阻应变片
- 原理：电阻丝变形导致电阻变化
- 灵敏系数 GF = (ΔR/R)/ε ≈ 2.0
- 惠斯通电桥检测微小电阻变化

### 测量布置
- 入射杆：SG1、SG2（记录入射波+反射波）
- 透射杆：SG3、SG4（记录透射波）
- 半桥/全桥温度补偿

### 数据采集
- 采样率：≥10 MSa/s
- 分辨率：12-16 bit
- 记录长度：8192点
- 触发方式：上升沿50mV`,
    keyFormulas: ['ΔV/V = GF·ε', 'GF ≈ 2.0'],
    connections: ['shpb-principle', 'three-wave', 'data-process'],
    estimatedMinutes: 10,
  },

  // ─── 理论模型 ───
  {
    id: 'three-wave',
    title: '三波法数据处理',
    subtitle: 'Three-Wave Analysis',
    category: 'theory',
    level: 2,
    content: `## 三波法数据处理

由入射波εᵢ、反射波εᵣ、透射波εₜ计算试样力学响应：

### 基本公式
**应力：**
$$\\sigma_s(t) = \\frac{EA}{2A_s}[\\varepsilon_i(t) + \\varepsilon_r(t) + \\varepsilon_t(t)]$$

**应变率：**
$$\\dot{\\varepsilon}_s(t) = \\frac{c}{L_s}[\\varepsilon_i(t) - \\varepsilon_r(t) - \\varepsilon_t(t)]$$

**应变：**
$$\\varepsilon_s(t) = \\frac{c}{L_s}\\int_0^t [\\varepsilon_i - \\varepsilon_r - \\varepsilon_t] d\\tau$$

### 简化（应力平衡假设）
当 εᵢ + εᵣ = εₜ 时：
- σ = EAεₜ/As
- ε̇ = -2cεᵣ/Ls`,
    keyFormulas: [
      'σ = EA(εᵢ+εᵣ+εₜ)/(2As)',
      'ε̇ = c(εᵢ-εᵣ-εₜ)/Ls',
    ],
    connections: ['one-d-wave', 'shpb-principle', 'strain-gauge', 'stress-equilibrium'],
    estimatedMinutes: 15,
  },
  {
    id: 'johnson-cook',
    title: 'Johnson-Cook本构模型',
    subtitle: 'J-C Constitutive Model',
    category: 'theory',
    level: 2,
    content: `## Johnson-Cook本构模型

描述金属材料在高应变率、高温下的流动应力：

### 公式
$$\\sigma = (A + B\\varepsilon^n)(1 + C\\ln\\dot{\\varepsilon}^*)(1 - T^{*m})$$

### 参数含义
| 参数 | 含义 |
|------|------|
| A | 参考应变率下的屈服应力 (MPa) |
| B | 应变硬化系数 (MPa) |
| n | 应变硬化指数 |
| C | 应变率敏感系数 |
| m | 温度软化指数 |

### 无量纲参数
- ε̇* = ε̇/ε̇₀（参考应变率ε̇₀=1/s）
- T* = (T-Troom)/(Tmelt-Troom)

### 典型材料J-C参数
| 材料 | A | B | n | C | m |
|------|---|---|---|---|---|
| Q235钢 | 350 | 275 | 0.36 | 0.022 | 1.0 |
| 6061-T6铝 | 324 | 114 | 0.42 | 0.002 | 1.34 |
| Ti-6Al-4V | 1098 | 1092 | 0.93 | 0.014 | 1.1 |`,
    keyFormulas: ['σ = (A+Bεⁿ)(1+Clnε̇*)(1-T*ᵐ)'],
    connections: ['strain-rate', 'dynamic-mechanics', 'material-behavior'],
    estimatedMinutes: 15,
  },
  {
    id: 'impedance-match',
    title: '波阻抗匹配',
    subtitle: 'Impedance Matching',
    category: 'theory',
    level: 2,
    content: `## 波阻抗匹配

波在不同介质界面处发生反射和透射，反射/透射系数取决于波阻抗比。

### 反射与透射系数
$$R = \\frac{Z_2 - Z_1}{Z_2 + Z_1}, \\quad T = \\frac{2Z_2}{Z_2 + Z_1}$$

### 匹配原则
- Z₁ ≈ Z₂ 时：大部分能量透射，适合精确测量
- Z₁ >> Z₂（软材料）：大部分能量反射，信号弱
- 可使用**脉冲整形器**改善匹配

### 常见材料波阻抗
| 材料 | Z (kg/m²s) |
|------|-----------|
| 钢 | 40.5×10⁶ |
| 铝 | 14.2×10⁶ |
| 铜 | 33.6×10⁶ |
| 混凝土 | ~7×10⁶ |`,
    keyFormulas: ['R = (Z₂-Z₁)/(Z₂+Z₁)', 'T = 2Z₂/(Z₂+Z₁)'],
    connections: ['stress-wave', 'shpb-principle', 'material-behavior'],
    estimatedMinutes: 10,
  },
  {
    id: 'stress-equilibrium',
    title: '应力平衡验证',
    subtitle: 'Stress Equilibrium Check',
    category: 'theory',
    level: 3,
    content: `## 应力平衡验证

SHPB实验有效性的关键前提是试样两端面**应力平衡**。

### 判据
$$R(t) = \\frac{|\\sigma_1(t) - \\sigma_2(t)|}{\\max(\\sigma_1(t), \\sigma_2(t))} < 5\\%$$

其中：
- σ₁ = E·A/As·(εᵢ + εᵣ)（入射端）
- σ₂ = E·A/As·εₜ（透射端）

### 改善方法
- 使用脉冲整形器（铜片/纸垫）延长上升时间
- 减小试样厚度（但需注意径向惯性）
- 选择合适的撞击速度`,
    keyFormulas: ['R = |σ₁-σ₂|/max(σ₁,σ₂) < 5%'],
    connections: ['three-wave', 'shpb-principle'],
    estimatedMinutes: 10,
  },

  // ─── 实验操作 ───
  {
    id: 'safety',
    title: '实验安全规范',
    subtitle: 'Safety Protocol',
    category: 'operation',
    level: 1,
    content: `## 实验安全规范

### 安全阈值
| 参数 | 最大值 | 说明 |
|------|--------|------|
| 电压 | 4000V | 致命高压！ |
| 电流 | 50kA | 瞬态峰值 |
| 储能 | 36kJ | 爆炸风险 |
| 温度 | 80°C | 设备损坏 |

### 操作规程
1. ⚡ 高压操作前确认接地良好
2. 🔒 充电前锁定安全联锁
3. 👁️ 实验区域设置警戒标志
4. 🧤 佩戴绝缘手套和护目镜
5. 📋 每次实验前完成安全检查清单
6. 🚨 紧急情况按下急停按钮

### 紧急处理
- 电击：立即切断电源，心肺复苏
- 爆炸：疏散人员，启动灭火器
- 设备过热：停止实验，自然冷却`,
    connections: ['capacitor-bank', 'experiment-flow'],
    estimatedMinutes: 8,
  },
  {
    id: 'experiment-flow',
    title: '实验操作流程',
    subtitle: 'Experiment Workflow',
    category: 'operation',
    level: 1,
    content: `## 实验操作流程

### 六阶段流程

**阶段1：电容充电** (Charging)
- 设定目标电压
- 监控充电曲线
- 确认储能达标

**阶段2：电磁加速** (Coil Acceleration)
- 三级线圈顺序触发
- 监控驱动电流波形
- 确认加速正常

**阶段3：撞击杆发射** (Striker Launch)
- 弹丸脱离线圈
- 测速系统校验速度
- 确认飞行轨迹

**阶段4：应力波传播** (Wave Propagation)
- 撞击杆撞击入射杆
- 应力波在杆中传播
- 应变片记录波形

**阶段5：试样变形** (Specimen Deformation)
- 应力波加载试样
- 高速摄影记录变形
- 监控温度变化

**阶段6：数据采集** (Data Collection)
- 采集应变信号
- 检查信号质量
- 保存原始数据`,
    connections: ['safety', 'shpb-principle', 'data-process'],
    estimatedMinutes: 12,
  },
  {
    id: 'waveform-control',
    title: '波形调控技术',
    subtitle: 'Waveform Shaping',
    category: 'operation',
    level: 3,
    content: `## 波形调控技术

### AI三级闭环算法
1. **LSTM时序预测**：预测下一时刻波形
2. **WGAN-GP波形生成**：生成目标波形
3. **PPO强化学习**：优化控制参数

### 脉冲整形方法
- **铜片整形**：延长上升时间，适合脆性材料
- **橡胶垫片**：降低加载频率，适合软材料
- **锥形撞击杆**：产生线性上升脉冲

### 典型波形
- 梯形波：恒应变率加载
- 半正弦波：减小弥散效应
- 三角波：线性加载/卸载`,
    connections: ['em-drive', 'shpb-principle', 'ai-control'],
    estimatedMinutes: 12,
  },

  // ─── 数据分析 ───
  {
    id: 'data-process',
    title: '数据处理流程',
    subtitle: 'Data Processing Pipeline',
    category: 'analysis',
    level: 2,
    content: `## 数据处理流程

### 处理步骤
1. **滤波去噪**：低通滤波消除高频噪声
2. **零点校正**：消除基线偏移
3. **时间对齐**：根据应变片位置补偿时移
4. **波形分离**：从叠加信号中分离入射波和反射波
5. **三波法计算**：得到应力-应变曲线
6. **有效性验证**：检查应力平衡

### 关键参数提取
- 峰值应力 σ_max
- 屈服应力 σ_y
- 断裂应变 ε_f
- 应变率 ε̇
- 能量吸收 W = ∫σdε`,
    keyFormulas: ['W = ∫σdε'],
    connections: ['three-wave', 'strain-gauge', 'stress-equilibrium'],
    estimatedMinutes: 12,
  },
  {
    id: 'dynamic-mechanics',
    title: '动态力学性能',
    subtitle: 'Dynamic Mechanical Properties',
    category: 'analysis',
    level: 2,
    content: `## 动态力学性能分析

### 应力-应变曲线解读
- **弹性阶段**：线性区域，斜率=动态弹性模量
- **屈服点**：偏离线性的临界点
- **塑性流动**：应变硬化或软化
- **失效**：应力急剧下降

### 应变率效应分析
- 绘制不同应变率下的应力-应变曲线族
- 提取流动应力随应变率变化关系
- 拟合本构模型参数

### 温度效应
- 绝热温升估算：ΔT = β∫σdε/(ρCp)
- Taylor-Quinney系数 β ≈ 0.9
- 热软化与应变硬化竞争`,
    keyFormulas: ['ΔT = β∫σdε/(ρCp)'],
    connections: ['strain-rate', 'johnson-cook', 'data-process'],
    estimatedMinutes: 12,
  },
  {
    id: 'material-behavior',
    title: '材料动态响应',
    subtitle: 'Material Dynamic Response',
    category: 'analysis',
    level: 2,
    content: `## 不同材料的动态响应

### 金属材料
- 应变率敏感，流动应力随ε̇增大
- 延性失效为主，形成剪切带
- J-C模型描述较好

### 岩石/混凝土
- 高度应变率敏感（DIF可达2-5）
- 拉压不对称
- HJC模型适用

### 高分子/泡沫
- 非常高的应变率敏感性
- 粘弹性行为显著
- 需要考虑温度-应变率耦合

### 陶瓷
- 脆性破坏为主
- 压碎强度远高于拉伸强度
- JH-2模型适用`,
    connections: ['dynamic-mechanics', 'johnson-cook', 'impedance-match'],
    estimatedMinutes: 10,
  },

  // ─── 前沿拓展 ───
  {
    id: 'ai-control',
    title: 'AI智能控制',
    subtitle: 'AI-Powered Control',
    category: 'advanced',
    level: 3,
    content: `## AI智能控制系统

### 三级AI闭环
1. **预测层**（LSTM）：基于历史数据预测波形走势
2. **生成层**（WGAN-GP）：根据目标生成最优控制波形
3. **优化层**（PPO）：强化学习自适应调节参数

### 应用场景
- 恒应变率加载波形实时调控
- 多轴同步加载协调
- 异常检测与自动保护
- 实验参数智能推荐`,
    connections: ['waveform-control', 'em-drive'],
    estimatedMinutes: 15,
  },
  {
    id: 'multi-field',
    title: '多场耦合实验',
    subtitle: 'Multi-Field Coupling',
    category: 'advanced',
    level: 3,
    content: `## 多场耦合动态测试

### 热-力耦合
- 高温SHPB（~1200°C）
- 热脉冲发生器快速加热
- 红外测温实时监控

### 电-力耦合
- 外加电场对材料动态性能的影响
- 压电材料动态响应测试
- 电磁干扰抑制技术

### 围压-冲击耦合
- 三轴围压装置（液压油路）
- 模拟地下深部环境
- 岩石动态力学测试`,
    connections: ['shpb-principle', 'ai-control'],
    estimatedMinutes: 12,
  },
];

// ═══════════════════════════════════════════════
// 学习路径
// ═══════════════════════════════════════════════

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  color: string;
  steps: { nodeId: string; milestone?: string }[];
}

export const LEARNING_PATHS: LearningPath[] = [
  {
    id: 'beginner',
    title: '入门之路',
    description: '从零开始了解霍普金森杆实验',
    color: '#3B82F6',
    steps: [
      { nodeId: 'stress-wave', milestone: '理解应力波概念' },
      { nodeId: 'strain-rate' },
      { nodeId: 'shpb-principle', milestone: '掌握SHPB原理' },
      { nodeId: 'safety' },
      { nodeId: 'experiment-flow', milestone: '完成第一次虚拟实验' },
    ],
  },
  {
    id: 'theory',
    title: '理论进阶',
    description: '深入理解实验理论基础',
    color: '#8B5CF6',
    steps: [
      { nodeId: 'one-d-wave' },
      { nodeId: 'impedance-match' },
      { nodeId: 'three-wave', milestone: '掌握三波法' },
      { nodeId: 'stress-equilibrium' },
      { nodeId: 'johnson-cook', milestone: '掌握J-C本构模型' },
    ],
  },
  {
    id: 'practice',
    title: '实验实战',
    description: '掌握完整实验操作与数据分析',
    color: '#10B981',
    steps: [
      { nodeId: 'em-drive' },
      { nodeId: 'capacitor-bank' },
      { nodeId: 'strain-gauge' },
      { nodeId: 'data-process', milestone: '独立完成数据处理' },
      { nodeId: 'dynamic-mechanics' },
      { nodeId: 'material-behavior', milestone: '完成材料性能分析' },
    ],
  },
  {
    id: 'advanced',
    title: '前沿探索',
    description: '了解最新技术和研究方向',
    color: '#EC4899',
    steps: [
      { nodeId: 'waveform-control' },
      { nodeId: 'ai-control', milestone: '理解AI闭环控制' },
      { nodeId: 'multi-field', milestone: '了解多场耦合前沿' },
    ],
  },
];

// ═══════════════════════════════════════════════
// 测验题库
// ═══════════════════════════════════════════════

export interface QuizQuestion {
  id: string;
  relatedNodeId: string;
  difficulty: 1 | 2 | 3;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1',
    relatedNodeId: 'stress-wave',
    difficulty: 1,
    question: '应力波在钢杆中的传播速度约为？',
    options: ['1000 m/s', '3000 m/s', '5000 m/s', '8000 m/s'],
    correctIndex: 2,
    explanation: '钢的弹性模量E≈200GPa，密度ρ≈7800kg/m³，波速 c=√(E/ρ)≈5064 m/s。',
  },
  {
    id: 'q2',
    relatedNodeId: 'shpb-principle',
    difficulty: 1,
    question: 'SHPB实验中，试样放置在哪两根杆之间？',
    options: ['撞击杆与入射杆', '入射杆与透射杆', '透射杆与动量阱', '两根入射杆'],
    correctIndex: 1,
    explanation: '试样夹在入射杆（Incident Bar）和透射杆（Transmitted Bar）之间。',
  },
  {
    id: 'q3',
    relatedNodeId: 'strain-rate',
    difficulty: 1,
    question: 'SHPB实验的典型应变率范围是？',
    options: ['10⁻³ ~ 10⁰ /s', '10⁰ ~ 10² /s', '10² ~ 10⁴ /s', '10⁵ ~ 10⁷ /s'],
    correctIndex: 2,
    explanation: 'SHPB实验的应变率范围通常为10²~10⁴ /s，属于高应变率范畴。',
  },
  {
    id: 'q4',
    relatedNodeId: 'one-d-wave',
    difficulty: 2,
    question: '一维应力波理论的基本假设不包括？',
    options: ['杆件足够细长', '应力横截面均匀分布', '杆件处于弹性状态', '考虑杆的横向惯性效应'],
    correctIndex: 3,
    explanation: '一维应力波理论假设横向惯性效应可忽略（即不考虑），这要求杆件足够细长(L/D>20)。',
  },
  {
    id: 'q5',
    relatedNodeId: 'impedance-match',
    difficulty: 2,
    question: '当试样波阻抗远小于杆件波阻抗时，入射波主要？',
    options: ['全部透射', '大部分透射', '大部分反射', '完全吸收'],
    correctIndex: 2,
    explanation: 'Z₂<<Z₁时，反射系数R≈-1，大部分能量被反射。这对软材料（泡沫、生物材料）的测试是个挑战。',
  },
  {
    id: 'q6',
    relatedNodeId: 'three-wave',
    difficulty: 2,
    question: '三波法中，应力平衡条件下，试样应力σ等于？',
    options: ['EA·εᵢ/As', 'EA·εᵣ/As', 'EA·εₜ/As', 'EA·(εᵢ-εᵣ)/As'],
    correctIndex: 2,
    explanation: '应力平衡时εᵢ+εᵣ=εₜ，简化后σ=EA·εₜ/As，只需透射波即可得到应力。',
  },
  {
    id: 'q7',
    relatedNodeId: 'johnson-cook',
    difficulty: 2,
    question: 'Johnson-Cook模型中，参数C表示？',
    options: ['屈服应力', '应变硬化系数', '应变率敏感系数', '温度软化指数'],
    correctIndex: 2,
    explanation: 'J-C模型 σ=(A+Bεⁿ)(1+Clnε̇*)(1-T*ᵐ) 中，C是应变率敏感系数，表征材料流动应力对应变率的敏感程度。',
  },
  {
    id: 'q8',
    relatedNodeId: 'safety',
    difficulty: 1,
    question: '本系统的最大安全电压阈值是？',
    options: ['2000V', '3000V', '4000V', '5000V'],
    correctIndex: 2,
    explanation: '电磁驱动系统的安全阈值为：电压≤4000V、电流≤50kA、储能≤36kJ、温度≤80°C。',
  },
  {
    id: 'q9',
    relatedNodeId: 'em-drive',
    difficulty: 2,
    question: '电磁驱动相比传统气炮的主要优势是？',
    options: ['速度更高', '波形可精确编程调控', '设备更便宜', '不需要电力'],
    correctIndex: 1,
    explanation: '电磁驱动的最大优势是波形可编程调控，通过控制放电波形实现精确的加载脉冲设计。',
  },
  {
    id: 'q10',
    relatedNodeId: 'stress-equilibrium',
    difficulty: 3,
    question: '应力平衡判据通常要求两端面应力差异小于？',
    options: ['1%', '5%', '10%', '20%'],
    correctIndex: 1,
    explanation: '一般要求 R=|σ₁-σ₂|/max(σ₁,σ₂) < 5%，确保试样处于均匀应力状态。',
  },
  {
    id: 'q11',
    relatedNodeId: 'capacitor-bank',
    difficulty: 1,
    question: '电容器储能公式是？',
    options: ['E = CU', 'E = ½CU²', 'E = CU²', 'E = 2CU²'],
    correctIndex: 1,
    explanation: '电容器储能 E = ½CU²，C为电容量，U为充电电压。',
  },
  {
    id: 'q12',
    relatedNodeId: 'data-process',
    difficulty: 3,
    question: '数据处理中"时间对齐"的目的是？',
    options: ['消除噪声', '补偿应变片到试样的距离造成的时间延迟', '提高采样率', '校正温度漂移'],
    correctIndex: 1,
    explanation: '应变片位于杆的中部而非端面，波传播需要时间。时间对齐根据应变片到试样的距离和波速补偿这个时移。',
  },
];
