import type { StageEasingName } from './types';

export type StageEasingFunction = (t: number) => number;

export const stageEasing: Record<StageEasingName, StageEasingFunction> = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => 1 - (1 - t) * (1 - t),
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
};

export function clampStageProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

export function easeStageProgress(value: number, easing: StageEasingName = 'linear'): number {
  return stageEasing[easing](clampStageProgress(value));
}
