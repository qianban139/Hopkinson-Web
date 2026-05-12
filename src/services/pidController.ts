/**
 * PID 闭环控制器
 *
 * 实现 PID 控制律:
 *   u(t) = Kp·e(t) + Ki·∫e(τ)dτ + Kd·de(t)/dt
 * 其中 e(t) = setpoint - measurement
 *
 * 工程增强:
 *   1. 抗积分饱和(clamping)—— 当输出已饱和时,暂停同向积分
 *   2. 微分项基于测量值(derivative on measurement)—— 避免设定值阶跃
 *      导致的"微分冲击"(derivative kick)
 *   3. 低通滤波微分项 —— 抑制测量噪声放大
 */

export interface PIDConfig {
  /** 比例增益 */
  kp: number;
  /** 积分增益 (1/s) */
  ki: number;
  /** 微分增益 (s) */
  kd: number;
  /** 输出饱和下限 */
  outMin: number;
  /** 输出饱和上限 */
  outMax: number;
  /** 微分低通滤波系数 α ∈ (0,1],1=不滤波 */
  dAlpha?: number;
}

export interface PIDStep {
  /** 时间 (s) */
  t: number;
  /** 设定值 */
  setpoint: number;
  /** 测量值 */
  measurement: number;
  /** 偏差 */
  error: number;
  /** 控制器输出 */
  output: number;
  /** P 分量 */
  pTerm: number;
  /** I 分量 */
  iTerm: number;
  /** D 分量 */
  dTerm: number;
}

export class PIDController {
  private cfg: PIDConfig;
  private integral = 0;
  private prevMeasurement: number | null = null;
  private prevDTerm = 0;

  constructor(cfg: PIDConfig) {
    this.cfg = { dAlpha: 0.3, ...cfg };
  }

  /** 重置积分与历史状态 */
  reset(): void {
    this.integral = 0;
    this.prevMeasurement = null;
    this.prevDTerm = 0;
  }

  /** 在线更新增益(运行时调参) */
  setGains(kp: number, ki: number, kd: number): void {
    this.cfg.kp = kp;
    this.cfg.ki = ki;
    this.cfg.kd = kd;
  }

  /**
   * 单步计算
   * @param setpoint  设定值(目标围压 MPa)
   * @param measurement  当前测量值(实际围压 MPa)
   * @param dt  本步时长(s)
   */
  update(setpoint: number, measurement: number, dt: number): PIDStep {
    const { kp, ki, kd, outMin, outMax, dAlpha = 0.3 } = this.cfg;
    const error = setpoint - measurement;

    // P 项
    const pTerm = kp * error;

    // D 项(基于测量值)
    let dRaw = 0;
    if (this.prevMeasurement !== null && dt > 0) {
      dRaw = -kd * ((measurement - this.prevMeasurement) / dt);
    }
    // 一阶低通滤波: y = α·x + (1-α)·y_prev
    const dTerm = dAlpha * dRaw + (1 - dAlpha) * this.prevDTerm;
    this.prevDTerm = dTerm;
    this.prevMeasurement = measurement;

    // I 项(先尝试累积,若饱和则按方向夹紧)
    const iIncrement = ki * error * dt;
    let iTrial = this.integral + iIncrement;
    let iTerm = iTrial;

    const unsaturated = pTerm + iTerm + dTerm;
    let output = unsaturated;
    /** 饱和方向: +1 = 上界饱和, -1 = 下界饱和, 0 = 未饱和 */
    let satDir = 0;

    if (output > outMax) {
      output = outMax;
      satDir = 1;
    } else if (output < outMin) {
      output = outMin;
      satDir = -1;
    }

    // Audit PID-1: 抗积分饱和 — 仅当本步积分增量与饱和方向同向时回退,
    // 否则允许积分回退(避免无界增长但又不阻止恢复).
    // 旧代码用 sign(error)===sign(ki*error) 在 ki>0 时恒为 true,
    // 实际上 "任何饱和都冻结积分", 阻止饱和退出.
    if (satDir !== 0 && Math.sign(iIncrement) === satDir) {
      iTrial = this.integral; // 仅当继续向饱和方向积累时回退
      iTerm = iTrial;
    }
    this.integral = iTrial;

    return {
      t: 0, // 由调用方填
      setpoint,
      measurement,
      error,
      output,
      pTerm,
      iTerm,
      dTerm,
    };
  }
}

/**
 * Ziegler-Nichols 经验整定(临界比例法)
 * @param ku  临界增益(系统等幅振荡时的 Kp)
 * @param tu  临界周期(s)
 * @param mode  'classic' | 'pessen' | 'no-overshoot'
 */
export function zieglerNicholsTune(
  ku: number,
  tu: number,
  mode: 'classic' | 'pessen' | 'no-overshoot' = 'classic',
): { kp: number; ki: number; kd: number } {
  switch (mode) {
    case 'pessen':
      return { kp: 0.7 * ku, ki: (1.75 * ku) / tu, kd: 0.105 * ku * tu };
    case 'no-overshoot':
      return { kp: 0.2 * ku, ki: (0.4 * ku) / tu, kd: (2 / 30) * ku * tu };
    case 'classic':
    default:
      return { kp: 0.6 * ku, ki: (1.2 * ku) / tu, kd: 0.075 * ku * tu };
  }
}
