import { useState, useCallback, useRef, useEffect } from 'react';

// 实验6阶段定义
export type ExperimentStage =
  | 'idle'           // 待机
  | 'charging'       // 1. 电容充能
  | 'coilAccel'      // 2. 线圈加速
  | 'strikerLaunch'  // 3. 子弹发射(单次撞击)
  | 'wavePropagate'  // 4. 应力波传播
  | 'deformation'    // 5. 试样变形
  | 'dataCollect';   // 6. 数据采集

export interface StageConfig {
  stage: ExperimentStage;
  label: string;
  duration: number; // 毫秒
  description: string;
}

// 默认阶段配置
export const STAGE_CONFIGS: StageConfig[] = [
  { stage: 'charging',      label: '电容充能',   duration: 2000, description: '电容组储能充电，电压递增' },
  { stage: 'coilAccel',     label: '线圈加速',   duration: 2000, description: '三级电磁线圈依次激活，产生电磁力' },
  { stage: 'strikerLaunch', label: '子弹发射',   duration: 1500, description: '电磁驱动子弹加速撞击入射杆' },
  { stage: 'wavePropagate', label: '应力波传播', duration: 3000, description: '入射波→试样→反射波+透射波' },
  { stage: 'deformation',   label: '试样变形',   duration: 2000, description: '入射杆与透射杆挤压试样产生变形' },
  { stage: 'dataCollect',   label: '数据采集',   duration: 1500, description: '应变片采集三波信号' },
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
