import type { ToolCatalogPort } from '../../domain/tool/model';
import { createWorkspaceSessionState, type WorkspaceSessionState } from './session';
import { createWorkspace } from './createWorkspace';

export type WorkspacePresetId = 'default';

const DEFAULT_WORKSPACE_INITIAL_TOOL_ID = 'example.welcome';

export function createWorkspaceFromPreset(toolCatalog: ToolCatalogPort, presetId: WorkspacePresetId = 'default') {
  switch (presetId) {
    case 'default':
      return createWorkspace(toolCatalog, { initialToolId: DEFAULT_WORKSPACE_INITIAL_TOOL_ID });
  }
}

export function createWorkspaceSessionFromPreset(
  toolCatalog: ToolCatalogPort,
  presetId: WorkspacePresetId = 'default'
): WorkspaceSessionState {
  return createWorkspaceSessionState(createWorkspaceFromPreset(toolCatalog, presetId));
}
