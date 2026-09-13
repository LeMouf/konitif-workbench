import type { JsonValue } from '../../domain/shared/json';
import type { RuntimeDebugEvent, RuntimeInspectableStatus, RuntimeStackTrace } from '../../domain/runtime/model';
import type {
  RuntimeCrashReport,
  RuntimeCrashReportInput,
  RuntimeEntityLifecycleEntry,
  RuntimeEntityLifecycleInput,
  RuntimeHealthCheck,
  RuntimeHealthCheckInput,
  RuntimeObservabilitySnapshot,
  RuntimePerformanceMarker,
  RuntimePerformanceMarkerInput,
  RuntimeStoreMutationEntry,
  RuntimeStoreMutationInput,
  RuntimeStructuredLog,
  RuntimeStructuredLogInput,
  RuntimeTelemetryTrace,
  RuntimeTelemetryTraceInput
} from '../../domain/runtime/observability';

export interface RuntimeObservabilityHubOptions {
  maxEntries?: number;
}

export class RuntimeObservabilityHub {
  private readonly maxEntries: number;
  private traces: RuntimeTelemetryTrace[] = [];
  private logs: RuntimeStructuredLog[] = [];
  private performanceMarkers: RuntimePerformanceMarker[] = [];
  private healthChecks: RuntimeHealthCheck[] = [];
  private storeMutations: RuntimeStoreMutationEntry[] = [];
  private lifecycleEntries: RuntimeEntityLifecycleEntry[] = [];
  private crashReports: RuntimeCrashReport[] = [];
  private sequence = 0;

  constructor(options: RuntimeObservabilityHubOptions = {}) {
    this.maxEntries = options.maxEntries ?? 100;
  }

  createSnapshot(timestamp = new Date().toISOString()): RuntimeObservabilitySnapshot {
    return {
      generatedAt: timestamp,
      traces: [...this.traces],
      logs: [...this.logs],
      performanceMarkers: [...this.performanceMarkers],
      healthChecks: [...this.healthChecks],
      storeMutations: [...this.storeMutations],
      lifecycleEntries: [...this.lifecycleEntries],
      crashReports: [...this.crashReports]
    };
  }

  recordTrace(input: RuntimeTelemetryTraceInput): RuntimeTelemetryTrace {
    const trace: RuntimeTelemetryTrace = {
      id: input.id ?? this.createId('trace'),
      type: input.type,
      level: input.level ?? 'info',
      scope: normalizeNullableText(input.scope, 160),
      label: sanitizeText(input.label ?? input.type, 160),
      message: sanitizeText(input.message ?? input.label ?? input.type, 500),
      timestamp: input.timestamp ?? new Date().toISOString(),
      payload: input.payload === undefined ? undefined : sanitizeJson(input.payload)
    };

    this.traces = prependRing(this.traces, trace, this.maxEntries);

    return trace;
  }

  recordDebugEvent(event: RuntimeDebugEvent): RuntimeTelemetryTrace {
    return this.recordTrace({
      id: event.id,
      type: 'debug-event',
      level: event.level,
      scope: event.scope,
      label: event.type,
      message: event.message,
      timestamp: event.timestamp,
      payload: event.payload
    });
  }

  recordStackTrace(trace: RuntimeStackTrace): RuntimeTelemetryTrace {
    return this.recordTrace({
      id: trace.id,
      type: 'stack-trace',
      level: 'error',
      scope: trace.scope,
      label: trace.message,
      message: trace.message,
      timestamp: trace.timestamp,
      payload: {
        frames: trace.frames,
        cause: trace.cause
      }
    });
  }

  recordLog(input: RuntimeStructuredLogInput): RuntimeStructuredLog {
    const log: RuntimeStructuredLog = {
      id: input.id ?? this.createId('log'),
      level: input.level ?? 'info',
      scope: normalizeNullableText(input.scope, 160),
      message: sanitizeText(input.message, 500),
      timestamp: input.timestamp ?? new Date().toISOString(),
      payload: input.payload === undefined ? undefined : sanitizeJson(input.payload)
    };

    this.logs = prependRing(this.logs, log, this.maxEntries);
    this.recordTrace({
      id: log.id,
      type: 'debug-event',
      level: log.level,
      scope: log.scope,
      label: 'structured log',
      message: log.message,
      timestamp: log.timestamp,
      payload: log.payload
    });

    return log;
  }

  recordPerformanceMarker(input: RuntimePerformanceMarkerInput): RuntimePerformanceMarker {
    const marker: RuntimePerformanceMarker = {
      id: input.id ?? this.createId('perf'),
      label: sanitizeText(input.label, 160),
      scope: normalizeNullableText(input.scope, 160),
      startTime: normalizeFiniteNumber(input.startTime) ?? 0,
      durationMs: normalizeFiniteNumber(input.durationMs),
      timestamp: input.timestamp ?? new Date().toISOString(),
      payload: input.payload === undefined ? undefined : sanitizeJson(input.payload)
    };

    this.performanceMarkers = prependRing(this.performanceMarkers, marker, this.maxEntries);
    this.recordTrace({
      id: marker.id,
      type: 'performance-marker',
      level: 'debug',
      scope: marker.scope,
      label: marker.label,
      message: marker.durationMs === null ? marker.label : `${marker.label} ${marker.durationMs}ms`,
      timestamp: marker.timestamp,
      payload: marker.payload
    });

    return marker;
  }

  recordHealthCheck(input: RuntimeHealthCheckInput): RuntimeHealthCheck {
    const healthCheck: RuntimeHealthCheck = {
      id: input.id ?? this.createId('health'),
      targetId: sanitizeText(input.targetId, 160),
      targetType: input.targetType,
      status: normalizeStatus(input.status),
      checkedAt: input.checkedAt ?? new Date().toISOString(),
      latencyMs: normalizeFiniteNumber(input.latencyMs),
      message: normalizeNullableText(input.message, 500),
      payload: input.payload === undefined ? undefined : sanitizeJson(input.payload)
    };

    this.healthChecks = prependRing(this.healthChecks, healthCheck, this.maxEntries);
    this.recordTrace({
      id: healthCheck.id,
      type: 'health-check',
      level: healthCheck.status === 'error' ? 'error' : healthCheck.status === 'degraded' ? 'warning' : 'info',
      scope: healthCheck.targetType,
      label: healthCheck.targetId,
      message: healthCheck.message ?? `Health ${healthCheck.status}`,
      timestamp: healthCheck.checkedAt,
      payload: healthCheck.payload
    });

    return healthCheck;
  }

  recordStoreMutation(input: RuntimeStoreMutationInput): RuntimeStoreMutationEntry {
    const mutation: RuntimeStoreMutationEntry = {
      id: input.id ?? this.createId('store'),
      storeId: sanitizeText(input.storeId, 160),
      kind: input.kind,
      timestamp: input.timestamp ?? new Date().toISOString(),
      value: input.value === undefined ? undefined : sanitizeJson(input.value)
    };

    this.storeMutations = prependRing(this.storeMutations, mutation, this.maxEntries);
    this.recordTrace({
      id: mutation.id,
      type: 'store-mutation',
      level: 'debug',
      scope: 'store',
      label: mutation.storeId,
      message: `Store ${mutation.kind}`,
      timestamp: mutation.timestamp,
      payload: mutation.value
    });

    return mutation;
  }

  recordEntityLifecycle(input: RuntimeEntityLifecycleInput): RuntimeEntityLifecycleEntry {
    const entry: RuntimeEntityLifecycleEntry = {
      id: input.id ?? this.createId('lifecycle'),
      entityId: sanitizeText(input.entityId, 160),
      entityType: input.entityType,
      kind: input.kind,
      status: normalizeStatus(input.status ?? (input.kind === 'error' ? 'error' : 'active')),
      timestamp: input.timestamp ?? new Date().toISOString(),
      message: normalizeNullableText(input.message, 500),
      payload: input.payload === undefined ? undefined : sanitizeJson(input.payload)
    };

    this.lifecycleEntries = prependRing(this.lifecycleEntries, entry, this.maxEntries);
    this.recordTrace({
      id: entry.id,
      type: 'lifecycle',
      level: entry.status === 'error' ? 'error' : entry.status === 'degraded' ? 'warning' : 'info',
      scope: entry.entityType,
      label: entry.entityId,
      message: entry.message ?? `${entry.entityType} ${entry.kind}`,
      timestamp: entry.timestamp,
      payload: entry.payload
    });

    return entry;
  }

  captureCrashReport(error: Error | string, input: RuntimeCrashReportInput = {}): RuntimeCrashReport {
    const resolvedError = error instanceof Error ? error : null;
    const stackSource = resolvedError?.stack ?? (typeof error === 'string' ? error : '');
    const cause = resolvedError && 'cause' in resolvedError ? (resolvedError as Error & { cause?: unknown }).cause : null;
    const report: RuntimeCrashReport = {
      id: input.id ?? this.createId('crash'),
      message: sanitizeText(input.message ?? resolvedError?.message ?? String(error), 500),
      scope: normalizeNullableText(input.scope, 160),
      timestamp: input.timestamp ?? new Date().toISOString(),
      stackFrames: stackSource
        .split('\n')
        .map((frame) => sanitizeText(frame.trim(), 500))
        .filter(Boolean)
        .slice(0, 24),
      cause: cause instanceof Error ? sanitizeText(cause.message, 500) : null,
      payload: input.payload === undefined ? undefined : sanitizeJson(input.payload)
    };

    this.crashReports = prependRing(this.crashReports, report, this.maxEntries);
    this.recordTrace({
      id: report.id,
      type: 'crash',
      level: 'error',
      scope: report.scope,
      label: 'crash report',
      message: report.message,
      timestamp: report.timestamp,
      payload: {
        cause: report.cause,
        frames: report.stackFrames,
        context: report.payload
      }
    });

    return report;
  }

  private createId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}:${this.sequence}`;
  }
}

function prependRing<T>(items: T[], item: T, maxEntries: number): T[] {
  return [item, ...items].slice(0, maxEntries);
}

function normalizeStatus(status: RuntimeInspectableStatus): RuntimeInspectableStatus {
  return status === 'active' || status === 'idle' || status === 'degraded' || status === 'error' || status === 'unknown'
    ? status
    : 'unknown';
}

function normalizeFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeNullableText(value: unknown, maxLength: number): string | null {
  return typeof value === 'string' ? sanitizeText(value, maxLength) : null;
}

function sanitizeText(value: string, maxLength = 2000): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}...`;
}

function sanitizeJson(value: unknown, depth = 0): JsonValue {
  if (value === null || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return sanitizeText(value);
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (Array.isArray(value)) {
    if (depth >= 4) {
      return `[Array(${value.length})]`;
    }

    return value.slice(0, 50).map((entry) => sanitizeJson(entry, depth + 1));
  }

  if (value && typeof value === 'object') {
    if (depth >= 4) {
      return '[Object]';
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 50)
        .map(([key, entry]) => [sanitizeText(key, 120), sanitizeJson(entry, depth + 1)])
    );
  }

  return null;
}
