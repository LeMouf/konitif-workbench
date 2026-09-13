import type { PanelNode } from '../panel/model';
import type { ToolInstance } from '../tool/model';
import type { Workspace, WorkspaceWindow } from './model';
import { findPanel, findSplit, findStack, findStackContainingPanel, listPanels } from '../layout/selectors';

export function getWindowById(workspace: Workspace, windowId: string): WorkspaceWindow | undefined {
  return workspace.windows.find((window) => window.id === windowId);
}

export function getActiveWindow(workspace: Workspace): WorkspaceWindow | undefined {
  return getWindowById(workspace, workspace.activeWindowId) ?? workspace.windows[0];
}

export function findWindowContainingPanel(workspace: Workspace, panelId: string): WorkspaceWindow | undefined {
  return workspace.windows.find((window) => findPanel(window.root, panelId));
}

export function findPanelInWorkspace(workspace: Workspace, panelId: string): PanelNode | undefined {
  for (const window of workspace.windows) {
    const match = findPanel(window.root, panelId);

    if (match) {
      return match;
    }
  }

  return undefined;
}

export function findStackInWorkspace(workspace: Workspace, stackId: string) {
  for (const window of workspace.windows) {
    const match = findStack(window.root, stackId);

    if (match) {
      return match;
    }
  }

  return undefined;
}

export function findStackContainingPanelInWorkspace(workspace: Workspace, panelId: string) {
  for (const window of workspace.windows) {
    const match = findStackContainingPanel(window.root, panelId);

    if (match) {
      return match;
    }
  }

  return undefined;
}

export function findSplitInWorkspace(workspace: Workspace, splitId: string) {
  for (const window of workspace.windows) {
    const match = findSplit(window.root, splitId);

    if (match) {
      return match;
    }
  }

  return undefined;
}

export function listPanelsInWorkspace(workspace: Workspace): PanelNode[] {
  return workspace.windows.flatMap((window) => listPanels(window.root));
}

export function findToolPlacementByToolId(
  workspace: Workspace,
  toolId: string
): { panelId: string; toolInstanceId: string; toolInstance: ToolInstance } | undefined {
  for (const panel of listPanelsInWorkspace(workspace)) {
    if (!panel.toolInstanceId) {
      continue;
    }

    const toolInstance = workspace.toolInstances[panel.toolInstanceId];

    if (toolInstance?.toolId === toolId) {
      return {
        panelId: panel.id,
        toolInstanceId: toolInstance.id,
        toolInstance
      };
    }
  }

  return undefined;
}

export function collectReferencedToolInstanceIds(workspace: Workspace): Set<string> {
  const toolInstanceIds = new Set<string>();

  for (const panel of listPanelsInWorkspace(workspace)) {
    if (panel.toolInstanceId) {
      toolInstanceIds.add(panel.toolInstanceId);
    }
  }

  return toolInstanceIds;
}

export function getPreferredFocusedPanelId(workspace: Workspace): string | null {
  const activeWindow = getActiveWindow(workspace);

  if (!activeWindow) {
    return null;
  }

  return getPreferredFocusedPanelIdFromNode(activeWindow.root);
}

function getPreferredFocusedPanelIdFromNode(node: WorkspaceWindow['root']): string | null {
  if (node.kind === 'stack') {
    return node.activeChildId;
  }

  return getPreferredFocusedPanelIdFromNode(node.children[0]) ?? getPreferredFocusedPanelIdFromNode(node.children[1]);
}

export function listToolInstances(workspace: Workspace): ToolInstance[] {
  return Object.values(workspace.toolInstances);
}
