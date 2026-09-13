import type { LayoutNode, SplitNode, SplitOrientation } from '../../domain/layout/model';
import { listPanels } from '../../domain/layout/selectors';
import { createSplit } from '../../domain/workspace/factories';
import type { Workspace } from '../../domain/workspace/model';
import { normalizeSplitSizes } from '../../domain/layout/validation';
import { pruneUnusedToolInstances, updateCanonicalizedActiveWindowRoot } from './finalizeWorkspace';
import { updateWorkspaceTargetWindow } from './targetWindow';

interface CollapseSplitBoundaryInput {
  rootSplitId: string;
  boundaryIndex: number;
  removeSide: 'start' | 'end';
}

interface CanonicalSegment {
  node: LayoutNode;
  size: number;
}

export function collapseSplitBoundary(workspace: Workspace, input: CollapseSplitBoundaryInput): Workspace {
  return updateWorkspaceTargetWindow(workspace, input.rootSplitId, (selected) => collapseSplitBoundaryInActiveWindow(selected, input));
}

function collapseSplitBoundaryInActiveWindow(workspace: Workspace, input: CollapseSplitBoundaryInput): Workspace {
  let removedNode: LayoutNode | null = null;
  let didCollapse = false;

  const nextWorkspace = updateCanonicalizedActiveWindowRoot(workspace, (root) => {
    const nextRoot = collapseSplitBoundaryInNode(root, input, (node) => {
      removedNode = node;
      didCollapse = true;
    });

    return didCollapse ? nextRoot : root;
  });

  if (!didCollapse || !removedNode) {
    return workspace;
  }

  const removedToolInstanceIds = new Set(
    listPanels(removedNode)
      .map((panel) => panel.toolInstanceId)
      .filter((toolInstanceId): toolInstanceId is string => !!toolInstanceId)
  );

  if (removedToolInstanceIds.size === 0) {
    return nextWorkspace;
  }

  return pruneUnusedToolInstances(nextWorkspace, removedToolInstanceIds);
}

function collapseSplitBoundaryInNode(
  node: LayoutNode,
  input: CollapseSplitBoundaryInput,
  onCollapse: (removedNode: LayoutNode) => void
): LayoutNode {
  if (node.kind !== 'split') {
    return node;
  }

  if (node.id === input.rootSplitId) {
    const segments = collectCanonicalSegments(node, node.orientation, 1);
    const removeIndex = input.removeSide === 'start' ? input.boundaryIndex : input.boundaryIndex + 1;

    if (removeIndex < 0 || removeIndex >= segments.length) {
      return node;
    }

    const removedSegment = segments[removeIndex];

    if (!removedSegment) {
      return node;
    }

    onCollapse(removedSegment.node);

    const remainingSegments = segments.filter((_, index) => index !== removeIndex);
    return buildCanonicalSplitChain(node.orientation, remainingSegments, node.id);
  }

  return {
    ...node,
    children: [
      collapseSplitBoundaryInNode(node.children[0], input, onCollapse),
      collapseSplitBoundaryInNode(node.children[1], input, onCollapse)
    ]
  };
}

function collectCanonicalSegments(
  node: LayoutNode,
  orientation: SplitOrientation,
  size: number
): CanonicalSegment[] {
  if (node.kind !== 'split' || node.orientation !== orientation) {
    return [{ node, size }];
  }

  return [
    ...collectCanonicalSegments(node.children[0], orientation, size * node.sizes[0]),
    ...collectCanonicalSegments(node.children[1], orientation, size * node.sizes[1])
  ];
}

function buildCanonicalSplitChain(
  orientation: SplitOrientation,
  segments: CanonicalSegment[],
  rootSplitId?: string
): LayoutNode {
  if (segments.length === 1) {
    return segments[0].node;
  }

  if (segments.length === 2) {
    const nextSizes = normalizeSplitSizes([segments[0].size, segments[1].size]);

    if (rootSplitId) {
      return {
        id: rootSplitId,
        kind: 'split',
        orientation,
        children: [segments[0].node, segments[1].node],
        sizes: nextSizes
      } satisfies SplitNode;
    }

    return createSplit(orientation, [segments[0].node, segments[1].node], nextSizes);
  }

  const splitIndex = resolveBalancedSplitIndex(segments);
  const leftSegments = segments.slice(0, splitIndex);
  const rightSegments = segments.slice(splitIndex);
  const leftTotal = leftSegments.reduce((sum, segment) => sum + segment.size, 0);
  const rightTotal = rightSegments.reduce((sum, segment) => sum + segment.size, 0);
  const nextSizes = normalizeSplitSizes([leftTotal, rightTotal]);
  const leftNode = buildCanonicalSplitChain(orientation, leftSegments);
  const rightNode = buildCanonicalSplitChain(orientation, rightSegments);

  if (rootSplitId) {
    return {
      id: rootSplitId,
      kind: 'split',
      orientation,
      children: [leftNode, rightNode],
      sizes: nextSizes
    } satisfies SplitNode;
  }

  return createSplit(orientation, [leftNode, rightNode], nextSizes);
}

function resolveBalancedSplitIndex(segments: CanonicalSegment[]): number {
  if (segments.length <= 2) {
    return 1;
  }

  return Math.max(1, Math.min(segments.length - 1, Math.floor(segments.length / 2)));
}
