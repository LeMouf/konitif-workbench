import {
  findStackContainingPanelInWorkspace,
  findWindowContainingPanel
} from '../../domain/workspace/selectors';
import { setActiveStackChild } from './setActiveStackChild';
import { createWorkspaceSessionState, type WorkspaceSessionState } from './session';

// Shared by direct commands and editable layout projections. The owning
// window must be selected before updating its active stack child.
export function focusPanel(state: WorkspaceSessionState, panelId: string): WorkspaceSessionState {
  const containingStack = findStackContainingPanelInWorkspace(state.workspace, panelId);
  const containingWindow = findWindowContainingPanel(state.workspace, panelId);

  if (!containingStack || !containingWindow) {
    return state;
  }

  const workspaceWithActiveWindow =
    state.workspace.activeWindowId === containingWindow.id
      ? state.workspace
      : { ...state.workspace, activeWindowId: containingWindow.id };
  const nextWorkspace =
    containingStack.activeChildId === panelId
      ? workspaceWithActiveWindow
      : setActiveStackChild(workspaceWithActiveWindow, { stackId: containingStack.id, panelId });

  return createWorkspaceSessionState(nextWorkspace, { activePanelId: panelId });
}
