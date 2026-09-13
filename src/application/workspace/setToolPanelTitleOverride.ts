import { updatePanelById } from './layoutTree';
import type { ToolCatalogPort } from '../../domain/tool/model';
import { normalizePanelTitleOverride, resolvePanelTitle } from '../../domain/tool/shell';
import type { Workspace } from '../../domain/workspace/model';
import { findPanelInWorkspace } from '../../domain/workspace/selectors';

interface SetToolPanelTitleOverrideInput {
  panelId: string;
  toolInstanceId: string;
  panelTitleOverride: string | null;
}

export function setToolPanelTitleOverride(
  workspace: Workspace,
  input: SetToolPanelTitleOverrideInput,
  toolCatalog: ToolCatalogPort
): Workspace {
  const panel = findPanelInWorkspace(workspace, input.panelId);
  const toolInstance = workspace.toolInstances[input.toolInstanceId];

  if (!panel || panel.toolInstanceId !== input.toolInstanceId || !toolInstance) {
    return workspace;
  }

  const toolDefinition = toolCatalog.getDefinition(toolInstance.toolId);

  if (!toolDefinition) {
    return workspace;
  }

  const normalizedOverride = normalizePanelTitleOverride(input.panelTitleOverride);
  const nextToolInstance = {
    ...toolInstance,
    panelTitleOverride: normalizedOverride
  };

  return {
    ...workspace,
    toolInstances: {
      ...workspace.toolInstances,
      [input.toolInstanceId]: nextToolInstance
    },
    windows: workspace.windows.map((window) => ({
      ...window,
      root: updatePanelById(window.root, input.panelId, (currentPanel) => ({
        ...currentPanel,
        title: resolvePanelTitle(toolDefinition, nextToolInstance)
      }))
    }))
  };
}
