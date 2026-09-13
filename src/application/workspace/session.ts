import type { PanelNode } from '../../domain/panel/model';
import type { ToolInstance } from '../../domain/tool/model';
import type { Workspace } from '../../domain/workspace/model';
import type { WorkspaceFocus, WorkspaceSessionState } from '../../domain/workspace/session';
import { getPreferredFocusedPanelId, findPanelInWorkspace } from '../../domain/workspace/selectors';

export type { WorkspaceFocus, WorkspaceSessionState } from '../../domain/workspace/session';

export function createWorkspaceSessionState(
  workspace: Workspace,
  focus: Partial<WorkspaceFocus> = {}
): WorkspaceSessionState {
  return {
    workspace,
    focus: normalizeWorkspaceFocus(workspace, focus)
  };
}

export function normalizeWorkspaceFocus(
  workspace: Workspace,
  focus: Partial<WorkspaceFocus> = {}
): WorkspaceFocus {
  const requestedPanelId = focus.activePanelId ?? getPreferredFullscreenPanelId(workspace) ?? getPreferredFocusedPanelId(workspace);
  const requestedPanel = requestedPanelId ? findPanelInWorkspace(workspace, requestedPanelId) : undefined;
  const panel = requestedPanel ?? getFallbackFocusedPanel(workspace);

  return {
    activePanelId: panel?.id ?? null,
    activeToolInstanceId: panel?.toolInstanceId ?? null
  };
}

export function getFocusedPanel(state: WorkspaceSessionState): PanelNode | undefined {
  return state.focus.activePanelId ? findPanelInWorkspace(state.workspace, state.focus.activePanelId) : undefined;
}

export function getFocusedToolInstance(state: WorkspaceSessionState): ToolInstance | undefined {
  if (!state.focus.activeToolInstanceId) {
    return undefined;
  }

  return state.workspace.toolInstances[state.focus.activeToolInstanceId];
}

function getFallbackFocusedPanel(workspace: Workspace): PanelNode | undefined {
  const fallbackPanelId = getPreferredFullscreenPanelId(workspace) ?? getPreferredFocusedPanelId(workspace);
  return fallbackPanelId ? findPanelInWorkspace(workspace, fallbackPanelId) : undefined;
}

function getPreferredFullscreenPanelId(workspace: Workspace): string | null {
  const fullscreenPanelId = workspace.fullscreenPanelId ?? null;

  if (!fullscreenPanelId) {
    return null;
  }

  return findPanelInWorkspace(workspace, fullscreenPanelId)?.id ?? null;
}
