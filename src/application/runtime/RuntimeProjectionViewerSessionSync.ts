import type { WorkbenchRuntimeSharedStateEntry } from '../../domain/runtime/model';
import type { JsonObject } from '../../domain/shared/json';
import type { ToolInstance } from '../../domain/tool/model';
import type { InMemorySurfaceViewerRegistry } from '../../infrastructure/surfaces/InMemorySurfaceViewerRegistry';
import {
  collectRuntimeProjectionSharedStateViewerSessionUpdatePlan,
  collectRuntimeProjectionViewerSessionUpdateRequests
} from './RuntimeProjectionViewerSessionUpdates';
import type {
  RuntimeProjectionSessionPatch,
  RuntimeProjectionSessionState
} from './RuntimeProjectionSessionTypes';

export {
  createRuntimeProjectionSharedStateSignature,
  filterRuntimeProjectionSharedStateEntriesByOrigin
} from './RuntimeProjectionViewerSessionUpdates';

export interface RuntimeProjectionViewerSessionSyncInput {
  surfaceViewerRegistry: InMemorySurfaceViewerRegistry;
  toolInstances: Record<string, ToolInstance>;
  patch: RuntimeProjectionSessionPatch;
}

export interface RuntimeProjectionViewerSessionUpdate {
  toolInstanceId: string;
  nextState: JsonObject;
}

export interface RuntimeProjectionSharedStateViewerSessionSyncInput {
  surfaceViewerRegistry: InMemorySurfaceViewerRegistry;
  toolInstances: Record<string, ToolInstance>;
  sessionState: RuntimeProjectionSessionState;
  sharedStateEntries: WorkbenchRuntimeSharedStateEntry[];
}

export interface RuntimeProjectionSharedStateViewerSessionSyncResult {
  sessionState: RuntimeProjectionSessionState;
  signatures: Record<string, string>;
  viewerUpdates: RuntimeProjectionViewerSessionUpdate[];
  changed: boolean;
}

export function collectRuntimeProjectionViewerSessionUpdates(
  input: RuntimeProjectionViewerSessionSyncInput
): RuntimeProjectionViewerSessionUpdate[] {
  const updates: RuntimeProjectionViewerSessionUpdate[] = [];

  for (const request of collectRuntimeProjectionViewerSessionUpdateRequests(input)) {
    const viewer = input.surfaceViewerRegistry.get(request.toolId);

    if (
      !viewer?.applyRuntimeProjectionSession ||
      !viewer.definition.projectionKinds.includes(request.patch.target.projectionKind)
    ) {
      continue;
    }

    const nextState = viewer.applyRuntimeProjectionSession({
      toolInstanceId: request.toolInstanceId,
      toolInstance: request.toolInstance,
      viewer: viewer.definition,
      patch: request.patch
    });

    if (nextState) {
      updates.push({
        toolInstanceId: request.toolInstanceId,
        nextState
      });
    }
  }

  return updates;
}

export function collectRuntimeProjectionSharedStateViewerSessionUpdates(
  input: RuntimeProjectionSharedStateViewerSessionSyncInput
): RuntimeProjectionSharedStateViewerSessionSyncResult {
  const updatePlan = collectRuntimeProjectionSharedStateViewerSessionUpdatePlan(input);
  const viewerUpdates = updatePlan.patches.flatMap((patch) =>
    collectRuntimeProjectionViewerSessionUpdates({
      surfaceViewerRegistry: input.surfaceViewerRegistry,
      toolInstances: input.toolInstances,
      patch
    })
  );

  return {
    sessionState: updatePlan.sessionState,
    signatures: updatePlan.signatures,
    viewerUpdates,
    changed: updatePlan.changed
  };
}
