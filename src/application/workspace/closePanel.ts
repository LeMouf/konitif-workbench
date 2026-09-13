import type { LayoutNode, NonEmptyArray, StackNode } from '../../domain/layout/model';
import type { Workspace } from '../../domain/workspace/model';
import { createStack } from '../../domain/workspace/factories';
import { getActiveWindow } from '../../domain/workspace/selectors';
import { pruneUnusedToolInstances, updateCanonicalizedActiveWindowRoot } from './finalizeWorkspace';
import { findStackPathContainingPanel, replaceNodeAtPathAllowingRemoval } from './layoutTree';

interface ClosePanelInput {
  panelId: string;
}

export function closePanel(workspace: Workspace, input: ClosePanelInput): Workspace {
  const activeWindow = getActiveWindow(workspace);

  if (!activeWindow) {
    return workspace;
  }

  const stackPath = findStackPathContainingPanel(activeWindow.root, input.panelId);

  if (!stackPath) {
    return workspace;
  }

  const nextWorkspace = updateCanonicalizedActiveWindowRoot(workspace, () =>
    replaceNodeAtPathAllowingRemoval(
      activeWindow.root,
      stackPath.trail,
      closePanelFromStack(stackPath.stack, input.panelId)
    ) ?? createStack()
  );

  return pruneUnusedToolInstances(nextWorkspace);
}

function closePanelFromStack(stack: StackNode, panelId: string): LayoutNode | null {
  const closedPanelIndex = stack.children.findIndex((panel) => panel.id === panelId);

  if (closedPanelIndex === -1) {
    return stack;
  }

  const nextChildren = stack.children.filter((panel) => panel.id !== panelId);

  if (nextChildren.length === 0) {
    return null;
  }

  const normalizedChildren = nextChildren as unknown as NonEmptyArray<StackNode['children'][number]>;
  const nextActiveChildId = selectActiveChildIdAfterClose(stack, panelId, closedPanelIndex, normalizedChildren);

  return {
    ...stack,
    children: normalizedChildren,
    activeChildId: nextActiveChildId
  };
}

function selectActiveChildIdAfterClose(
  stack: StackNode,
  panelId: string,
  closedPanelIndex: number,
  nextChildren: NonEmptyArray<StackNode['children'][number]>
): string {
  if (stack.activeChildId !== panelId) {
    return stack.activeChildId;
  }

  const previousPanel = stack.children[closedPanelIndex - 1];

  if (previousPanel) {
    return previousPanel.id;
  }

  return nextChildren[0].id;
}
