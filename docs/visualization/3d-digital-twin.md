# 3D 数字孪生

> Three.js + React Three Fiber 的 SHPB 装置 3D 渲染

---

## 一、技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Three.js | 0.183.2 | WebGL 3D 渲染引擎 |
| React Three Fiber | 9.5.0 | React 声明式封装 |
| Drei | 10.7.7 | 常用 Helper（轨道控制、光照） |

## 二、文件结构

```
src/features/experiment-3d/
└── HopkinsonBar3D.tsx           # 主 3D 场景组件

src/components/
├── Model3D.tsx                  # 通用 3D 模型容器
└── GLTFModel.tsx                # GLTF 模型加载器
```

## 三、3D 场景组件

### HopkinsonBar3D

完整的霍普金森杆装置 3D 模型，包括：

- **打击杆 (Striker Bar)**：金属圆柱，18Ni 马氏体钢质感
- **入射杆 (Incident Bar)**：长金属杆，配应变片标记
- **试件 (Specimen)**：可替换为不同材料的小圆柱
- **透射杆 (Transmitted Bar)**：长金属杆
- **电磁线圈 (EM Coil)**：锥形线圈，发射时发光
- **电容器组 (Capacitor Bank)**：高压电容阵列
- **支架与基座 (Frame)**：金属框架结构
- **应变片 (Strain Gauges)**：杆件表面贴片标记

### 交互特性

- **轨道控制 (OrbitControls)**：鼠标拖拽旋转视角
- **缩放 (Zoom)**：滚轮缩放
- **自动旋转 (AutoRotate)**：可选自动旋转模式
- **材质高亮**：鼠标悬停部件高亮显示

## 四、渲染优化

### 性能策略

1. **几何体复用**：相同的杆件共享 Geometry
2. **LOD（细节层次）**：远景使用低多边形模型
3. **延迟加载**：3D 场景仅在 VirtualLab 页面挂载
4. **Suspense 边界**：3D 资源加载时显示骨架屏

### 视频降级

为了提升首屏性能，部分场景使用预渲染视频替代实时 3D：
- 视频托管在阿里云 OSS
- 添加 `crossOrigin` 属性避免 CORS 问题
- `autoPlay` + `loop` + `muted` 实现伪 3D 视图

## 五、与 2D 视图的关系

虚拟实验室页面提供两种视图模式：

| 模式 | 优点 | 缺点 |
|------|------|------|
| **2D 视图** | 性能高、清晰、可标注 | 缺少立体感 |
| **3D 视图** | 沉浸感强、空间关系清晰 | 性能开销大 |

用户可通过页面顶部 Tab 切换。

## 六、未来扩展

- **手势控制**：集成 MediaPipe 实现手势交互
- **AR/VR 模式**：WebXR 支持
- **实时数据驱动**：3D 模型根据真实传感器数据动态变化
- **多视角同步**：多个相机视角并排显示
