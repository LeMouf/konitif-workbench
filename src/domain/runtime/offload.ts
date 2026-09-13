import type { JsonValue } from '../shared/json';

export type RuntimeOffloadTaskKind =
  | 'repo-indexing'
  | 'static-analysis'
  | 'embeddings'
  | 'preview-generation'
  | 'custom';

export type RuntimeOffloadTaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type RuntimeOffloadTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface RuntimeOffloadTaskInput {
  id?: string;
  kind: RuntimeOffloadTaskKind;
  label: string;
  priority?: RuntimeOffloadTaskPriority;
  cancellable?: boolean;
  payload?: unknown;
}

export interface RuntimeOffloadTask {
  id: string;
  kind: RuntimeOffloadTaskKind;
  label: string;
  priority: RuntimeOffloadTaskPriority;
  status: RuntimeOffloadTaskStatus;
  progress: number;
  cancellable: boolean;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  payload?: JsonValue;
  result?: JsonValue;
}

export interface RuntimeOffloadEvent {
  id: string;
  taskId: string;
  kind: 'queued' | 'started' | 'progress' | 'completed' | 'failed' | 'cancelled';
  timestamp: string;
  message: string;
  progress: number;
}

export interface RuntimeOffloadSnapshot {
  generatedAt: string;
  activeTaskIds: string[];
  queue: string[];
  tasks: RuntimeOffloadTask[];
  totals: {
    queued: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
}

export function createRuntimeOffloadTask(
  input: RuntimeOffloadTaskInput,
  timestamp = new Date().toISOString()
): RuntimeOffloadTask {
  return {
    id: input.id ?? `offload:${input.kind}:${timestamp}`,
    kind: input.kind,
    label: sanitizeText(input.label, 160),
    priority: input.priority ?? 'normal',
    status: 'queued',
    progress: 0,
    cancellable: input.cancellable ?? true,
    createdAt: timestamp,
    startedAt: null,
    completedAt: null,
    error: null,
    payload: input.payload === undefined ? undefined : sanitizeJson(input.payload)
  };
}

export function startRuntimeOffloadTask(
  task: RuntimeOffloadTask,
  timestamp = new Date().toISOString()
): RuntimeOffloadTask {
  if (task.status !== 'queued') {
    return task;
  }

  return {
    ...task,
    status: 'running',
    startedAt: timestamp,
    error: null
  };
}

export function updateRuntimeOffloadTaskProgress(
  task: RuntimeOffloadTask,
  progress: number,
  _timestamp = new Date().toISOString()
): RuntimeOffloadTask {
  if (task.status !== 'running') {
    return task;
  }

  return {
    ...task,
    progress: clampProgress(progress)
  };
}

export function completeRuntimeOffloadTask(
  task: RuntimeOffloadTask,
  result: unknown = undefined,
  timestamp = new Date().toISOString()
): RuntimeOffloadTask {
  if (task.status !== 'running') {
    return task;
  }

  return {
    ...task,
    status: 'completed',
    progress: 100,
    completedAt: timestamp,
    error: null,
    result: result === undefined ? task.result : sanitizeJson(result)
  };
}

export function failRuntimeOffloadTask(
  task: RuntimeOffloadTask,
  error: string,
  timestamp = new Date().toISOString()
): RuntimeOffloadTask {
  if (task.status !== 'running' && task.status !== 'queued') {
    return task;
  }

  return {
    ...task,
    status: 'failed',
    completedAt: timestamp,
    error: sanitizeText(error, 500)
  };
}

export function cancelRuntimeOffloadTask(
  task: RuntimeOffloadTask,
  timestamp = new Date().toISOString()
): RuntimeOffloadTask {
  if (!task.cancellable || task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
    return task;
  }

  return {
    ...task,
    status: 'cancelled',
    completedAt: timestamp,
    error: null
  };
}

export function createRuntimeOffloadSnapshot(
  tasks: RuntimeOffloadTask[],
  timestamp = new Date().toISOString()
): RuntimeOffloadSnapshot {
  const sortedTasks = [...tasks].sort(compareRuntimeOffloadTasks);

  return {
    generatedAt: timestamp,
    activeTaskIds: sortedTasks.filter((task) => task.status === 'running').map((task) => task.id),
    queue: sortedTasks.filter((task) => task.status === 'queued').map((task) => task.id),
    tasks: sortedTasks,
    totals: {
      queued: sortedTasks.filter((task) => task.status === 'queued').length,
      running: sortedTasks.filter((task) => task.status === 'running').length,
      completed: sortedTasks.filter((task) => task.status === 'completed').length,
      failed: sortedTasks.filter((task) => task.status === 'failed').length,
      cancelled: sortedTasks.filter((task) => task.status === 'cancelled').length
    }
  };
}

export function compareRuntimeOffloadTasks(a: RuntimeOffloadTask, b: RuntimeOffloadTask): number {
  const priorityDelta = priorityWeight[b.priority] - priorityWeight[a.priority];

  if (priorityDelta !== 0 && a.status === b.status && a.status === 'queued') {
    return priorityDelta;
  }

  return a.createdAt.localeCompare(b.createdAt);
}

const priorityWeight: Record<RuntimeOffloadTaskPriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
  urgent: 3
};

function clampProgress(progress: number): number {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(progress) ? progress : 0)));
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
