export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type StageNodeKind = 'panel' | 'drawer' | 'overlay' | 'camera';

export interface StageNode {
  id: string;
  kind: StageNodeKind;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  opacity: number;
  visible: boolean;
  zIndex?: number;
  /** Runtime admission accepts plain data (including nested arrays), not resources or callbacks. */
  metadata?: Record<string, unknown>;
}

export interface StageCamera {
  position: Vec3;
  rotation: Vec3;
  perspective: number;
}

export interface StageState {
  nodes: Record<string, StageNode>;
  camera: StageCamera;
  ambient?: StageAmbientState;
}

export type StageEasingName = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

export type StageTweenProperty =
  | 'position.x'
  | 'position.y'
  | 'position.z'
  | 'rotation.x'
  | 'rotation.y'
  | 'rotation.z'
  | 'scale.x'
  | 'scale.y'
  | 'scale.z'
  | 'opacity'
  | 'visible'
  | 'camera.position.x'
  | 'camera.position.y'
  | 'camera.position.z'
  | 'camera.rotation.x'
  | 'camera.rotation.y'
  | 'camera.rotation.z'
  | 'camera.perspective';

export interface StageKeyframe {
  at: number;
  value: number | boolean;
  easing?: StageEasingName;
}

export interface StageTimelineTrack {
  targetId: string;
  property: StageTweenProperty;
  keyframes: StageKeyframe[];
}

export interface StageTimeline {
  id: string;
  duration: number;
  tracks: StageTimelineTrack[];
  metadata?: Record<string, unknown>;
}

export interface StageViewport {
  width: number;
  height: number;
}

export interface StageProjectedNode {
  id: string;
  kind: StageNodeKind;
  visible: boolean;
  opacity: number;
  x: number;
  y: number;
  depth: number;
  scale: number;
  zIndex: number;
  transform: string;
  metadata?: Record<string, unknown>;
}

export interface StageProjection {
  viewport: StageViewport;
  camera: StageCamera;
  nodes: StageProjectedNode[];
  ambient: StageAmbientProjection;
}

export interface StageAmbientState {
  focusNodeId?: string;
  depthIntensity?: number;
  fogIntensity?: number;
  lightIntensity?: number;
  motionIntensity?: number;
  parallaxIntensity?: number;
  tint?: string;
  /** Same plain-data admission as StageNode metadata when owned by StageRuntime. */
  metadata?: Record<string, unknown>;
}

export interface StageAmbientProjection {
  focusPoint: { x: number; y: number };
  focusDepth: number;
  depthIntensity: number;
  fogIntensity: number;
  lightIntensity: number;
  motionIntensity: number;
  parallaxIntensity: number;
  tint?: string;
  metadata?: Record<string, unknown>;
}

export interface StageRuntime {
  getState(): StageState;
  setState(state: StageState): void;
  subscribe(listener: (state: StageState) => void): () => void;
  applyTimeline(timeline: StageTimeline, timeMs: number): StageState;
}

export function vec3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function createStageNode(
  id: string,
  kind: StageNodeKind,
  options: Partial<Omit<StageNode, 'id' | 'kind'>> = {},
): StageNode {
  return {
    id,
    kind,
    position: options.position ?? vec3(),
    rotation: options.rotation ?? vec3(),
    scale: options.scale ?? vec3(1, 1, 1),
    opacity: options.opacity ?? 1,
    visible: options.visible ?? true,
    zIndex: options.zIndex,
    metadata: options.metadata,
  };
}

export function createStageCamera(options: Partial<StageCamera> = {}): StageCamera {
  return {
    position: options.position ?? vec3(),
    rotation: options.rotation ?? vec3(),
    perspective: options.perspective ?? 900,
  };
}

export function createStageState(options: Partial<StageState> = {}): StageState {
  return {
    nodes: options.nodes ?? {},
    camera: options.camera ?? createStageCamera(),
    ambient: options.ambient,
  };
}
