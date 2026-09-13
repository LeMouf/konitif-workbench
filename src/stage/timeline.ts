import { resolveStageTrackValue, setStageTweenValue } from './tween';
import type { StageState, StageTimeline } from './types';

export function applyStageTimeline(
  state: StageState,
  timeline: StageTimeline,
  timeMs: number,
): StageState {
  const nextState = cloneStageState(state);
  const clampedTime = Math.min(Math.max(0, timeMs), Math.max(0, timeline.duration));

  for (const track of timeline.tracks) {
    const value = resolveStageTrackValue(track, clampedTime);

    if (value !== undefined) {
      setStageTweenValue(nextState, track.targetId, track.property, value);
    }
  }

  return nextState;
}

export function cloneStageState(state: StageState): StageState {
  return {
    camera: {
      position: { ...state.camera.position },
      rotation: { ...state.camera.rotation },
      perspective: state.camera.perspective,
    },
    ambient: state.ambient
      ? {
          ...state.ambient,
          metadata: state.ambient.metadata ? cloneStageMetadata(state.ambient.metadata) : undefined,
        }
      : undefined,
    nodes: Object.fromEntries(
      Object.entries(state.nodes).map(([id, node]) => [
        id,
        {
          ...node,
          position: { ...node.position },
          rotation: { ...node.rotation },
          scale: { ...node.scale },
          metadata: node.metadata ? cloneStageMetadata(node.metadata) : undefined,
        },
      ]),
    ),
  };
}

/** Stage metadata is data, not a container for runtime resources or callbacks. */
function cloneStageMetadata(value: Record<string, unknown>): Record<string, unknown> {
  const ancestors = new Set<object>();
  function copy(input: unknown): unknown {
    if (input === null || input === undefined || typeof input === 'string' || typeof input === 'boolean') return input;
    if (typeof input === 'number' && Number.isFinite(input)) return input;
    if (typeof input !== 'object' || input === null) throw new TypeError('Unsupported Stage metadata value');
    const array = Array.isArray(input);
    if (!array && Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null) {
      throw new TypeError('Stage metadata must contain plain data');
    }
    if (ancestors.has(input)) throw new TypeError('Cyclic Stage metadata');
    ancestors.add(input);
    const result: Record<string, unknown> | unknown[] = array ? new Array(input.length) : {};
    for (const key of Reflect.ownKeys(input)) {
      if (array && key === 'length') continue;
      const descriptor = Object.getOwnPropertyDescriptor(input, key)!;
      if (typeof key !== 'string' || !('value' in descriptor)) throw new TypeError('Stage metadata cannot contain symbols or accessors');
      Object.defineProperty(result, key, { value: copy(descriptor.value), enumerable: descriptor.enumerable,
        configurable: true, writable: true });
    }
    ancestors.delete(input);
    return result;
  }
  return copy(value) as Record<string, unknown>;
}
