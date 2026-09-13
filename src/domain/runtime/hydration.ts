import type { RuntimePlan } from './plan';

export type RuntimeHydrationStepKind = 'documents' | 'graphs' | 'layouts' | 'sessions' | 'tools' | 'stores';
export type RuntimeHydrationStepStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface RuntimeHydrationStep {
  id: string;
  kind: RuntimeHydrationStepKind;
  label: string;
  status: RuntimeHydrationStepStatus;
  startedAt: string | null;
  completedAt: string | null;
  message: string | null;
}

export interface RuntimeHydrationSnapshot {
  planId: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'partial';
  activeStepId: string | null;
  progress: number;
  steps: RuntimeHydrationStep[];
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  error: string | null;
}

const DEFAULT_HYDRATION_STEPS: Array<{ kind: RuntimeHydrationStepKind; label: string }> = [
  { kind: 'documents', label: 'Hydrate documents' },
  { kind: 'graphs', label: 'Hydrate graphs' },
  { kind: 'layouts', label: 'Hydrate layouts' },
  { kind: 'sessions', label: 'Hydrate sessions' },
  { kind: 'tools', label: 'Hydrate tools' },
  { kind: 'stores', label: 'Hydrate stores' }
];

export function createRuntimeHydrationSnapshot(
  plan: RuntimePlan,
  timestamp = new Date().toISOString()
): RuntimeHydrationSnapshot {
  const steps = DEFAULT_HYDRATION_STEPS.map((step) => ({
    id: `hydrate:${step.kind}`,
    kind: step.kind,
    label: step.label,
    status: 'pending' as const,
    startedAt: null,
    completedAt: null,
    message: null
  }));
  const firstStep = steps[0] ?? null;

  return {
    planId: plan.id,
    status: 'running',
    activeStepId: firstStep?.id ?? null,
    progress: 0,
    steps: firstStep
      ? steps.map((step) => step.id === firstStep.id ? { ...step, status: 'running', startedAt: timestamp } : step)
      : steps,
    startedAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    error: null
  };
}

export function completeRuntimeHydrationStep(
  snapshot: RuntimeHydrationSnapshot,
  stepId: string,
  timestamp = new Date().toISOString(),
  message: string | null = null
): RuntimeHydrationSnapshot {
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
  const progress = calculateHydrationProgress(nextSteps);
  const completed = progress >= 100;

  return {
    ...snapshot,
    status: completed ? 'completed' : 'running',
    activeStepId: completed ? null : nextPendingStep?.id ?? null,
    progress,
    steps: nextSteps,
    updatedAt: timestamp,
    completedAt: completed ? timestamp : null,
    error: null
  };
}

export function failRuntimeHydrationStep(
  snapshot: RuntimeHydrationSnapshot,
  stepId: string,
  error: string,
  timestamp = new Date().toISOString()
): RuntimeHydrationSnapshot {
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
    progress: calculateHydrationProgress(steps),
    steps,
    updatedAt: timestamp,
    completedAt: timestamp,
    error
  };
}

function calculateHydrationProgress(steps: RuntimeHydrationStep[]): number {
  if (steps.length === 0) {
    return 100;
  }

  const resolvedSteps = steps.filter((step) => step.status === 'completed').length;

  return Math.round((resolvedSteps / steps.length) * 100);
}
