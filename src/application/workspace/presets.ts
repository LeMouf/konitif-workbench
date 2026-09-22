import type { ToolCatalogPort } from '../../domain/tool/model';
import { createWorkspaceSessionState, type WorkspaceSessionState } from './session';
import { createWorkspace } from './createWorkspace';

export type WorkspacePresetId = 'default';

export function createWorkspaceFromPreset(toolCatalog: ToolCatalogPort, presetId: WorkspacePresetId = 'default') {
  switch (presetId) {
    case 'default':
      return createWorkspace(toolCatalog);
  }
}

export function createWorkspaceSessionFromPreset(
  toolCatalog: ToolCatalogPort,
  presetId: WorkspacePresetId = 'default'
): WorkspaceSessionState {
  return createWorkspaceSessionState(createWorkspaceFromPreset(toolCatalog, presetId));
}
