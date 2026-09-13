import type { LayoutDockPlacement, LayoutDockSide, LayoutDockTarget } from '../../domain/layout/interaction';
import type { LayoutNode, SplitNode, StackNode, SplitOrientation } from '../../domain/layout/model';
import type { PanelNode } from '../../domain/panel/model';
import type { Workspace } from '../../domain/workspace/model';
import { getActiveWindow } from '../../domain/workspace/selectors';
import { findStack } from '../../domain/layout/selectors';
import { createSplit, createStack } from '../../domain/workspace/factories';
import { canonicalizeLayout } from './canonicalizeLayout';
import { updateActiveWindowRoot } from './layoutTree';
import { LAYOUT_MIN_SPLIT_SIZE } from '../../domain/layout/validation';
import { updateWorkspaceTargetWindow } from './targetWindow';

const WORKSPACE_EDGE_DOCK_RATIO = 0.25;

export interface DockPanelInput {
  panelId: string;
  target: LayoutDockTarget;
}

interface ExtractedPanelResult {
  nextNode: LayoutNode | null;
  panel: PanelNode | null;
}

export function dockPanel(workspace: Workspace, input: DockPanelInput): Workspace {
  return updateWorkspaceTargetWindow(workspace, input.panelId, (selected) => dockPanelInActiveWindow(selected, input));
}

function dockPanelInActiveWindow(workspace: Workspace, input: DockPanelInput): Workspace {
  const activeWindow = getActiveWindow(workspace);

  if (!activeWindow) {
    return workspace;
  }

  const sourceStack = findStackContainingPanel(activeWindow.root, input.panelId);

  if (!sourceStack) {
    return workspace;
  }

  if (input.target.kind === 'workspace-edge') {
    const extracted = extractPanelFromNode(activeWindow.root, input.panelId);

    if (!extracted.panel || !extracted.nextNode) {
      return workspace;
    }

    const nextRoot = wrapRootWithDockedPanel(extracted.nextNode, extracted.panel, input.target.side);

    return updateActiveWindowRoot(workspace, () => canonicalizeLayout(nextRoot));
  }

  const targetStack = findStack(activeWindow.root, input.target.stackId);

  if (!targetStack) {
    return workspace;
  }

  if (input.target.placement === 'center' && sourceStack.id === targetStack.id) {
    return reorderPanelWithinStack(workspace, sourceStack, input.panelId, input.target.tabIndex ?? null);
  }

  if (input.target.placement !== 'center' && sourceStack.id === targetStack.id && sourceStack.children.length <= 1) {
    return workspace;
  }

  if (input.target.placement !== 'center' && sourceStack.children.length === 1) {
    const reorderedWorkspace = reorderWholeStackWithinAlignedBand(
      workspace,
      activeWindow.root,
      sourceStack.id,
      targetStack.id,
      input.target.placement
    );

    if (reorderedWorkspace) {
      return reorderedWorkspace;
    }
  }

  const preferredSplitSizes = resolveDockPreferredSplitSizes(
    activeWindow.root,
    sourceStack.id,
    targetStack.id,
    input.target.placement
  );
  const extracted = extractPanelFromNode(activeWindow.root, input.panelId);

  if (!extracted.panel || !extracted.nextNode) {
    return workspace;
  }

  const nextRoot = insertPanelIntoDockTarget(extracted.nextNode, extracted.panel, input.target, preferredSplitSizes);

  if (!nextRoot) {
    return workspace;
  }

  return updateActiveWindowRoot(workspace, () => canonicalizeLayout(nextRoot));
}

function insertPanelIntoDockTarget(
  node: LayoutNode,
  panel: PanelNode,
  target: Extract<LayoutDockTarget, { kind: 'stack' }>,
  preferredSplitSizes: [number, number] | null
): LayoutNode | null {
  if (node.kind === 'stack') {
    if (node.id !== target.stackId) {
      return node;
    }

    if (target.placement === 'center') {
      const insertionIndex = clampTabInsertionIndex(target.tabIndex ?? node.children.length, node.children.length);
      const nextChildren = [...node.children];
      nextChildren.splice(insertionIndex, 0, panel);

      return {
        ...node,
        activeChildId: panel.id,
        children: nextChildren as unknown as StackNode['children']
      };
    }

    const movedStack = createStack([panel]);
    const orientation = target.placement === 'left' || target.placement === 'right' ? 'horizontal' : 'vertical';
    const nextChildren: [LayoutNode, LayoutNode] =
      target.placement === 'left' || target.placement === 'top'
        ? [movedStack, node]
        : [node, movedStack];

    return createSplit(orientation, nextChildren, preferredSplitSizes ?? [1, 1]);
  }

  const nextChildren = node.children.map((child) => insertPanelIntoDockTarget(child, panel, target, preferredSplitSizes)) as [
    LayoutNode | null,
    LayoutNode | null
  ];

  if (nextChildren[0] === null && nextChildren[1] === null) {
    return null;
  }

  if (nextChildren[0] === null) {
    return nextChildren[1];
  }

  if (nextChildren[1] === null) {
    return nextChildren[0];
  }

  return {
    ...node,
    children: nextChildren as SplitNode['children']
  };
}

function extractPanelFromNode(node: LayoutNode, panelId: string): ExtractedPanelResult {
  if (node.kind === 'stack') {
    const panel = node.children.find((entry) => entry.id === panelId) ?? null;

    if (!panel) {
      return { nextNode: node, panel: null };
    }

    if (node.children.length === 1) {
      return {
        nextNode: null,
        panel
      };
    }

    const nextChildren = node.children.filter((entry) => entry.id !== panelId) as unknown as StackNode['children'];
    const activeChildId =
      node.activeChildId === panelId
        ? nextChildren[Math.max(0, node.children.findIndex((entry) => entry.id === panelId) - 1)]?.id ?? nextChildren[0].id
        : node.activeChildId;

    return {
      nextNode: {
        ...node,
        activeChildId,
        children: nextChildren
      },
      panel
    };
  }

  const leftResult = extractPanelFromNode(node.children[0], panelId);

  if (leftResult.panel) {
    if (!leftResult.nextNode) {
      return {
        nextNode: node.children[1],
        panel: leftResult.panel
      };
    }

    return {
      nextNode: {
        ...node,
        children: [leftResult.nextNode, node.children[1]]
      },
      panel: leftResult.panel
    };
  }

  const rightResult = extractPanelFromNode(node.children[1], panelId);

  if (rightResult.panel) {
    if (!rightResult.nextNode) {
      return {
        nextNode: node.children[0],
        panel: rightResult.panel
      };
    }

    return {
      nextNode: {
        ...node,
        children: [node.children[0], rightResult.nextNode]
      },
      panel: rightResult.panel
    };
  }

  return { nextNode: node, panel: null };
}

function findStackContainingPanel(node: LayoutNode, panelId: string): StackNode | undefined {
  if (node.kind === 'stack') {
    return node.children.some((panel) => panel.id === panelId) ? node : undefined;
  }

  return findStackContainingPanel(node.children[0], panelId) ?? findStackContainingPanel(node.children[1], panelId);
}

export function createStackDockTarget(
  stackId: string,
  placement: LayoutDockPlacement,
  tabIndex: number | null = null
): LayoutDockTarget {
  return {
    kind: 'stack',
    stackId,
    placement,
    tabIndex
  };
}

export function createWorkspaceEdgeDockTarget(side: LayoutDockSide): LayoutDockTarget {
  return {
    kind: 'workspace-edge',
    side
  };
}

export function isEdgeDockPlacement(placement: LayoutDockPlacement): placement is LayoutDockSide {
  return placement !== 'center';
}

function wrapRootWithDockedPanel(root: LayoutNode, panel: PanelNode, side: LayoutDockSide): LayoutNode {
  const dockedStack = createStack([panel]);
  const orientation: SplitOrientation = side === 'left' || side === 'right' ? 'horizontal' : 'vertical';
  const leadingSizes: [number, number] = [WORKSPACE_EDGE_DOCK_RATIO, 1 - WORKSPACE_EDGE_DOCK_RATIO];
  const trailingSizes: [number, number] = [1 - WORKSPACE_EDGE_DOCK_RATIO, WORKSPACE_EDGE_DOCK_RATIO];

  if (side === 'left' || side === 'top') {
    return createSplit(orientation, [dockedStack, root], leadingSizes);
  }

  return createSplit(orientation, [root, dockedStack], trailingSizes);
}

function reorderPanelWithinStack(
  workspace: Workspace,
  stack: StackNode,
  panelId: string,
  targetTabIndex: number | null
): Workspace {
  const currentIndex = stack.children.findIndex((panel) => panel.id === panelId);

  if (currentIndex === -1) {
    return workspace;
  }

  const rawTargetIndex = clampTabInsertionIndex(targetTabIndex ?? currentIndex, stack.children.length);
  const nextIndex = rawTargetIndex > currentIndex ? rawTargetIndex - 1 : rawTargetIndex;

  if (nextIndex === currentIndex) {
    return workspace;
  }

  const nextChildren = [...stack.children];
  const [movedPanel] = nextChildren.splice(currentIndex, 1);
  nextChildren.splice(nextIndex, 0, movedPanel);

  return updateActiveWindowRoot(workspace, (root) =>
      replaceStackById(root, stack.id, {
        ...stack,
        activeChildId: panelId,
        children: nextChildren as unknown as StackNode['children']
      })
    );
}

function replaceStackById(node: LayoutNode, stackId: string, replacement: StackNode): LayoutNode {
  if (node.kind === 'stack') {
    return node.id === stackId ? replacement : node;
  }

  return {
    ...node,
    children: [
      replaceStackById(node.children[0], stackId, replacement),
      replaceStackById(node.children[1], stackId, replacement)
    ]
  };
}

interface ReorderableChainSegment {
  node: LayoutNode;
  size: number;
}

function reorderWholeStackWithinAlignedBand(
  workspace: Workspace,
  root: LayoutNode,
  sourceStackId: string,
  targetStackId: string,
  placement: LayoutDockSide
): Workspace | null {
  const orientation: SplitOrientation = placement === 'left' || placement === 'right' ? 'horizontal' : 'vertical';
  const sourceBounds = findNodeBounds(root, sourceStackId);
  const targetBounds = findNodeBounds(root, targetStackId);

  if (!sourceBounds || !targetBounds) {
    return null;
  }

  const crossAxisOverlap =
    orientation === 'horizontal'
      ? resolveRangeOverlapRatio(sourceBounds.vertical, targetBounds.vertical)
      : resolveRangeOverlapRatio(sourceBounds.horizontal, targetBounds.horizontal);

  if (crossAxisOverlap < 0.95) {
    return null;
  }

  const container = findMinimalSameOrientationContainer(root, sourceStackId, targetStackId, orientation);

  if (!container) {
    return null;
  }

  const segments = flattenSameOrientationChain(container, orientation);
  const sourceIndex = segments.findIndex((segment) => segment.node.kind === 'stack' && segment.node.id === sourceStackId);
  const targetIndex = segments.findIndex((segment) => segment.node.kind === 'stack' && segment.node.id === targetStackId);

  if (sourceIndex === -1 || targetIndex === -1) {
    return null;
  }

  const nextSegments = [...segments];
  const [sourceSegment] = nextSegments.splice(sourceIndex, 1);
  const targetIndexAfterRemoval = nextSegments.findIndex(
    (segment) => segment.node.kind === 'stack' && segment.node.id === targetStackId
  );

  if (targetIndexAfterRemoval === -1) {
    return null;
  }

  const insertionIndex = placement === 'left' || placement === 'top' ? targetIndexAfterRemoval : targetIndexAfterRemoval + 1;
  nextSegments.splice(insertionIndex, 0, sourceSegment);

  if (segmentsHaveSameOrder(segments, nextSegments)) {
    return workspace;
  }

  const nextChain = buildSameOrientationChain(orientation, nextSegments);

  return updateActiveWindowRoot(workspace, (currentRoot) =>
    canonicalizeLayout(replaceNodeById(currentRoot, container.id, nextChain))
  );
}

function findMinimalSameOrientationContainer(
  node: LayoutNode,
  sourceStackId: string,
  targetStackId: string,
  orientation: SplitOrientation
): SplitNode | null {
  if (node.kind === 'stack') {
    return null;
  }

  if (node.orientation !== orientation) {
    return (
      findMinimalSameOrientationContainer(node.children[0], sourceStackId, targetStackId, orientation) ??
      findMinimalSameOrientationContainer(node.children[1], sourceStackId, targetStackId, orientation)
    );
  }

  const containsSource = containsNodeId(node, sourceStackId);
  const containsTarget = containsNodeId(node, targetStackId);

  if (!containsSource || !containsTarget) {
    return (
      findMinimalSameOrientationContainer(node.children[0], sourceStackId, targetStackId, orientation) ??
      findMinimalSameOrientationContainer(node.children[1], sourceStackId, targetStackId, orientation)
    );
  }

  const nestedMatch =
    findMinimalSameOrientationContainer(node.children[0], sourceStackId, targetStackId, orientation) ??
    findMinimalSameOrientationContainer(node.children[1], sourceStackId, targetStackId, orientation);

  return nestedMatch ?? node;
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

function flattenSameOrientationChain(
  node: LayoutNode,
  orientation: SplitOrientation,
  inheritedSize = 1
): ReorderableChainSegment[] {
  if (node.kind === 'split' && node.orientation === orientation) {
    return [
      ...flattenSameOrientationChain(node.children[0], orientation, inheritedSize * node.sizes[0]),
      ...flattenSameOrientationChain(node.children[1], orientation, inheritedSize * node.sizes[1])
    ];
  }

  return [{ node, size: inheritedSize }];
}

function buildSameOrientationChain(orientation: SplitOrientation, segments: ReorderableChainSegment[]): LayoutNode {
  if (segments.length === 1) {
    return segments[0].node;
  }

  const [firstSegment, ...restSegments] = segments;
  const totalSize = segments.reduce((sum, segment) => sum + segment.size, 0);
  const firstRatio = totalSize > 0 ? firstSegment.size / totalSize : 0.5;

  return createSplit(
    orientation,
    [firstSegment.node, buildSameOrientationChain(orientation, restSegments)],
    [firstRatio, 1 - firstRatio]
  );
}

function replaceNodeById(node: LayoutNode, targetNodeId: string, replacement: LayoutNode): LayoutNode {
  if (node.id === targetNodeId) {
    return replacement;
  }

  if (node.kind === 'stack') {
    return node;
  }

  return {
    ...node,
    children: [
      replaceNodeById(node.children[0], targetNodeId, replacement),
      replaceNodeById(node.children[1], targetNodeId, replacement)
    ]
  };
}

function segmentsHaveSameOrder(first: ReorderableChainSegment[], second: ReorderableChainSegment[]): boolean {
  if (first.length !== second.length) {
    return false;
  }

  return first.every((segment, index) => segment.node.id === second[index]?.node.id);
}

function clampTabInsertionIndex(index: number, length: number): number {
  return Math.max(0, Math.min(length, Math.round(index)));
}

interface LayoutBounds {
  horizontal: { start: number; end: number };
  vertical: { start: number; end: number };
}

function resolveDockPreferredSplitSizes(
  root: LayoutNode,
  sourceStackId: string,
  targetStackId: string,
  placement: LayoutDockPlacement
): [number, number] | null {
  if (placement === 'center') {
    return null;
  }

  const orientation: SplitOrientation = placement === 'left' || placement === 'right' ? 'horizontal' : 'vertical';
  const sourceBounds = findNodeBounds(root, sourceStackId);
  const targetBounds = findNodeBounds(root, targetStackId);

  if (!sourceBounds || !targetBounds) {
    return null;
  }

  const crossAxisOverlap =
    orientation === 'horizontal'
      ? resolveRangeOverlapRatio(sourceBounds.vertical, targetBounds.vertical)
      : resolveRangeOverlapRatio(sourceBounds.horizontal, targetBounds.horizontal);

  if (crossAxisOverlap < 0.95) {
    return null;
  }

  const sourceSpan =
    orientation === 'horizontal'
      ? sourceBounds.horizontal.end - sourceBounds.horizontal.start
      : sourceBounds.vertical.end - sourceBounds.vertical.start;
  const targetSpan =
    orientation === 'horizontal'
      ? targetBounds.horizontal.end - targetBounds.horizontal.start
      : targetBounds.vertical.end - targetBounds.vertical.start;

  if (!Number.isFinite(sourceSpan) || !Number.isFinite(targetSpan) || sourceSpan <= 0 || targetSpan <= 0) {
    return null;
  }

  const movedRatio = Math.max(
    LAYOUT_MIN_SPLIT_SIZE,
    Math.min(1 - LAYOUT_MIN_SPLIT_SIZE, sourceSpan / targetSpan)
  );

  return placement === 'left' || placement === 'top'
    ? [movedRatio, 1 - movedRatio]
    : [1 - movedRatio, movedRatio];
}

function findNodeBounds(node: LayoutNode, targetNodeId: string, bounds: LayoutBounds = {
  horizontal: { start: 0, end: 1 },
  vertical: { start: 0, end: 1 }
}): LayoutBounds | null {
  if (node.id === targetNodeId) {
    return bounds;
  }

  if (node.kind === 'stack') {
    return null;
  }

  const [firstSize] = node.sizes;

  if (node.orientation === 'horizontal') {
    const width = bounds.horizontal.end - bounds.horizontal.start;
    const splitPoint = bounds.horizontal.start + width * firstSize;
    const firstBounds: LayoutBounds = {
      horizontal: { start: bounds.horizontal.start, end: splitPoint },
      vertical: bounds.vertical
    };
    const secondBounds: LayoutBounds = {
      horizontal: { start: splitPoint, end: bounds.horizontal.end },
      vertical: bounds.vertical
    };

    return findNodeBounds(node.children[0], targetNodeId, firstBounds) ??
      findNodeBounds(node.children[1], targetNodeId, secondBounds);
  }

  const height = bounds.vertical.end - bounds.vertical.start;
  const splitPoint = bounds.vertical.start + height * firstSize;
  const firstBounds: LayoutBounds = {
    horizontal: bounds.horizontal,
    vertical: { start: bounds.vertical.start, end: splitPoint }
  };
  const secondBounds: LayoutBounds = {
    horizontal: bounds.horizontal,
    vertical: { start: splitPoint, end: bounds.vertical.end }
  };

  return findNodeBounds(node.children[0], targetNodeId, firstBounds) ??
    findNodeBounds(node.children[1], targetNodeId, secondBounds);
}

function resolveRangeOverlapRatio(
  first: { start: number; end: number },
  second: { start: number; end: number }
): number {
  const overlapStart = Math.max(first.start, second.start);
  const overlapEnd = Math.min(first.end, second.end);
  const overlap = Math.max(0, overlapEnd - overlapStart);
  const base = Math.min(first.end - first.start, second.end - second.start);

  if (base <= 0) {
    return 0;
  }

  return overlap / base;
}
