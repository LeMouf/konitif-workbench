import type { BootEvent } from './events';
import {
  BOOT_PHASES,
  type BootDependency,
  type BootExecutionState,
  type BootMode,
  type BootPhase,
  type BootStepStatus,
} from './types';

export interface BootStepProjection {
  id: string;
  label: string;
  phase: BootPhase;
  status: BootStepStatus;
  criticality: 'critical' | 'optional';
  dependencies: BootDependency[];
  attempts: number;
  warnings: string[];
  metadata: Record<string, unknown>;
  startedAt?: number;
  endedAt?: number;
  durationMs?: number;
  error?: string;
}

export interface BootPhaseProjection {
  phase: BootPhase;
  status: BootStepStatus | 'empty';
  steps: BootStepProjection[];
  counts: Record<BootStepStatus, number>;
  startedAt?: number;
  endedAt?: number;
  durationMs?: number;
}

export interface BootProjection {
  executionId: string;
  mode: BootMode;
  currentPhase: BootPhase;
  failed: boolean;
  startedAt?: number;
  endedAt?: number;
  phases: BootPhaseProjection[];
  steps: BootStepProjection[];
  lastEvent?: BootEvent;
  events: BootEvent[];
}

export interface BootExecutionProjection extends BootProjection {
  phase: BootPhase;
  status: 'idle' | 'running' | 'success' | 'failed';
  durationMs?: number;
  errors: Array<{ stepId?: string; error: string }>;
}

export type BootEventTimelineScope = 'boot' | 'phase' | 'step';
export type BootEventTimelineStatus = 'start' | 'success' | 'failed' | 'blocked' | 'event';
export type BootEventTimelineKind = 'open' | 'close' | 'error' | 'event';

export interface BootEventTimelineRow {
  id: string;
  executionId: string;
  scope: BootEventTimelineScope;
  scopeId: string;
  scopeLabel: string;
  level: number;
  name: string;
  status: BootEventTimelineStatus;
  kind: BootEventTimelineKind;
  eventTypes: string[];
  startTime?: number;
  endTime?: number;
  durationMs?: number;
  startPercent: number;
  timelinePercent: number;
}

const STEP_STATUSES: readonly BootStepStatus[] = [
  'pending',
  'running',
  'success',
  'failed',
  'skipped',
  'blocked',
];

export function createBootExecutionProjection(
  state: BootExecutionState,
  mode: BootMode = 'normal',
  lastEvent?: BootEvent,
  events: readonly BootEvent[] = [],
): BootExecutionProjection {
  const steps = Object.values(state.nodes).map((node): BootStepProjection => {
    const { state: stepState } = node;
    const durationMs =
      stepState.startedAt !== undefined && stepState.endedAt !== undefined
        ? stepState.endedAt - stepState.startedAt
        : undefined;

    return {
      id: stepState.id,
      label: stepState.label,
      phase: stepState.phase,
      status: stepState.status,
      criticality: stepState.criticality,
      dependencies: stepState.dependencies.map((dependency) => ({ ...dependency })),
      attempts: node.attempts,
      warnings: [...node.warnings],
      metadata: sanitizeMetadata(node.metadata),
      startedAt: stepState.startedAt,
      endedAt: stepState.endedAt,
      durationMs,
      error: stepState.error === undefined ? undefined : stringifyError(stepState.error),
    };
  });

  const phases = BOOT_PHASES.map((phase) => createPhaseProjection(phase, steps));
  const status = resolveExecutionStatus(state);
  const durationMs =
    state.startedAt !== undefined && state.endedAt !== undefined
      ? state.endedAt - state.startedAt
      : undefined;

  return {
    executionId: state.executionId,
    mode,
    currentPhase: state.phase,
    failed: state.failed,
    phase: state.phase,
    status,
    startedAt: state.startedAt,
    endedAt: state.endedAt,
    durationMs,
    phases,
    steps,
    lastEvent: lastEvent ? sanitizeBootEvent(lastEvent) : undefined,
    events: events.map((event) => sanitizeBootEvent(event)),
    errors: state.errors.map((entry) => ({
      stepId: entry.stepId,
      error: stringifyError(entry.error),
    })),
  };
}

export function createBootProjection(
  state: BootExecutionState,
  mode: BootMode = 'normal',
  lastEvent?: BootEvent,
  events: readonly BootEvent[] = [],
): BootProjection {
  const projection = createBootExecutionProjection(state, mode, lastEvent, events);

  return {
    executionId: projection.executionId,
    mode: projection.mode,
    currentPhase: projection.currentPhase,
    failed: projection.failed,
    startedAt: projection.startedAt,
    endedAt: projection.endedAt,
    phases: projection.phases,
    steps: projection.steps,
    lastEvent: projection.lastEvent,
    events: projection.events,
  };
}

export function getBootStepDurationMs(
  step: Pick<BootStepProjection, 'startedAt' | 'endedAt' | 'status'>,
  now: () => number = () => Date.now(),
): number | undefined {
  if (step.startedAt !== undefined && step.endedAt !== undefined) {
    return step.endedAt - step.startedAt;
  }

  if (step.startedAt !== undefined && step.status === 'running') {
    return now() - step.startedAt;
  }

  return undefined;
}

export const getStepDurationMs = getBootStepDurationMs;

export function createBootEventTimelineRows(
  projection: BootProjection | null | undefined,
  events: readonly BootEvent[] = projection?.events ?? [],
): BootEventTimelineRow[] {
  if (!projection) {
    return [];
  }

  const startedAt = projection.startedAt;
  const endedAt = projection.endedAt ?? Date.now();
  const totalDuration = startedAt !== undefined ? Math.max(1, endedAt - startedAt) : 1;
  const rows = new Map<string, BootEventTimelineRow>();

  events.forEach((event, index) => {
    const step = 'stepId' in event ? projection.steps.find((entry) => entry.id === event.stepId) : undefined;
    const phase =
      'phase' in event
        ? projection.phases.find((entry) => entry.phase === event.phase)
        : step
          ? projection.phases.find((entry) => entry.phase === step.phase)
          : undefined;
    const eventTime = resolveBootEventTime(event, projection);
    const scope = resolveBootEventTimelineScope(event);
    const scopeId = resolveBootEventTimelineScopeId(event, step, phase);
    const key = `${scope}:${scopeId}`;
    const existing = rows.get(key);
    const kind = resolveBootEventTimelineKind(event);
    const status = resolveBootEventTimelineStatus(event);
    const row = existing ?? {
      id: `${event.executionId}:${key}:${index}`,
      executionId: event.executionId,
      scope,
      scopeId,
      scopeLabel: resolveBootEventTimelineScopeLabel(scope, scopeId, step, phase),
      level: resolveBootEventTimelineLevel(scope),
      name: resolveBootEventTimelineName(event, scopeId),
      status,
      kind,
      eventTypes: [],
      startTime: undefined,
      endTime: undefined,
      durationMs: undefined,
      startPercent: 0,
      timelinePercent: 1,
    };

    row.eventTypes = [...row.eventTypes, event.type];

    if (!existing && kind !== 'open') {
      row.startTime = step?.startedAt ?? phase?.startedAt ?? projection.startedAt ?? eventTime;
    }

    if (kind === 'open') {
      row.startTime = eventTime ?? row.startTime;
    } else {
      row.endTime = eventTime ?? step?.endedAt ?? phase?.endedAt ?? projection.endedAt;
      row.status = status;
      row.kind = kind;
    }

    if (scope === 'phase' && phase && row.kind === 'open') {
      const inferredPhaseStatus = resolveBootPhaseTimelineStatus(phase);

      if (inferredPhaseStatus !== 'start') {
        row.endTime = phase.endedAt ?? row.endTime;
        row.status = inferredPhaseStatus;
        row.kind = inferredPhaseStatus === 'success' ? 'close' : 'error';
      }
    }

    const fallbackDuration = step?.durationMs ?? phase?.durationMs;
    row.durationMs =
      row.startTime !== undefined && row.endTime !== undefined
        ? row.endTime - row.startTime
        : fallbackDuration;

    const rowStart = row.startTime ?? eventTime;
    const rowEnd = row.endTime ?? eventTime ?? rowStart;
    row.startPercent =
      startedAt !== undefined && rowStart !== undefined
        ? clampPercent(((rowStart - startedAt) / totalDuration) * 100)
        : 0;
    row.timelinePercent =
      rowStart !== undefined && rowEnd !== undefined
        ? Math.max(1, Math.min(100 - row.startPercent, ((rowEnd - rowStart) / totalDuration) * 100))
        : Math.max(1, row.timelinePercent);

    rows.set(key, row);
  });

  return [...rows.values()];
}

function createPhaseProjection(
  phase: BootPhase,
  allSteps: readonly BootStepProjection[],
): BootPhaseProjection {
  const steps = allSteps.filter((step) => step.phase === phase);
  const counts = Object.fromEntries(STEP_STATUSES.map((status) => [status, 0])) as Record<
    BootStepStatus,
    number
  >;

  for (const step of steps) {
    counts[step.status] += 1;
  }

  const startedAt = minDefined(steps.map((step) => step.startedAt));
  const endedAt = maxDefined(steps.map((step) => step.endedAt));

  return {
    phase,
    status: resolvePhaseStatus(steps),
    steps,
    counts,
    startedAt,
    endedAt,
    durationMs: startedAt !== undefined && endedAt !== undefined ? endedAt - startedAt : undefined,
  };
}

function resolvePhaseStatus(steps: readonly BootStepProjection[]): BootStepStatus | 'empty' {
  if (steps.length === 0) {
    return 'empty';
  }

  if (steps.some((step) => step.status === 'failed')) {
    return 'failed';
  }

  if (steps.some((step) => step.status === 'blocked')) {
    return 'blocked';
  }

  if (steps.some((step) => step.status === 'running')) {
    return 'running';
  }

  if (steps.every((step) => step.status === 'success')) {
    return 'success';
  }

  if (steps.every((step) => step.status === 'skipped')) {
    return 'skipped';
  }

  return 'pending';
}

function resolveExecutionStatus(state: BootExecutionState): BootExecutionProjection['status'] {
  if (state.failed) {
    return 'failed';
  }

  if (state.endedAt !== undefined && state.startedAt !== undefined) {
    return 'success';
  }

  if (state.startedAt !== undefined) {
    return 'running';
  }

  return 'idle';
}

function resolveBootEventTime(event: BootEvent, projection: BootProjection): number | undefined {
  if (event.type === 'boot:start' || event.type === 'boot:success' || event.type === 'boot:failed') {
    return event.type === 'boot:start' ? event.state.startedAt : event.state.endedAt;
  }

  if ('stepId' in event) {
    const step = projection.steps.find((entry) => entry.id === event.stepId);

    if (event.type === 'step:start') {
      return step?.startedAt;
    }

    return step?.endedAt ?? step?.startedAt;
  }

  if ('phase' in event) {
    return projection.phases.find((entry) => entry.phase === event.phase)?.startedAt;
  }

  return undefined;
}

function resolveBootEventTimelineScope(event: BootEvent): BootEventTimelineScope {
  if ('stepId' in event) {
    return 'step';
  }

  if ('phase' in event) {
    return 'phase';
  }

  return 'boot';
}

function resolveBootEventTimelineScopeId(
  event: BootEvent,
  step: BootStepProjection | undefined,
  phase: BootPhaseProjection | undefined,
): string {
  if ('stepId' in event) {
    return event.stepId;
  }

  if ('phase' in event) {
    return event.phase;
  }

  return step?.id ?? phase?.phase ?? event.executionId;
}

function resolveBootEventTimelineScopeLabel(
  scope: BootEventTimelineScope,
  scopeId: string,
  step: BootStepProjection | undefined,
  phase: BootPhaseProjection | undefined,
): string {
  if (scope === 'step') {
    return `${formatBootPhaseLabel(step?.phase)} / step`;
  }

  if (scope === 'phase') {
    return `${formatBootPhaseLabel(phase?.phase ?? (scopeId as BootPhase))} / phase`;
  }

  return 'Boot / root';
}

function resolveBootEventTimelineLevel(scope: BootEventTimelineScope): number {
  if (scope === 'boot') {
    return 0;
  }

  if (scope === 'phase') {
    return 1;
  }

  return 2;
}

function resolveBootEventTimelineName(event: BootEvent, fallback: string): string {
  if ('stepId' in event) {
    return event.stepId;
  }

  if ('phase' in event) {
    return event.phase;
  }

  return fallback;
}

function resolveBootEventTimelineStatus(event: BootEvent): BootEventTimelineStatus {
  if (event.type.endsWith(':start')) {
    return 'start';
  }

  if (event.type.endsWith(':success')) {
    return 'success';
  }

  if (event.type.endsWith(':failed')) {
    return 'failed';
  }

  if (event.type.endsWith(':blocked')) {
    return 'blocked';
  }

  return 'event';
}

function resolveBootEventTimelineKind(event: BootEvent): BootEventTimelineKind {
  if (event.type.endsWith(':start')) {
    return 'open';
  }

  if (event.type.endsWith(':success')) {
    return 'close';
  }

  if (event.type.endsWith(':failed') || event.type.endsWith(':blocked')) {
    return 'error';
  }

  return 'event';
}

function resolveBootPhaseTimelineStatus(phase: BootPhaseProjection): BootEventTimelineStatus {
  if (phase.status === 'success' || phase.status === 'skipped') {
    return 'success';
  }

  if (phase.status === 'failed') {
    return 'failed';
  }

  if (phase.status === 'blocked') {
    return 'blocked';
  }

  return 'start';
}

function formatBootPhaseLabel(phase: BootPhase | undefined): string {
  return phase ? phase.replace(/^\w/, (letter) => letter.toUpperCase()) : 'Unknown';
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function sanitizeBootEvent(event: BootEvent): BootEvent {
  if (event.type === 'boot:start' || event.type === 'boot:success') {
    return {
      ...event,
      state: sanitizeExecutionState(event.state),
    };
  }

  if (event.type === 'boot:failed') {
    return {
      ...event,
      state: sanitizeExecutionState(event.state),
      error: stringifyError(event.error),
    };
  }

  if (event.type === 'step:failed') {
    return {
      ...event,
      error: stringifyError(event.error),
    };
  }

  return { ...event };
}

function sanitizeExecutionState(state: BootExecutionState): BootExecutionState {
  return {
    ...state,
    steps: Object.fromEntries(
      Object.entries(state.steps).map(([stepId, step]) => [
        stepId,
        {
          ...step,
          dependencies: step.dependencies.map((dependency) => ({ ...dependency })),
          error: step.error === undefined ? undefined : stringifyError(step.error),
        },
      ]),
    ),
    nodes: Object.fromEntries(
      Object.entries(state.nodes).map(([stepId, node]) => [
        stepId,
        {
          ...node,
          state: {
            ...node.state,
            dependencies: node.state.dependencies.map((dependency) => ({ ...dependency })),
            error: node.state.error === undefined ? undefined : stringifyError(node.state.error),
          },
          warnings: [...node.warnings],
          metadata: sanitizeMetadata(node.metadata),
        },
      ]),
    ),
    errors: state.errors.map((entry) => ({
      stepId: entry.stepId,
      error: stringifyError(entry.error),
    })),
  };
}

function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>;
  } catch {
    return Object.fromEntries(
      Object.entries(metadata).map(([key, value]) => [key, stringifyError(value)]),
    );
  }
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function minDefined(values: Array<number | undefined>): number | undefined {
  const defined = values.filter((value): value is number => value !== undefined);
  return defined.length === 0 ? undefined : Math.min(...defined);
}

function maxDefined(values: Array<number | undefined>): number | undefined {
  const defined = values.filter((value): value is number => value !== undefined);
  return defined.length === 0 ? undefined : Math.max(...defined);
}
