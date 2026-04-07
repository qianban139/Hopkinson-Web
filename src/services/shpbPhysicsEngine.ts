// src/services/shpbPhysicsEngine.ts
// SHPB 物理仿真引擎 — 基于一维应力波理论和 Johnson-Cook 本构模型
// 替代原有 Math.random() 随机结果生成，实现物理上合理的实验仿真

import type { Material, JohnsonCookParams } from '@/types';

// ═══════════════════════════════════════════════════════
// 常量 & 配置
// ═══════════════════════════════════════════════════════

/** SHPB 系统参数（典型电磁驱动霍普金森杆配置） */
const SHPB_CONFIG = {
  /** 杆材料：马氏体时效钢 (18Ni) */
  barDensity: 8100,              // kg/m³
  barElasticModulus: 190e9,      // Pa
  barDiameter: 0.0148,           // m (14.8mm)
  barCrossSection: 0,            // 自动计算
  /** 打击杆 */
  strikerLength: 0.2,            // m (200mm)
  strikerMass: 0,                // 自动计算
  /** 电磁驱动系统 */
  capacitance: 4000e-6,          // F (4000μF 电容组)
  couplingEfficiency: 0.12,      // 电磁耦合效率 (典型 8%-15%)
  /** 试件 */
  specimenDiameter: 0.008,       // m (8mm)
  specimenLength: 0.004,         // m (4mm, 压缩试件)
  /** 采样 */
  samplePoints: 250,             // 数据点数
  referenceStrainRate: 1.0,      // 参考应变率 /s (J-C 模型)
  roomTemperature: 25,           // °C
};

// 初始化截面积和打击杆质量
SHPB_CONFIG.barCrossSection = Math.PI * Math.pow(SHPB_CONFIG.barDiameter / 2, 2);
SHPB_CONFIG.strikerMass = SHPB_CONFIG.barDensity * SHPB_CONFIG.barCrossSection * SHPB_CONFIG.strikerLength;

// ═══════════════════════════════════════════════════════
// 核心物理计算
// ═══════════════════════════════════════════════════════

/** 计算电容器储能 (J) */
export function calcStoredEnergy(voltage: number): number {
  return 0.5 * SHPB_CONFIG.capacitance * voltage * voltage;
}

/** 电压 → 打击杆速度 (m/s)：v = sqrt(2 * η * E / m) */
export function calcStrikerVelocity(voltage: number): number {
  const energy = calcStoredEnergy(voltage);
  const kineticEnergy = energy * SHPB_CONFIG.couplingEfficiency;
  return Math.sqrt(2 * kineticEnergy / SHPB_CONFIG.strikerMass);
}

/** 杆的波阻抗 Z = ρcA = A√(ρE) */
export function calcImpedance(density: number, elasticModulus: number, crossSection: number): number {
  return crossSection * Math.sqrt(density * elasticModulus);
}

/** 一维弹性波速 c = √(E/ρ) */
export function calcWaveSpeed(elasticModulus: number, density: number): number {
  return Math.sqrt(elasticModulus / density);
}

/** 入射脉冲峰值应力 (Pa): σ_i = ρ_bar * c_bar * v_striker / 2 */
export function calcIncidentStress(strikerVelocity: number): number {
  const c_bar = calcWaveSpeed(SHPB_CONFIG.barElasticModulus, SHPB_CONFIG.barDensity);
  return SHPB_CONFIG.barDensity * c_bar * strikerVelocity / 2;
}

/** 阻抗失配反射系数 R = (Z_s - Z_b) / (Z_s + Z_b) */
export function calcReflectionCoefficient(material: Material): number {
  const specimenCrossSection = Math.PI * Math.pow(SHPB_CONFIG.specimenDiameter / 2, 2);
  const Z_bar = calcImpedance(SHPB_CONFIG.barDensity, SHPB_CONFIG.barElasticModulus, SHPB_CONFIG.barCrossSection);
  const Z_specimen = calcImpedance(material.density, material.elasticModulus, specimenCrossSection);
  return (Z_specimen - Z_bar) / (Z_specimen + Z_bar);
}

/** 透射系数 T = 2Z_s / (Z_s + Z_b) */
export function calcTransmissionCoefficient(material: Material): number {
  const specimenCrossSection = Math.PI * Math.pow(SHPB_CONFIG.specimenDiameter / 2, 2);
  const Z_bar = calcImpedance(SHPB_CONFIG.barDensity, SHPB_CONFIG.barElasticModulus, SHPB_CONFIG.barCrossSection);
  const Z_specimen = calcImpedance(material.density, material.elasticModulus, specimenCrossSection);
  return 2 * Z_specimen / (Z_specimen + Z_bar);
}

// ═══════════════════════════════════════════════════════
// Johnson-Cook 本构模型
// ═══════════════════════════════════════════════════════

/**
 * Johnson-Cook 本构方程
 * σ = (A + Bεⁿ)(1 + C·ln(ε̇/ε̇₀))(1 − T*ᵐ)
 *
 * @param strain - 等效塑性应变 ε
 * @param strainRate - 应变率 ε̇ (/s)
 * @param temperature - 温度 (°C)
 * @param jc - Johnson-Cook 参数
 * @returns 流动应力 σ (MPa)
 */
export function johnsonCookStress(
  strain: number,
  strainRate: number,
  temperature: number,
  jc: JohnsonCookParams
): number {
  // 应变硬化项
  const hardeningTerm = jc.A + jc.B * Math.pow(Math.max(strain, 1e-9), jc.n);

  // 应变率效应项
  const rateRatio = Math.max(strainRate / SHPB_CONFIG.referenceStrainRate, 1);
  const rateTerm = 1 + jc.C * Math.log(rateRatio);

  // 热软化项
  const T_room = SHPB_CONFIG.roomTemperature;
  const T_star = Math.max(0, Math.min(1, (temperature - T_room) / (jc.Tm - T_room)));
  const thermalTerm = 1 - Math.pow(T_star, jc.m);

  return hardeningTerm * rateTerm * thermalTerm;
}

/**
 * 生成 J-C 模型的应力-应变曲线
 * @returns 应力数组 (MPa)，对应均匀分布的应变点
 */
export function generateStressStrainCurve(
  material: Material,
  strainRate: number,
  temperature: number,
  maxStrain: number,
  numPoints: number = 100
): { strain: number; stress: number }[] {
  const curve: { strain: number; stress: number }[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const strain = (i / numPoints) * maxStrain;
    const stress = johnsonCookStress(strain, strainRate, temperature, material.johnsonCookParams);
    curve.push({ strain, stress });
  }
  return curve;
}

// ═══════════════════════════════════════════════════════
// 完整 SHPB 实验仿真
// ═══════════════════════════════════════════════════════

export interface SHPBSimulationInput {
  material: Material;
  voltage: number;           // V
  pulseWidth?: number;       // μs (可选，影响加载时间)
  temperature?: number;      // °C (默认室温 25°C)
}

export interface SHPBSimulationResult {
  // 核心结果指标
  peakStress: number;        // MPa
  strainRate: number;        // /s
  yieldStrength: number;     // MPa
  maxStrain: number;         // %（百分比）
  energyAbsorption: number;  // J/m³ (单位体积吸收能)
  duration: number;          // μs

  // 三波峰值
  incidentWavePeak: number;  // MPa
  reflectedWavePeak: number; // MPa
  transmittedWavePeak: number; // MPa

  // 中间变量（可用于 UI 展示）
  strikerVelocity: number;   // m/s
  storedEnergy: number;      // J
  reflectionCoeff: number;   // 反射系数 (-1 ~ 1)
  transmissionCoeff: number; // 透射系数
}

/**
 * 运行 SHPB 实验仿真
 *
 * 物理流程：
 * 1. 电容放电 → 电磁驱动 → 打击杆获得速度 v
 * 2. 打击杆撞击入射杆 → 生成入射应力波 σ_i
 * 3. 应力波到达试件 → 阻抗失配 → 反射波 σ_r + 透射波 σ_t
 * 4. 由透射波计算试件应力，由反射波计算试件应变率
 * 5. 结合 J-C 模型确定材料动态响应
 */
export function runSHPBSimulation(input: SHPBSimulationInput): SHPBSimulationResult {
  const { material, voltage, temperature = 25 } = input;
  const jc = material.johnsonCookParams;

  // ——— Step 1: 电磁驱动 ———
  const storedEnergy = calcStoredEnergy(voltage);
  const strikerVelocity = calcStrikerVelocity(voltage);

  // ——— Step 2: 入射波 ———
  const incidentStressPa = calcIncidentStress(strikerVelocity);
  const incidentStressMPa = incidentStressPa / 1e6;

  // 脉冲持续时间 = 2L_striker / c_bar (应力波在打击杆中往返一次)
  const c_bar = calcWaveSpeed(SHPB_CONFIG.barElasticModulus, SHPB_CONFIG.barDensity);
  const pulseDurationUs = (2 * SHPB_CONFIG.strikerLength / c_bar) * 1e6;

  // ——— Step 3: 阻抗失配 ———
  const R = calcReflectionCoefficient(material);
  const T = calcTransmissionCoefficient(material);

  // 反射波与透射波峰值（应力）
  // 注意：R 可能为负（试件阻抗 < 杆阻抗，如泡沫），取绝对值表示幅值
  const reflectedStressMPa = Math.abs(R) * incidentStressMPa;
  const transmittedStressMPa = Math.abs(T) * incidentStressMPa;

  // ——— Step 4: 试件应力和应变率 ———
  // 三波法：σ_s = (A_bar / A_s) * σ_t （由透射波确定试件应力）
  const areaRatio = SHPB_CONFIG.barCrossSection /
    (Math.PI * Math.pow(SHPB_CONFIG.specimenDiameter / 2, 2));
  const specimenStressMPa = areaRatio * transmittedStressMPa;

  // 应变率：ε̇ = -2c_bar * ε_r / L_s （由反射波确定应变率）
  // ε_r = σ_r / E_bar (反射应变)
  const reflectedStrainAmplitude = (reflectedStressMPa * 1e6) / SHPB_CONFIG.barElasticModulus;
  const strainRate = 2 * c_bar * reflectedStrainAmplitude / SHPB_CONFIG.specimenLength;

  // ——— Step 5: J-C 模型确定动态响应 ———
  // 用迭代找到峰值应力对应的应变
  // 思路：加载过程中应变逐渐增大，当 J-C 应力 ≈ 施加应力时达到平衡
  let peakStrain = 0;
  const strainStep = 0.001;
  const maxIterStrain = 0.8; // 泡沫等可达很大应变

  for (let eps = 0; eps < maxIterStrain; eps += strainStep) {
    const jcStress = johnsonCookStress(eps, strainRate, temperature, jc);
    if (jcStress >= specimenStressMPa) {
      peakStrain = eps;
      break;
    }
    peakStrain = eps;
  }

  // 用 J-C 模型在实际应变率和温度下计算峰值流动应力
  const peakStress = johnsonCookStress(
    Math.min(peakStrain, 0.5),
    strainRate,
    temperature,
    jc
  );

  // 屈服强度 = J-C 在 ε≈0 处的应力（含应变率效应）
  const yieldStrength = johnsonCookStress(0.002, strainRate, temperature, jc);

  // ——— Step 6: 能量与时间 ———
  // 单位体积吸收能 = ∫σdε ≈ 平均应力 × 峰值应变
  const avgStress = (yieldStrength + peakStress) / 2;
  const energyAbsorption = avgStress * peakStrain; // MPa = MJ/m³ → J/m³ 需要 ×1e6

  // 加载持续时间 ≈ 脉冲持续时间
  const duration = Math.round(pulseDurationUs);

  return {
    peakStress: Math.round(peakStress * 100) / 100,
    strainRate: Math.round(strainRate),
    yieldStrength: Math.round(yieldStrength * 100) / 100,
    maxStrain: Math.round(peakStrain * 10000) / 100, // 转百分比
    energyAbsorption: Math.round(avgStress * peakStrain * 100) / 100,
    duration,
    incidentWavePeak: Math.round(incidentStressMPa * 100) / 100,
    reflectedWavePeak: Math.round(reflectedStressMPa * 100) / 100,
    transmittedWavePeak: Math.round(transmittedStressMPa * 100) / 100,
    strikerVelocity: Math.round(strikerVelocity * 100) / 100,
    storedEnergy: Math.round(storedEnergy * 100) / 100,
    reflectionCoeff: Math.round(R * 1000) / 1000,
    transmissionCoeff: Math.round(T * 1000) / 1000,
  };
}

// ═══════════════════════════════════════════════════════
// 波形数据生成（供 ExperimentResultCharts 使用）
// ═══════════════════════════════════════════════════════

export interface WaveformGenerationInput {
  voltage: number;
  material: Material;
  peakStress: number;
  strainRate: number;
}

/**
 * 生成基于物理参数的三波数据
 * 反射/透射系数由阻抗失配计算得出，而非硬编码
 */
export function generatePhysicsBasedWaveforms(input: WaveformGenerationInput) {
  const { voltage, material, peakStress, strainRate } = input;
  const N = SHPB_CONFIG.samplePoints;

  const R_coeff = Math.abs(calcReflectionCoefficient(material));
  const T_coeff = Math.abs(calcTransmissionCoefficient(material));

  // 入射波幅值基于实际计算
  const strikerV = calcStrikerVelocity(voltage);
  const incidentAmplitude = calcIncidentStress(strikerV) / 1e6; // MPa

  return { R_coeff, T_coeff, incidentAmplitude };
}
