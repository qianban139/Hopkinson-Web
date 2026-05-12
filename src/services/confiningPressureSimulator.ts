/**
 * 围压液压系统动力学仿真
 *
 * 将"伺服阀 + 液压缸 + 被围试样"建模为二阶系统(带时滞):
 *
 *   τ²·p̈ + 2ζτ·ṗ + p = K·u(t - Td) + d(t)
 *
 * 其中:
 *   p   —— 实际围压(MPa)
 *   u   —— 控制器输出(归一化 0~1,对应伺服阀开度)
 *   K   —— 静态增益(MPa/单位开度)
 *   τ   —— 时间常数(s)
 *   ζ   —— 阻尼比(0.3~1.0 之间工程常见)
 *   Td  —— 纯时滞(s,伺服阀响应延迟)
 *   d   —— 扰动(试样破碎瞬间泄压等)
 *
 * 求解: 显式二阶欧拉积分 + 环形缓冲模拟时滞。
 */

import { PIDController, type PIDConfig, type PIDStep } from './pidController';

export interface PlantParams {
  /** 静态增益 (MPa) —— 伺服阀全开时的稳态压力 */
  K: number;
  /** 时间常数 (s) */
  tau: number;
  /** 阻尼比(0.2=欠阻尼 / 1.0=临界阻尼) */
  zeta: number;
  /** 纯时滞 (s) */
  deadTime: number;
  /** 过程噪声标准差 (MPa),模拟测量噪声 */
  noiseStd?: number;
}

export const DEFAULT_PLANT: PlantParams = {
  K: 200,        // 伺服阀全开 → 最大 200 MPa
  tau: 0.35,     // 0.35s 时间常数
  zeta: 0.45,    // 欠阻尼(让开环有明显超调,便于对比)
  deadTime: 0.06,
  noiseStd: 0.15,
};

export interface SimTrace {
  t: number[];
  setpoint: number[];
  measured: number[];
  output: number[];
  error: number[];
}

/**
 * 闭环仿真 —— PID 控制下的围压响应
 * @param setpointProfile  时间序列的设定值(MPa)
 * @param dt  采样周期(s)
 * @param pidCfg  PID 配置
 * @param plant  被控对象参数
 */
export function simulateClosedLoop(
  setpointProfile: number[],
  dt: number,
  pidCfg: PIDConfig,
  plant: PlantParams = DEFAULT_PLANT,
): SimTrace {
  const pid = new PIDController(pidCfg);
  const N = setpointProfile.length;
  const t = new Array<number>(N);
  const setpoint = [...setpointProfile];
  const measured = new Array<number>(N).fill(0);
  const output = new Array<number>(N).fill(0);
  const error = new Array<number>(N).fill(0);

  // 二阶状态: p(当前)、pDot(速率)
  let p = 0;
  let pDot = 0;

  // 时滞缓冲
  const delaySteps = Math.max(0, Math.round(plant.deadTime / dt));
  const uBuffer: number[] = new Array(delaySteps + 1).fill(0);

  const { K, tau, zeta, noiseStd = 0 } = plant;

  for (let i = 0; i < N; i++) {
    t[i] = i * dt;
    // 测量值加噪声
    const meas = p + (noiseStd > 0 ? randn() * noiseStd : 0);

    // PID 计算(输出单位 MPa,下方再归一化到伺服阀开度 0~1)
    const step = pid.update(setpoint[i], meas, dt);
    error[i] = step.error;
    // 将 PID 输出映射到伺服阀开度 [0,1]
    const uCmd = clamp(step.output / K, 0, 1);
    output[i] = uCmd * K; // 回显为等效 MPa

    // 时滞队列
    uBuffer.push(uCmd);
    const uDelayed = uBuffer.shift()!;

    // 二阶系统: τ²p̈ + 2ζτṗ + p = K·u
    const pDdot = (K * uDelayed - 2 * zeta * tau * pDot - p) / (tau * tau);
    pDot += pDdot * dt;
    p += pDot * dt;
    if (p < 0) { p = 0; pDot = Math.max(0, pDot); } // 物理下限: 压力不为负
    measured[i] = p;
  }

  return { t, setpoint, measured, output, error };
}

/**
 * 开环仿真 —— 无反馈,直接按设定值比例开阀
 * 用于对比展示"开环+扰动"的漂移与超调
 */
export function simulateOpenLoop(
  setpointProfile: number[],
  dt: number,
  plant: PlantParams = DEFAULT_PLANT,
): SimTrace {
  const N = setpointProfile.length;
  const t = new Array<number>(N);
  const setpoint = [...setpointProfile];
  const measured = new Array<number>(N).fill(0);
  const output = new Array<number>(N).fill(0);
  const error = new Array<number>(N).fill(0);

  let p = 0;
  let pDot = 0;
  const delaySteps = Math.max(0, Math.round(plant.deadTime / dt));
  const uBuffer: number[] = new Array(delaySteps + 1).fill(0);
  const { K, tau, zeta, noiseStd = 0 } = plant;

  // 开环增益标定偏差 + 缓慢漂移(模拟油温/密封变化)
  const gainBias = 0.88;

  for (let i = 0; i < N; i++) {
    t[i] = i * dt;
    // 开环: 直接把设定值除以标定增益 → 伺服开度
    const uCmd = clamp(setpoint[i] / (K * gainBias), 0, 1);
    output[i] = uCmd * K;

    uBuffer.push(uCmd);
    const uDelayed = uBuffer.shift()!;

    const pDdot = (K * uDelayed - 2 * zeta * tau * pDot - p) / (tau * tau);
    pDot += pDdot * dt;
    p += pDot * dt;
    if (p < 0) { p = 0; pDot = Math.max(0, pDot); }

    const meas = p + (noiseStd > 0 ? randn() * noiseStd * 1.5 : 0);
    measured[i] = meas;
    error[i] = setpoint[i] - meas;
  }

  return { t, setpoint, measured, output, error };
}

/**
 * 构造"阶跃 + 扰动"的设定值时序,用于演示
 * @param duration  总时长(s)
 * @param dt  采样周期(s)
 * @param target  目标围压(MPa)
 * @param stepAt  阶跃时刻(s)
 * @param disturbAt  扰动时刻(s,向设定值额外注入 -10 MPa 扰动保持 0.4s)
 */
export function buildDemoProfile(
  duration: number,
  dt: number,
  target: number,
  stepAt = 0.2,
  disturbAt = 3.5,
): number[] {
  const N = Math.ceil(duration / dt);
  const out = new Array<number>(N).fill(0);
  const stepIdx = Math.floor(stepAt / dt);
  const disturbStart = Math.floor(disturbAt / dt);
  const disturbEnd = Math.floor((disturbAt + 0.4) / dt);
  for (let i = 0; i < N; i++) {
    let v = i >= stepIdx ? target : 0;
    if (i >= disturbStart && i < disturbEnd) v = Math.max(0, target - 10);
    out[i] = v;
  }
  return out;
}

/**
 * 评估指标: 超调、稳态误差、2% 调节时间、RMSE
 */
export function evalResponse(trace: SimTrace, target: number): {
  overshoot: number;
  steadyError: number;
  settlingTime: number;
  rmse: number;
} {
  const { t, measured } = trace;
  const N = measured.length;
  const peak = Math.max(...measured);
  const overshoot = Math.max(0, ((peak - target) / target) * 100);

  // 稳态取最后 15% 平均
  const tailStart = Math.floor(N * 0.85);
  let tailSum = 0;
  for (let i = tailStart; i < N; i++) tailSum += measured[i];
  const tailMean = tailSum / (N - tailStart);
  const steadyError = tailMean - target;

  // 2% 调节时间(从最后一次越过 ±2% 带的时刻算)
  const band = target * 0.02;
  let settleIdx = 0;
  for (let i = N - 1; i >= 0; i--) {
    if (Math.abs(measured[i] - target) > band) { settleIdx = i; break; }
  }
  const settlingTime = t[settleIdx];

  let sq = 0;
  for (let i = 0; i < N; i++) sq += (measured[i] - trace.setpoint[i]) ** 2;
  const rmse = Math.sqrt(sq / N);

  return { overshoot, steadyError, settlingTime, rmse };
}

/** 单步闭环接口 —— 给 UI 做逐帧动画用 */
export class ConfiningPressurePlant {
  private p = 0;
  private pDot = 0;
  private uBuffer: number[];
  private params: PlantParams;

  constructor(params: PlantParams, dt: number) {
    this.params = params;
    const delaySteps = Math.max(0, Math.round(params.deadTime / dt));
    this.uBuffer = new Array(delaySteps + 1).fill(0);
  }

  reset(): void {
    this.p = 0;
    this.pDot = 0;
    this.uBuffer.fill(0);
  }

  /** 当前压力(带测量噪声) */
  readPressure(): number {
    const { noiseStd = 0 } = this.params;
    return this.p + (noiseStd > 0 ? randn() * noiseStd : 0);
  }

  /** 步进一步,返回实际压力(无噪声,用于记录真值) */
  step(uNormalized: number, dt: number): number {
    const { K, tau, zeta } = this.params;
    this.uBuffer.push(clamp(uNormalized, 0, 1));
    const uDelayed = this.uBuffer.shift()!;
    const pDdot = (K * uDelayed - 2 * zeta * tau * this.pDot - this.p) / (tau * tau);
    this.pDot += pDdot * dt;
    this.p += this.pDot * dt;
    if (this.p < 0) { this.p = 0; this.pDot = Math.max(0, this.pDot); }
    return this.p;
  }
}

// ————————————————————————————————————————————
// 工具
// ————————————————————————————————————————————

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Box-Muller 标准正态随机 */
function randn(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export type { PIDStep };
