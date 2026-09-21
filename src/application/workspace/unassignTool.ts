import type { Workspace } from '../../domain/workspace/model';
import { listPanelsInWorkspace } from '../../domain/workspace/selectors';
import { pruneUnusedToolInstances } from './finalizeWorkspace';
import { updatePanelById } from './layoutTree';

export function unassignTool(workspace: Workspace, toolId: string): Workspace {
  const instanceIds = new Set(
    Object.values(workspace.toolInstances)
      .filter(instance => instance.toolId === toolId)
      .map(instance => instance.id)
  );
  if (instanceIds.size === 0) return workspace;

  let windows = workspace.windows;
  for (const panel of listPanelsInWorkspace(workspace)) {
    if (!panel.toolInstanceId || !instanceIds.has(panel.toolInstanceId)) continue;
    windows = windows.map(window => ({
      ...window,
      root: updatePanelById(window.root, panel.id, current => ({
        ...current,
        title: 'Welcome',
        toolInstanceId: null
      }))
    }));
  }
  return pruneUnusedToolInstances({ ...workspace, windows }, instanceIds);
}
