import { createPanel, createStack, createWorkspaceWindow } from '../../domain/workspace/factories';
import type { Workspace } from '../../domain/workspace/model';
import { createWorkspaceSessionState } from '../workspace/session';

const screenPrefix = 'window.screen.';
export const PRIMARY_EXPERIENCE_SCREEN = 'main';

export function experienceScreens(workspace: Workspace) {
  return workspace.windows.flatMap((window, index) => {
    if (index === 0) return [{id:PRIMARY_EXPERIENCE_SCREEN, window, number:1}];
    if (window.id.startsWith(screenPrefix)) {
      return [{id:window.id.slice(screenPrefix.length), window, number:index+1}];
    }
    return [];
  });
}

export function addExperienceScreen(workspace: Workspace, screenId?: string, title?:string) {
  const panel = createPanel();
  const created = createWorkspaceWindow(createStack([panel]));
  const id = screenId ?? created.id.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const window = {...created, id:screenPrefix+id,...(title?.trim()?{title:title.trim()}: {})};
  if (experienceScreens(workspace).some(screen=>screen.id===id)) return null;
  return {id, window, panelId:panel.id, workspace:{...workspace, windows:[...workspace.windows,window]}};
}

export function focusExperienceScreen(workspace: Workspace, window: Workspace['windows'][number]) {
  return createWorkspaceSessionState({...workspace, activeWindowId:window.id, fullscreenPanelId:null});
}

export function renameExperienceScreen(workspace: Workspace, id: string, title: string): Workspace | null {
  const name = title.trim();
  const screen = experienceScreens(workspace).find(entry => entry.id === id);
  if (!name || !screen || name === screen.window.title) return null;

  return {
    ...workspace,
    windows: workspace.windows.map(window =>
      window.id === screen.window.id ? { ...window, title: name } : window
    )
  };
}
