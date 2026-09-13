export type RuntimeTeardownStepStatus = 'pending' | 'running' | 'completed' | 'failed';
export type RuntimeTeardownStepKind =
  | 'stop-services'
  | 'dispose-managers'
  | 'terminate-workers'
  | 'unsubscribe-stores'
  | 'flush-logs'
  | 'persist-final-checkpoint'
  | 'close-repo-handles'
  | 'return-launch-gate';

export interface RuntimeTeardownStep {
  id: string;
  kind: RuntimeTeardownStepKind;
  label: string;
  status: RuntimeTeardownStepStatus;
  startedAt: string | null;
  completedAt: string | null;
  message: string | null;
}

export interface RuntimeTeardownReport {
  id: string;
  createdAt: string;
  reason: string;
  completedSteps: number;
  failedStepId: string | null;
}

export interface RuntimeTeardownSnapshot {
  status: 'idle' | 'running' | 'completed' | 'failed';
  activeStepId: string | null;
  progress: number;
  reason: string;
  report: RuntimeTeardownReport | null;
  steps: RuntimeTeardownStep[];
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  error: string | null;
}

const TEARDOWN_STEPS: Array<{ kind: RuntimeTeardownStepKind; label: string }> = [
  { kind: 'stop-services', label: 'Stop services' },
  { kind: 'dispose-managers', label: 'Dispose managers' },
  { kind: 'terminate-workers', label: 'Terminate workers' },
  { kind: 'unsubscribe-stores', label: 'Unsubscribe stores' },
  { kind: 'flush-logs', label: 'Flush logs' },
  { kind: 'persist-final-checkpoint', label: 'Persist final checkpoint' },
  { kind: 'close-repo-handles', label: 'Close repository handles' },
  { kind: 'return-launch-gate', label: 'Return launch gate' }
];

export function createRuntimeTeardownSnapshot(
  timestamp = new Date().toISOString(),
  reason = 'User requested teardown.'
): RuntimeTeardownSnapshot {
  const steps = TEARDOWN_STEPS.map((step) => ({
    id: `teardown:${step.kind}`,
    kind: step.kind,
    label: step.label,
    status: 'pending' as const,
    startedAt: null,
    completedAt: null,
    message: null
  }));
  const firstStep = steps[0] ?? null;

  return {
    status: 'running',
    activeStepId: firstStep?.id ?? null,
    progress: 0,
    reason,
    report: null,
    steps: firstStep
      ? steps.map((step) => step.id === firstStep.id ? { ...step, status: 'running', startedAt: timestamp } : step)
      : steps,
    startedAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    error: null
  };
}

export function completeRuntimeTeardownStep(
  snapshot: RuntimeTeardownSnapshot,
  stepId: string,
  timestamp = new Date().toISOString(),
  message: string | null = null
): RuntimeTeardownSnapshot {
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
  const progress = calculateTeardownProgress(nextSteps);
  const completed = progress >= 100;
  const report = completed
    ? createTeardownReport(snapshot.reason, nextSteps, timestamp, null)
    : snapshot.report;

  return {
    ...snapshot,
    status: completed ? 'completed' : 'running',
    activeStepId: completed ? null : nextPendingStep?.id ?? null,
    progress,
    report,
    steps: nextSteps,
    updatedAt: timestamp,
    completedAt: completed ? timestamp : null,
    error: null
  };
}

export function failRuntimeTeardownStep(
  snapshot: RuntimeTeardownSnapshot,
  stepId: string,
  error: string,
  timestamp = new Date().toISOString()
): RuntimeTeardownSnapshot {
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
    progress: calculateTeardownProgress(steps),
    report: createTeardownReport(snapshot.reason, steps, timestamp, stepId),
    steps,
    updatedAt: timestamp,
    completedAt: timestamp,
    error
  };
}

function createTeardownReport(
  reason: string,
  steps: RuntimeTeardownStep[],
  timestamp: string,
  failedStepId: string | null
): RuntimeTeardownReport {
  return {
    id: `teardown-report:${timestamp}`,
    createdAt: timestamp,
    reason,
    completedSteps: steps.filter((step) => step.status === 'completed').length,
    failedStepId
  };
}

function calculateTeardownProgress(steps: RuntimeTeardownStep[]): number {
  if (steps.length === 0) {
    return 100;
  }

  const resolvedSteps = steps.filter((step) => step.status === 'completed').length;

  return Math.round((resolvedSteps / steps.length) * 100);
}
