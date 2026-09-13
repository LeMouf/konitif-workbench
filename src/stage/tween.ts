import { easeStageProgress } from './easing';
import type { StageKeyframe, StageState, StageTimelineTrack, StageTweenProperty } from './types';

export function resolveStageTrackValue(
  track: StageTimelineTrack,
  timeMs: number,
): number | boolean | undefined {
  const keyframes = [...track.keyframes].sort((a, b) => a.at - b.at);

  if (keyframes.length === 0) {
    return undefined;
  }

  if (timeMs <= keyframes[0].at) {
    return keyframes[0].value;
  }

  const last = keyframes[keyframes.length - 1];

  if (timeMs >= last.at) {
    return last.value;
  }

  const nextIndex = keyframes.findIndex((keyframe) => keyframe.at >= timeMs);
  const previous = keyframes[nextIndex - 1];
  const next = keyframes[nextIndex];

  return interpolateStageKeyframes(previous, next, timeMs);
}

export function setStageTweenValue(
  state: StageState,
  targetId: string,
  property: StageTweenProperty,
  value: number | boolean,
): void {
  if (property.startsWith('camera.')) {
    setCameraTweenValue(state, property, value);
    return;
  }

  const node = state.nodes[targetId];

  if (!node) {
    return;
  }

  switch (property) {
    case 'position.x':
      node.position.x = Number(value);
      break;
    case 'position.y':
      node.position.y = Number(value);
      break;
    case 'position.z':
      node.position.z = Number(value);
      break;
    case 'rotation.x':
      node.rotation.x = Number(value);
      break;
    case 'rotation.y':
      node.rotation.y = Number(value);
      break;
    case 'rotation.z':
      node.rotation.z = Number(value);
      break;
    case 'scale.x':
      node.scale.x = Number(value);
      break;
    case 'scale.y':
      node.scale.y = Number(value);
      break;
    case 'scale.z':
      node.scale.z = Number(value);
      break;
    case 'opacity':
      node.opacity = Number(value);
      break;
    case 'visible':
      node.visible = Boolean(value);
      break;
    default:
      throwUnsupportedStageProperty(property);
  }
}

function interpolateStageKeyframes(
  previous: StageKeyframe,
  next: StageKeyframe,
  timeMs: number,
): number | boolean {
  if (typeof previous.value === 'boolean' || typeof next.value === 'boolean') {
    return timeMs >= next.at ? next.value : previous.value;
  }

  const span = next.at - previous.at;
  const progress = span <= 0 ? 1 : (timeMs - previous.at) / span;
  const eased = easeStageProgress(progress, next.easing ?? previous.easing ?? 'linear');

  return previous.value + (next.value - previous.value) * eased;
}

function setCameraTweenValue(
  state: StageState,
  property: StageTweenProperty,
  value: number | boolean,
): void {
  switch (property) {
    case 'camera.position.x':
      state.camera.position.x = Number(value);
      break;
    case 'camera.position.y':
      state.camera.position.y = Number(value);
      break;
    case 'camera.position.z':
      state.camera.position.z = Number(value);
      break;
    case 'camera.rotation.x':
      state.camera.rotation.x = Number(value);
      break;
    case 'camera.rotation.y':
      state.camera.rotation.y = Number(value);
      break;
    case 'camera.rotation.z':
      state.camera.rotation.z = Number(value);
      break;
    case 'camera.perspective':
      state.camera.perspective = Number(value);
      break;
    default:
      throwUnsupportedStageProperty(property);
  }
}

function throwUnsupportedStageProperty(property: StageTweenProperty): never {
  throw new Error(`Unsupported stage tween property "${property}".`);
}
