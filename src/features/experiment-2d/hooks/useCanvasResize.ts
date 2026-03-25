// src/features/experiment-2d/hooks/useCanvasResize.ts
// Canvas自适应缩放Hook - 处理DPI和容器尺寸变化
import { useEffect, useCallback, useRef } from 'react';

interface UseCanvasResizeOptions {
  /** 设计宽度(逻辑像素) */
  designWidth: number;
  /** 设计高度(逻辑像素) */
  designHeight: number;
  /** 最小缩放比 */
  minScale?: number;
}

interface CanvasSize {
  width: number;
  height: number;
  scale: number;
  dpr: number;
}

export function useCanvasResize(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: UseCanvasResizeOptions
) {
  const sizeRef = useRef<CanvasSize>({
    width: options.designWidth,
    height: options.designHeight,
    scale: 1,
    dpr: 1,
  });

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const containerW = rect.width;
    const containerH = rect.height;

    // 计算缩放以适配容器(保持宽高比)
    const scaleX = containerW / options.designWidth;
    const scaleY = containerH / options.designHeight;
    // 填满宽度（宽高比极大时宽度为瓶颈），垂直自动居中
    const scale = Math.max(options.minScale ?? 0.3, Math.min(scaleX, scaleY));

    const displayW = options.designWidth * scale;
    const displayH = options.designHeight * scale;

    // CSS尺寸 — 居中于容器
    canvas.style.width = `${displayW}px`;
    canvas.style.height = `${displayH}px`;
    canvas.style.position = 'absolute';
    canvas.style.left = `${(containerW - displayW) / 2}px`;
    canvas.style.top = `${(containerH - displayH) / 2}px`;

    // 物理像素尺寸
    canvas.width = displayW * dpr;
    canvas.height = displayH * dpr;

    sizeRef.current = { width: displayW, height: displayH, scale, dpr };
  }, [canvasRef, containerRef, options.designWidth, options.designHeight, options.minScale]);

  useEffect(() => {
    resize();
    const observer = new ResizeObserver(resize);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener('resize', resize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [resize, containerRef]);

  return { sizeRef, resize };
}
