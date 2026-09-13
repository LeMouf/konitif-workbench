import type { RuntimePlan, RuntimePlanStep } from './plan';

export type RuntimeInitializationStepStatus = 'pending' | 'running' | 'completed' | 'skipped' | 'failed';

export interface RuntimeInitializationStep {
  id: string;
  planStepId: string;
  label: string;
  status: RuntimeInitializationStepStatus;
  startedAt: string | null;
  completedAt: string | null;
  message: string | null;
}

export interface RuntimeInitializationSnapshot {
  planId: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  activeStepId: string | null;
  progress: number;
  steps: RuntimeInitializationStep[];
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  error: string | null;
}

export function createRuntimeInitializationSnapshot(
  plan: RuntimePlan,
  timestamp = new Date().toISOString()
): RuntimeInitializationSnapshot {
  const steps = plan.steps.map((step) => createInitializationStep(step, timestamp));
  const firstPendingStep = steps.find((step) => step.status === 'pending') ?? null;

  return {
    planId: plan.id,
    status: plan.canExecute ? 'running' : 'failed',
    activeStepId: firstPendingStep?.id ?? null,
    progress: calculateInitializationProgress(steps),
    steps: firstPendingStep
      ? steps.map((step) => step.id === firstPendingStep.id ? { ...step, status: 'running', startedAt: timestamp } : step)
      : steps,
    startedAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    error: plan.canExecute ? null : 'Runtime plan is blocked.'
  };
}

export function completeRuntimeInitializationStep(
  snapshot: RuntimeInitializationSnapshot,
  stepId: string,
  timestamp = new Date().toISOString(),
  message: string | null = null
): RuntimeInitializationSnapshot {
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
  const progress = calculateInitializationProgress(nextSteps);
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

export function failRuntimeInitializationStep(
  snapshot: RuntimeInitializationSnapshot,
  stepId: string,
  error: string,
  timestamp = new Date().toISOString()
): RuntimeInitializationSnapshot {
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
    progress: calculateInitializationProgress(steps),
    steps,
    updatedAt: timestamp,
    completedAt: timestamp,
    error
  };
}

function createInitializationStep(step: RuntimePlanStep, timestamp: string): RuntimeInitializationStep {
  return {
    id: `init:${step.id}`,
    planStepId: step.id,
    label: step.label,
    status: step.status === 'skipped' ? 'skipped' : step.status === 'blocked' ? 'failed' : 'pending',
    startedAt: null,
    completedAt: step.status === 'skipped' || step.status === 'blocked' ? timestamp : null,
    message: step.reason
  };
}

function calculateInitializationProgress(steps: RuntimeInitializationStep[]): number {
  if (steps.length === 0) {
    return 100;
  }

  const resolvedSteps = steps.filter((step) => step.status === 'completed' || step.status === 'skipped').length;

  return Math.round((resolvedSteps / steps.length) * 100);
}
