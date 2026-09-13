import type { RuntimeHydrationSnapshot } from '../runtime/hydration';
import type { RuntimeInitializationSnapshot } from '../runtime/initialization';
import type { RuntimePlan } from '../runtime/plan';
import type { RuntimeRecoverySnapshot, RuntimeSafeModeSnapshot } from '../runtime/recovery';
import type { RuntimeSuspensionSnapshot } from '../runtime/suspension';
import type { RuntimeTeardownSnapshot } from '../runtime/teardown';
import type { RepositoryInspectionSnapshot } from '../repository/model';

export type LaunchTargetKind = 'self' | 'project';
export type LaunchProjectKind = 'app' | 'repository';
export type LaunchProfile =
  | 'core-only'
  | 'project-workbench'
  | 'repo-inspect-only'
  | 'app-safe-mode'
  | 'app-full-runtime'
  | 'sandbox-runtime'
  | 'recovery-mode';
export type LaunchPhase =
  | 'BOOT'
  | 'LAUNCH_GATE'
  | 'CONTEXT_RESOLVED'
  | 'PREFLIGHT'
  | 'PLANNED'
  | 'INITIALIZING'
  | 'HYDRATING'
  | 'RUNNING'
  | 'SUSPENDING'
  | 'SUSPENDED'
  | 'RESUMING'
  | 'TEARDOWN'
  | 'RECOVERY'
  | 'SAFE_MODE';
export type LaunchScreen =
  | 'gate'
  | 'dashboard'
  | 'preflight'
  | 'initializing'
  | 'running'
  | 'safe-mode';

export const LAUNCH_OBSERVABLE_PHASES = [
  'PREFLIGHT',
  'PLANNED',
  'INITIALIZING',
  'HYDRATING',
  'RUNNING',
  'TEARDOWN',
  'RECOVERY'
] as const satisfies readonly LaunchPhase[];

export type LaunchObservablePhase = (typeof LAUNCH_OBSERVABLE_PHASES)[number];

export interface LaunchProjectOption {
  id: string;
  kind: LaunchProjectKind;
  label: string;
  root: string;
  description?: string | null;
  icon?: string | null;
}

export interface LaunchTarget {
  kind: LaunchTargetKind;
  profile: LaunchProfile;
  project?: LaunchProjectOption | null;
}

export interface LaunchPreflightCheck {
  id: string;
  label: string;
  status: 'pending' | 'ready' | 'warning' | 'blocked';
  message: string;
}

export interface LaunchPreflightSummary {
  target: LaunchTarget;
  checks: LaunchPreflightCheck[];
  generatedAt: string;
  repository: RepositoryInspectionSnapshot | null;
}

export interface LaunchState {
  phase: LaunchPhase;
  screen: LaunchScreen;
  target: LaunchTarget | null;
  preflight: LaunchPreflightSummary | null;
  plan: RuntimePlan | null;
  initialization: RuntimeInitializationSnapshot | null;
  hydration: RuntimeHydrationSnapshot | null;
  suspension: RuntimeSuspensionSnapshot | null;
  teardown: RuntimeTeardownSnapshot | null;
  recovery: RuntimeRecoverySnapshot | null;
  safeMode: RuntimeSafeModeSnapshot | null;
  error: string | null;
}

export function createInitialLaunchState(): LaunchState {
  return {
    phase: 'LAUNCH_GATE',
    screen: 'gate',
    target: null,
    preflight: null,
    plan: null,
    initialization: null,
    hydration: null,
    suspension: null,
    teardown: null,
    recovery: null,
    safeMode: null,
    error: null
  };
}

export function transitionLaunchState(state: LaunchState, phase: LaunchPhase, patch: Partial<LaunchState> = {}): LaunchState {
  return {
    ...state,
    ...patch,
    phase,
    screen: patch.screen ?? resolveLaunchScreenForPhase(phase, state.screen)
  };
}

export function createSelfLaunchTarget(): LaunchTarget {
  return {
    kind: 'self',
    profile: 'core-only',
    project: null
  };
}

export function createProjectLaunchTarget(
  project: LaunchProjectOption,
  profile: LaunchProfile = 'project-workbench'
): LaunchTarget {
  return {
    kind: 'project',
    profile,
    project
  };
}

export function createLaunchPreflightSummary(target: LaunchTarget, now = new Date().toISOString()): LaunchPreflightSummary {
  const checks: LaunchPreflightCheck[] =
    target.kind === 'self'
      ? [
          {
            id: 'launch.self.profile',
            label: 'Core profile',
            status: 'ready',
            message: 'Reduced self-inspection environment selected.'
          },
          {
            id: 'launch.self.runtime',
            label: 'Runtime',
            status: 'ready',
            message: 'Workspace runtime will initialize after confirmation.'
          }
        ]
      : [
          {
            id: 'launch.project.target',
            label: 'Project target',
            status: target.project?.root ? 'ready' : 'blocked',
            message: target.project?.root ?? 'No project root selected.'
          },
          {
            id: 'launch.project.scan',
            label: 'Repository projection',
            status: 'pending',
            message: 'Repository metadata will hydrate when an inspection projection is available.'
          }
        ];

  return {
    target,
    checks,
    generatedAt: now,
    repository: null
  };
}

function resolveLaunchScreenForPhase(phase: LaunchPhase, fallback: LaunchScreen): LaunchScreen {
  switch (phase) {
    case 'BOOT':
    case 'LAUNCH_GATE':
    case 'CONTEXT_RESOLVED':
      return 'gate';
    case 'PREFLIGHT':
    case 'PLANNED':
      return 'preflight';
    case 'INITIALIZING':
    case 'HYDRATING':
      return 'initializing';
    case 'RUNNING':
    case 'SUSPENDING':
    case 'SUSPENDED':
    case 'RESUMING':
    case 'TEARDOWN':
    case 'RECOVERY':
      return 'running';
    case 'SAFE_MODE':
      return 'safe-mode';
    default:
      return fallback;
  }
}
