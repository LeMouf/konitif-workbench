import type { ToolCatalogPort } from '../../domain/tool/model';
import type { Workspace } from '../../domain/workspace/model';
import { createPanel, createStack, createWorkspaceShell, createWorkspaceWindow } from '../../domain/workspace/factories';
import { openTool } from './openTool';

interface CreateWorkspaceOptions {
  initialToolId?: string;
}

export function createWorkspace(toolCatalog?: ToolCatalogPort, options: CreateWorkspaceOptions = {}): Workspace {
  const initialPanel = createPanel('Welcome');
  const initialStack = createStack([initialPanel]);
  const initialWindow = createWorkspaceWindow(initialStack);
  const workspace = createWorkspaceShell(initialWindow);

  if (!options.initialToolId || !toolCatalog) {
    return workspace;
  }

  return openTool(workspace, { panelId: initialPanel.id, toolId: options.initialToolId }, toolCatalog).workspace;
}
