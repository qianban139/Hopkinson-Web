// src/features/experiment-2d/hooks/useRenderLoop.ts
// 60fps渲染循环Hook - 分层渲染(静态层缓存 + 动态层每帧)
import { useEffect, useRef, useCallback } from 'react';

export type RenderCallback = (
  ctx: CanvasRenderingContext2D,
  time: number,
  dt: number,
  width: number,
  height: number
) => void;

interface UseRenderLoopOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  render: RenderCallback;
  /** 是否需要持续渲染(false=仅状态变化时渲染) */
  continuous?: boolean;
  /** 目标FPS */
  targetFps?: number;
}

export function useRenderLoop({ canvasRef, render, continuous = true, targetFps = 60 }: UseRenderLoopOptions) {
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const frameInterval = 1000 / targetFps;
  const renderRef = useRef(render);
  renderRef.current = render;

  const tick = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dt = timestamp - lastTimeRef.current;
    if (dt < frameInterval * 0.9) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    lastTimeRef.current = timestamp;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    renderRef.current(ctx, timestamp, dt, w, h);
    ctx.restore();

    if (continuous) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [canvasRef, continuous, frameInterval]);

  // 启动/停止渲染循环
  useEffect(() => {
    if (continuous) {
      lastTimeRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [continuous, tick]);

  // 手动触发一帧(用于非连续模式)
  const requestFrame = useCallback(() => {
    if (!continuous) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [continuous, tick]);

  return { requestFrame };
}
