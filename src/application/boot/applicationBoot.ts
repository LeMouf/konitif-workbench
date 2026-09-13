import type { BootProjection, BootStepProjection } from '../../boot/projection';
import type { BootMode, BootPhase, BootStepStatus } from '../../boot/types';

export type ApplicationBootSource =
  | 'desktop_host'
  | 'frontend'
  | 'backend'
  | 'resources'
  | 'configuration'
  | 'registry'
  | 'workspace'
  | 'runtime'
  | 'product';

export type ApplicationBootEventStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'completed_with_warnings'
  | 'blocked'
  | 'failed'
  | 'cancelled'
  | 'skipped'
  | 'unknown';

export type ApplicationBootSeverity = 'info' | 'warning' | 'error';

export interface ApplicationBootJournalEntry {
  eventId: string;
  phase: BootPhase;
  stepId: string;
  source: ApplicationBootSource;
  status: ApplicationBootEventStatus;
  message: string;
  diagnosticCode?: string;
  severity: ApplicationBootSeverity;
  startedAt?: number;
  completedAt?: number;
  details: Record<string, unknown>;
}

export type ApplicationRevealReadinessStatus =
  | 'ready'
  | 'ready_with_warnings'
  | 'blocked'
  | 'safe_mode'
  | 'unknown';

export interface ApplicationRevealReadiness {
  status: ApplicationRevealReadinessStatus;
  reasons: string[];
  blockingDiagnostic?: string;
}

export interface ApplicationBootLifecycleProjection {
  executionId: string;
  mode: BootMode;
  phase: BootPhase;
  status: 'idle' | 'running' | 'success' | 'failed';
  currentStep: ApplicationBootJournalEntry | null;
  journal: ApplicationBootJournalEntry[];
  completedSteps: number;
  totalSteps: number;
  warningCount: number;
  blockingDiagnostics: string[];
  revealReadiness: ApplicationRevealReadiness;
  progress: {
    kind: 'planned-steps' | 'indeterminate';
    completed: number;
    total: number;
  };
}

export interface CreateApplicationBootLifecycleProjectionOptions {
  firstFrameReady?: boolean;
  requiredResourcesReady?: boolean;
  workspaceShellMounted?: boolean;
}

export function createApplicationBootLifecycleProjection(
  bootProjection: BootProjection,
  options: CreateApplicationBootLifecycleProjectionOptions = {},
): ApplicationBootLifecycleProjection {
  const journal = bootProjection.steps.map((step) => createJournalEntry(step));
  const completedSteps = bootProjection.steps.filter((step) => isCompletedStepStatus(step.status)).length;
  const warningCount = bootProjection.steps.reduce((count, step) => count + step.warnings.length, 0);
  const blockingDiagnostics = bootProjection.steps
    .filter((step) => step.status === 'failed' || step.status === 'blocked')
    .map((step) => step.error ?? `${step.label} ${step.status}`);
  const status = resolveApplicationBootStatus(bootProjection);
  const currentStep = resolveCurrentJournalEntry(journal);
  const revealReadiness = resolveApplicationRevealReadiness(
    bootProjection,
    warningCount,
    blockingDiagnostics,
    options,
  );

  return {
    executionId: bootProjection.executionId,
    mode: bootProjection.mode,
    phase: bootProjection.currentPhase,
    status,
    currentStep,
    journal,
    completedSteps,
    totalSteps: bootProjection.steps.length,
    warningCount,
    blockingDiagnostics,
    revealReadiness,
    progress:
      bootProjection.steps.length > 0
        ? {
            kind: 'planned-steps',
            completed: completedSteps,
            total: bootProjection.steps.length,
          }
        : {
            kind: 'indeterminate',
            completed: 0,
            total: 0,
          },
  };
}

function createJournalEntry(step: BootStepProjection): ApplicationBootJournalEntry {
  const status = mapBootStepStatus(step.status, step.warnings.length);

  return {
    eventId: `${step.id}:${status}`,
    phase: step.phase,
    stepId: step.id,
    source: resolveApplicationBootSource(step),
    status,
    message: step.label,
    diagnosticCode: step.error ? `boot.${step.status}.${step.id}` : undefined,
    severity: resolveApplicationBootSeverity(status),
    startedAt: step.startedAt,
    completedAt: step.endedAt,
    details: {
      attempts: step.attempts,
      criticality: step.criticality,
      dependencies: step.dependencies.map((dependency) => dependency.stepId),
      warnings: [...step.warnings],
      ...(step.error ? { error: step.error } : {}),
      ...step.metadata,
    },
  };
}

function mapBootStepStatus(
  status: BootStepStatus,
  warningCount: number,
): ApplicationBootEventStatus {
  switch (status) {
    case 'success':
      return warningCount > 0 ? 'completed_with_warnings' : 'completed';
    case 'failed':
      return 'failed';
    case 'blocked':
      return 'blocked';
    case 'skipped':
      return 'skipped';
    case 'running':
      return 'running';
    case 'pending':
    default:
      return 'pending';
  }
}

function resolveApplicationBootSource(step: BootStepProjection): ApplicationBootSource {
  const source = step.metadata.source;

  if (isApplicationBootSource(source)) {
    return source;
  }

  if (step.id.includes('desktop')) return 'desktop_host';
  if (step.id.includes('resource')) return 'resources';
  if (step.id.includes('registry')) return 'registry';
  if (step.id.includes('persistence') || step.id.includes('workspace')) return 'workspace';
  if (step.id.includes('runtime')) return 'runtime';
  if (step.id.includes('profile') || step.id.includes('configuration')) return 'configuration';

  return 'frontend';
}

function isApplicationBootSource(value: unknown): value is ApplicationBootSource {
  return (
    value === 'desktop_host' ||
    value === 'frontend' ||
    value === 'backend' ||
    value === 'resources' ||
    value === 'configuration' ||
    value === 'registry' ||
    value === 'workspace' ||
    value === 'runtime' ||
    value === 'product'
  );
}

function resolveApplicationBootSeverity(status: ApplicationBootEventStatus): ApplicationBootSeverity {
  if (status === 'failed' || status === 'blocked') {
    return 'error';
  }

  if (status === 'completed_with_warnings' || status === 'skipped') {
    return 'warning';
  }

  return 'info';
}

function resolveApplicationBootStatus(
  bootProjection: BootProjection,
): ApplicationBootLifecycleProjection['status'] {
  if (bootProjection.failed) {
    return 'failed';
  }

  if (bootProjection.lastEvent?.type === 'boot:success') {
    return 'success';
  }

  if (bootProjection.lastEvent) {
    return 'running';
  }

  return 'idle';
}

function resolveCurrentJournalEntry(
  journal: readonly ApplicationBootJournalEntry[],
): ApplicationBootJournalEntry | null {
  return (
    journal.find((entry) => entry.status === 'running') ??
    [...journal].reverse().find((entry) => entry.status !== 'pending') ??
    journal[0] ??
    null
  );
}

function resolveApplicationRevealReadiness(
  bootProjection: BootProjection,
  warningCount: number,
  blockingDiagnostics: readonly string[],
  options: CreateApplicationBootLifecycleProjectionOptions,
): ApplicationRevealReadiness {
  if (bootProjection.mode === 'safe') {
    return {
      status: 'safe_mode',
      reasons: ['Boot is running in safe mode.'],
    };
  }

  if (bootProjection.failed || blockingDiagnostics.length > 0) {
    return {
      status: 'blocked',
      reasons: blockingDiagnostics.length > 0 ? [...blockingDiagnostics] : ['Boot failed.'],
      blockingDiagnostic: blockingDiagnostics[0] ?? 'Boot failed.',
    };
  }

  const readinessGates = [
    [options.requiredResourcesReady, 'Required resources are not ready.'],
    [options.workspaceShellMounted, 'Workspace shell is not mounted.'],
    [options.firstFrameReady, 'First application frame is not ready.'],
  ] as const;
  const openReasons = readinessGates
    .filter(([isReady]) => isReady !== true)
    .map(([, reason]) => reason);

  if (bootProjection.lastEvent?.type !== 'boot:success') {
    return {
      status: 'unknown',
      reasons: ['Boot DAG has not reached RUNNING.'],
    };
  }

  if (openReasons.length > 0) {
    return {
      status: 'unknown',
      reasons: openReasons,
    };
  }

  return {
    status: warningCount > 0 ? 'ready_with_warnings' : 'ready',
    reasons: warningCount > 0 ? [`Boot completed with ${warningCount} warning(s).`] : ['Application is ready to reveal.'],
  };
}

function isCompletedStepStatus(status: BootStepStatus): boolean {
  return status === 'success' || status === 'skipped';
}
