export type RuntimeSuspensionOperation = 'suspend' | 'resume';
export type RuntimeSuspensionStepStatus = 'pending' | 'running' | 'completed' | 'failed';
export type RuntimeSuspensionStepKind =
  | 'pause-watchers'
  | 'pause-workers'
  | 'freeze-sessions'
  | 'flush-writes'
  | 'checkpoint'
  | 'validate-checkpoint'
  | 'reconnect-services'
  | 'resume-watchers'
  | 'resume-workers'
  | 'rehydrate-state';

export interface RuntimeSuspensionStep {
  id: string;
  kind: RuntimeSuspensionStepKind;
  label: string;
  status: RuntimeSuspensionStepStatus;
  startedAt: string | null;
  completedAt: string | null;
  message: string | null;
}

export interface RuntimeSuspensionCheckpoint {
  id: string;
  createdAt: string;
  reason: string;
}

export interface RuntimeSuspensionSnapshot {
  operation: RuntimeSuspensionOperation;
  status: 'idle' | 'running' | 'completed' | 'failed';
  activeStepId: string | null;
  progress: number;
  checkpoint: RuntimeSuspensionCheckpoint | null;
  steps: RuntimeSuspensionStep[];
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  error: string | null;
}

const SUSPEND_STEPS: Array<{ kind: RuntimeSuspensionStepKind; label: string }> = [
  { kind: 'pause-watchers', label: 'Pause watchers' },
  { kind: 'pause-workers', label: 'Pause workers' },
  { kind: 'freeze-sessions', label: 'Freeze sessions' },
  { kind: 'flush-writes', label: 'Flush writes' },
  { kind: 'checkpoint', label: 'Create checkpoint' }
];

const RESUME_STEPS: Array<{ kind: RuntimeSuspensionStepKind; label: string }> = [
  { kind: 'validate-checkpoint', label: 'Validate checkpoint' },
  { kind: 'reconnect-services', label: 'Reconnect services' },
  { kind: 'rehydrate-state', label: 'Rehydrate state' },
  { kind: 'resume-watchers', label: 'Resume watchers' },
  { kind: 'resume-workers', label: 'Resume workers' }
];

export function createRuntimeSuspensionSnapshot(
  operation: RuntimeSuspensionOperation,
  timestamp = new Date().toISOString(),
  _reason = operation === 'suspend' ? 'User requested suspension.' : 'User requested resume.',
  checkpoint: RuntimeSuspensionCheckpoint | null = null
): RuntimeSuspensionSnapshot {
  const steps = (operation === 'suspend' ? SUSPEND_STEPS : RESUME_STEPS).map((step) => ({
    id: `${operation}:${step.kind}`,
    kind: step.kind,
    label: step.label,
    status: 'pending' as const,
    startedAt: null,
    completedAt: null,
    message: null
  }));
  const firstStep = steps[0] ?? null;

  return {
    operation,
    status: 'running',
    activeStepId: firstStep?.id ?? null,
    progress: 0,
    checkpoint,
    steps: firstStep
      ? steps.map((step) => step.id === firstStep.id ? { ...step, status: 'running', startedAt: timestamp } : step)
      : steps,
    startedAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    error: null
  };
}

export function completeRuntimeSuspensionStep(
  snapshot: RuntimeSuspensionSnapshot,
  stepId: string,
  timestamp = new Date().toISOString(),
  message: string | null = null
): RuntimeSuspensionSnapshot {
  const steps = snapshot.steps.map((step) =>
    step.id === stepId
      ? {
          ...step,
          status: 'completed' as const,
          completedAt: timestamp,
          message
        }
      : step
  );
  const nextPendingStep = steps.find((step) => step.status === 'pending') ?? null;
  const nextSteps = nextPendingStep
    ? steps.map((step) =>
        step.id === nextPendingStep.id
          ? {
              ...step,
              status: 'running' as const,
              startedAt: timestamp
            }
          : step
      )
    : steps;
  const progress = calculateSuspensionProgress(nextSteps);
  const completed = progress >= 100;
  const checkpoint =
    completed && snapshot.operation === 'suspend'
      ? {
          id: `checkpoint:${timestamp}`,
          createdAt: timestamp,
          reason: snapshot.checkpoint?.reason ?? 'Runtime suspended.'
        }
      : snapshot.checkpoint;

  return {
    ...snapshot,
    status: completed ? 'completed' : 'running',
    activeStepId: completed ? null : nextPendingStep?.id ?? null,
    progress,
    checkpoint,
    steps: nextSteps,
    updatedAt: timestamp,
    completedAt: completed ? timestamp : null,
    error: null
  };
}

export function failRuntimeSuspensionStep(
  snapshot: RuntimeSuspensionSnapshot,
  stepId: string,
  error: string,
  timestamp = new Date().toISOString()
): RuntimeSuspensionSnapshot {
  const steps = snapshot.steps.map((step) =>
    step.id === stepId
      ? {
          ...step,
          status: 'failed' as const,
          completedAt: timestamp,
          message: error
        }
      : step
  );

  return {
    ...snapshot,
    status: 'failed',
    activeStepId: null,
    progress: calculateSuspensionProgress(steps),
    steps,
    updatedAt: timestamp,
    completedAt: timestamp,
    error
  };
}

function calculateSuspensionProgress(steps: RuntimeSuspensionStep[]): number {
  if (steps.length === 0) {
    return 100;
  }

  const resolvedSteps = steps.filter((step) => step.status === 'completed').length;

  return Math.round((resolvedSteps / steps.length) * 100);
}
