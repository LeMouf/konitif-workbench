import type { LaunchState } from '../../domain/launch/model';
import type { RuntimeLaunchProgressSnapshot } from '../../domain/runtime/model';

export function createRuntimeLaunchProgressSnapshot(state: LaunchState): RuntimeLaunchProgressSnapshot {
  const checks = state.preflight?.checks ?? [];
  const readyChecks = checks.filter((check) => check.status === 'ready').length;
  const warningChecks = checks.filter((check) => check.status === 'warning').length;
  const blockedChecks = checks.filter((check) => check.status === 'blocked').length;

  if (state.hydration) {
    return createRuntimeLaunchStepProgressSnapshot(
      state.phase,
      state.hydration.status,
      state.hydration.progress,
      state.hydration.activeStepId,
      state.hydration.steps.filter((step) => step.status === 'completed').length,
      state.hydration.steps.length,
      readyChecks,
      warningChecks,
      blockedChecks
    );
  }

  if (state.initialization) {
    return createRuntimeLaunchStepProgressSnapshot(
      state.phase,
      state.initialization.status,
      state.initialization.progress,
      state.initialization.activeStepId,
      state.initialization.steps.filter((step) => step.status === 'completed' || step.status === 'skipped').length,
      state.initialization.steps.length,
      readyChecks,
      warningChecks,
      blockedChecks
    );
  }

  if (state.phase === 'RUNNING') {
    return createRuntimeLaunchStepProgressSnapshot(
      state.phase,
      'running',
      100,
      null,
      0,
      0,
      readyChecks,
      warningChecks,
      blockedChecks
    );
  }

  if (state.plan) {
    const plannedSteps = state.plan.steps.filter((step) => step.status === 'planned').length;
    const blockedSteps = state.plan.steps.filter((step) => step.status === 'blocked').length;
    const executable = state.plan.canExecute && blockedSteps === 0;

    return createRuntimeLaunchStepProgressSnapshot(
      state.phase,
      executable ? 'planned' : 'blocked',
      executable ? 100 : 0,
      null,
      plannedSteps,
      state.plan.steps.length,
      readyChecks,
      warningChecks,
      blockedChecks
    );
  }

  if (checks.length > 0) {
    return createRuntimeLaunchStepProgressSnapshot(
      state.phase,
      blockedChecks > 0 ? 'blocked' : warningChecks > 0 ? 'warning' : readyChecks === checks.length ? 'ready' : 'pending',
      checks.length ? Math.round((readyChecks / checks.length) * 100) : 0,
      checks.find((check) => check.status === 'pending' || check.status === 'blocked')?.id ?? null,
      readyChecks,
      checks.length,
      readyChecks,
      warningChecks,
      blockedChecks
    );
  }

  return createRuntimeLaunchStepProgressSnapshot(
    state.phase,
    state.error ? 'error' : state.phase.toLowerCase(),
    0,
    null,
    0,
    0,
    0,
    0,
    0
  );
}

function createRuntimeLaunchStepProgressSnapshot(
  phase: LaunchState['phase'],
  status: string,
  progress: number,
  activeStepId: string | null,
  completedSteps: number,
  totalSteps: number,
  readyChecks: number,
  warningChecks: number,
  blockedChecks: number
): RuntimeLaunchProgressSnapshot {
  return {
    phase,
    status,
    progress: Math.max(0, Math.min(100, Math.round(progress))),
    activeStepId,
    completedSteps,
    totalSteps,
    readyChecks,
    warningChecks,
    blockedChecks
  };
}
