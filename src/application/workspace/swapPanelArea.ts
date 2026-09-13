import type { LayoutEdge } from '../../domain/layout/interaction';
import type { LayoutNode, SplitOrientation, SplitNode } from '../../domain/layout/model';
import type { Workspace } from '../../domain/workspace/model';
import { containsPanel, listPanels } from '../../domain/layout/selectors';
import { getActiveWindow } from '../../domain/workspace/selectors';
import { canonicalizeLayout } from './canonicalizeLayout';
import { updateActiveWindowRoot, updateSplitById } from './layoutTree';
import { selectWorkspaceTargetWindow, updateWorkspaceTargetWindow } from './targetWindow';

interface SwapPanelAreaInput {
  panelId: string;
  edge: LayoutEdge;
  sourceAreaPanelIds?: readonly string[];
  siblingAreaPanelIds?: readonly string[];
}

interface SwapCandidate {
  splitId: string;
}

interface ExplicitSwapCandidate {
  sourceNodeId: string;
  siblingNodeId: string;
}

interface LayoutBranchAncestor {
  splitId: string;
  orientation: SplitOrientation;
  childIndex: 0 | 1;
}

export function canSwapPanelArea(workspace: Workspace, input: SwapPanelAreaInput): boolean {
  const activeWindow = getActiveWindow(selectWorkspaceTargetWindow(workspace, input.panelId));

  if (!activeWindow || !containsPanel(activeWindow.root, input.panelId)) {
    return false;
  }

  return findExplicitSwapCandidate(activeWindow.root, input) !== null || findSwapCandidate(activeWindow.root, input) !== null;
}

export function swapPanelArea(workspace: Workspace, input: SwapPanelAreaInput): Workspace {
  return updateWorkspaceTargetWindow(workspace, input.panelId, (selected) => swapPanelAreaInActiveWindow(selected, input));
}

function swapPanelAreaInActiveWindow(workspace: Workspace, input: SwapPanelAreaInput): Workspace {
  const activeWindow = getActiveWindow(workspace);

  if (!activeWindow || !containsPanel(activeWindow.root, input.panelId)) {
    return workspace;
  }

  const explicitCandidate = findExplicitSwapCandidate(activeWindow.root, input);

  if (explicitCandidate) {
    return updateActiveWindowRoot(workspace, (root) =>
      canonicalizeLayout(swapNodesById(root, explicitCandidate.sourceNodeId, explicitCandidate.siblingNodeId))
    );
  }

  const candidate = findSwapCandidate(activeWindow.root, input);

  if (!candidate) {
    return workspace;
  }

  return updateActiveWindowRoot(workspace, (root) =>
    canonicalizeLayout(updateSplitById(root, candidate.splitId, (split) => swapSplitChildren(split)))
  );
}

function swapSplitChildren(split: SplitNode): SplitNode {
  return {
    ...split,
    children: [split.children[1], split.children[0]],
    sizes: [split.sizes[1], split.sizes[0]]
  };
}

function findSwapCandidate(root: LayoutNode, input: SwapPanelAreaInput): SwapCandidate | null {
  const { panelId, edge } = input;
  const ancestors = findLayoutBranchAncestors(root, panelId);
  const targetOrientation = edge === 'left' || edge === 'right' ? 'horizontal' : 'vertical';
  const expectedChildIndex = edge === 'left' || edge === 'top' ? 1 : 0;

  if (!ancestors) {
    return null;
  }

  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const ancestor = ancestors[index];

    if (ancestor.orientation === targetOrientation && ancestor.childIndex === expectedChildIndex) {
      return {
        splitId: ancestor.splitId
      };
    }
  }

  return null;
}

function findExplicitSwapCandidate(
  root: LayoutNode,
  input: SwapPanelAreaInput
): ExplicitSwapCandidate | null {
  if (!input.sourceAreaPanelIds || !input.siblingAreaPanelIds) {
    return null;
  }

  const expectedSourceIds = normalizePanelIdSet(input.sourceAreaPanelIds);
  const expectedSiblingIds = normalizePanelIdSet(input.siblingAreaPanelIds);

  if (expectedSourceIds.length === 0 || expectedSiblingIds.length === 0) {
    return null;
  }

  const sourceNode = findNodeByExactPanelSet(root, expectedSourceIds);
  const siblingNode = findNodeByExactPanelSet(root, expectedSiblingIds);

  if (
    !sourceNode ||
    !siblingNode ||
    sourceNode.id === siblingNode.id ||
    containsNodeId(sourceNode, siblingNode.id) ||
    containsNodeId(siblingNode, sourceNode.id)
  ) {
    return null;
  }

  return {
    sourceNodeId: sourceNode.id,
    siblingNodeId: siblingNode.id
  };
}

function findNodeByExactPanelSet(
  node: LayoutNode,
  expectedPanelIds: string[]
): LayoutNode | null {
  if (matchesPanelIdSet(normalizePanelIdSet(listPanelIds(node)), expectedPanelIds)) {
    return node;
  }

  if (node.kind === 'stack') {
    return null;
  }

  return findNodeByExactPanelSet(node.children[0], expectedPanelIds) ?? findNodeByExactPanelSet(node.children[1], expectedPanelIds);
}

function listPanelIds(node: LayoutNode): string[] {
  return listPanels(node).map((panel) => panel.id);
}

function normalizePanelIdSet(panelIds: readonly string[]): string[] {
  return Array.from(new Set(panelIds)).sort();
}

function matchesPanelIdSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((panelId, index) => panelId === right[index]);
}

function swapNodesById(root: LayoutNode, sourceNodeId: string, siblingNodeId: string): LayoutNode {
  const sourceNode = findNodeById(root, sourceNodeId);
  const siblingNode = findNodeById(root, siblingNodeId);

  if (!sourceNode || !siblingNode) {
    return root;
  }

  return replaceNodes(root, sourceNodeId, siblingNodeId, sourceNode, siblingNode);
}

function findNodeById(node: LayoutNode, nodeId: string): LayoutNode | null {
  if (node.id === nodeId) {
    return node;
  }

  if (node.kind === 'stack') {
    return null;
  }

  return findNodeById(node.children[0], nodeId) ?? findNodeById(node.children[1], nodeId);
}

function containsNodeId(node: LayoutNode, nodeId: string): boolean {
  if (node.id === nodeId) {
    return true;
  }

  if (node.kind === 'stack') {
    return false;
  }

  return containsNodeId(node.children[0], nodeId) || containsNodeId(node.children[1], nodeId);
}

function replaceNodes(
  node: LayoutNode,
  sourceNodeId: string,
  siblingNodeId: string,
  sourceNode: LayoutNode,
  siblingNode: LayoutNode
): LayoutNode {
  if (node.id === sourceNodeId) {
    return siblingNode;
  }

  if (node.id === siblingNodeId) {
    return sourceNode;
  }

  if (node.kind === 'stack') {
    return node;
  }

  return {
    ...node,
    children: [
      replaceNodes(node.children[0], sourceNodeId, siblingNodeId, sourceNode, siblingNode),
      replaceNodes(node.children[1], sourceNodeId, siblingNodeId, sourceNode, siblingNode)
    ]
  };
}

function findLayoutBranchAncestors(
  node: LayoutNode,
  panelId: string,
  trail: LayoutBranchAncestor[] = []
): LayoutBranchAncestor[] | null {
  if (node.kind === 'stack') {
    return node.children.some((panel) => panel.id === panelId) ? trail : null;
  }

  for (let childIndex = 0 as 0 | 1; childIndex < node.children.length; childIndex = (childIndex + 1) as 0 | 1) {
    const child = node.children[childIndex];
    const match = findLayoutBranchAncestors(child, panelId, [
      ...trail,
      {
        splitId: node.id,
        orientation: node.orientation,
        childIndex
      }
    ]);

    if (match) {
      return match;
    }
  }

  return null;
}
