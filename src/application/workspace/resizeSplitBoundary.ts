import type { LayoutNode, SplitOrientation } from '../../domain/layout/model';
import { LAYOUT_MIN_SPLIT_SIZE, normalizeSplitSizes } from '../../domain/layout/validation';
import type { Workspace } from '../../domain/workspace/model';
import { updateActiveWindowRoot } from './layoutTree';
import { updateWorkspaceTargetWindow } from './targetWindow';

const MIN_CHAIN_SEGMENT_SIZE = LAYOUT_MIN_SPLIT_SIZE;

export type ResizeSplitBoundaryMode = 'local' | 'proportional';

interface ResizeSplitBoundaryInput {
  rootSplitId: string;
  boundaryIndex: number;
  deltaRatio: number;
  mode?: ResizeSplitBoundaryMode;
}

interface FlattenedChain {
  orientation: SplitOrientation;
  sizes: number[];
}

export function resizeSplitBoundary(workspace: Workspace, input: ResizeSplitBoundaryInput): Workspace {
  return updateWorkspaceTargetWindow(workspace, input.rootSplitId, (selected) => resizeSplitBoundaryInActiveWindow(selected, input));
}

function resizeSplitBoundaryInActiveWindow(workspace: Workspace, input: ResizeSplitBoundaryInput): Workspace {
  if (!Number.isFinite(input.deltaRatio) || Math.abs(input.deltaRatio) < Number.EPSILON) {
    return workspace;
  }

  return updateActiveWindowRoot(workspace, (root) =>
    resizeSplitBoundaryInNode(root, input.rootSplitId, input.boundaryIndex, input.deltaRatio, input.mode ?? 'local')
  );
}

function resizeSplitBoundaryInNode(
  node: LayoutNode,
  rootSplitId: string,
  boundaryIndex: number,
  deltaRatio: number,
  mode: ResizeSplitBoundaryMode
): LayoutNode {
  if (node.kind !== 'split') {
    return node;
  }

  if (node.id === rootSplitId) {
    const chain = flattenSameOrientationChain(node, node.orientation, 1);

    if (boundaryIndex < 0 || boundaryIndex >= chain.sizes.length - 1) {
      return node;
    }

    const nextSizes =
      mode === 'proportional'
        ? resizeBoundaryProportionally(chain.sizes, boundaryIndex, deltaRatio)
        : resizeBoundaryLocally(chain.sizes, boundaryIndex, deltaRatio);

    if (!nextSizes) {
      return node;
    }

    const [nextNode] = applyFlattenedChainSizes(node, node.orientation, nextSizes, 0);
    return nextNode;
  }

  return {
    ...node,
    children: [
      resizeSplitBoundaryInNode(node.children[0], rootSplitId, boundaryIndex, deltaRatio, mode),
      resizeSplitBoundaryInNode(node.children[1], rootSplitId, boundaryIndex, deltaRatio, mode)
    ]
  };
}

function flattenSameOrientationChain(
  node: LayoutNode,
  orientation: SplitOrientation,
  size: number
): FlattenedChain {
  if (node.kind !== 'split' || node.orientation !== orientation) {
    return {
      orientation,
      sizes: [size]
    };
  }

  const left = flattenSameOrientationChain(node.children[0], orientation, size * node.sizes[0]);
  const right = flattenSameOrientationChain(node.children[1], orientation, size * node.sizes[1]);

  return {
    orientation,
    sizes: [...left.sizes, ...right.sizes]
  };
}

function applyFlattenedChainSizes(
  node: LayoutNode,
  orientation: SplitOrientation,
  sizes: number[],
  offset: number
): [LayoutNode, number, number] {
  if (node.kind !== 'split' || node.orientation !== orientation) {
    return [node, offset + 1, sizes[offset] ?? 0];
  }

  const [leftChild, leftOffset, leftSize] = applyFlattenedChainSizes(node.children[0], orientation, sizes, offset);
  const [rightChild, rightOffset, rightSize] = applyFlattenedChainSizes(node.children[1], orientation, sizes, leftOffset);

  return [
    {
      ...node,
      children: [leftChild, rightChild],
      sizes: normalizeSplitSizes([leftSize, rightSize])
    },
    rightOffset,
    leftSize + rightSize
  ];
}

function resizeBoundaryLocally(
  sizes: number[],
  boundaryIndex: number,
  deltaRatio: number
): number[] | null {
  const nextSizes = [...sizes];
  const leftIndex = boundaryIndex;
  const rightIndex = boundaryIndex + 1;
  const clampedDelta = clamp(
    deltaRatio,
    -(nextSizes[leftIndex] - MIN_CHAIN_SEGMENT_SIZE),
    nextSizes[rightIndex] - MIN_CHAIN_SEGMENT_SIZE
  );

  if (!Number.isFinite(clampedDelta) || Math.abs(clampedDelta) < Number.EPSILON) {
    return null;
  }

  nextSizes[leftIndex] += clampedDelta;
  nextSizes[rightIndex] -= clampedDelta;
  return nextSizes;
}

function resizeBoundaryProportionally(
  sizes: number[],
  boundaryIndex: number,
  deltaRatio: number
): number[] | null {
  const leftSizes = sizes.slice(0, boundaryIndex + 1);
  const rightSizes = sizes.slice(boundaryIndex + 1);
  const leftTotal = sum(leftSizes);
  const minLeftTotal = leftSizes.length * MIN_CHAIN_SEGMENT_SIZE;
  const minRightTotal = rightSizes.length * MIN_CHAIN_SEGMENT_SIZE;
  const nextLeftTotal = clamp(deltaRatio + leftTotal, minLeftTotal, 1 - minRightTotal);
  const nextRightTotal = 1 - nextLeftTotal;

  if (
    !Number.isFinite(nextLeftTotal) ||
    !Number.isFinite(nextRightTotal) ||
    Math.abs(nextLeftTotal - leftTotal) < Number.EPSILON
  ) {
    return null;
  }

  return [
    ...scaleSegmentGroup(leftSizes, nextLeftTotal),
    ...scaleSegmentGroup(rightSizes, nextRightTotal)
  ];
}

function scaleSegmentGroup(sizes: number[], nextTotal: number): number[] {
  const currentTotal = sum(sizes);

  if (currentTotal <= 0) {
    return sizes.map(() => nextTotal / Math.max(sizes.length, 1));
  }

  const scaled = sizes.map((size) => size / currentTotal * nextTotal);
  const clamped = scaled.map((size) => Math.max(MIN_CHAIN_SEGMENT_SIZE, size));
  const clampedTotal = sum(clamped);

  return clamped.map((size) => size / clampedTotal * nextTotal);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
