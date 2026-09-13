import type { LayoutNode, SplitNode, StackNode } from '../../domain/layout/model';
import type { PanelNode } from '../../domain/panel/model';
import type { Workspace } from '../../domain/workspace/model';
import { containsPanel as layoutContainsPanel } from '../../domain/layout/selectors';
import { getActiveWindow } from '../../domain/workspace/selectors';

export interface LayoutNodePathEntry {
  split: SplitNode;
  childIndex: 0 | 1;
}

export interface StackPanelPath {
  stack: StackNode;
  trail: LayoutNodePathEntry[];
}

export interface LayoutNodePath {
  node: LayoutNode;
  trail: LayoutNodePathEntry[];
}

export interface PanelPath {
  panel: PanelNode;
  stack: StackNode;
  panelIndex: number;
  trail: LayoutNodePathEntry[];
}

export function updateActiveWindowRoot(
  workspace: Workspace,
  updater: (root: LayoutNode) => LayoutNode
): Workspace {
  const activeWindow = getActiveWindow(workspace);

  if (!activeWindow) {
    return workspace;
  }

  return {
    ...workspace,
    windows: workspace.windows.map((window) =>
      window.id === activeWindow.id ? { ...window, root: updater(window.root) } : window
    )
  };
}

export function containsPanel(node: LayoutNode, panelId: string): boolean {
  return layoutContainsPanel(node, panelId);
}

export function updateStackById(
  node: LayoutNode,
  stackId: string,
  updater: (stack: StackNode) => StackNode
): LayoutNode {
  const stackPath = findStackPathById(node, stackId);

  if (!stackPath || stackPath.node.kind !== 'stack') {
    return node;
  }

  return replaceNodeAtPath(node, stackPath.trail, updater(stackPath.node));
}

export function updateSplitById(
  node: LayoutNode,
  splitId: string,
  updater: (split: SplitNode) => SplitNode
): LayoutNode {
  const splitPath = findSplitPathById(node, splitId);

  if (!splitPath || splitPath.node.kind !== 'split') {
    return node;
  }

  return replaceNodeAtPath(node, splitPath.trail, updater(splitPath.node));
}

export function updatePanelById(
  node: LayoutNode,
  panelId: string,
  updater: (panel: PanelNode) => PanelNode
): LayoutNode {
  const panelPath = findPanelPathById(node, panelId);

  if (!panelPath) {
    return node;
  }

  const nextChildren = [...panelPath.stack.children] as [PanelNode, ...PanelNode[]];
  nextChildren[panelPath.panelIndex] = updater(panelPath.panel);

  return replaceNodeAtPath(node, panelPath.trail, {
    ...panelPath.stack,
    children: nextChildren
  });
}

export function replaceStackContainingPanel(
  node: LayoutNode,
  panelId: string,
  updater: (stack: StackNode) => LayoutNode
): LayoutNode {
  const stackPath = findStackPathContainingPanel(node, panelId);

  if (!stackPath) {
    return node;
  }

  return replaceNodeAtPath(node, stackPath.trail, updater(stackPath.stack));
}

export function findStackPathContainingPanel(
  node: LayoutNode,
  panelId: string,
  trail: LayoutNodePathEntry[] = []
): StackPanelPath | null {
  if (node.kind === 'stack') {
    return node.children.some((panel) => panel.id === panelId)
      ? {
          stack: node,
          trail
        }
      : null;
  }

  for (let childIndex = 0 as 0 | 1; childIndex < node.children.length; childIndex = (childIndex + 1) as 0 | 1) {
    const child = node.children[childIndex];
    const path = findStackPathContainingPanel(child, panelId, [...trail, { split: node, childIndex }]);

    if (path) {
      return path;
    }
  }

  return null;
}

export function findLayoutNodePathById(
  node: LayoutNode,
  nodeId: string,
  trail: LayoutNodePathEntry[] = []
): LayoutNodePath | null {
  if (node.id === nodeId) {
    return {
      node,
      trail
    };
  }

  if (node.kind === 'stack') {
    return null;
  }

  for (let childIndex = 0 as 0 | 1; childIndex < node.children.length; childIndex = (childIndex + 1) as 0 | 1) {
    const child = node.children[childIndex];
    const path = findLayoutNodePathById(child, nodeId, [...trail, { split: node, childIndex }]);

    if (path) {
      return path;
    }
  }

  return null;
}

export function findStackPathById(node: LayoutNode, stackId: string): LayoutNodePath | null {
  const path = findLayoutNodePathById(node, stackId);
  return path?.node.kind === 'stack' ? path : null;
}

export function findSplitPathById(node: LayoutNode, splitId: string): LayoutNodePath | null {
  const path = findLayoutNodePathById(node, splitId);
  return path?.node.kind === 'split' ? path : null;
}

export function findPanelPathById(
  node: LayoutNode,
  panelId: string,
  trail: LayoutNodePathEntry[] = []
): PanelPath | null {
  if (node.kind === 'stack') {
    const panelIndex = node.children.findIndex((panel) => panel.id === panelId);

    return panelIndex === -1
      ? null
      : {
          panel: node.children[panelIndex],
          stack: node,
          panelIndex,
          trail
        };
  }

  for (let childIndex = 0 as 0 | 1; childIndex < node.children.length; childIndex = (childIndex + 1) as 0 | 1) {
    const child = node.children[childIndex];
    const path = findPanelPathById(child, panelId, [...trail, { split: node, childIndex }]);

    if (path) {
      return path;
    }
  }

  return null;
}

export function replaceNodeAtPath(
  root: LayoutNode,
  trail: LayoutNodePathEntry[],
  replacement: LayoutNode
): LayoutNode {
  return replaceNodeAtPathAllowingRemoval(root, trail, replacement) ?? root;
}

export function replaceNodeAtPathAllowingRemoval(
  root: LayoutNode,
  trail: LayoutNodePathEntry[],
  replacement: LayoutNode | null
): LayoutNode | null {
  let nextNode = replacement;

  for (let index = trail.length - 1; index >= 0; index -= 1) {
    const { split, childIndex } = trail[index];
    const siblingIndex = childIndex === 0 ? 1 : 0;
    const sibling = split.children[siblingIndex];

    if (!nextNode) {
      nextNode = sibling;
      continue;
    }

    const nextChildren =
      childIndex === 0 ? ([nextNode, sibling] as SplitNode['children']) : ([sibling, nextNode] as SplitNode['children']);

    nextNode = {
      ...split,
      children: nextChildren
    };
  }

  return nextNode;
}
