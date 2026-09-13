import type { LaunchProfile, LaunchTarget } from '../launch/model';
import type { JsonValue } from '../shared/json';

export type RuntimeCheckpointKind =
  | 'project-state'
  | 'workspace-state'
  | 'runtime-session'
  | 'launch-profile'
  | 'tool-session'
  | 'last-known-good'
  | 'crash-snapshot'
  | 'restore-point';

export interface RuntimeCheckpointInput {
  id?: string;
  kind: RuntimeCheckpointKind;
  label: string;
  target?: LaunchTarget | null;
  profile?: LaunchProfile | null;
  data?: unknown;
  tags?: string[];
  source?: string | null;
}

export interface RuntimeCheckpoint {
  schemaVersion: 'runtime-checkpoint.v1';
  id: string;
  kind: RuntimeCheckpointKind;
  label: string;
  target: LaunchTarget | null;
  profile: LaunchProfile | null;
  data: JsonValue;
  tags: string[];
  source: string | null;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeCheckpointSnapshot {
  generatedAt: string;
  checkpoints: RuntimeCheckpoint[];
  lastKnownGoodId: string | null;
  restorePointIds: string[];
  totals: Record<RuntimeCheckpointKind, number>;
}

export function createRuntimeCheckpoint(
  input: RuntimeCheckpointInput,
  timestamp = new Date().toISOString()
): RuntimeCheckpoint {
  const data = sanitizeJson(input.data ?? null);

  return {
    schemaVersion: 'runtime-checkpoint.v1',
    id: input.id ?? `checkpoint:${input.kind}:${timestamp}`,
    kind: input.kind,
    label: sanitizeText(input.label, 160),
    target: input.target ?? null,
    profile: input.profile ?? input.target?.profile ?? null,
    data,
    tags: (input.tags ?? []).map((tag) => sanitizeText(tag, 80)).slice(0, 20),
    source: normalizeNullableText(input.source, 160),
    sizeBytes: estimateJsonSize(data),
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function updateRuntimeCheckpoint(
  checkpoint: RuntimeCheckpoint,
  data: unknown,
  timestamp = new Date().toISOString()
): RuntimeCheckpoint {
  const sanitizedData = sanitizeJson(data);

  return {
    ...checkpoint,
    data: sanitizedData,
    sizeBytes: estimateJsonSize(sanitizedData),
    updatedAt: timestamp
  };
}

export function createRuntimeCheckpointSnapshot(
  checkpoints: RuntimeCheckpoint[],
  lastKnownGoodId: string | null = null,
  timestamp = new Date().toISOString()
): RuntimeCheckpointSnapshot {
  const sortedCheckpoints = [...checkpoints].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return {
    generatedAt: timestamp,
    checkpoints: sortedCheckpoints,
    lastKnownGoodId,
    restorePointIds: sortedCheckpoints
      .filter((checkpoint) => checkpoint.kind === 'restore-point' || checkpoint.id === lastKnownGoodId)
      .map((checkpoint) => checkpoint.id),
    totals: createCheckpointTotals(sortedCheckpoints)
  };
}

const checkpointKinds: RuntimeCheckpointKind[] = [
  'project-state',
  'workspace-state',
  'runtime-session',
  'launch-profile',
  'tool-session',
  'last-known-good',
  'crash-snapshot',
  'restore-point'
];

function createCheckpointTotals(checkpoints: RuntimeCheckpoint[]): Record<RuntimeCheckpointKind, number> {
  const totals = Object.fromEntries(checkpointKinds.map((kind) => [kind, 0])) as Record<RuntimeCheckpointKind, number>;

  for (const checkpoint of checkpoints) {
    totals[checkpoint.kind] += 1;
  }

  return totals;
}

function estimateJsonSize(value: JsonValue): number {
  return JSON.stringify(value).length;
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
    return depth >= 4 ? `[Array(${value.length})]` : value.slice(0, 50).map((entry) => sanitizeJson(entry, depth + 1));
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
