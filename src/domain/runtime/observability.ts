import type { JsonValue } from '../shared/json';
import type { RuntimeDebugEvent, RuntimeInspectableStatus, RuntimeStackTrace } from './model';

export type RuntimeTelemetryLevel = 'debug' | 'info' | 'warning' | 'error';

export type RuntimeTelemetryTraceType =
  | 'debug-event'
  | 'stack-trace'
  | 'performance-marker'
  | 'health-check'
  | 'lifecycle'
  | 'store-mutation'
  | 'crash';

export type RuntimeObservedEntityType = 'runtime' | 'backend' | 'store' | 'service' | 'manager' | 'tool';
export type RuntimeStoreMutationKind = 'register' | 'snapshot' | 'update' | 'dispose';
export type RuntimeEntityLifecycleKind = 'register' | 'start' | 'ready' | 'degraded' | 'error' | 'dispose';

export interface RuntimeTelemetryTrace {
  id: string;
  type: RuntimeTelemetryTraceType;
  level: RuntimeTelemetryLevel;
  scope: string | null;
  label: string;
  message: string;
  timestamp: string;
  payload?: JsonValue;
}

export interface RuntimeStructuredLog {
  id: string;
  level: RuntimeTelemetryLevel;
  scope: string | null;
  message: string;
  timestamp: string;
  payload?: JsonValue;
}

export interface RuntimePerformanceMarker {
  id: string;
  label: string;
  scope: string | null;
  startTime: number;
  durationMs: number | null;
  timestamp: string;
  payload?: JsonValue;
}

export interface RuntimeHealthCheck {
  id: string;
  targetId: string;
  targetType: RuntimeObservedEntityType;
  status: RuntimeInspectableStatus;
  checkedAt: string;
  latencyMs: number | null;
  message: string | null;
  payload?: JsonValue;
}

export interface RuntimeStoreMutationEntry {
  id: string;
  storeId: string;
  kind: RuntimeStoreMutationKind;
  timestamp: string;
  value?: JsonValue;
}

export interface RuntimeEntityLifecycleEntry {
  id: string;
  entityId: string;
  entityType: Exclude<RuntimeObservedEntityType, 'store' | 'backend'>;
  kind: RuntimeEntityLifecycleKind;
  status: RuntimeInspectableStatus;
  timestamp: string;
  message: string | null;
  payload?: JsonValue;
}

export interface RuntimeCrashReport {
  id: string;
  message: string;
  scope: string | null;
  timestamp: string;
  stackFrames: string[];
  cause: string | null;
  payload?: JsonValue;
}

export interface RuntimeObservabilitySnapshot {
  generatedAt: string;
  traces: RuntimeTelemetryTrace[];
  logs: RuntimeStructuredLog[];
  performanceMarkers: RuntimePerformanceMarker[];
  healthChecks: RuntimeHealthCheck[];
  storeMutations: RuntimeStoreMutationEntry[];
  lifecycleEntries: RuntimeEntityLifecycleEntry[];
  crashReports: RuntimeCrashReport[];
}

export interface RuntimeTelemetryTraceInput {
  id?: string;
  type: RuntimeTelemetryTraceType;
  level?: RuntimeTelemetryLevel;
  scope?: string | null;
  label?: string;
  message?: string;
  timestamp?: string;
  payload?: unknown;
}

export interface RuntimeStructuredLogInput {
  id?: string;
  level?: RuntimeTelemetryLevel;
  scope?: string | null;
  message: string;
  timestamp?: string;
  payload?: unknown;
}

export interface RuntimePerformanceMarkerInput {
  id?: string;
  label: string;
  scope?: string | null;
  startTime?: number;
  durationMs?: number | null;
  timestamp?: string;
  payload?: unknown;
}

export interface RuntimeHealthCheckInput {
  id?: string;
  targetId: string;
  targetType: RuntimeObservedEntityType;
  status: RuntimeInspectableStatus;
  checkedAt?: string;
  latencyMs?: number | null;
  message?: string | null;
  payload?: unknown;
}

export interface RuntimeStoreMutationInput {
  id?: string;
  storeId: string;
  kind: RuntimeStoreMutationKind;
  timestamp?: string;
  value?: unknown;
}

export interface RuntimeEntityLifecycleInput {
  id?: string;
  entityId: string;
  entityType: Exclude<RuntimeObservedEntityType, 'store' | 'backend'>;
  kind: RuntimeEntityLifecycleKind;
  status?: RuntimeInspectableStatus;
  timestamp?: string;
  message?: string | null;
  payload?: unknown;
}

export interface RuntimeCrashReportInput {
  id?: string;
  message?: string;
  scope?: string | null;
  timestamp?: string;
  payload?: unknown;
}

export type RuntimeDebugTraceInput = RuntimeDebugEvent | RuntimeStackTrace;
