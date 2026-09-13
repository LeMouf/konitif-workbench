import type { LayoutEdge } from '../../domain/layout/interaction';
import type { LayoutNode, SplitNode, SplitOrientation, StackNode } from '../../domain/layout/model';
import type { Workspace } from '../../domain/workspace/model';
import { containsPanel } from '../../domain/layout/selectors';
import { getActiveWindow } from '../../domain/workspace/selectors';
import { createPanel, createSplit, createStack } from '../../domain/workspace/factories';
import { canonicalizeLayout } from './canonicalizeLayout';
import { replaceStackContainingPanel, updateActiveWindowRoot } from './layoutTree';
import { updateWorkspaceTargetWindow } from './targetWindow';

export type PanelSubdivisionAxis = 'columns' | 'rows';

export interface PanelSubdivisionPreview {
  axis: PanelSubdivisionAxis;
  cutCount: number;
  pointerRatio: number;
  linePositions: number[];
  preservedSegmentIndex: number;
  segmentRanges: Array<{
    index: number;
    start: number;
    end: number;
    center: number;
  }>;
}

export interface SubdividePanelInput {
  panelId: string;
  orientation: SplitOrientation;
  edge: LayoutEdge;
  cuts: number;
  pointerRatio: number;
}

export interface SubdividePanelResult {
  workspace: Workspace;
  createdPanelIds: string[];
  originalPanelId: string;
}

const MIN_SUBDIVISION_CUTS = 1;
const MAX_SUBDIVISION_CUTS = 5;
const MIN_POINTER_RATIO = 0.12;
const MAX_POINTER_RATIO = 0.88;

export function clampSubdivisionCuts(cuts: number): number {
  return Math.max(MIN_SUBDIVISION_CUTS, Math.min(MAX_SUBDIVISION_CUTS, Math.round(cuts)));
}

export function clampSubdivisionPointerRatio(pointerRatio: number): number {
  return Math.max(MIN_POINTER_RATIO, Math.min(MAX_POINTER_RATIO, Number(pointerRatio.toFixed(4))));
}

export function resolveSubdivisionAxis(orientation: SplitOrientation): PanelSubdivisionAxis {
  return orientation === 'vertical' ? 'columns' : 'rows';
}

export function resolveLayoutOrientationForSubdivision(orientation: SplitOrientation): SplitOrientation {
  return orientation === 'vertical' ? 'horizontal' : 'vertical';
}

export function getSubdivisionSegmentSizes(edge: LayoutEdge, cuts: number, pointerRatio: number): number[] {
  const safeCuts = clampSubdivisionCuts(cuts);
  const safePointerRatio = clampSubdivisionPointerRatio(pointerRatio);
  const segmentCount = safeCuts + 1;

  void edge;
  void safePointerRatio;
  const unit = Number((1 / segmentCount).toFixed(4));
  const segments = Array.from({ length: segmentCount }, () => unit);
  const normalizedTotal = Number(segments.reduce((sum, size) => sum + size, 0).toFixed(4));
  const correction = Number((1 - normalizedTotal).toFixed(4));

  if (correction !== 0) {
    segments[segments.length - 1] = Number((segments[segments.length - 1] + correction).toFixed(4));
  }

  return segments;
}

export function getSubdivisionPreview(
  orientation: SplitOrientation,
  edge: LayoutEdge,
  cuts: number,
  pointerRatio: number
): PanelSubdivisionPreview {
  const segmentSizes = getSubdivisionSegmentSizes(edge, cuts, pointerRatio);
  let cursor = 0;
  const segmentRanges = segmentSizes.map((size, index) => {
    const start = cursor * 100;
    cursor += size;
    const end = cursor * 100;

    return {
      index,
      start: Number(start.toFixed(3)),
      end: Number(end.toFixed(3)),
      center: Number((((start + end) / 2)).toFixed(3))
    };
  });

  return {
    axis: resolveSubdivisionAxis(orientation),
    cutCount: clampSubdivisionCuts(cuts),
    pointerRatio: clampSubdivisionPointerRatio(pointerRatio),
    linePositions: segmentRanges.slice(0, -1).map((segment) => segment.end),
    preservedSegmentIndex: resolveSubdivisionPreservedSegmentIndex(edge, cuts, pointerRatio),
    segmentRanges
  };
}

export function resolveDefaultSubdivisionPreservedSegmentIndex(edge: LayoutEdge, cuts: number): number {
  const segmentCount = clampSubdivisionCuts(cuts) + 1;
  return edge === 'left' || edge === 'top' ? segmentCount - 1 : 0;
}

export function resolveSubdivisionPreservedSegmentIndex(edge: LayoutEdge, cuts: number, pointerRatio: number): number {
  const safePointerRatio = clampSubdivisionPointerRatio(pointerRatio);
  const segmentCount = clampSubdivisionCuts(cuts) + 1;
  const layoutSegmentIndex = Math.min(segmentCount - 1, Math.floor(safePointerRatio * segmentCount));

  return edge === 'left' || edge === 'top' ? layoutSegmentIndex : segmentCount - 1 - layoutSegmentIndex;
}

export function resolveSubdivisionSegmentPointerRatio(edge: LayoutEdge, cuts: number, segmentIndex: number): number {
  const safeCuts = clampSubdivisionCuts(cuts);
  const segmentCount = safeCuts + 1;
  const safeIndex = Math.max(0, Math.min(segmentCount - 1, Math.round(segmentIndex)));
  const layoutSegmentIndex = edge === 'left' || edge === 'top' ? safeIndex : segmentCount - 1 - safeIndex;

  return clampSubdivisionPointerRatio((layoutSegmentIndex + 0.5) / segmentCount);
}

export function subdividePanel(workspace: Workspace, input: SubdividePanelInput): SubdividePanelResult {
  let result!: SubdividePanelResult;
  const nextWorkspace = updateWorkspaceTargetWindow(workspace, input.panelId, (selected) => {
    result = subdividePanelInActiveWindow(selected, input);
    return result.workspace;
  });
  return { ...result, workspace: nextWorkspace };
}

function subdividePanelInActiveWindow(workspace: Workspace, input: SubdividePanelInput): SubdividePanelResult {
  const activeWindow = getActiveWindow(workspace);

  if (!activeWindow || !containsPanel(activeWindow.root, input.panelId)) {
    return {
      workspace,
      createdPanelIds: [],
      originalPanelId: input.panelId
    };
  }

  const createdPanelIds: string[] = [];
  const orientation = resolveLayoutOrientationForSubdivision(input.orientation);
  const sizes = getSubdivisionSegmentSizes(input.edge, input.cuts, input.pointerRatio);
  const preservedSegmentIndex = resolveSubdivisionPreservedSegmentIndex(input.edge, input.cuts, input.pointerRatio);

  const nextRoot = replaceStackContainingPanel(activeWindow.root, input.panelId, (stack) => {
    const replacementNodes = sizes.map((_, index) => {
      const shouldPreserveOriginal = index === preservedSegmentIndex;

      if (shouldPreserveOriginal) {
        return stack;
      }

      const panel = createPanel('New panel');
      createdPanelIds.push(panel.id);
      return createStack([panel]);
    });

    return buildSubdivisionTree(orientation, replacementNodes, sizes);
  });

  return {
    workspace: updateActiveWindowRoot(workspace, () => canonicalizeLayout(nextRoot)),
    createdPanelIds,
    originalPanelId: input.panelId
  };
}

function buildSubdivisionTree(
  orientation: SplitOrientation,
  nodes: Array<StackNode | SplitNode>,
  sizes: number[]
): LayoutNode {
  if (nodes.length === 1) {
    return nodes[0];
  }

  if (nodes.length === 2) {
    return createSplit(orientation, [nodes[0], nodes[1]], [sizes[0], sizes[1]]);
  }

  const [headNode, ...tailNodes] = nodes;
  const [headSize, ...tailSizes] = sizes;
  const tailTotal = tailSizes.reduce((sum, size) => sum + size, 0);

  return createSplit(
    orientation,
    [headNode, buildSubdivisionTree(orientation, tailNodes, tailSizes)],
    [headSize, tailTotal]
  );
}
