import type { JsonObject } from '../../domain/shared/json';
import type { ToolRuntimeCapabilitySnapshot, ToolRuntimeContext } from '../../domain/tool/runtime';
import type { RuntimeProjectionSessionPatch } from '../runtime/RuntimeProjectionSessionTypes';
import type {
  ToolPanelLoadingState,
  ToolResourceLoadingState,
  ToolShellStatus
} from '../../domain/tool/model';
import type { WorkbenchReadingLevel } from '../../domain/presentation/readingLevel';
import type { WorkspaceFocus } from './session';

export interface ToolRuntimeHostActions {
  updateToolState(toolInstanceId: string, nextState: JsonObject): boolean;
  setToolPanelTitleOverride(panelId: string, toolInstanceId: string, nextTitle: string | null): boolean;
  setToolShellStatus(toolInstanceId: string, nextStatus: ToolShellStatus | null): boolean;
  setToolPanelLoading(toolInstanceId: string, nextLoading: ToolPanelLoadingState | null): boolean;
  setToolResourceLoading(toolInstanceId: string, nextLoading: ToolResourceLoadingState | null): boolean;
  patchRuntimeProjectionSession?(patch: RuntimeProjectionSessionPatch): boolean;
  runToolCommand(panelId: string, toolInstanceId: string, commandId: string): boolean;
  openTool(toolId: string): boolean;
  canUndoHistory(): boolean;
  canRedoHistory(): boolean;
  undoHistory(): boolean;
  redoHistory(): boolean;
}

interface CreateToolRuntimeContextInput {
  panelId: string;
  toolInstanceId: string;
  focus: WorkspaceFocus;
  hostActions: ToolRuntimeHostActions;
  layoutEditingEnabled?: boolean;
  readingLevel?: WorkbenchReadingLevel;
  capabilities?: ToolRuntimeCapabilitySnapshot;
  requestCapability?: (capabilityId: string) => boolean;
}

const EMPTY_TOOL_RUNTIME_CAPABILITY_SNAPSHOT: ToolRuntimeCapabilitySnapshot = Object.freeze({
  list: () => [],
  get: () => null
});

export function createToolRuntimeContext(input: CreateToolRuntimeContextInput): ToolRuntimeContext {
  const capabilitySnapshot = input.capabilities ?? EMPTY_TOOL_RUNTIME_CAPABILITY_SNAPSHOT;

  return {
    toolInstanceId: input.toolInstanceId,
    panelId: input.panelId,
    readingLevel: input.readingLevel ?? 'casual',
    session: {
      activePanelId: input.focus.activePanelId,
      activeToolInstanceId: input.focus.activeToolInstanceId,
      isActivePanel: input.focus.activePanelId === input.panelId,
      isActiveToolInstance: input.focus.activeToolInstanceId === input.toolInstanceId,
      layoutEditingEnabled: input.layoutEditingEnabled === true
    },
    capabilities: Object.freeze({
      list: capabilitySnapshot.list,
      get: capabilitySnapshot.get,
      request(capabilityId: string) {
        return (
          capabilitySnapshot.get(capabilityId) !== null && (input.requestCapability?.(capabilityId) ?? false)
        );
      }
    }),
    setState(nextState) {
      return input.hostActions.updateToolState(input.toolInstanceId, nextState);
    },
    setPanelTitleOverride(nextTitle) {
      return input.hostActions.setToolPanelTitleOverride(input.panelId, input.toolInstanceId, nextTitle);
    },
    setShellStatus(nextStatus) {
      return input.hostActions.setToolShellStatus(input.toolInstanceId, nextStatus);
    },
    setPanelLoading(nextLoading) {
      return input.hostActions.setToolPanelLoading(input.toolInstanceId, nextLoading);
    },
    setResourceLoading(nextLoading) {
      return input.hostActions.setToolResourceLoading(input.toolInstanceId, nextLoading);
    },
    publishRuntimeProjectionSession(patch) {
      return (
        input.hostActions.patchRuntimeProjectionSession?.({
          ...patch,
          toolInstanceId: input.toolInstanceId
        }) ?? false
      );
    },
    runCommand(commandId) {
      return input.hostActions.runToolCommand(input.panelId, input.toolInstanceId, commandId);
    },
    openTool(toolId) {
      return input.hostActions.openTool(toolId);
    },
    canUndoHistory() {
      return input.hostActions.canUndoHistory();
    },
    canRedoHistory() {
      return input.hostActions.canRedoHistory();
    },
    undoHistory() {
      return input.hostActions.undoHistory();
    },
    redoHistory() {
      return input.hostActions.redoHistory();
    }
  };
}
