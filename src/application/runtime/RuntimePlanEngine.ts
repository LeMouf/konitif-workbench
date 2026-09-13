import type { LaunchPreflightCheck, LaunchPreflightSummary, LaunchTarget } from '../../domain/launch/model';
import type { RuntimePlan, RuntimePlanStep, RuntimePlanWarning } from '../../domain/runtime/plan';

export interface CreateRuntimePlanInput {
  target: LaunchTarget;
  preflight?: LaunchPreflightSummary | null;
  dryRun?: boolean;
  now?: string;
}

export class RuntimePlanEngine {
  createPlan(input: CreateRuntimePlanInput): RuntimePlan {
    const timestamp = input.now ?? new Date().toISOString();
    const blockedChecks = (input.preflight?.checks ?? []).filter((check) => check.status === 'blocked');
    const warningChecks = (input.preflight?.checks ?? []).filter((check) => check.status === 'warning');
    const steps = createStepsForTarget(input.target, blockedChecks);

    return {
      id: `runtime-plan:${input.target.kind}:${input.target.profile}:${timestamp}`,
      target: input.target,
      profile: input.target.profile,
      createdAt: timestamp,
      dryRun: input.dryRun ?? false,
      canExecute: blockedChecks.length === 0 && steps.every((step) => step.status !== 'blocked'),
      steps,
      warnings: createWarnings([...blockedChecks, ...warningChecks]),
      preflight: input.preflight ?? null
    };
  }
}

function createStepsForTarget(target: LaunchTarget, blockedChecks: LaunchPreflightCheck[]): RuntimePlanStep[] {
  const hasBlockedPreflight = blockedChecks.length > 0;
  const baseSteps: RuntimePlanStep[] = [
    createStep('runtime.observability', 'observability-hook', 'Attach observability hooks', !hasBlockedPreflight),
    createStep('runtime.teardown', 'teardown-hook', 'Register teardown hooks', !hasBlockedPreflight),
    createStep('runtime.rollback', 'rollback-hook', 'Register rollback hooks', !hasBlockedPreflight)
  ];

  if (target.kind === 'self' || target.profile === 'core-only' || target.profile === 'recovery-mode') {
    return [
      ...baseSteps,
      createStep('tool.runtime-inspector', 'register-tool', 'Register Runtime Inspector', !hasBlockedPreflight),
      createStep('manager.core-observability', 'initialize-manager', 'Initialize core observability manager', !hasBlockedPreflight)
    ];
  }

  if (target.profile === 'repo-inspect-only') {
    return [
      ...baseSteps,
      createStep('service.repo-inspection', 'start-service', 'Start repository inspection service', !hasBlockedPreflight),
      createStep('worker.repo-index', 'launch-worker', 'Launch repository indexing worker', !hasBlockedPreflight),
      createStep('tool.runtime-inspector', 'register-tool', 'Register Runtime Inspector', !hasBlockedPreflight)
    ];
  }

  return [
    ...baseSteps,
    createStep('store.workspace', 'mount-store', 'Mount workspace stores', !hasBlockedPreflight),
    createStep('service.runtime-api', 'start-service', 'Start runtime API services', !hasBlockedPreflight),
    createStep('manager.workspace', 'initialize-manager', 'Initialize workspace managers', !hasBlockedPreflight),
    createStep('tool.registry', 'register-tool', 'Register workspace tools', !hasBlockedPreflight),
    createStep('watcher.workspace', 'activate-watcher', 'Activate workspace watchers', !hasBlockedPreflight),
    createStep('worker.background', 'launch-worker', 'Launch background workers', !hasBlockedPreflight)
  ];
}

function createStep(
  id: string,
  kind: RuntimePlanStep['kind'],
  label: string,
  enabled: boolean
): RuntimePlanStep {
  return {
    id,
    kind,
    label,
    status: enabled ? 'planned' : 'blocked',
    critical: kind !== 'activate-watcher' && kind !== 'launch-worker',
    reason: enabled ? null : 'Blocked by preflight.'
  };
}

function createWarnings(checks: LaunchPreflightCheck[]): RuntimePlanWarning[] {
  return checks.map((check) => ({
    id: check.id,
    message: `${check.label}: ${check.message}`
  }));
}
