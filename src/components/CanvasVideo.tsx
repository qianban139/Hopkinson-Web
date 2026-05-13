/**
 * CanvasVideo — 通过 canvas 代理渲染 video 帧, 隐藏浏览器原生悬浮控件
 *
 * 问题: Chrome/Edge 等浏览器在 <video> 元素 hover 时强制显示"下载/投屏/PIP"
 * 等浮层, 即使 controls={false} 与 controlsList="nodownload..." 也无法
 * 彻底隐藏. 这是浏览器 chrome 级 overlay, CSS 伪元素管不到.
 *
 * 方案: 让真正的 <video> 元素离屏 (位置 -9999px / 1×1 像素 / opacity 0),
 * 浏览器检测不到鼠标 hover 在 video bounding box 上 → 不显示浮层.
 * 同时用 <canvas> 在原位置以 drawImage(video) 逐帧渲染, 视觉上等同于
 * 直接放 video 元素.
 *
 * 性能: 使用 requestVideoFrameCallback (Chrome 87+ / 已普及) 仅在视频有新
 * 帧时 draw, 比 requestAnimationFrame 节能. 老浏览器自动 fallback 到 rAF.
 *
 * 父组件透过 ref 直接拿到 HTMLVideoElement, 与普通 <video> 用法一致:
 *   const videoRef = useRef<HTMLVideoElement>(null);
 *   <CanvasVideo ref={videoRef} src=... muted onLoadedMetadata=... />
 *   videoRef.current?.play();
 */

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { CSSProperties, ReactEventHandler, MouseEventHandler } from 'react';

interface CanvasVideoProps {
  src: string;
  className?: string;
  style?: CSSProperties;
  /** canvas 渲染分辨率 (默认跟随视频原始分辨率); 想节省 GPU 时可降低 */
  renderScale?: number;

  // 标准 video 透传属性
  muted?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  playsInline?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
  poster?: string;

  // 事件透传
  onLoadedMetadata?: ReactEventHandler<HTMLVideoElement>;
  onCanPlay?: ReactEventHandler<HTMLVideoElement>;
  onPlay?: ReactEventHandler<HTMLVideoElement>;
  onPause?: ReactEventHandler<HTMLVideoElement>;
  onEnded?: ReactEventHandler<HTMLVideoElement>;
  onTimeUpdate?: ReactEventHandler<HTMLVideoElement>;

  // canvas 的点击/右键 (用户交互捕获在 canvas 上)
  onClick?: MouseEventHandler<HTMLCanvasElement>;
  onContextMenu?: MouseEventHandler<HTMLCanvasElement>;
}

interface VideoFrameCallbackVideo extends HTMLVideoElement {
  requestVideoFrameCallback?: (cb: (now: number, metadata: unknown) => void) => number;
  cancelVideoFrameCallback?: (id: number) => void;
}

const CanvasVideo = forwardRef<HTMLVideoElement, CanvasVideoProps>(function CanvasVideo(
  {
    src,
    className,
    style,
    renderScale = 1,
    muted,
    autoPlay,
    loop,
    playsInline,
    preload,
    poster,
    onLoadedMetadata,
    onCanPlay,
    onPlay,
    onPause,
    onEnded,
    onTimeUpdate,
    onClick,
    onContextMenu,
  },
  ref,
) {
  const videoRef = useRef<VideoFrameCallbackVideo>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useImperativeHandle<HTMLVideoElement, HTMLVideoElement>(
    ref,
    () => videoRef.current as HTMLVideoElement,
    [],
  );

  useEffect(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;

    const ctx = c.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) return;

    let rafId = 0;
    let vfcId = 0;
    let stopped = false;

    function drawFrame(): void {
      if (!v || !c) return;
      if (v.readyState < 2 || v.videoWidth === 0) return;
      const targetW = Math.max(1, Math.round(v.videoWidth * renderScale));
      const targetH = Math.max(1, Math.round(v.videoHeight * renderScale));
      if (c.width !== targetW) c.width = targetW;
      if (c.height !== targetH) c.height = targetH;
      ctx!.drawImage(v, 0, 0, targetW, targetH);
    }

    if (typeof v.requestVideoFrameCallback === 'function') {
      const cb = (): void => {
        if (stopped) return;
        drawFrame();
        vfcId = v.requestVideoFrameCallback!(cb);
      };
      vfcId = v.requestVideoFrameCallback(cb);
    } else {
      const loopFrame = (): void => {
        if (stopped) return;
        drawFrame();
        rafId = requestAnimationFrame(loopFrame);
      };
      rafId = requestAnimationFrame(loopFrame);
    }

    return () => {
      stopped = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (vfcId && typeof v.cancelVideoFrameCallback === 'function') {
        v.cancelVideoFrameCallback(vfcId);
      }
    };
  }, [renderScale]);

  return (
    <>
      {/* 真正的 video 元素离屏 1×1 像素, 浏览器不会在它上面显示悬浮控件.
          仍可正常播放、响应事件、控制 currentTime/play/pause/muted */}
      <video
        ref={videoRef}
        src={src}
        muted={muted}
        autoPlay={autoPlay}
        loop={loop}
        playsInline={playsInline}
        preload={preload}
        poster={poster}
        disablePictureInPicture
        disableRemotePlayback
        onLoadedMetadata={onLoadedMetadata}
        onCanPlay={onCanPlay}
        onPlay={onPlay}
        onPause={onPause}
        onEnded={onEnded}
        onTimeUpdate={onTimeUpdate}
        style={{
          position: 'fixed',
          left: -9999,
          top: -9999,
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
        }}
        aria-hidden
      />
      {/* canvas 在原位置渲染视频帧, 浏览器不识别为 video → 不显示悬浮控件 */}
      <canvas
        ref={canvasRef}
        className={className}
        style={style}
        onClick={onClick}
        onContextMenu={onContextMenu}
      />
    </>
  );
});

export default CanvasVideo;
