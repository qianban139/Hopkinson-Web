import { useState, useCallback, useRef, useEffect } from 'react';

// 实验4阶段定义 (适配 3D 实验视频)
export type ExperimentStage =
  | 'idle'              // 待机
  | 'confiningPressure' // 1. 试样变换围压
  | 'charging'          // 2. 电容充电
  | 'strikerLaunch'     // 3. 子弹发射
  | 'dataCollect'       // 4. 数据采集
  // 以下旧阶段保留以兼容部分 2D 渲染器判断（新流程不再使用）
  | 'coilAccel'
  | 'wavePropagate'
  | 'deformation';

export interface StageConfig {
  stage: ExperimentStage;
  label: string;
  duration: number; // 毫秒
  description: string;
}

// 默认阶段配置 — 与 3D 实验视频片段对应，总时长 12000ms 匹配视频长度
export const STAGE_CONFIGS: StageConfig[] = [
  { stage: 'confiningPressure', label: '试样变换围压', duration: 3000, description: '试样装入并调节围压条件' },
  { stage: 'charging',          label: '电容充电',     duration: 3000, description: '电容组储能充电，电压递增至目标值' },
  { stage: 'strikerLaunch',     label: '子弹发射',     duration: 4000, description: '电磁驱动子弹加速并撞击试样，应力波传播' },
  { stage: 'dataCollect',       label: '数据采集',     duration: 2000, description: '应变片采集三波信号并实时分析' },
];

export interface AnimationState {
  // 当前阶段
  currentStage: ExperimentStage;
  // 当前阶段索引 (0-5, -1表示idle)
  stageIndex: number;
  // 当前阶段内进度 0~1
  stageProgress: number;
  // 全局进度 0~1
  globalProgress: number;
  // 是否正在播放
  isPlaying: boolean;
  // 是否已完成
  isComplete: boolean;
  // 已经过的总时间(毫秒)
  elapsedTime: number;
}

export interface UseExperimentAnimationReturn extends AnimationState {
  play: () => void;
  pause: () => void;
  reset: () => void;
  jumpToStage: (index: number) => void;
  totalDuration: number;
  stages: StageConfig[];
}

export function useExperimentAnimation(): UseExperimentAnimationReturn {
  const [state, setState] = useState<AnimationState>({
    currentStage: 'idle',
    stageIndex: -1,
    stageProgress: 0,
    globalProgress: 0,
    isPlaying: false,
    isComplete: false,
    elapsedTime: 0,
  });

  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);

  const totalDuration = STAGE_CONFIGS.reduce((sum, s) => sum + s.duration, 0);

  // 根据已过时间计算当前状态
  const computeState = useCallback((elapsed: number): Omit<AnimationState, 'isPlaying'> => {
    if (elapsed <= 0) {
      return { currentStage: 'idle', stageIndex: -1, stageProgress: 0, globalProgress: 0, isComplete: false, elapsedTime: 0 };
    }

    if (elapsed >= totalDuration) {
      const last = STAGE_CONFIGS[STAGE_CONFIGS.length - 1];
      return { currentStage: last.stage, stageIndex: STAGE_CONFIGS.length - 1, stageProgress: 1, globalProgress: 1, isComplete: true, elapsedTime: totalDuration };
    }

    let accumulated = 0;
    for (let i = 0; i < STAGE_CONFIGS.length; i++) {
      const config = STAGE_CONFIGS[i];
      if (elapsed < accumulated + config.duration) {
        const stageElapsed = elapsed - accumulated;
        return {
          currentStage: config.stage,
          stageIndex: i,
          stageProgress: stageElapsed / config.duration,
          globalProgress: elapsed / totalDuration,
          isComplete: false,
          elapsedTime: elapsed,
        };
      }
      accumulated += config.duration;
    }

    return { currentStage: 'idle', stageIndex: -1, stageProgress: 0, globalProgress: 0, isComplete: false, elapsedTime: 0 };
  }, [totalDuration]);

  // 动画帧循环
  const tick = useCallback((timestamp: number) => {
    const elapsed = timestamp - startTimeRef.current;
    const computed = computeState(elapsed);

    setState(prev => ({ ...prev, ...computed, isPlaying: !computed.isComplete }));

    if (!computed.isComplete) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [computeState]);

  // 播放
  const play = useCallback(() => {
    // 如果已完成，重新开始
    if (state.isComplete) {
      pausedAtRef.current = 0;
    }

    startTimeRef.current = performance.now() - pausedAtRef.current;
    setState(prev => ({ ...prev, isPlaying: true, isComplete: false }));
    rafRef.current = requestAnimationFrame(tick);
  }, [tick, state.isComplete]);

  // 暂停
  const pause = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    pausedAtRef.current = state.elapsedTime;
    setState(prev => ({ ...prev, isPlaying: false }));
  }, [state.elapsedTime]);

  // 重置
  const reset = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    pausedAtRef.current = 0;
    setState({
      currentStage: 'idle',
      stageIndex: -1,
      stageProgress: 0,
      globalProgress: 0,
      isPlaying: false,
      isComplete: false,
      elapsedTime: 0,
    });
  }, []);

  // 跳转到指定阶段
  const jumpToStage = useCallback((index: number) => {
    cancelAnimationFrame(rafRef.current);
    const clampedIndex = Math.max(0, Math.min(index, STAGE_CONFIGS.length - 1));

    let elapsed = 0;
    for (let i = 0; i < clampedIndex; i++) {
      elapsed += STAGE_CONFIGS[i].duration;
    }

    pausedAtRef.current = elapsed;
    const computed = computeState(elapsed);
    setState(prev => ({ ...prev, ...computed, isPlaying: false }));
  }, [computeState]);

  // 清理
  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return {
    ...state,
    play,
    pause,
    reset,
    jumpToStage,
    totalDuration,
    stages: STAGE_CONFIGS,
  };
}
