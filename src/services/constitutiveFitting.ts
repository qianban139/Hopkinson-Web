/**
 * 多本构模型拟合引擎
 *
 * 支持 5 种常用动态本构模型，统一通过 Levenberg-Marquardt 风格的
 * 简化非线性最小二乘进行参数拟合。
 *
 * 模型清单：
 * 1. Johnson-Cook (J-C)         : σ = (A + B·εⁿ)(1 + C·ln(ε̇/ε̇₀))(1 - T*ᵐ)
 * 2. Cowper-Symonds (C-S)       : σ = σ₀(1 + (ε̇/D)^(1/q))
 * 3. Zerilli-Armstrong (Z-A)    : σ = C₀ + C₁·exp(-C₃T + C₄T·ln(ε̇)) + C₅·ε^n
 * 4. Power Law                  : σ = K·εⁿ
 * 5. Bilinear (双线性硬化)       : σ = E·ε        (ε ≤ εy)
 *                                  σ = σy + Et·(ε-εy) (ε > εy)
 *
 * 数据格式：实验点 = [(应变, 应力, 应变率, 温度)]
 */

/** 单个实验数据点 */
export interface DataPoint {
  strain: number;
  stress: number; // MPa
  strainRate: number; // 1/s
  temperature?: number; // K
}

/** 拟合结果通用接口 */
export interface FitResult<P> {
  /** 拟合参数 */
  params: P;
  /** 决定系数 R² */
  rSquared: number;
  /** 均方根误差 (MPa) */
  rmse: number;
  /** 残差序列 */
  residuals: number[];
  /** 模型预测值 */
  predicted: number[];
  /** 拟合迭代次数 */
  iterations: number;
  /** 模型名称 */
  modelName: string;
}

/* ============================================================
 * 通用工具
 * ============================================================ */

function computeRSquared(actual: number[], predicted: number[]): number {
  const mean = actual.reduce((a, b) => a + b, 0) / actual.length;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < actual.length; i++) {
    ssRes += (actual[i] - predicted[i]) ** 2;
    ssTot += (actual[i] - mean) ** 2;
  }
  return ssTot > 0 ? 1 - ssRes / ssTot : 0;
}

function computeRMSE(actual: number[], predicted: number[]): number {
  let sum = 0;
  for (let i = 0; i < actual.length; i++) {
    sum += (actual[i] - predicted[i]) ** 2;
  }
  return Math.sqrt(sum / actual.length);
}

/** 简化非线性最小二乘：坐标下降 + 自适应步长 */
function nonlinearOptimize(
  initial: number[],
  bounds: Array<[number, number]>,
  costFn: (params: number[]) => number,
  maxIterations = 200,
  tolerance = 1e-6,
): { params: number[]; iterations: number } {
  const params = [...initial];
  let prevCost = costFn(params);
  let step = 0.1;
  let iter = 0;

  for (iter = 0; iter < maxIterations; iter++) {
    let improved = false;
    for (let i = 0; i < params.length; i++) {
      const original = params[i];
      const range = bounds[i][1] - bounds[i][0];
      const delta = step * range;

      // 试探正向
      params[i] = Math.min(bounds[i][1], original + delta);
      const costPlus = costFn(params);

      // 试探反向
      params[i] = Math.max(bounds[i][0], original - delta);
      const costMinus = costFn(params);

      // 选最优
      if (costPlus < prevCost && costPlus <= costMinus) {
        params[i] = Math.min(bounds[i][1], original + delta);
        prevCost = costPlus;
        improved = true;
      } else if (costMinus < prevCost) {
        params[i] = Math.max(bounds[i][0], original - delta);
        prevCost = costMinus;
        improved = true;
      } else {
        params[i] = original;
      }
    }

    if (!improved) {
      step *= 0.5;
      if (step < tolerance) break;
    }
  }

  return { params, iterations: iter + 1 };
}

/* ============================================================
 * 1. Johnson-Cook 模型
 * ============================================================ */

export interface JCParams {
  A: number; // 屈服强度 (MPa)
  B: number; // 应变硬化系数 (MPa)
  n: number; // 应变硬化指数
  C: number; // 应变率敏感系数
  m: number; // 温度软化指数
  refStrainRate: number; // 参考应变率 (1/s)
  refTemperature: number; // 参考温度 (K)
  meltingTemperature: number; // 熔点 (K)
}

export function jcStress(params: JCParams, p: DataPoint): number {
  const { A, B, n, C, m, refStrainRate, refTemperature, meltingTemperature } = params;
  const strainTerm = A + B * Math.pow(Math.max(p.strain, 0), n);
  const rateTerm = 1 + C * Math.log(Math.max(p.strainRate / refStrainRate, 1e-6));
  const T = p.temperature ?? refTemperature;
  const tStar = Math.max(0, (T - refTemperature) / (meltingTemperature - refTemperature));
  const tempTerm = 1 - Math.pow(tStar, m);
  return strainTerm * Math.max(rateTerm, 0) * Math.max(tempTerm, 0);
}

export function fitJohnsonCook(
  data: DataPoint[],
  fixed: Pick<JCParams, 'refStrainRate' | 'refTemperature' | 'meltingTemperature'>,
): FitResult<JCParams> {
  const initial = [350, 600, 0.3, 0.02, 1.0]; // A, B, n, C, m
  const bounds: Array<[number, number]> = [
    [50, 2000],
    [50, 3000],
    [0.05, 1.0],
    [0.001, 0.2],
    [0.3, 2.0],
  ];

  const cost = (p: number[]): number => {
    const params: JCParams = {
      A: p[0], B: p[1], n: p[2], C: p[3], m: p[4], ...fixed,
    };
    let sum = 0;
    for (const pt of data) {
      const pred = jcStress(params, pt);
      sum += (pred - pt.stress) ** 2;
    }
    return sum / data.length;
  };

  const { params: optimal, iterations } = nonlinearOptimize(initial, bounds, cost);
  const fitted: JCParams = {
    A: optimal[0], B: optimal[1], n: optimal[2], C: optimal[3], m: optimal[4], ...fixed,
  };

  const predicted = data.map((pt) => jcStress(fitted, pt));
  const actual = data.map((pt) => pt.stress);
  const residuals = actual.map((a, i) => a - predicted[i]);

  return {
    params: fitted,
    rSquared: computeRSquared(actual, predicted),
    rmse: computeRMSE(actual, predicted),
    residuals,
    predicted,
    iterations,
    modelName: 'Johnson-Cook',
  };
}

/* ============================================================
 * 2. Cowper-Symonds 模型
 * ============================================================ */

export interface CSParams {
  sigma0: number; // 准静态屈服强度 (MPa)
  D: number; // 应变率系数 (1/s)
  q: number; // 应变率指数
}

export function csStress(params: CSParams, p: DataPoint): number {
  const ratio = Math.max(p.strainRate / params.D, 0);
  return params.sigma0 * (1 + Math.pow(ratio, 1 / params.q));
}

export function fitCowperSymonds(data: DataPoint[]): FitResult<CSParams> {
  const initial = [350, 40, 5];
  const bounds: Array<[number, number]> = [
    [50, 2000],
    [1, 10000],
    [1, 20],
  ];

  const cost = (p: number[]): number => {
    const params: CSParams = { sigma0: p[0], D: p[1], q: p[2] };
    let sum = 0;
    for (const pt of data) {
      sum += (csStress(params, pt) - pt.stress) ** 2;
    }
    return sum / data.length;
  };

  const { params: optimal, iterations } = nonlinearOptimize(initial, bounds, cost);
  const fitted: CSParams = { sigma0: optimal[0], D: optimal[1], q: optimal[2] };
  const predicted = data.map((pt) => csStress(fitted, pt));
  const actual = data.map((pt) => pt.stress);
  return {
    params: fitted,
    rSquared: computeRSquared(actual, predicted),
    rmse: computeRMSE(actual, predicted),
    residuals: actual.map((a, i) => a - predicted[i]),
    predicted,
    iterations,
    modelName: 'Cowper-Symonds',
  };
}

/* ============================================================
 * 3. Zerilli-Armstrong 模型 (FCC 形式)
 * ============================================================ */

export interface ZAParams {
  C0: number; // (MPa)
  C1: number; // (MPa)
  C3: number; // (1/K)
  C4: number; // (1/K)
  C5: number; // (MPa)
  n: number; // 应变硬化指数
}

export function zaStress(params: ZAParams, p: DataPoint): number {
  const T = p.temperature ?? 300;
  const lnRate = Math.log(Math.max(p.strainRate, 1e-6));
  const expTerm = Math.exp(-params.C3 * T + params.C4 * T * lnRate);
  const strainTerm = params.C5 * Math.pow(Math.max(p.strain, 0), params.n);
  return params.C0 + params.C1 * expTerm + strainTerm;
}

export function fitZerilliArmstrong(data: DataPoint[]): FitResult<ZAParams> {
  const initial = [50, 1000, 0.005, 0.0002, 300, 0.3];
  const bounds: Array<[number, number]> = [
    [0, 500],
    [100, 3000],
    [0.0001, 0.02],
    [0.00001, 0.001],
    [50, 1500],
    [0.05, 1.0],
  ];

  const cost = (p: number[]): number => {
    const params: ZAParams = {
      C0: p[0], C1: p[1], C3: p[2], C4: p[3], C5: p[4], n: p[5],
    };
    let sum = 0;
    for (const pt of data) {
      sum += (zaStress(params, pt) - pt.stress) ** 2;
    }
    return sum / data.length;
  };

  const { params: optimal, iterations } = nonlinearOptimize(initial, bounds, cost);
  const fitted: ZAParams = {
    C0: optimal[0], C1: optimal[1], C3: optimal[2], C4: optimal[3], C5: optimal[4], n: optimal[5],
  };
  const predicted = data.map((pt) => zaStress(fitted, pt));
  const actual = data.map((pt) => pt.stress);
  return {
    params: fitted,
    rSquared: computeRSquared(actual, predicted),
    rmse: computeRMSE(actual, predicted),
    residuals: actual.map((a, i) => a - predicted[i]),
    predicted,
    iterations,
    modelName: 'Zerilli-Armstrong',
  };
}

/* ============================================================
 * 4. Power Law 模型
 * ============================================================ */

export interface PowerLawParams {
  K: number; // 强度系数 (MPa)
  n: number; // 硬化指数
}

export function powerLawStress(params: PowerLawParams, p: DataPoint): number {
  return params.K * Math.pow(Math.max(p.strain, 1e-6), params.n);
}

/** Power Law 可对数线性化，用解析最小二乘拟合 */
export function fitPowerLaw(data: DataPoint[]): FitResult<PowerLawParams> {
  // ln(σ) = ln(K) + n·ln(ε)
  const valid = data.filter((p) => p.strain > 0 && p.stress > 0);
  if (valid.length < 2) {
    return {
      params: { K: 0, n: 0 },
      rSquared: 0,
      rmse: 0,
      residuals: [],
      predicted: [],
      iterations: 0,
      modelName: 'Power Law',
    };
  }

  const x = valid.map((p) => Math.log(p.strain));
  const y = valid.map((p) => Math.log(p.stress));
  const meanX = x.reduce((a, b) => a + b, 0) / x.length;
  const meanY = y.reduce((a, b) => a + b, 0) / y.length;

  let num = 0;
  let den = 0;
  for (let i = 0; i < x.length; i++) {
    num += (x[i] - meanX) * (y[i] - meanY);
    den += (x[i] - meanX) ** 2;
  }
  const n = den !== 0 ? num / den : 0;
  const lnK = meanY - n * meanX;
  const K = Math.exp(lnK);

  const fitted: PowerLawParams = { K, n };
  const predicted = data.map((pt) => powerLawStress(fitted, pt));
  const actual = data.map((pt) => pt.stress);

  return {
    params: fitted,
    rSquared: computeRSquared(actual, predicted),
    rmse: computeRMSE(actual, predicted),
    residuals: actual.map((a, i) => a - predicted[i]),
    predicted,
    iterations: 1,
    modelName: 'Power Law',
  };
}

/* ============================================================
 * 5. Bilinear 模型（双线性硬化）
 * ============================================================ */

export interface BilinearParams {
  E: number; // 弹性模量 (GPa)
  yieldStrain: number;
  yieldStress: number; // MPa
  Et: number; // 切线模量 (GPa)
}

export function bilinearStress(params: BilinearParams, p: DataPoint): number {
  if (p.strain <= params.yieldStrain) {
    return params.E * 1000 * p.strain; // GPa·1 → MPa
  }
  return params.yieldStress + params.Et * 1000 * (p.strain - params.yieldStrain);
}

export function fitBilinear(data: DataPoint[]): FitResult<BilinearParams> {
  // 找屈服点候选：取应变最小若干点估弹性模量，剩余拟合切线
  const sorted = [...data].sort((a, b) => a.strain - b.strain);
  const n = sorted.length;
  if (n < 4) {
    return {
      params: { E: 0, yieldStrain: 0, yieldStress: 0, Et: 0 },
      rSquared: 0,
      rmse: 0,
      residuals: [],
      predicted: [],
      iterations: 0,
      modelName: 'Bilinear',
    };
  }

  // 用前 30% 数据估算弹性模量
  const elasticEnd = Math.max(2, Math.floor(n * 0.3));
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < elasticEnd; i++) {
    sumXY += sorted[i].strain * sorted[i].stress;
    sumXX += sorted[i].strain ** 2;
  }
  const E_MPa = sumXX > 0 ? sumXY / sumXX : 0;
  const E = E_MPa / 1000; // MPa → GPa

  // 屈服点：取弹性段末尾
  const yieldStrain = sorted[elasticEnd - 1].strain;
  const yieldStress = sorted[elasticEnd - 1].stress;

  // 用后段数据拟合切线模量
  let sumX = 0, sumY = 0, sumXY2 = 0, sumXX2 = 0;
  let cnt = 0;
  for (let i = elasticEnd; i < n; i++) {
    const xi = sorted[i].strain - yieldStrain;
    const yi = sorted[i].stress - yieldStress;
    sumX += xi;
    sumY += yi;
    sumXY2 += xi * yi;
    sumXX2 += xi * xi;
    cnt++;
  }
  const Et_MPa = cnt > 1 && sumXX2 * cnt - sumX * sumX !== 0
    ? (cnt * sumXY2 - sumX * sumY) / (cnt * sumXX2 - sumX * sumX)
    : 0;
  const Et = Et_MPa / 1000;

  const fitted: BilinearParams = { E, yieldStrain, yieldStress, Et };
  const predicted = data.map((pt) => bilinearStress(fitted, pt));
  const actual = data.map((pt) => pt.stress);

  return {
    params: fitted,
    rSquared: computeRSquared(actual, predicted),
    rmse: computeRMSE(actual, predicted),
    residuals: actual.map((a, i) => a - predicted[i]),
    predicted,
    iterations: 1,
    modelName: 'Bilinear',
  };
}

/* ============================================================
 * 统一入口：根据模型 id 拟合
 * ============================================================ */

export type ConstitutiveModelId =
  | 'johnson-cook'
  | 'cowper-symonds'
  | 'zerilli-armstrong'
  | 'power-law'
  | 'bilinear';

export interface ModelInfo {
  id: ConstitutiveModelId;
  name: string;
  formula: string;
  description: string;
  paramCount: number;
  applicableRange: string;
}

export const MODEL_REGISTRY: ModelInfo[] = [
  {
    id: 'johnson-cook',
    name: 'Johnson-Cook',
    formula: 'σ = (A + B·εⁿ)(1 + C·ln(ε̇/ε̇₀))(1 - T*ᵐ)',
    description: '同时考虑应变硬化、应变率强化、温度软化，是金属动态本构最常用模型',
    paramCount: 5,
    applicableRange: '应变率 10⁻³ ~ 10⁵ /s，温度宽广范围',
  },
  {
    id: 'cowper-symonds',
    name: 'Cowper-Symonds',
    formula: 'σ = σ₀(1 + (ε̇/D)^(1/q))',
    description: '只考虑应变率强化的简化模型，参数少便于工程应用',
    paramCount: 3,
    applicableRange: '中高应变率，等温',
  },
  {
    id: 'zerilli-armstrong',
    name: 'Zerilli-Armstrong',
    formula: 'σ = C₀ + C₁·exp(-C₃T + C₄T·lnε̇) + C₅·εⁿ',
    description: '基于位错动力学的物理模型，FCC 形式',
    paramCount: 6,
    applicableRange: 'FCC 金属（铜、铝、奥氏体钢）',
  },
  {
    id: 'power-law',
    name: 'Power Law',
    formula: 'σ = K·εⁿ',
    description: '最简单的应变硬化模型，可对数线性拟合',
    paramCount: 2,
    applicableRange: '准静态、室温、单调加载',
  },
  {
    id: 'bilinear',
    name: 'Bilinear (双线性硬化)',
    formula: 'σ = E·ε (弹性) | σ = σy + Et·(ε-εy) (塑性)',
    description: '弹塑性两段直线，用于有限元仿真简化',
    paramCount: 4,
    applicableRange: '工程结构计算',
  },
];

export function fitConstitutiveModel(
  modelId: ConstitutiveModelId,
  data: DataPoint[],
  options?: {
    refStrainRate?: number;
    refTemperature?: number;
    meltingTemperature?: number;
  },
): FitResult<unknown> {
  switch (modelId) {
    case 'johnson-cook':
      return fitJohnsonCook(data, {
        refStrainRate: options?.refStrainRate ?? 1,
        refTemperature: options?.refTemperature ?? 300,
        meltingTemperature: options?.meltingTemperature ?? 1800,
      }) as FitResult<unknown>;
    case 'cowper-symonds':
      return fitCowperSymonds(data) as FitResult<unknown>;
    case 'zerilli-armstrong':
      return fitZerilliArmstrong(data) as FitResult<unknown>;
    case 'power-law':
      return fitPowerLaw(data) as FitResult<unknown>;
    case 'bilinear':
      return fitBilinear(data) as FitResult<unknown>;
  }
}

/**
 * 从应力-应变曲线生成 DataPoint 序列
 */
export function curveToDataPoints(
  strain: number[],
  stress: number[],
  strainRate: number,
  temperature?: number,
): DataPoint[] {
  const n = Math.min(strain.length, stress.length);
  const out: DataPoint[] = [];
  for (let i = 0; i < n; i++) {
    if (strain[i] >= 0 && stress[i] >= 0) {
      out.push({ strain: strain[i], stress: stress[i], strainRate, temperature });
    }
  }
  return out;
}
