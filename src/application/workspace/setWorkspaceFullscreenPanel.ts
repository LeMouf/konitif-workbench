import type { Workspace } from '../../domain/workspace/model';
import { findPanelInWorkspace } from '../../domain/workspace/selectors';

export function normalizeWorkspaceFullscreenPanel(workspace: Workspace): Workspace {
  const fullscreenPanelId = workspace.fullscreenPanelId ?? null;

  if (fullscreenPanelId === null) {
    return workspace.fullscreenPanelId === null ? workspace : { ...workspace, fullscreenPanelId: null };
  }

  return findPanelInWorkspace(workspace, fullscreenPanelId)
    ? workspace
    : {
        ...workspace,
        fullscreenPanelId: null
      };
}

export function setWorkspaceFullscreenPanel(workspace: Workspace, panelId: string | null): Workspace {
  const nextFullscreenPanelId = panelId ?? null;

  if (nextFullscreenPanelId !== null && !findPanelInWorkspace(workspace, nextFullscreenPanelId)) {
    return normalizeWorkspaceFullscreenPanel(workspace);
  }

  if ((workspace.fullscreenPanelId ?? null) === nextFullscreenPanelId) {
    return normalizeWorkspaceFullscreenPanel(workspace);
  }

  return {
    ...workspace,
    fullscreenPanelId: nextFullscreenPanelId
  };
}
