import type { LaunchPhase, LaunchTarget } from '../launch/model';

export type RuntimeRecoveryCause =
  | 'launch-failed'
  | 'initialization-failed'
  | 'hydration-failed'
  | 'suspension-failed'
  | 'resume-failed'
  | 'teardown-failed'
  | 'crash'
  | 'manual';

export type RuntimeRecoveryActionKind =
  | 'capture-failed-launch-report'
  | 'load-last-known-good'
  | 'disable-tools'
  | 'disable-plugins'
  | 'boot-core-only'
  | 'export-diagnostic-bundle'
  | 'retry-preflight'
  | 'retry-safe-mode'
  | 'return-launch-gate';

export type RuntimeRecoveryActionStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface RuntimeFailedLaunchReport {
  id: string;
  createdAt: string;
  phase: LaunchPhase;
  cause: RuntimeRecoveryCause;
  target: LaunchTarget | null;
  error: string;
}

export interface RuntimeDiagnosticBundle {
  id: string;
  createdAt: string;
  failedLaunchReportId: string;
  includedSections: string[];
  sanitized: boolean;
}

export interface RuntimeRecoveryAction {
  id: string;
  kind: RuntimeRecoveryActionKind;
  label: string;
  status: RuntimeRecoveryActionStatus;
  startedAt: string | null;
  completedAt: string | null;
  message: string | null;
}

export interface RuntimeRecoverySnapshot {
  status: 'idle' | 'running' | 'completed' | 'failed';
  cause: RuntimeRecoveryCause;
  activeActionId: string | null;
  progress: number;
  report: RuntimeFailedLaunchReport;
  diagnosticBundle: RuntimeDiagnosticBundle | null;
  actions: RuntimeRecoveryAction[];
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  error: string | null;
}

export interface RuntimeSafeModeSnapshot {
  active: boolean;
  reason: string;
  enteredAt: string;
  profile: 'core-only';
  disabledTools: string[];
  disabledPlugins: string[];
  failedLaunchReportId: string | null;
  diagnosticBundleId: string | null;
}

const RECOVERY_ACTIONS: Array<{ kind: RuntimeRecoveryActionKind; label: string }> = [
  { kind: 'capture-failed-launch-report', label: 'Capture failed launch report' },
  { kind: 'load-last-known-good', label: 'Load last known good config' },
  { kind: 'disable-tools', label: 'Disable non-critical tools' },
  { kind: 'disable-plugins', label: 'Disable plugins' },
  { kind: 'boot-core-only', label: 'Boot core-only runtime' },
  { kind: 'export-diagnostic-bundle', label: 'Export diagnostic bundle' },
  { kind: 'retry-preflight', label: 'Retry from preflight' },
  { kind: 'retry-safe-mode', label: 'Retry from safe mode' },
  { kind: 'return-launch-gate', label: 'Return to launch gate' }
];

export function createRuntimeRecoverySnapshot(
  input: {
    phase: LaunchPhase;
    cause: RuntimeRecoveryCause;
    target: LaunchTarget | null;
    error: string;
  },
  timestamp = new Date().toISOString()
): RuntimeRecoverySnapshot {
  const actions = RECOVERY_ACTIONS.map((action) => ({
    id: `recovery:${action.kind}`,
    kind: action.kind,
    label: action.label,
    status: 'pending' as const,
    startedAt: null,
    completedAt: null,
    message: null
  }));
  const firstAction = actions[0] ?? null;

  return {
    status: 'running',
    cause: input.cause,
    activeActionId: firstAction?.id ?? null,
    progress: 0,
    report: {
      id: `failed-launch:${timestamp}`,
      createdAt: timestamp,
      phase: input.phase,
      cause: input.cause,
      target: input.target,
      error: input.error
    },
    diagnosticBundle: null,
    actions: firstAction
      ? actions.map((action) =>
          action.id === firstAction.id ? { ...action, status: 'running', startedAt: timestamp } : action
        )
      : actions,
    startedAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    error: input.error
  };
}

export function completeRuntimeRecoveryAction(
  snapshot: RuntimeRecoverySnapshot,
  actionId: string,
  timestamp = new Date().toISOString(),
  message: string | null = null
): RuntimeRecoverySnapshot {
  const actions = snapshot.actions.map((action) =>
    action.id === actionId
      ? {
          ...action,
          status: 'completed' as const,
          completedAt: timestamp,
          message
        }
      : action
  );
  const diagnosticBundle =
    actions.find((action) => action.id === actionId)?.kind === 'export-diagnostic-bundle'
      ? createRuntimeDiagnosticBundle(snapshot.report.id, timestamp)
      : snapshot.diagnosticBundle;
  const nextPendingAction = actions.find((action) => action.status === 'pending') ?? null;
  const nextActions = nextPendingAction
    ? actions.map((action) =>
        action.id === nextPendingAction.id
          ? {
              ...action,
              status: 'running' as const,
              startedAt: timestamp
            }
          : action
      )
    : actions;
  const progress = calculateRecoveryProgress(nextActions);
  const completed = progress >= 100;

  return {
    ...snapshot,
    status: completed ? 'completed' : 'running',
    activeActionId: completed ? null : nextPendingAction?.id ?? null,
    progress,
    diagnosticBundle,
    actions: nextActions,
    updatedAt: timestamp,
    completedAt: completed ? timestamp : null,
    error: null
  };
}

export function failRuntimeRecoveryAction(
  snapshot: RuntimeRecoverySnapshot,
  actionId: string,
  error: string,
  timestamp = new Date().toISOString()
): RuntimeRecoverySnapshot {
  const actions = snapshot.actions.map((action) =>
    action.id === actionId
      ? {
          ...action,
          status: 'failed' as const,
          completedAt: timestamp,
          message: error
        }
      : action
  );

  return {
    ...snapshot,
    status: 'failed',
    activeActionId: null,
    progress: calculateRecoveryProgress(actions),
    actions,
    updatedAt: timestamp,
    completedAt: timestamp,
    error
  };
}

export function createRuntimeSafeModeSnapshot(
  recovery: RuntimeRecoverySnapshot | null,
  timestamp = new Date().toISOString(),
  reason = 'Recovery switched to core-only safe mode.'
): RuntimeSafeModeSnapshot {
  return {
    active: true,
    reason,
    enteredAt: timestamp,
    profile: 'core-only',
    disabledTools: ['non-critical-tools'],
    disabledPlugins: ['external-plugins'],
    failedLaunchReportId: recovery?.report.id ?? null,
    diagnosticBundleId: recovery?.diagnosticBundle?.id ?? null
  };
}

export function createRuntimeDiagnosticBundle(
  failedLaunchReportId: string,
  timestamp = new Date().toISOString()
): RuntimeDiagnosticBundle {
  return {
    id: `diagnostic-bundle:${timestamp}`,
    createdAt: timestamp,
    failedLaunchReportId,
    includedSections: ['launch-state', 'runtime-plan', 'lifecycle', 'debug-events', 'stack-traces'],
    sanitized: true
  };
}

function calculateRecoveryProgress(actions: RuntimeRecoveryAction[]): number {
  if (actions.length === 0) {
    return 100;
  }

  const resolvedActions = actions.filter((action) => action.status === 'completed').length;

  return Math.round((resolvedActions / actions.length) * 100);
}
