# 材料参数数据库

> 30+ 种材料的 Johnson-Cook 参数与物理属性

---

## 数据来源

`src/data/materials.json`

所有 J-C 参数均来自已发表的实验文献数据。

## 材料分类体系

本平台材料数据库覆盖 **7 大类**材料：

| 类别 | 代号前缀 | 典型材料 |
|------|---------|---------|
| 金属 (Metal) | `metal-` | 5A06 铝合金、Q235 钢、TC4 钛合金、45# 钢 |
| 矿石岩土 (Rock) | `rock-` | 砂岩、花岗岩、大理岩 |
| 混凝土 (Concrete) | `concrete-` | C30、C50、RPC 活性粉末混凝土 |
| 陶瓷 (Ceramic) | `ceramic-` | Al₂O₃ 氧化铝、SiC 碳化硅 |
| 高分子 (Polymer) | `polymer-` | PC 聚碳酸酯、环氧树脂、PEEK |
| 吸能材料 (Foam) | `foam-` | 铝泡沫、聚氨酯泡沫 |
| 生物材料 (Bio) | `bio-` | 人工骨、竹材 |

## 材料数据结构

每种材料包含以下属性：

```typescript
interface Material {
  id: string;                    // 唯一标识 (e.g. "metal-01")
  name: string;                  // 中文名称
  category: MaterialCategory;    // 所属大类
  subCategory: MaterialSubCategory; // 子类别
  density: number;               // 密度 (kg/m³)
  elasticModulus: number;        // 弹性模量 (Pa)
  yieldStrength: number;         // 准静态屈服强度 (MPa)
  johnsonCookParams: {           // J-C 本构参数
    A: number;  // 屈服应力 (MPa)
    B: number;  // 硬化系数 (MPa)
    n: number;  // 硬化指数
    C: number;  // 应变率敏感系数
    m: number;  // 温度软化指数
    Tm: number; // 熔点 (°C)
  };
  stiffness: number;             // 刚度系数
  damping: number;               // 阻尼系数
  emiThreshold: number;          // EMI 安全阈值
  typicalStrainRateRange: [number, number]; // 典型应变率范围
  stressStrainData: {strain: number; stress: number}[]; // 参考曲线
}
```

## 金属材料参数

| 材料 | 密度 (kg/m³) | E (GPa) | A (MPa) | B (MPa) | n | C | m | Tm (°C) |
|------|-------------|---------|---------|---------|-------|-------|-----|---------|
| 5A06 铝合金 | 2700 | 70 | 280 | 500 | 0.42 | 0.025 | 1.0 | 640 |
| Q235 结构钢 | 7850 | 210 | 235 | 450 | 0.35 | 0.015 | 1.0 | 1500 |
| TC4 钛合金 | 4430 | 114 | 950 | 800 | 0.50 | 0.018 | 0.9 | 1660 |
| 45# 钢 | 7850 | 210 | 507 | 320 | 0.28 | 0.064 | 1.06 | 1500 |

## 岩石与混凝土参数

| 材料 | 密度 (kg/m³) | E (GPa) | A (MPa) | B (MPa) | n | C | m | Tm (°C) |
|------|-------------|---------|---------|---------|-------|-------|-----|---------|
| 砂岩 | 2300 | 20 | 80 | 200 | 0.50 | 0.040 | 0.8 | 1200 |
| 花岗岩 | 2650 | 50 | 150 | 280 | 0.45 | 0.035 | 0.8 | 1200 |
| C30 混凝土 | 2400 | 30 | 30 | 120 | 0.40 | 0.040 | 1.0 | 1100 |
| C50 混凝土 | 2400 | 35 | 50 | 150 | 0.38 | 0.035 | 1.0 | 1100 |

## 高分子与吸能材料参数

| 材料 | 密度 (kg/m³) | E (GPa) | A (MPa) | B (MPa) | n | C | m | Tm (°C) |
|------|-------------|---------|---------|---------|-------|-------|-----|---------|
| PC 聚碳酸酯 | 1200 | 2.3 | 60 | 80 | 0.50 | 0.060 | 0.8 | 267 |
| 环氧树脂 | 1150 | 3.0 | 80 | 100 | 0.45 | 0.050 | 0.9 | 200 |
| 铝泡沫 | 450 | 1.0 | 5 | 40 | 0.60 | 0.030 | 1.0 | 640 |
| 聚氨酯泡沫 | 60 | 0.02 | 0.5 | 5 | 0.70 | 0.080 | 1.0 | 200 |

## 波阻抗匹配

材料的波阻抗 Z = ρc = √(ρE) 直接影响实验中的能量传递效率：

- **高阻抗材料**（钢、钛合金）：反射系数小，透射效率高
- **低阻抗材料**（泡沫、高分子）：反射系数大，需特殊杆设计

## 使用方式

```typescript
import materialsData from '@/data/materials.json';

// 按类别筛选
const metals = materialsData.materials.filter(m => m.category === '金属');

// 获取 J-C 参数
const jc = material.johnsonCookParams;
const stress = johnsonCookStress(strain, strainRate, temperature, jc);
```
