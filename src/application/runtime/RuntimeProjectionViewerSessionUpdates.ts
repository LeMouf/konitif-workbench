import type { WorkbenchRuntimeSharedStateEntry } from '../../domain/runtime/model';
import type { ToolInstance } from '../../domain/tool/model';
import { isRuntimeProjectionSessionSharedStateKey } from './RuntimeProjectionSessionKeys';
import { createRuntimeProjectionSessionPatchFromEntry } from './RuntimeProjectionSessionSerialization';
import { mergeRuntimeProjectionSessionSharedStateEntries } from './RuntimeProjectionSessionSharedState';
import type {
  RuntimeProjectionSessionPatch,
  RuntimeProjectionSessionState
} from './RuntimeProjectionSessionTypes';

export interface RuntimeProjectionViewerSessionUpdateRequestInput {
  toolInstances: Record<string, ToolInstance>;
  patch: RuntimeProjectionSessionPatch;
}

export interface RuntimeProjectionViewerSessionUpdateRequest {
  toolInstanceId: string;
  toolId: string;
  toolInstance: ToolInstance;
  patch: RuntimeProjectionSessionPatch;
}

export interface RuntimeProjectionSharedStateViewerSessionUpdatePlanInput {
  sessionState: RuntimeProjectionSessionState;
  sharedStateEntries: WorkbenchRuntimeSharedStateEntry[];
}

export interface RuntimeProjectionSharedStateViewerSessionUpdatePlan {
  sessionState: RuntimeProjectionSessionState;
  signatures: Record<string, string>;
  patches: RuntimeProjectionSessionPatch[];
  changed: boolean;
}

export function collectRuntimeProjectionViewerSessionUpdateRequests(
  input: RuntimeProjectionViewerSessionUpdateRequestInput
): RuntimeProjectionViewerSessionUpdateRequest[] {
  const requests: RuntimeProjectionViewerSessionUpdateRequest[] = [];

  for (const [toolInstanceId, toolInstance] of Object.entries(input.toolInstances)) {
    if (toolInstanceId === input.patch.toolInstanceId || !toolInstance.toolId) {
      continue;
    }

    requests.push({
      toolInstanceId,
      toolId: toolInstance.toolId,
      toolInstance,
      patch: input.patch
    });
  }

  return requests;
}

export function collectRuntimeProjectionSharedStateViewerSessionUpdatePlan(
  input: RuntimeProjectionSharedStateViewerSessionUpdatePlanInput
): RuntimeProjectionSharedStateViewerSessionUpdatePlan {
  const mergeResult = mergeRuntimeProjectionSessionSharedStateEntries(
    input.sessionState,
    input.sharedStateEntries
  );

  return {
    sessionState: mergeResult.state,
    signatures: mergeResult.signatures,
    patches: mergeResult.changedEntries.map(createRuntimeProjectionSessionPatchFromEntry),
    changed: mergeResult.changed
  };
}

export function createRuntimeProjectionSharedStateSignature(
  entries: WorkbenchRuntimeSharedStateEntry[]
): string {
  return entries
    .filter((entry) => isRuntimeProjectionSessionSharedStateKey(entry.key))
    .map((entry) => `${entry.key}:${entry.revision}:${entry.originClientId ?? ''}`)
    .join('|');
}

export function filterRuntimeProjectionSharedStateEntriesByOrigin(
  entries: WorkbenchRuntimeSharedStateEntry[],
  originClientId: string | null
): WorkbenchRuntimeSharedStateEntry[] {
  return originClientId
    ? entries.filter((entry) => entry.originClientId !== originClientId)
    : entries;
}
