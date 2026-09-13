import type { LayoutNode, SplitNode, StackNode } from './model';
import type { PanelNode } from '../panel/model';

export function visitLayoutNodes(node: LayoutNode, visitor: (node: LayoutNode) => void): void {
  visitor(node);

  if (node.kind === 'split') {
    for (const child of node.children) {
      visitLayoutNodes(child, visitor);
    }
  }
}

export function findLayoutNode(node: LayoutNode, targetId: string): LayoutNode | undefined {
  if (node.id === targetId) {
    return node;
  }

  if (node.kind === 'split') {
    for (const child of node.children) {
      const match = findLayoutNode(child, targetId);

      if (match) {
        return match;
      }
    }
  }

  return undefined;
}

export function findPanel(node: LayoutNode, panelId: string): PanelNode | undefined {
  if (node.kind === 'stack') {
    return node.children.find((panel) => panel.id === panelId);
  }

  for (const child of node.children) {
    const match = findPanel(child, panelId);

    if (match) {
      return match;
    }
  }

  return undefined;
}

export function findStack(node: LayoutNode, stackId: string): StackNode | undefined {
  const match = findLayoutNode(node, stackId);
  return match?.kind === 'stack' ? match : undefined;
}

export function findSplit(node: LayoutNode, splitId: string): SplitNode | undefined {
  const match = findLayoutNode(node, splitId);
  return match?.kind === 'split' ? match : undefined;
}

export function containsPanel(node: LayoutNode, panelId: string): boolean {
  return !!findPanel(node, panelId);
}

export function findStackContainingPanel(node: LayoutNode, panelId: string): StackNode | undefined {
  if (node.kind === 'stack') {
    return node.children.some((panel) => panel.id === panelId) ? node : undefined;
  }

  for (const child of node.children) {
    const match = findStackContainingPanel(child, panelId);

    if (match) {
      return match;
    }
  }

  return undefined;
}

export function listPanels(node: LayoutNode): PanelNode[] {
  const panels: PanelNode[] = [];

  visitLayoutNodes(node, (entry) => {
    if (entry.kind === 'stack') {
      panels.push(...entry.children);
    }
  });

  return panels;
}

export function listStacks(node: LayoutNode): StackNode[] {
  const stacks: StackNode[] = [];

  visitLayoutNodes(node, (entry) => {
    if (entry.kind === 'stack') {
      stacks.push(entry);
    }
  });

  return stacks;
}

export function listSplits(node: LayoutNode): SplitNode[] {
  const splits: SplitNode[] = [];

  visitLayoutNodes(node, (entry) => {
    if (entry.kind === 'split') {
      splits.push(entry);
    }
  });

  return splits;
}
