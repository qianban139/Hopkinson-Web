# 端到端仿真流程

> 从用户输入到实验结果的完整计算链路

---

## 仿真流程概览

```
用户输入                    物理计算                        输出结果
────────                   ────────                       ────────
材料选择 ──┐
电压设定 ──┼──► runSHPBSimulation() ──► 应力-应变曲线
脉宽设定 ──┤        │                    三波波形
温度设定 ──┘        │                    力学参数
                    ▼
              6步物理计算
```

## 计算步骤详解

### Step 1: 电磁驱动

```
输入: voltage (V)
  │
  ├── calcStoredEnergy(voltage)
  │     E = ½CU² (C=4000μF)
  │
  └── calcStrikerVelocity(voltage)
        v = √(2ηE/m)  (η=12%)
```

| 电压 (V) | 储能 (J) | 打击杆速度 (m/s) |
|----------|---------|----------------|
| 1000 | 2000 | 5.3 |
| 2000 | 8000 | 10.6 |
| 3000 | 18000 | 15.9 |
| 4000 | 32000 | 21.2 |

### Step 2: 入射波生成

```
输入: strikerVelocity (m/s)
  │
  ├── calcIncidentStress(v)
  │     σᵢ = ρ_bar · c_bar · v / 2
  │
  └── pulseDuration
        T = 2L_striker / c_bar
        ≈ 82 μs (200mm打击杆)
```

### Step 3: 阻抗失配计算

```
输入: material (Material)
  │
  ├── calcReflectionCoefficient(material)
  │     R = (Z_s - Z_b) / (Z_s + Z_b)
  │
  ├── calcTransmissionCoefficient(material)
  │     T = 2Z_s / (Z_s + Z_b)
  │
  ├── reflectedStress = |R| × incidentStress
  └── transmittedStress = |T| × incidentStress
```

### Step 4: 试件响应计算

```
三波法:
  │
  ├── specimenStress = (A_bar/A_s) × transmittedStress
  │
  └── strainRate = 2c_bar × ε_r / L_s
        其中 ε_r = σ_r / E_bar
```

### Step 5: J-C 本构求解

```
迭代求解:
  for ε = 0 → 0.8 (步长 0.001):
    σ_JC = johnsonCookStress(ε, ε̇, T, jc)
    if σ_JC ≥ specimenStress:
      peakStrain = ε; break

peakStress = johnsonCookStress(min(peakStrain, 0.5), ε̇, T, jc)
yieldStrength = johnsonCookStress(0.002, ε̇, T, jc)
```

### Step 6: 能量与汇总

```
energyAbsorption = (yieldStrength + peakStress) / 2 × peakStrain
duration = round(pulseDuration)
```

## 输出数据结构

```typescript
interface SHPBSimulationResult {
  // 核心力学结果
  peakStress: number;        // 峰值应力 (MPa)
  strainRate: number;        // 应变率 (/s)
  yieldStrength: number;     // 动态屈服强度 (MPa)
  maxStrain: number;         // 最大应变 (%)
  energyAbsorption: number;  // 单位体积吸收能 (MJ/m³)
  duration: number;          // 加载持续时间 (μs)

  // 三波峰值
  incidentWavePeak: number;  // 入射波峰值 (MPa)
  reflectedWavePeak: number; // 反射波峰值 (MPa)
  transmittedWavePeak: number; // 透射波峰值 (MPa)

  // 中间变量
  strikerVelocity: number;   // 打击杆速度 (m/s)
  storedEnergy: number;      // 电容储能 (J)
  reflectionCoeff: number;   // 反射系数
  transmissionCoeff: number; // 透射系数
}
```

## 波形数据生成

`generatePhysicsBasedWaveforms()` 基于物理计算（非随机生成）产生三波数据：

- 入射波幅值 = `calcIncidentStress(v) / 1e6` (MPa)
- 反射波幅值 = |R| × 入射波幅值
- 透射波幅值 = |T| × 入射波幅值

反射/透射系数由阻抗失配物理计算，不是硬编码常数。
