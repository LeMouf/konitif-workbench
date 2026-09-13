import type { LaunchPhase } from '../launch/model';

export type RuntimeLifecycleState = LaunchPhase;
export type RuntimeLifecycleMacroPhase =
  | 'boot'
  | 'launch'
  | 'planning'
  | 'initialization'
  | 'hydration'
  | 'running'
  | 'suspension'
  | 'teardown'
  | 'recovery';
export type RuntimeLifecycleHealth = 'idle' | 'progressing' | 'healthy' | 'recovering' | 'safe-mode' | 'blocked';

export interface RuntimeLifecycleTransition {
  id: string;
  from: RuntimeLifecycleState | null;
  to: RuntimeLifecycleState;
  accepted: boolean;
  timestamp: string;
  message: string;
}

export interface RuntimeLifecycleTransitionError {
  id: string;
  from: RuntimeLifecycleState | null;
  to: RuntimeLifecycleState;
  timestamp: string;
  message: string;
}

export interface RuntimeLifecycleSnapshot {
  state: RuntimeLifecycleState;
  previousState: RuntimeLifecycleState | null;
  transitions: RuntimeLifecycleTransition[];
  errors: RuntimeLifecycleTransitionError[];
  updatedAt: string;
}

export interface RuntimeLifecycleSummary {
  state: RuntimeLifecycleState;
  previousState: RuntimeLifecycleState | null;
  macroPhase: RuntimeLifecycleMacroPhase;
  health: RuntimeLifecycleHealth;
  acceptedTransitions: number;
  rejectedTransitions: number;
  latestTransitionAt: string | null;
  updatedAt: string;
}

export interface RuntimeLifecycleTransitionInput {
  id: string;
  timestamp: string;
  message?: string;
  maxTransitions?: number;
  maxErrors?: number;
}

export const RUNTIME_LIFECYCLE_ALLOWED_TRANSITIONS: Record<RuntimeLifecycleState, readonly RuntimeLifecycleState[]> = {
  BOOT: ['LAUNCH_GATE', 'SAFE_MODE'],
  LAUNCH_GATE: ['CONTEXT_RESOLVED', 'PREFLIGHT', 'SAFE_MODE'],
  CONTEXT_RESOLVED: ['LAUNCH_GATE', 'PREFLIGHT', 'SAFE_MODE'],
  PREFLIGHT: ['CONTEXT_RESOLVED', 'LAUNCH_GATE', 'PLANNED', 'SAFE_MODE'],
  PLANNED: ['INITIALIZING', 'RECOVERY', 'SAFE_MODE'],
  INITIALIZING: ['HYDRATING', 'RECOVERY', 'SAFE_MODE'],
  HYDRATING: ['RUNNING', 'RECOVERY', 'SAFE_MODE'],
  RUNNING: ['SUSPENDING', 'TEARDOWN', 'RECOVERY'],
  SUSPENDING: ['SUSPENDED', 'TEARDOWN', 'RECOVERY'],
  SUSPENDED: ['RESUMING', 'TEARDOWN', 'SAFE_MODE'],
  RESUMING: ['RUNNING', 'RECOVERY', 'SAFE_MODE'],
  TEARDOWN: ['LAUNCH_GATE', 'INITIALIZING', 'SAFE_MODE'],
  RECOVERY: ['LAUNCH_GATE', 'PREFLIGHT', 'INITIALIZING', 'SAFE_MODE'],
  SAFE_MODE: ['LAUNCH_GATE', 'PREFLIGHT', 'INITIALIZING']
};

export const RUNTIME_LIFECYCLE_MACRO_PHASES: Record<RuntimeLifecycleState, RuntimeLifecycleMacroPhase> = {
  BOOT: 'boot',
  LAUNCH_GATE: 'launch',
  CONTEXT_RESOLVED: 'launch',
  PREFLIGHT: 'planning',
  PLANNED: 'planning',
  INITIALIZING: 'initialization',
  HYDRATING: 'hydration',
  RUNNING: 'running',
  SUSPENDING: 'suspension',
  SUSPENDED: 'suspension',
  RESUMING: 'suspension',
  TEARDOWN: 'teardown',
  RECOVERY: 'recovery',
  SAFE_MODE: 'recovery'
};

export function createRuntimeLifecycleSnapshot(
  state: RuntimeLifecycleState = 'LAUNCH_GATE',
  timestamp = new Date().toISOString()
): RuntimeLifecycleSnapshot {
  return {
    state,
    previousState: null,
    transitions: [],
    errors: [],
    updatedAt: timestamp
  };
}

export function canTransitionRuntimeLifecycle(
  from: RuntimeLifecycleState | null,
  to: RuntimeLifecycleState
): boolean {
  if (!from || from === to) {
    return true;
  }

  return RUNTIME_LIFECYCLE_ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionRuntimeLifecycleSnapshot(
  snapshot: RuntimeLifecycleSnapshot,
  to: RuntimeLifecycleState,
  input: RuntimeLifecycleTransitionInput
): RuntimeLifecycleSnapshot {
  const from = snapshot.state;
  const accepted = canTransitionRuntimeLifecycle(from, to);
  const transition: RuntimeLifecycleTransition = {
    id: input.id,
    from,
    to,
    accepted,
    timestamp: input.timestamp,
    message: input.message ?? (accepted ? `Runtime lifecycle moved to ${to}` : `Runtime lifecycle rejected ${from} -> ${to}`)
  };
  const maxTransitions = input.maxTransitions ?? 50;
  const maxErrors = input.maxErrors ?? 20;

  if (!accepted) {
    const error: RuntimeLifecycleTransitionError = {
      id: input.id,
      from,
      to,
      timestamp: input.timestamp,
      message: transition.message
    };

    return {
      ...snapshot,
      transitions: [transition, ...snapshot.transitions].slice(0, maxTransitions),
      errors: [error, ...snapshot.errors].slice(0, maxErrors),
      updatedAt: input.timestamp
    };
  }

  return {
    state: to,
    previousState: from,
    transitions: [transition, ...snapshot.transitions].slice(0, maxTransitions),
    errors: snapshot.errors.slice(0, maxErrors),
    updatedAt: input.timestamp
  };
}

export function resolveRuntimeLifecycleMacroPhase(state: RuntimeLifecycleState): RuntimeLifecycleMacroPhase {
  return RUNTIME_LIFECYCLE_MACRO_PHASES[state] ?? 'launch';
}

export function resolveRuntimeLifecycleHealth(snapshot: RuntimeLifecycleSnapshot): RuntimeLifecycleHealth {
  if (snapshot.errors.length > 0 && snapshot.state !== 'RECOVERY' && snapshot.state !== 'SAFE_MODE') {
    return 'blocked';
  }

  switch (snapshot.state) {
    case 'BOOT':
    case 'LAUNCH_GATE':
    case 'CONTEXT_RESOLVED':
      return 'idle';
    case 'RUNNING':
      return 'healthy';
    case 'RECOVERY':
      return 'recovering';
    case 'SAFE_MODE':
      return 'safe-mode';
    default:
      return 'progressing';
  }
}

export function createRuntimeLifecycleSummary(snapshot: RuntimeLifecycleSnapshot): RuntimeLifecycleSummary {
  const latestTransition = snapshot.transitions[0] ?? null;

  return {
    state: snapshot.state,
    previousState: snapshot.previousState,
    macroPhase: resolveRuntimeLifecycleMacroPhase(snapshot.state),
    health: resolveRuntimeLifecycleHealth(snapshot),
    acceptedTransitions: snapshot.transitions.filter((transition) => transition.accepted).length,
    rejectedTransitions: snapshot.transitions.filter((transition) => !transition.accepted).length,
    latestTransitionAt: latestTransition?.timestamp ?? null,
    updatedAt: snapshot.updatedAt
  };
}
