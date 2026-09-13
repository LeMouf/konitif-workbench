import type { LaunchState } from '../../domain/launch/model';
import type {
  RuntimeDebugEventLevel,
  RuntimeLaunchSnapshot,
  RuntimeLaunchTransition,
  RuntimeLaunchProgressSnapshot
} from '../../domain/runtime/model';
import type { RuntimeStoreMutationInput } from '../../domain/runtime/observability';
import { createRuntimeLaunchProgressSnapshot } from './RuntimeLaunchProgress';
import { sanitizeRuntimeJson } from './WorkbenchRuntimeSanitizers';

export interface RuntimeLaunchTransitionRecordInput {
  id: string;
  message: string;
  previousPhase: LaunchState['phase'] | null;
  state: LaunchState;
  timestamp: string;
}

export interface RuntimeLaunchSnapshotFromStateInput {
  state: LaunchState;
  timestamp: string;
  transitions: RuntimeLaunchTransition[];
}

export interface RuntimeLaunchStoreMutationValueInput {
  previousPhase: LaunchState['phase'] | null;
  progress: RuntimeLaunchProgressSnapshot;
  state: LaunchState;
}

export interface RuntimeLaunchStoreMutationInput {
  id: string;
  previousPhase: LaunchState['phase'] | null;
  progress: RuntimeLaunchProgressSnapshot;
  state: LaunchState;
  timestamp: string;
}

export interface RuntimeLaunchPhaseDebugEventInput {
  id?: string;
  level?: RuntimeDebugEventLevel;
  type: string;
  message?: string;
  scope?: string | null;
  payload?: unknown;
  timestamp?: string;
}

export interface RuntimeLaunchPhaseDebugEventInputOptions {
  launchSnapshot: RuntimeLaunchSnapshot;
  previousPhase: LaunchState['phase'] | null;
  state: LaunchState;
  timestamp: string;
  transition: RuntimeLaunchTransition;
}

export function createRuntimeLaunchTransitionRecord(
  input: RuntimeLaunchTransitionRecordInput
): RuntimeLaunchTransition {
  return {
    id: input.id,
    phase: input.state.phase,
    previousPhase: input.previousPhase,
    target: input.state.target
      ? sanitizeRuntimeJson(input.state.target) as unknown as RuntimeLaunchTransition['target']
      : null,
    timestamp: input.timestamp,
    message: input.message
  };
}

export function createRuntimeLaunchSnapshotFromState(
  input: RuntimeLaunchSnapshotFromStateInput
): RuntimeLaunchSnapshot {
  return {
    phase: input.state.phase,
    target: input.state.target
      ? sanitizeRuntimeJson(input.state.target) as unknown as RuntimeLaunchSnapshot['target']
      : null,
    preflight: input.state.preflight
      ? sanitizeRuntimeJson(input.state.preflight) as unknown as RuntimeLaunchSnapshot['preflight']
      : null,
    plan: input.state.plan ? sanitizeRuntimeJson(input.state.plan) as unknown as RuntimeLaunchSnapshot['plan'] : null,
    initialization: input.state.initialization
      ? sanitizeRuntimeJson(input.state.initialization) as unknown as RuntimeLaunchSnapshot['initialization']
      : null,
    hydration: input.state.hydration
      ? sanitizeRuntimeJson(input.state.hydration) as unknown as RuntimeLaunchSnapshot['hydration']
      : null,
    progress: createRuntimeLaunchProgressSnapshot(input.state),
    state: sanitizeRuntimeJson(input.state) as unknown as RuntimeLaunchSnapshot['state'],
    transitions: input.transitions,
    updatedAt: input.timestamp
  };
}

export function createRuntimeLaunchStoreMutationValue(
  input: RuntimeLaunchStoreMutationValueInput
): NonNullable<RuntimeStoreMutationInput['value']> {
  return {
    phase: input.state.phase,
    previousPhase: input.previousPhase,
    targetKind: input.state.target?.kind ?? null,
    profile: input.state.target?.profile ?? null,
    progress: input.progress,
    error: input.state.error
  };
}

export function createRuntimeLaunchStoreMutationInput(
  input: RuntimeLaunchStoreMutationInput
): RuntimeStoreMutationInput {
  return {
    id: input.id,
    storeId: 'launch.state',
    kind: input.previousPhase ? 'update' : 'snapshot',
    timestamp: input.timestamp,
    value: createRuntimeLaunchStoreMutationValue(input)
  };
}

export function createRuntimeLaunchPhaseDebugEventInput(
  input: RuntimeLaunchPhaseDebugEventInputOptions
): RuntimeLaunchPhaseDebugEventInput {
  return {
    id: input.transition.id,
    level: input.state.phase === 'RECOVERY' || input.state.phase === 'SAFE_MODE' ? 'warning' : 'info',
    type: 'launch.phase.changed',
    message: input.transition.message,
    scope: 'launch',
    timestamp: input.timestamp,
    payload: {
      phase: input.state.phase,
      previousPhase: input.previousPhase,
      target: input.state.target,
      preflight: input.state.preflight,
      progress: input.launchSnapshot.progress,
      error: input.state.error
    }
  };
}
