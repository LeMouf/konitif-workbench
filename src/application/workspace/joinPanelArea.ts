import type { LayoutEdge } from '../../domain/layout/interaction';
import type { LayoutNode, SplitOrientation, SplitNode } from '../../domain/layout/model';
import type { Workspace } from '../../domain/workspace/model';
import { getActiveWindow } from '../../domain/workspace/selectors';
import { containsPanel, listPanels } from '../../domain/layout/selectors';
import { normalizeSplitSizes } from '../../domain/layout/validation';
import { pruneUnusedToolInstances, updateCanonicalizedActiveWindowRoot } from './finalizeWorkspace';
import { selectWorkspaceTargetWindow, updateWorkspaceTargetWindow } from './targetWindow';

export type JoinPanelAreaSide = 'left' | 'right' | 'top' | 'bottom';

interface JoinPanelAreaInput {
  panelId: string;
  edge: LayoutEdge;
  side: JoinPanelAreaSide;
  sourceAreaPanelIds?: readonly string[];
  siblingAreaPanelIds?: readonly string[];
}

interface JoinCandidate {
  splitId: string;
}

interface ExplicitJoinCandidate {
  sourceNodeId: string;
  siblingNodeId: string;
}

interface LayoutBranchAncestor {
  splitId: string;
  orientation: SplitOrientation;
  childIndex: 0 | 1;
}

export function canJoinPanelArea(workspace: Workspace, input: Omit<JoinPanelAreaInput, 'side'>): boolean {
  const activeWindow = getActiveWindow(selectWorkspaceTargetWindow(workspace, input.panelId));

  if (!activeWindow || !containsPanel(activeWindow.root, input.panelId)) {
    return false;
  }

  return findExplicitJoinCandidate(activeWindow.root, input) !== null || findJoinCandidate(activeWindow.root, input.panelId, input.edge) !== null;
}

export function joinPanelArea(workspace: Workspace, input: JoinPanelAreaInput): Workspace {
  return updateWorkspaceTargetWindow(workspace, input.panelId, (selected) => joinPanelAreaInActiveWindow(selected, input));
}

function joinPanelAreaInActiveWindow(workspace: Workspace, input: JoinPanelAreaInput): Workspace {
  const activeWindow = getActiveWindow(workspace);

  if (!activeWindow || !containsPanel(activeWindow.root, input.panelId)) {
    return workspace;
  }

  const explicitCandidate = findExplicitJoinCandidate(activeWindow.root, input);

  if (explicitCandidate) {
    return pruneUnusedToolInstances(
      updateCanonicalizedActiveWindowRoot(workspace, (root) =>
        joinNodesById(root, explicitCandidate.sourceNodeId, explicitCandidate.siblingNodeId, input.edge)
      )
    );
  }

  const candidate = findJoinCandidate(activeWindow.root, input.panelId, input.edge);

  if (!candidate) {
    return workspace;
  }

  return pruneUnusedToolInstances(
    updateCanonicalizedActiveWindowRoot(workspace, (root) => {
      const split = findSplitById(root, candidate.splitId);
      return split ? replaceNodeById(root, candidate.splitId, keepJoinedSide(split, input.side)) : root;
    })
  );
}

function keepJoinedSide(split: SplitNode, side: JoinPanelAreaSide): SplitNode['children'][0] {
  if (split.orientation === 'horizontal') {
    return side === 'left' ? split.children[0] : split.children[1];
  }

  return side === 'top' ? split.children[0] : split.children[1];
}

function findSplitById(node: LayoutNode, splitId: string): SplitNode | null {
  if (node.kind === 'split') {
    if (node.id === splitId) {
      return node;
    }

    return findSplitById(node.children[0], splitId) ?? findSplitById(node.children[1], splitId);
  }

  return null;
}

function findJoinCandidate(root: LayoutNode, panelId: string, edge: LayoutEdge): JoinCandidate | null {
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

function findExplicitJoinCandidate(
  root: LayoutNode,
  input: Omit<JoinPanelAreaInput, 'side'>
): ExplicitJoinCandidate | null {
  if (!input.sourceAreaPanelIds || !input.siblingAreaPanelIds) {
    return null;
  }

  const sourceNode = findNodeByExactPanelSet(root, normalizePanelIdSet(input.sourceAreaPanelIds));
  const siblingNode = findNodeByExactPanelSet(root, normalizePanelIdSet(input.siblingAreaPanelIds));

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

    if (!containsPanel(child, panelId)) {
      continue;
    }

    return findLayoutBranchAncestors(child, panelId, [
      ...trail,
      {
        splitId: node.id,
        orientation: node.orientation,
        childIndex
      }
    ]);
  }

  return null;
}

function findNodeByExactPanelSet(node: LayoutNode, expectedPanelIds: string[]): LayoutNode | null {
  if (matchesPanelIdSet(normalizePanelIdSet(listPanels(node).map((panel) => panel.id)), expectedPanelIds)) {
    return node;
  }

  if (node.kind === 'stack') {
    return null;
  }

  return findNodeByExactPanelSet(node.children[0], expectedPanelIds) ?? findNodeByExactPanelSet(node.children[1], expectedPanelIds);
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

function joinNodesById(root: LayoutNode, sourceNodeId: string, siblingNodeId: string, edge: LayoutEdge): LayoutNode {
  const axis = edge === 'left' || edge === 'right' ? 'horizontal' : 'vertical';
  const sourcePath = findNodePathById(root, sourceNodeId);
  const siblingPath = findNodePathById(root, siblingNodeId);

  if (!sourcePath || !siblingPath) {
    return root;
  }

  const commonSplitIndex = findCommonSplitIndex(sourcePath, siblingPath);

  if (commonSplitIndex === -1) {
    return root;
  }

  const sourceLcaEntry = sourcePath[commonSplitIndex];
  const siblingLcaEntry = siblingPath[commonSplitIndex];

  if (sourceLcaEntry.childIndex === siblingLcaEntry.childIndex) {
    return root;
  }

  const sourceSpanWithinLca = resolveAxisSpanFromPath(sourcePath.slice(commonSplitIndex), axis);
  const lcaSourceSize = sourceLcaEntry.split.sizes[sourceLcaEntry.childIndex];
  const lcaSiblingSize = sourceLcaEntry.split.sizes[siblingLcaEntry.childIndex];
  const sourceBranch = sourceLcaEntry.split.children[sourceLcaEntry.childIndex];
  const siblingBranch = sourceLcaEntry.split.children[siblingLcaEntry.childIndex];
  const remainingSourceBranch = removeNodeById(sourceBranch, sourceNodeId);
  const siblingDeltaRelative = lcaSiblingSize > 0 ? sourceSpanWithinLca / lcaSiblingSize : 0;
  const expandedSiblingBranch = expandNodeAlongAxis(siblingBranch, siblingNodeId, axis, siblingDeltaRelative);

  if (!remainingSourceBranch) {
    return replaceNodeById(root, sourceLcaEntry.split.id, expandedSiblingBranch);
  }

  const nextSizes = [...sourceLcaEntry.split.sizes] as [number, number];
  nextSizes[sourceLcaEntry.childIndex] = Math.max(lcaSourceSize - sourceSpanWithinLca, 0);
  nextSizes[siblingLcaEntry.childIndex] = lcaSiblingSize + sourceSpanWithinLca;

  const nextChildren = [...sourceLcaEntry.split.children] as [LayoutNode, LayoutNode];
  nextChildren[sourceLcaEntry.childIndex] = remainingSourceBranch;
  nextChildren[siblingLcaEntry.childIndex] = expandedSiblingBranch;

  return replaceNodeById(root, sourceLcaEntry.split.id, {
    ...sourceLcaEntry.split,
    children: nextChildren,
    sizes: normalizeSplitSizes(nextSizes)
  });
}

function removeNodeById(node: LayoutNode, nodeId: string): LayoutNode | null {
  if (node.id === nodeId) {
    return null;
  }

  if (node.kind === 'stack') {
    return node;
  }

  const firstChild = removeNodeById(node.children[0], nodeId);
  const secondChild = removeNodeById(node.children[1], nodeId);

  if (!firstChild && !secondChild) {
    return null;
  }

  if (!firstChild) {
    return secondChild;
  }

  if (!secondChild) {
    return firstChild;
  }

  return {
    ...node,
    children: [firstChild, secondChild]
  };
}

function replaceNodeById(node: LayoutNode, nodeId: string, replacement: LayoutNode): LayoutNode {
  if (node.id === nodeId) {
    return replacement;
  }

  if (node.kind === 'stack') {
    return node;
  }

  return {
    ...node,
    children: [
      replaceNodeById(node.children[0], nodeId, replacement),
      replaceNodeById(node.children[1], nodeId, replacement)
    ]
  };
}

interface NodePathEntry {
  split: SplitNode;
  childIndex: 0 | 1;
}

function findNodePathById(
  node: LayoutNode,
  targetNodeId: string,
  trail: NodePathEntry[] = []
): NodePathEntry[] | null {
  if (node.id === targetNodeId) {
    return trail;
  }

  if (node.kind === 'stack') {
    return null;
  }

  for (let childIndex = 0 as 0 | 1; childIndex < node.children.length; childIndex = (childIndex + 1) as 0 | 1) {
    const child = node.children[childIndex];
    const path = findNodePathById(child, targetNodeId, [...trail, { split: node, childIndex }]);

    if (path) {
      return path;
    }
  }

  return null;
}

function findCommonSplitIndex(sourcePath: NodePathEntry[], siblingPath: NodePathEntry[]): number {
  const maxLength = Math.min(sourcePath.length, siblingPath.length);
  let commonIndex = -1;

  for (let index = 0; index < maxLength; index += 1) {
    if (sourcePath[index].split.id !== siblingPath[index].split.id) {
      break;
    }

    commonIndex = index;
  }

  return commonIndex;
}

function resolveAxisSpanFromPath(path: NodePathEntry[], axis: SplitOrientation): number {
  return path.reduce((span, entry) => {
    if (entry.split.orientation !== axis) {
      return span;
    }

    return span * entry.split.sizes[entry.childIndex];
  }, 1);
}

function expandNodeAlongAxis(
  node: LayoutNode,
  targetNodeId: string,
  axis: SplitOrientation,
  deltaRelativeToNode: number
): LayoutNode {
  if (deltaRelativeToNode <= 0 || node.id === targetNodeId || node.kind === 'stack') {
    return node;
  }

  const targetChildIndex = findChildIndexContainingNode(node, targetNodeId);

  if (targetChildIndex === null) {
    return node;
  }

  const nextChildren = [...node.children] as [LayoutNode, LayoutNode];

  if (node.orientation !== axis) {
    nextChildren[targetChildIndex] = expandNodeAlongAxis(
      node.children[targetChildIndex],
      targetNodeId,
      axis,
      deltaRelativeToNode
    );

    return {
      ...node,
      children: nextChildren
    };
  }

  const siblingChildIndex = targetChildIndex === 0 ? 1 : 0;
  const targetSize = node.sizes[targetChildIndex];
  const siblingSize = node.sizes[siblingChildIndex];
  const totalFactor = 1 + deltaRelativeToNode;
  const nextSizes = [...node.sizes] as [number, number];

  nextSizes[targetChildIndex] = (targetSize + deltaRelativeToNode) / totalFactor;
  nextSizes[siblingChildIndex] = siblingSize / totalFactor;
  nextChildren[targetChildIndex] = expandNodeAlongAxis(
    node.children[targetChildIndex],
    targetNodeId,
    axis,
    targetSize > 0 ? deltaRelativeToNode / targetSize : 0
  );

  return {
    ...node,
    children: nextChildren,
    sizes: normalizeSplitSizes(nextSizes)
  };
}

function findChildIndexContainingNode(node: SplitNode, targetNodeId: string): 0 | 1 | null {
  if (containsNodeId(node.children[0], targetNodeId)) {
    return 0;
  }

  if (containsNodeId(node.children[1], targetNodeId)) {
    return 1;
  }

  return null;
}

function containsNodeId(node: LayoutNode, targetNodeId: string): boolean {
  if (node.id === targetNodeId) {
    return true;
  }

  if (node.kind === 'stack') {
    return false;
  }

  return containsNodeId(node.children[0], targetNodeId) || containsNodeId(node.children[1], targetNodeId);
}
