import type { LayoutNode, SplitNode, SplitOrientation } from '../../domain/layout/model';
import { createSplit } from '../../domain/workspace/factories';
import { normalizeSplitSizes } from '../../domain/layout/validation';

interface CanonicalSegment {
  node: LayoutNode;
  size: number;
}

export function canonicalizeLayout(node: LayoutNode): LayoutNode {
  if (node.kind === 'stack') {
    return node;
  }

  const leftChild = canonicalizeLayout(node.children[0]);
  const rightChild = canonicalizeLayout(node.children[1]);
  const segments = [
    ...collectCanonicalSegments(leftChild, node.orientation, node.sizes[0]),
    ...collectCanonicalSegments(rightChild, node.orientation, node.sizes[1])
  ];

  if (segments.length === 2 && segments[0].node === leftChild && segments[1].node === rightChild) {
    if (leftChild === node.children[0] && rightChild === node.children[1]) {
      return node;
    }

    return {
      ...node,
      children: [leftChild, rightChild],
      sizes: normalizeSplitSizes(node.sizes)
    };
  }

  const splitIds = collectCanonicalSplitIds(node, node.orientation).slice(0, Math.max(0, segments.length - 1));
  return buildCanonicalSplitChain(node.orientation, segments, splitIds);
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
  splitIds: string[]
): LayoutNode {
  if (segments.length === 1) {
    return segments[0].node;
  }

  if (segments.length === 2) {
    const nextSizes = normalizeSplitSizes([segments[0].size, segments[1].size]);
    const splitId = splitIds[0];

    if (splitId) {
      return {
        id: splitId,
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
  const currentSplitId = splitIds[0];
  const leftSplitCount = Math.max(0, leftSegments.length - 1);
  const leftSplitIds = splitIds.slice(1, 1 + leftSplitCount);
  const rightSplitIds = splitIds.slice(1 + leftSplitCount);
  const leftNode = buildCanonicalSplitChain(orientation, leftSegments, leftSplitIds);
  const rightNode = buildCanonicalSplitChain(orientation, rightSegments, rightSplitIds);

  if (currentSplitId) {
    return {
      id: currentSplitId,
      kind: 'split',
      orientation,
      children: [leftNode, rightNode],
      sizes: nextSizes
    } satisfies SplitNode;
  }

  return createSplit(orientation, [leftNode, rightNode], nextSizes);
}

function collectCanonicalSplitIds(node: LayoutNode, orientation: SplitOrientation): string[] {
  if (node.kind !== 'split' || node.orientation !== orientation) {
    return [];
  }

  return [
    node.id,
    ...collectCanonicalSplitIds(node.children[0], orientation),
    ...collectCanonicalSplitIds(node.children[1], orientation)
  ];
}

function resolveBalancedSplitIndex(segments: CanonicalSegment[]): number {
  if (segments.length <= 2) {
    return 1;
  }

  return Math.max(1, Math.min(segments.length - 1, Math.floor(segments.length / 2)));
}
