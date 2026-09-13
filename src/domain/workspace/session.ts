import type { Workspace } from './model';

export interface WorkspaceFocus {
  activePanelId: string | null;
  activeToolInstanceId: string | null;
}

export interface WorkspaceSessionState {
  workspace: Workspace;
  focus: WorkspaceFocus;
}
