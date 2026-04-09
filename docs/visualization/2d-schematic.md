# 2D 示意图渲染

> Canvas 2D + 自定义渲染器的精细 SHPB 示意图

---

## 一、设计目标

提供高性能、可标注、清晰的 SHPB 装置 2D 示意图，作为 3D 视图的轻量替代方案。

## 二、文件结构

```
src/features/experiment-2d/
├── HopkinsonBar2DRealistic.tsx  # 主 2D 场景组件
├── index.ts                     # 模块导出
├── renderers/                   # 各组件渲染器
│   ├── StrikerBar.ts            #   打击杆
│   ├── IncidentBar.ts           #   入射杆
│   ├── TransmittedBar.ts        #   透射杆
│   ├── Specimen.ts              #   试件
│   ├── ElectromagneticCoil.ts   #   电磁线圈
│   ├── CapacitorBank.ts         #   电容器组
│   ├── StrainGauge.ts           #   应变片
│   └── ...
├── hooks/
│   ├── useRenderLoop.ts         # requestAnimationFrame 渲染循环
│   └── useCanvasResize.ts       # Canvas 自适应尺寸
└── utils/
    └── canvasHelpers.ts         # 通用绘图工具
```

## 三、渲染器模式

每个 SHPB 组件实现统一的 Renderer 接口：

```typescript
interface Renderer {
  draw(ctx: CanvasRenderingContext2D, time: number, state: RenderState): void;
  hitTest?(x: number, y: number): boolean;
}
```

### 优势

- **职责分离**：每个组件独立维护
- **易于扩展**：新增组件只需添加渲染器
- **性能可控**：可选择性跳过未变化的组件

## 四、渲染循环

`useRenderLoop.ts` 基于 `requestAnimationFrame`：

```typescript
function useRenderLoop(canvasRef, draw) {
  useEffect(() => {
    let raf: number;
    const loop = (time: number) => {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) draw(ctx, time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [draw]);
}
```

## 五、Canvas 自适应

`useCanvasResize.ts` 处理设备像素比 (DPR) 和窗口尺寸变化：

- 自动适配高 DPI 屏幕
- 监听窗口 resize 事件
- 保持设计坐标系一致性

## 六、绘制内容

### 静态元素

- 装置框架与基座
- 各组件的本体
- 标尺与坐标系
- 应变片位置标记

### 动态元素

- **应力波传播**：可视化入射、反射、透射波
- **打击杆运动**：实验过程动画
- **电流脉冲**：电磁线圈电流脉冲可视化
- **试件变形**：根据 J-C 模型实时变形
- **温度场**：热软化阶段的温度分布

## 七、与物理引擎的连接

```
shpbPhysicsEngine.runSHPBSimulation()
    │
    ▼
SimulationResult
    │
    ▼
HopkinsonBar2DRealistic.tsx
    │
    ├── 设置波形振幅
    ├── 设置打击杆速度
    └── 触发动画播放
```

## 八、性能指标

- **目标帧率**：60 fps
- **内存占用**：< 50MB
- **首次渲染**：< 100ms
