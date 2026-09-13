import { applyStageTimeline, cloneStageState } from './timeline';
import type { StageRuntime, StageState, StageTimeline } from './types';

export function createStageRuntime(initialState: StageState): StageRuntime {
  let state = cloneStageState(initialState);
  const listeners = new Set<(state: StageState) => void>();

  function notify(): void {
    const snapshot = cloneStageState(state);

    for (const listener of listeners) {
      listener(cloneStageState(snapshot));
    }
  }

  return {
    getState() {
      return cloneStageState(state);
    },
    setState(nextState) {
      state = cloneStageState(nextState);
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(cloneStageState(state));

      return () => {
        listeners.delete(listener);
      };
    },
    applyTimeline(timeline: StageTimeline, timeMs: number) {
      state = applyStageTimeline(state, timeline, timeMs);
      notify();

      return cloneStageState(state);
    },
  };
}
