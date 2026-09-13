import type { JsonObject } from '../../domain/shared/json';

import {
  createTemporalHistoryRecorder,
  type TemporalHistoryRecorder, type TemporalHistoryRecorderOptions,
  type TemporalHistorySnapshot, type TemporalHistorySpan, type TemporalHistoryReplayState,
} from './temporalHistoryCore';

export type RuntimeHistoryReplayState = TemporalHistoryReplayState;
export type RuntimeHistoryChannel = 'viewer' | 'physics' | 'timeline' | 'interaction' | 'ui' | 'performance';

export interface RuntimeHistoryVector3 {
  x: number;
  y: number;
  z: number;
}

export interface RuntimeHistoryQuaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface RuntimeHistoryTransform {
  id: string;
  position: RuntimeHistoryVector3;
  rotation?: RuntimeHistoryQuaternion;
  scale?: RuntimeHistoryVector3;
  sourceId?: string;
  metadata?: JsonObject;
}

export interface RuntimeHistoryViewerCameraSample {
  position: RuntimeHistoryVector3;
  target: RuntimeHistoryVector3;
  projection: string;
}

export interface RuntimeHistoryPhysicsSample {
  engine: string;
  enabled: boolean;
  motorsCoupled?: boolean;
  bodyCount: number;
  jointCount: number;
  centerOfMass?: RuntimeHistoryVector3 | null;
  bodyTransforms?: RuntimeHistoryTransform[];
  jointStates?: Record<string, number>;
}

export interface RuntimeHistoryPlaybackSample {
  sourceId?: string;
  currentTime: number;
  isPlaying: boolean;
  playbackRate?: number;
  duration?: number;
}

export interface RuntimeHistoryViewerSample {
  camera?: RuntimeHistoryViewerCameraSample;
  joints?: Record<string, number>;
  physics?: RuntimeHistoryPhysicsSample;
  playback?: RuntimeHistoryPlaybackSample;
  metadata?: JsonObject;
}

export interface RuntimeHistorySample {
  id: number;
  timeSeconds: number;
  recordedAt: number;
  viewer?: RuntimeHistoryViewerSample;
  metadata?: JsonObject;
}

export interface RuntimeHistoryEvent {
  id: number;
  timeSeconds: number;
  recordedAt: number;
  channel: RuntimeHistoryChannel;
  type: string;
  label?: string;
  payload?: JsonObject;
}

type SampleData = Omit<RuntimeHistorySample, 'id' | 'recordedAt'>;
type EventData = Omit<RuntimeHistoryEvent, 'id' | 'recordedAt'>;
export type RuntimeHistorySpan = TemporalHistorySpan;
export type RuntimeHistorySnapshot = TemporalHistorySnapshot<SampleData, EventData>;
export type RuntimeHistoryRecorderOptions = TemporalHistoryRecorderOptions;
export type RuntimeHistoryRecorder = TemporalHistoryRecorder<SampleData, EventData>;

/** Compatibility specialization; the shared composition recorder keeps its identity. */
export function createRuntimeHistoryRecorder(options: RuntimeHistoryRecorderOptions = {}): RuntimeHistoryRecorder {
  return createTemporalHistoryRecorder<SampleData, EventData>(options);
}
