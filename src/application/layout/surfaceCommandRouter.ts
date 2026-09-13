import type { LayoutDockSide } from '../../domain/layout/interaction';
import type { SplitOrientation } from '../../domain/layout/model';
import type {
  LayoutSurfaceProjection,
  LayoutUserActionIntent
} from '../../domain/layout/surfaceProjection';
import type { JsonObject, JsonValue } from '../../domain/shared/json';
import type { ShellRegionId, ShellState } from '../../domain/shell/model';
import type { Workspace } from '../../domain/workspace/model';
import {
  findPanelInWorkspace,
  findStackInWorkspace
} from '../../domain/workspace/selectors';
import {
  activateShellWidget,
  setShellRegionOpen,
  setShellRegionSize,
  setShellRegionVisible
} from '../shell/state';
import { closePanel } from '../workspace/closePanel';
import { collapseSplitBoundary } from '../workspace/collapseSplitBoundary';
import { createWorkspaceSessionState, type WorkspaceSessionState } from '../workspace/session';
import { dockPanel } from '../workspace/dockPanel';
import { resizeSplitBoundary, type ResizeSplitBoundaryMode } from '../workspace/resizeSplitBoundary';
import { focusPanel } from '../workspace/focusPanel';
import { selectWorkspaceTargetWindow } from '../workspace/targetWindow';
import { splitPanel } from '../workspace/splitPanel';

export interface LayoutSurfaceCommandState {
  shellState?: ShellState;
  workspaceSession?: WorkspaceSessionState;
}

export interface DispatchLayoutSurfaceIntentInput {
  state: LayoutSurfaceCommandState;
  intent: LayoutUserActionIntent;
  projection?: LayoutSurfaceProjection;
}

export interface DispatchLayoutSurfaceIntentResult {
  state: LayoutSurfaceCommandState;
  handled: boolean;
  reason?: string;
}

export function dispatchLayoutSurfaceIntent(
  input: DispatchLayoutSurfaceIntentInput
): DispatchLayoutSurfaceIntentResult {
  if (input.intent.surfaceId.startsWith('shell:')) {
    return dispatchShellLayoutSurfaceIntent(input);
  }

  if (input.intent.surfaceId.startsWith('workspace:')) {
    return dispatchWorkspaceLayoutSurfaceIntent(input);
  }

  return {
    state: input.state,
    handled: false,
    reason: `Unsupported layout surface "${input.intent.surfaceId}"`
  };
}

function dispatchShellLayoutSurfaceIntent(
  input: DispatchLayoutSurfaceIntentInput
): DispatchLayoutSurfaceIntentResult {
  const shellState = input.state.shellState;

  if (!shellState) {
    return createUnhandledResult(input.state, 'Missing shell state');
  }

  const regionId = resolveShellRegionId(input.intent, input.projection);

  if (!regionId || !shellState.regions[regionId]) {
    return createUnhandledResult(input.state, 'Unknown shell region');
  }

  const region = shellState.regions[regionId];
  let nextShellState = shellState;

  switch (input.intent.kind) {
    case 'activate': {
      const widgetId = readString(input.intent.metadata, 'widgetId') ?? region.activeWidgetId;
      nextShellState = widgetId ? activateShellWidget(shellState, regionId, widgetId) : shellState;
      break;
    }
    case 'resize': {
      const nextSize = resolveNextShellRegionSize(region.size, input.intent.metadata);
      nextShellState = nextSize === null ? shellState : setShellRegionSize(shellState, regionId, nextSize);
      break;
    }
    case 'toggle-open':
      nextShellState = setShellRegionOpen(shellState, regionId, !region.isOpen);
      break;
    case 'toggle-visibility':
      nextShellState = setShellRegionVisible(shellState, regionId, !region.isVisible);
      break;
    default:
      return createUnhandledResult(input.state, `Unsupported shell intent "${input.intent.kind}"`);
  }

  return {
    state: {
      ...input.state,
      shellState: nextShellState
    },
    handled: true
  };
}

function dispatchWorkspaceLayoutSurfaceIntent(
  input: DispatchLayoutSurfaceIntentInput
): DispatchLayoutSurfaceIntentResult {
  let workspaceSession = input.state.workspaceSession;

  if (!workspaceSession) {
    return createUnhandledResult(input.state, 'Missing workspace session');
  }

  const sourceId = resolveWorkspaceSourceId(input.intent, input.projection);

  if (!sourceId) {
    return createUnhandledResult(input.state, 'Unknown workspace target');
  }

  const workspace = selectWorkspaceTargetWindow(workspaceSession.workspace, sourceId);
  workspaceSession = createWorkspaceSessionState(workspace, workspaceSession.focus);
  let nextSession = workspaceSession;

  switch (input.intent.kind) {
    case 'activate':
      nextSession = activateWorkspaceTarget(workspaceSession, sourceId);
      break;
    case 'close':
      nextSession = updateWorkspaceSession(workspaceSession, closePanel(workspace, { panelId: sourceId }), sourceId);
      break;
    case 'collapse':
      nextSession = updateWorkspaceSession(
        workspaceSession,
        collapseSplitBoundary(workspace, {
          rootSplitId: sourceId,
          boundaryIndex: readNumber(input.intent.metadata, 'boundaryIndex') ?? 0,
          removeSide: readRemoveSide(input.intent.metadata) ?? 'end'
        })
      );
      break;
    case 'dock':
    case 'move':
      nextSession = dockWorkspacePanel(workspaceSession, sourceId, input.intent);
      break;
    case 'resize': {
      const deltaRatio = readNumber(input.intent.metadata, 'deltaRatio');

      if (deltaRatio === null) {
        return createUnhandledResult(input.state, 'Missing workspace resize deltaRatio');
      }

      nextSession = updateWorkspaceSession(
        workspaceSession,
        resizeSplitBoundary(workspace, {
          rootSplitId: sourceId,
          boundaryIndex: readNumber(input.intent.metadata, 'boundaryIndex') ?? 0,
          deltaRatio,
          mode: readResizeMode(input.intent.metadata) ?? 'local'
        })
      );
      break;
    }
    case 'split':
      nextSession = splitWorkspaceTarget(workspaceSession, sourceId, input.intent);
      break;
    default:
      return createUnhandledResult(input.state, `Unsupported workspace intent "${input.intent.kind}"`);
  }

  return {
    state: {
      ...input.state,
      workspaceSession: nextSession
    },
    handled: true
  };
}

function activateWorkspaceTarget(state: WorkspaceSessionState, sourceId: string): WorkspaceSessionState {
  const panel = findPanelInWorkspace(state.workspace, sourceId);

  if (!panel) {
    const stack = findStackInWorkspace(state.workspace, sourceId);
    return stack ? focusPanel(state, stack.activeChildId) : state;
  }

  return focusPanel(state, panel.id);
}

function splitWorkspaceTarget(
  state: WorkspaceSessionState,
  sourceId: string,
  intent: LayoutUserActionIntent
): WorkspaceSessionState {
  const targetPanelId = resolveWorkspacePanelId(state.workspace, sourceId);

  if (!targetPanelId) {
    return state;
  }

  const orientation = intent.orientation ?? readSplitOrientation(intent.metadata) ?? 'horizontal';
  const nextWorkspace = splitPanel(state.workspace, {
    panelId: targetPanelId,
    orientation,
    side: intent.side
  });

  return updateWorkspaceSession(state, nextWorkspace, targetPanelId);
}

function dockWorkspacePanel(
  state: WorkspaceSessionState,
  sourceId: string,
  intent: LayoutUserActionIntent
): WorkspaceSessionState {
  const panelId = readString(intent.metadata, 'panelId') ?? state.focus.activePanelId;
  const targetStack = findStackInWorkspace(state.workspace, sourceId);
  const placement = intent.side ?? readDockSide(intent.metadata) ?? 'center';

  if (!panelId || !targetStack) {
    return state;
  }

  const nextWorkspace = dockPanel(state.workspace, {
    panelId,
    target: {
      kind: 'stack',
      stackId: targetStack.id,
      placement
    }
  });

  return updateWorkspaceSession(state, nextWorkspace, panelId);
}

function updateWorkspaceSession(
  state: WorkspaceSessionState,
  workspace: Workspace,
  preferredPanelId = state.focus.activePanelId
): WorkspaceSessionState {
  return createWorkspaceSessionState(workspace, { activePanelId: preferredPanelId ?? undefined });
}

function resolveWorkspacePanelId(workspace: Workspace, sourceId: string): string | null {
  const panel = findPanelInWorkspace(workspace, sourceId);

  if (panel) {
    return panel.id;
  }

  const stack = findStackInWorkspace(workspace, sourceId);
  return stack?.activeChildId ?? null;
}

function resolveShellRegionId(
  intent: LayoutUserActionIntent,
  projection: LayoutSurfaceProjection | undefined
): ShellRegionId | null {
  const projectedRegionId = resolveProjectedMetadataString(intent.targetId, projection, 'regionId');

  if (isShellRegionId(projectedRegionId)) {
    return projectedRegionId;
  }

  const marker = intent.targetId.includes(':boundary:') ? ':boundary:' : ':region:';
  const value = readSuffixAfterMarker(intent.targetId, marker);
  return isShellRegionId(value) ? value : null;
}

function resolveWorkspaceSourceId(
  intent: LayoutUserActionIntent,
  projection: LayoutSurfaceProjection | undefined
): string | null {
  const projectedArea = projection?.areas[intent.targetId];

  if (projectedArea) {
    return projectedArea.sourceId;
  }

  const projectedBoundary = projection?.boundaries[intent.targetId];

  if (projectedBoundary) {
    return projectedBoundary.sourceId;
  }

  return readSuffixAfterMarker(intent.targetId, ':area:') ?? readSuffixAfterMarker(intent.targetId, ':boundary:');
}

function resolveProjectedMetadataString(
  targetId: string,
  projection: LayoutSurfaceProjection | undefined,
  key: string
): string | null {
  const areaValue = readString(projection?.areas[targetId]?.metadata, key);

  if (areaValue !== null) {
    return areaValue;
  }

  return readString(projection?.boundaries[targetId]?.metadata, key);
}

function resolveNextShellRegionSize(currentSize: number, metadata: JsonObject | undefined): number | null {
  const size = readNumber(metadata, 'size');

  if (size !== null) {
    return size;
  }

  const delta = readNumber(metadata, 'delta');
  return delta === null ? null : currentSize + delta;
}

function readString(metadata: JsonObject | undefined, key: string): string | null {
  const value = readMetadataValue(metadata, key);
  return typeof value === 'string' ? value : null;
}

function readNumber(metadata: JsonObject | undefined, key: string): number | null {
  const value = readMetadataValue(metadata, key);
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readSplitOrientation(metadata: JsonObject | undefined): SplitOrientation | null {
  const value = readString(metadata, 'orientation');
  return value === 'horizontal' || value === 'vertical' ? value : null;
}

function readDockSide(metadata: JsonObject | undefined): LayoutDockSide | null {
  const value = readString(metadata, 'side');
  return isDockSide(value) ? value : null;
}

function readRemoveSide(metadata: JsonObject | undefined): 'start' | 'end' | null {
  const value = readString(metadata, 'removeSide');
  return value === 'start' || value === 'end' ? value : null;
}

function readResizeMode(metadata: JsonObject | undefined): ResizeSplitBoundaryMode | null {
  const value = readString(metadata, 'mode');
  return value === 'local' || value === 'proportional' ? value : null;
}

function readMetadataValue(metadata: JsonObject | undefined, key: string): JsonValue | undefined {
  return metadata ? metadata[key] : undefined;
}

function readSuffixAfterMarker(value: string, marker: string): string | null {
  const markerIndex = value.indexOf(marker);
  return markerIndex === -1 ? null : value.slice(markerIndex + marker.length) || null;
}

function isShellRegionId(value: string | null): value is ShellRegionId {
  return value === 'left' || value === 'right' || value === 'bottom';
}

function isDockSide(value: string | null): value is LayoutDockSide {
  return value === 'top' || value === 'right' || value === 'bottom' || value === 'left';
}

function createUnhandledResult(state: LayoutSurfaceCommandState, reason: string): DispatchLayoutSurfaceIntentResult {
  return {
    state,
    handled: false,
    reason
  };
}
