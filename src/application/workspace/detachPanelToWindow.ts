import type { LayoutNode, NonEmptyArray, StackNode } from '../../domain/layout/model';
import type { PanelNode } from '../../domain/panel/model';
import type { Workspace, WorkspaceWindow } from '../../domain/workspace/model';
import { createStack, createWorkspaceWindow } from '../../domain/workspace/factories';
import { canonicalizeLayout } from './canonicalizeLayout';
import { findPanelPathById, replaceNodeAtPathAllowingRemoval } from './layoutTree';

export interface DetachPanelToWindowInput {
  panelId: string;
}

export interface DetachPanelToWindowResult {
  workspace: Workspace;
  panelId: string;
  sourceWindowId: string;
  sourceStackId: string;
  windowId: string;
}

export function detachPanelToWindow(
  workspace: Workspace,
  input: DetachPanelToWindowInput
): DetachPanelToWindowResult | null {
  for (const sourceWindow of workspace.windows) {
    const panelPath = findPanelPathById(sourceWindow.root, input.panelId);

    if (!panelPath) {
      continue;
    }

    const nextSourceRoot =
      replaceNodeAtPathAllowingRemoval(
        sourceWindow.root,
        panelPath.trail,
        removePanelFromStack(panelPath.stack, input.panelId)
      ) ?? createStack();
    const detachedWindow = createWorkspaceWindow(createStack([panelPath.panel]), panelPath.panel.title);
    const nextWorkspace = {
      ...workspace,
      activeWindowId: sourceWindow.id,
      fullscreenPanelId: workspace.fullscreenPanelId === input.panelId ? null : workspace.fullscreenPanelId ?? null,
      windows: [
        ...workspace.windows.map((window): WorkspaceWindow =>
          window.id === sourceWindow.id
            ? {
                ...window,
                root: canonicalizeLayout(nextSourceRoot)
              }
            : window
        ),
        detachedWindow
      ]
    };

    return {
      workspace: nextWorkspace,
      panelId: panelPath.panel.id,
      sourceWindowId: sourceWindow.id,
      sourceStackId: panelPath.stack.id,
      windowId: detachedWindow.id
    };
  }

  return null;
}

function removePanelFromStack(stack: StackNode, panelId: string): LayoutNode | null {
  const removedPanelIndex = stack.children.findIndex((panel) => panel.id === panelId);

  if (removedPanelIndex === -1) {
    return stack;
  }

  const nextChildren = stack.children.filter((panel) => panel.id !== panelId);

  if (nextChildren.length === 0) {
    return null;
  }

  const normalizedChildren = nextChildren as unknown as NonEmptyArray<PanelNode>;

  return {
    ...stack,
    children: normalizedChildren,
    activeChildId: selectActivePanelAfterDetach(stack, panelId, removedPanelIndex, normalizedChildren)
  };
}

function selectActivePanelAfterDetach(
  stack: StackNode,
  panelId: string,
  removedPanelIndex: number,
  nextChildren: NonEmptyArray<PanelNode>
): string {
  if (stack.activeChildId !== panelId) {
    return stack.activeChildId;
  }

  return stack.children[removedPanelIndex - 1]?.id ?? nextChildren[0].id;
}
