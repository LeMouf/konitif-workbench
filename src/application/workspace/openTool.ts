import type { ToolCatalogPort } from '../../domain/tool/model';
import { createInitialToolShellState, resolvePanelTitle } from '../../domain/tool/shell';
import type { Workspace } from '../../domain/workspace/model';
import { createId } from '../../domain/shared/id';
import { cloneJsonObject } from '../../domain/shared/json';
import { containsPanel } from '../../domain/layout/selectors';
import { findToolPlacementByToolId, getActiveWindow } from '../../domain/workspace/selectors';
import { pruneUnusedToolInstances } from './finalizeWorkspace';
import { updateActiveWindowRoot, updatePanelById } from './layoutTree';

interface OpenToolInput {
  panelId: string;
  toolId: string;
  singletonPlacement?: 'focus-existing' | 'move-to-panel';
}

export interface OpenToolResult {
  workspace: Workspace;
  panelId: string | null;
  toolInstanceId: string | null;
  reusedExisting: boolean;
}

export function openTool(workspace: Workspace, input: OpenToolInput, toolCatalog: ToolCatalogPort): OpenToolResult {
  const toolDefinition = toolCatalog.getDefinition(input.toolId);
  const activeWindow = getActiveWindow(workspace);

  if (!toolDefinition || !activeWindow || !containsPanel(activeWindow.root, input.panelId)) {
    return {
      workspace,
      panelId: null,
      toolInstanceId: null,
      reusedExisting: false
    };
  }

  const existingPlacement = findToolPlacementByToolId(workspace, input.toolId);

  if (
    toolDefinition.openingPolicy.mode === 'singleton-global' &&
    existingPlacement &&
    input.singletonPlacement !== 'move-to-panel'
  ) {
    return {
      workspace,
      panelId: existingPlacement.panelId,
      toolInstanceId: existingPlacement.toolInstanceId,
      reusedExisting: true
    };
  }

  if (
    toolDefinition.openingPolicy.mode === 'singleton-global' &&
    existingPlacement &&
    input.singletonPlacement === 'move-to-panel'
  ) {
    const nextWorkspace = moveExistingToolInstanceToPanel(workspace, {
      sourcePanelId: existingPlacement.panelId,
      targetPanelId: input.panelId,
      toolInstanceId: existingPlacement.toolInstanceId,
      panelTitle: resolvePanelTitle(toolDefinition, existingPlacement.toolInstance)
    });

    return {
      workspace: pruneUnusedToolInstances(nextWorkspace),
      panelId: input.panelId,
      toolInstanceId: existingPlacement.toolInstanceId,
      reusedExisting: true
    };
  }

  const toolInstance = {
    id: createId('tool-instance'),
    toolId: toolDefinition.id,
    state: cloneJsonObject(toolDefinition.initialState),
    panelTitleOverride: null,
    shellState: createInitialToolShellState(toolDefinition)
  };

  const nextWorkspace = updateActiveWindowRoot(
    {
      ...workspace,
      toolInstances: {
        ...workspace.toolInstances,
        [toolInstance.id]: toolInstance
      }
    },
    (root) =>
      updatePanelById(root, input.panelId, (panel) => ({
        ...panel,
        title: resolvePanelTitle(toolDefinition, toolInstance),
        toolInstanceId: toolInstance.id
      }))
  );

  return {
    workspace: pruneUnusedToolInstances(nextWorkspace),
    panelId: input.panelId,
    toolInstanceId: toolInstance.id,
    reusedExisting: false
  };
}

function moveExistingToolInstanceToPanel(
  workspace: Workspace,
  input: {
    sourcePanelId: string;
    targetPanelId: string;
    toolInstanceId: string;
    panelTitle: string;
  }
): Workspace {
  return {
    ...workspace,
    windows: workspace.windows.map((window) => ({
      ...window,
      root: updatePanelById(
        updatePanelById(window.root, input.sourcePanelId, (panel) =>
          panel.id === input.targetPanelId
            ? panel
            : {
                ...panel,
                title: 'New panel',
                toolInstanceId: null
              }
        ),
        input.targetPanelId,
        (panel) => ({
          ...panel,
          title: input.panelTitle,
          toolInstanceId: input.toolInstanceId
        })
      )
    }))
  };
}
