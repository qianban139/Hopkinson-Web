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

  // ─── 前沿研究论文 & 工程理论 ───
  {
    id: 'ann-shpb-concrete',
    title: 'ANN 驱动的混凝土 SHPB 本构预测',
    subtitle: 'BP Neural Network for Concrete SHPB Prediction (龙旭 2021)',
    category: 'advanced',
    level: 3,
    content: `## 论文背景

龙旭等（2021，南京航空航天大学学报）针对混凝土类脆性材料在高应变率下的本构行为，提出 **ABAQUS 仿真 + BP 神经网络** 的 SHPB 压缩性能预测方法，取代传统的重复有限元建模。

### 核心流程

1. **ABAQUS 显式动力学仿真** 建立 SHPB 模型
   - 入射杆 2.0 m / 透射杆 1.5 m / 试件 21.5 mm
   - 本构模型: Drucker-Prager (摩擦角 40°、膨胀角 40°、K=1)
   - 4 种入射应力波（峰值 60 / 100 / 130 / 160 MPa）
2. **20 组训练样本** 覆盖应变率 500 ~ 1400/s
3. **BP 网络结构**
   - 输入层: 入射波时序信号
   - 隐层: tansig 激活函数
   - 输出层: purelin,反射波 + 透射波
4. **应变率外推**: 可预测训练样本未覆盖的更高/更低应变率

### 关键公式

试件应变率（三波法）:
$$\\dot{\\varepsilon}_s = \\frac{C_0}{L_s}(\\varepsilon_i - \\varepsilon_r - \\varepsilon_t)$$

试件应力:
$$\\sigma_s = \\frac{A_b}{2A_s}\\,E_b\\,(\\varepsilon_i + \\varepsilon_r + \\varepsilon_t)$$

### 工程意义

- **效率**: 一次训练替代无数次有限元建模、分析、后处理
- **精度**: 能够精确捕捉混凝土的应变率敏感性（DIF 2 ~ 5）
- **外推**: 突破数据边界,对高应变率区域做可靠预测
- **推广**: 方法对其他脆性材料（岩石、陶瓷）同样适用`,
    keyFormulas: [
      'ε̇_s = C₀/L_s · (ε_i − ε_r − ε_t)',
      'σ_s = A_b/(2A_s) · E_b · (ε_i + ε_r + ε_t)',
    ],
    connections: ['shpb-principle', 'three-wave', 'johnson-cook'],
    estimatedMinutes: 18,
  },
  {
    id: 'deep-learning-coal-ct',
    title: '深度学习煤岩 Micro-CT 裂隙智能提取',
    subtitle: 'MCSN: U-Net + VGG16 + DCAC (王登科 2024)',
    category: 'advanced',
    level: 3,
    content: `## 论文背景

王登科等（2024，煤炭学报）针对煤岩 CT 扫描图像中 **矸石干扰、多尺度裂隙识别** 的难题，提出 **MCSN (Multi-scale Coal-rock fissure Segmentation Network)**。

### 网络架构

1. **U-Net 编解码 + 跳跃连接** —— 多尺度结构信息跨层传递
2. **VGG16 迁移学习** —— 用 ImageNet 预训练权重初始化 U-Net 编码器,减少训练数据需求
3. **DCAC 模块** —— 深度可分离空洞卷积
   - 膨胀率 1 / 2 / 4
   - 等效感受野 3×3 → 7×7 → 15×15
   - 显著降低参数量与计算量
4. **残差模块** —— 缓解梯度消失,激活函数 GeLU

### 数据集

- **扫描仪**: Phoenix v|tomelx s 工业 CT
- **试样**: 25 mm × 50 mm 煤块
- **原始图像**: 600 张,人工标注(裂隙 RGB 255-255-255,背景 0-0-0)
- **数据增广**: 旋转(±10°/±30°)+ 翻转 → 6000 张
- **划分**: 训练 4200 / 验证 1800

### 评价指标

$$\\text{MPA} = \\frac{1}{k+1}\\sum_{i=0}^{k}\\frac{p_{ii}}{\\sum_{j=0}^{k}p_{ij}}$$

Recall、Precision、MPA、MIoU 四项指标全面优于:
- 阈值分割 (Otsu / BiDoseResp / Bi-PTI)
- 经典 CNN (FCN / YOLOv5 / U-Net 原版)

### 工程应用

- **巷道围岩钻孔窥视**: 视频 + 平面展开图双源交叉验证
- **裂隙空间分布重建**: 为瓦斯抽采钻孔注封封堵提供定量依据
- **提高煤层气抽采体积分数**: 优化封堵段选择`,
    keyFormulas: [
      'MPA = (1/(k+1)) · Σ p_ii/Σ p_ij',
      'Recall = p_ii / (p_ii + p_ij)',
    ],
    connections: ['stress-wave', 'material-behavior'],
    estimatedMinutes: 22,
  },
  {
    id: 'pid-servo-confining',
    title: 'PID 闭环精准伺服调控（围压应用）',
    subtitle: 'PID Servo Control for Confining Pressure',
    category: 'advanced',
    level: 2,
    content: `## 大白话拆开理解

### 1. 伺服
油缸 / 电机 **精准跟着指令动** —— 你要多少压力,它就给多少。

### 2. PID 算法
**自动纠错算法**,由三部分组成:
- **比例 P**: 当前偏差越大,调节力度越大
- **积分 I**: 如果持续偏离目标,累积偏差会逐步加大修正力度
- **微分 D**: 如果偏差变化太快,提前减弱调节,避免过冲

### 3. 闭环
**实时检测实际围压 → 对比设定值 → 自动加压/减压 → 一直修正。**

---

## 放到霍普金森压力机里

设定围压 **50 MPa**:

| 方式 | 行为 | 结果 |
|---|---|---|
| 开环 | 只管加压、不准回头看 | 压力忽高忽低,不可靠 |
| PID 闭环伺服 | 实时测真实压力 → 低了补、高了泄 | 稳稳卡在设定值、不漂移、不超调、精度极高 |

---

## 控制律公式

$$u(t) = K_p\\,e(t) + K_i\\int_0^t e(\\tau)\\,d\\tau + K_d\\,\\frac{de(t)}{dt}$$

其中 $e(t) = P_{target} - P_{measured}$ (围压偏差)。

### 参数调优经验

| 参数 | 调大的效果 | 过大的副作用 |
|---|---|---|
| $K_p$ | 响应更快 | 振荡 (hunting) |
| $K_i$ | 消除稳态误差 | 积分饱和、响应滞后 |
| $K_d$ | 抑制超调 | 放大传感器噪声 |

### 典型围压参数

\`\`\`
目标围压 : 50 MPa
采样周期 : 1 ms
Kp = 0.15   (快速跟踪)
Ki = 0.008  (小值防积分饱和)
Kd = 0.25   (中等阻尼,平顺)
\`\`\`

2 ~ 3 秒内稳定在目标值 ±2%。

---

## 一句话专业总结

> **"基于 PID 算法的闭环伺服控制"** —— 实时测量 + 自动纠错,实现围压的高精度稳定加载。`,
    keyFormulas: ['u(t) = Kp·e(t) + Ki·∫e(τ)dτ + Kd·de(t)/dt'],
    connections: ['em-drive', 'safety', 'multi-field'],
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
