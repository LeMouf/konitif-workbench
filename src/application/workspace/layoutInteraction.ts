import type {
  LayoutDockSide,
  LayoutEdge,
  LayoutInteractionAnchor,
  LayoutInteractionState,
  LayoutDockTarget,
  LayoutMenuTarget,
  LayoutInteractionSourceKind,
  LayoutMenuActionId
} from '../../domain/layout/interaction';
import type { LayoutNode, SplitNode, SplitOrientation } from '../../domain/layout/model';
import { containsPanel, listPanels } from '../../domain/layout/selectors';
import { normalizeSplitSizes } from '../../domain/layout/validation';

export type LayoutMenuActionSelection =
  | {
      kind: 'split';
      orientation: SplitOrientation;
      panelId: string;
      edge: LayoutEdge;
    }
  | {
      kind: 'join';
      panelId: string;
      edge: LayoutEdge;
      side: LayoutDockSide;
      sourceAreaPanelIds: readonly string[];
      siblingAreaPanelIds: readonly string[];
    }
  | {
      kind: 'swap';
      panelId: string;
      edge: LayoutEdge;
      sourceAreaPanelIds: readonly string[];
      siblingAreaPanelIds: readonly string[];
    };

export interface LayoutMenuActionItem {
  id: string;
  label: string;
  group: 'split' | 'transform';
  enabled: boolean;
  selection: LayoutMenuActionSelection | null;
}

export interface SplitHandleMenuTarget {
  panelId: string;
  edge: LayoutEdge;
}

export interface LayoutSplitCommit {
  panelId: string | null;
  orientation: SplitOrientation;
  side: LayoutDockSide;
}

export type LayoutInteractionResolution =
  | {
      kind: 'state';
      state: LayoutInteractionState;
    }
  | {
      kind: 'commit-subdivide';
      state: LayoutInteractionState;
      subdivide: {
        panelId: string;
        orientation: SplitOrientation;
        edge: LayoutEdge;
        cuts: number;
        pointerRatio: number;
      };
    }
  | {
      kind: 'commit-split';
      state: LayoutInteractionState;
      split: LayoutSplitCommit;
    }
  | {
      kind: 'commit-swap';
      state: LayoutInteractionState;
      swap: {
        panelId: string;
        edge: LayoutEdge;
        sourceAreaPanelIds: readonly string[];
        siblingAreaPanelIds: readonly string[];
      };
    }
  | {
      kind: 'commit-join';
      state: LayoutInteractionState;
      join: {
        panelId: string;
        edge: LayoutEdge;
        side: 'left' | 'right' | 'top' | 'bottom';
        sourceAreaPanelIds: readonly string[];
        siblingAreaPanelIds: readonly string[];
      };
    }
  | {
      kind: 'commit-dock';
      state: LayoutInteractionState;
      dock: {
        panelId: string;
        target: LayoutDockTarget;
      };
    }
  | {
      kind: 'commit-boundary-pull';
      state: LayoutInteractionState;
      boundaryPull: {
        windowId?: string;
        left?: number;
        right?: number;
        top?: number;
        bottom?: number;
      };
    }
  | {
      kind: 'commit-intersection-resize';
      state: LayoutInteractionState;
      intersectionResize: {
        columnSplitId: string;
        rowSplitId: string;
        columnSizes: [number, number];
        rowSizes: [number, number];
      };
    };

export function createLayoutInteractionState(): LayoutInteractionState {
  return { mode: 'idle' };
}

export function openLayoutSplitMenu(
  panelId: string | null,
  edge: LayoutEdge,
  anchor: LayoutInteractionAnchor,
  targets: LayoutMenuTarget[] = [],
  options: {
    source?: LayoutInteractionSourceKind;
    initialActionId?: LayoutMenuActionId | null;
  } = {}
): LayoutInteractionState {
  return {
    mode: 'split-menu',
    source: options.source ?? (targets.length > 0 ? 'split-boundary' : panelId ? 'panel-menu' : 'workspace-edge'),
    panelId,
    edge,
    anchor,
    targets,
    initialActionId: options.initialActionId ?? null
  };
}

export function dismissLayoutInteraction(): LayoutInteractionState {
  return createLayoutInteractionState();
}

export function startPanelDrag(
  panelId: string,
  sourceStackId: string,
  anchor: LayoutInteractionAnchor
): LayoutInteractionState {
  return {
    mode: 'drag-panel',
    panelId,
    sourceStackId,
    anchor,
    pointer: anchor,
    hoveredTarget: null
  };
}

export function updatePanelDrag(
  state: LayoutInteractionState,
  pointer: LayoutInteractionAnchor,
  hoveredTarget: LayoutDockTarget | null
): LayoutInteractionState {
  if (state.mode !== 'drag-panel') {
    return state;
  }

  return {
    ...state,
    pointer,
    hoveredTarget
  };
}

export function commitPanelDock(state: LayoutInteractionState): LayoutInteractionResolution {
  if (state.mode !== 'drag-panel' || !state.hoveredTarget) {
    return {
      kind: 'state',
      state
    };
  }

  return {
    kind: 'commit-dock',
    state: dismissLayoutInteraction(),
    dock: {
      panelId: state.panelId,
      target: state.hoveredTarget
    }
  };
}

export function resolveSplitHandleMenuTarget(
  split: SplitNode,
  activePanelId: string | null
): SplitHandleMenuTarget | null {
  const [firstChild, secondChild] = split.children;
  const activeInFirst = activePanelId ? containsPanel(firstChild, activePanelId) : false;
  const activeInSecond = activePanelId ? containsPanel(secondChild, activePanelId) : false;

  if (split.orientation === 'horizontal') {
    if (activeInFirst) {
      const panelId = getPreferredPanelIdInNode(firstChild, activePanelId);
      return panelId ? { panelId, edge: 'right' } : null;
    }

    if (activeInSecond) {
      const panelId = getPreferredPanelIdInNode(secondChild, activePanelId);
      return panelId ? { panelId, edge: 'left' } : null;
    }

    const fallbackPanelId = getPreferredPanelIdInNode(firstChild);
    return fallbackPanelId ? { panelId: fallbackPanelId, edge: 'right' } : null;
  }

  if (activeInFirst) {
    const panelId = getPreferredPanelIdInNode(firstChild, activePanelId);
    return panelId ? { panelId, edge: 'bottom' } : null;
  }

  if (activeInSecond) {
    const panelId = getPreferredPanelIdInNode(secondChild, activePanelId);
    return panelId ? { panelId, edge: 'top' } : null;
  }

  const fallbackPanelId = getPreferredPanelIdInNode(firstChild);
  return fallbackPanelId ? { panelId: fallbackPanelId, edge: 'bottom' } : null;
}

export function resolveSplitHandleMenuTargets(split: SplitNode): LayoutMenuTarget[] {
  const [firstChild, secondChild] = split.children;

  if (split.orientation === 'horizontal') {
    const firstBoundaryTargets = collectWorkspaceEdgeMenuTargets(firstChild, 'right');
    const secondBoundaryTargets = collectWorkspaceEdgeMenuTargets(secondChild, 'left');
    const firstAreaId = `${split.id}:child:0:boundary:right`;
    const secondAreaId = `${split.id}:child:1:boundary:left`;
    const firstAreaPanelIds = collectBoundaryPanelIds(firstBoundaryTargets);
    const secondAreaPanelIds = collectBoundaryPanelIds(secondBoundaryTargets);

    return [
      ...firstBoundaryTargets.map((target) => ({
        ...target,
        areaId: firstAreaId,
        areaPanelIds: firstAreaPanelIds,
        label: 'Left',
        joinSide: 'right' as const,
        joinSiblingPanelIds: secondAreaPanelIds,
        swapSiblingPanelIds: secondAreaPanelIds
      })),
      ...secondBoundaryTargets.map((target) => ({
        ...target,
        areaId: secondAreaId,
        areaPanelIds: secondAreaPanelIds,
        label: 'Right',
        joinSide: 'left' as const,
        joinSiblingPanelIds: firstAreaPanelIds,
        swapSiblingPanelIds: firstAreaPanelIds
      }))
    ];
  }

  const firstBoundaryTargets = collectWorkspaceEdgeMenuTargets(firstChild, 'bottom');
  const secondBoundaryTargets = collectWorkspaceEdgeMenuTargets(secondChild, 'top');
  const firstAreaId = `${split.id}:child:0:boundary:bottom`;
  const secondAreaId = `${split.id}:child:1:boundary:top`;
  const firstAreaPanelIds = collectBoundaryPanelIds(firstBoundaryTargets);
  const secondAreaPanelIds = collectBoundaryPanelIds(secondBoundaryTargets);

  return [
    ...firstBoundaryTargets.map((target) => ({
      ...target,
      areaId: firstAreaId,
      areaPanelIds: firstAreaPanelIds,
      label: 'Up',
      joinSide: 'bottom' as const,
      joinSiblingPanelIds: secondAreaPanelIds,
      swapSiblingPanelIds: secondAreaPanelIds
    })),
    ...secondBoundaryTargets.map((target) => ({
      ...target,
      areaId: secondAreaId,
      areaPanelIds: secondAreaPanelIds,
      label: 'Down',
      joinSide: 'top' as const,
      joinSiblingPanelIds: firstAreaPanelIds,
      swapSiblingPanelIds: firstAreaPanelIds
    }))
  ];
}

export function resolveWorkspaceEdgeMenuTargets(root: LayoutNode, edge: LayoutEdge): LayoutMenuTarget[] {
  return collectWorkspaceEdgeMenuTargets(root, edge).map((target) => ({
    ...target,
    areaId: resolveImmediateSwapAreaId(root, target.panelId, target.edge),
    areaPanelIds: resolveImmediateSwapAreaPanelIds(root, target.panelId, target.edge),
    joinSiblingPanelIds: resolveImmediateJoinSiblingPanelIds(root, target.panelId, target.edge),
    swapSiblingPanelIds: resolveImmediateSwapSiblingPanelIds(root, target.panelId, target.edge)
  }));
}

export function resolvePanelMenuTargets(root: LayoutNode, panelId: string): LayoutMenuTarget[] {
  const edges: LayoutEdge[] = ['left', 'right', 'top', 'bottom'];

  return edges
    .map<LayoutMenuTarget | null>((edge) => {
      const areaPanelIds = resolveNearestSwapAreaPanelIds(root, panelId, edge);
      const joinSiblingPanelIds = resolveNearestSwapSiblingPanelIds(root, panelId, edge);
      const swapSiblingPanelIds = resolveNearestSwapSiblingPanelIds(root, panelId, edge);

      if (joinSiblingPanelIds.length === 0 && swapSiblingPanelIds.length === 0) {
        return null;
      }

      return {
        id: `panel:${panelId}:edge:${edge}`,
        panelId,
        areaId: `panel:${panelId}:edge:${edge}`,
        areaPanelIds,
        edge,
        label: edge,
        joinSide: edge,
        joinSiblingPanelIds,
        swapSiblingPanelIds
      } satisfies LayoutMenuTarget;
    })
    .filter(isLayoutMenuTarget);
}

export function resolvePanelMenuJoinTargets(root: LayoutNode, panelId: string): LayoutMenuTarget[] {
  const edges: LayoutEdge[] = ['left', 'right', 'top', 'bottom'];

  return edges.flatMap((edge) => {
    const area = findNearestSwapArea(root, panelId, edge);

    if (!area) {
      return [];
    }

    const siblingEdge = resolveOppositeEdge(edge);
    // Panel-menu joins are anchored to the panel that opened the menu, not the
    // larger structural branch that may contain it. This keeps preview + commit
    // semantics aligned with the user-visible origin panel.
    const sourcePanelIds = [panelId];
    const boundaryNodes = collectBoundaryNodes(area.siblingNode, siblingEdge);
    const boundaryPanelSets = boundaryNodes.map((node) => listPanels(node).map((panel) => panel.id));
    const combinedBoundaryPanels = boundaryNodes.length > 1
      ? normalizePanelIdSet(boundaryPanelSets.flat())
      : null;

    const boundaryTargets = boundaryPanelSets.map((panelIds, index) => ({
      id: `panel:${panelId}:join:${edge}:${index}`,
      panelId,
      areaId: `panel:${panelId}:join:${edge}:${index}`,
      areaPanelIds: sourcePanelIds,
      edge,
      label: edge,
      joinSide: edge,
      joinSiblingPanelIds: panelIds,
      swapSiblingPanelIds: []
    }));

    if (combinedBoundaryPanels && combinedBoundaryPanels.length > 0) {
      boundaryTargets.unshift({
        id: `panel:${panelId}:join:${edge}:group`,
        panelId,
        areaId: `panel:${panelId}:join:${edge}:group`,
        areaPanelIds: sourcePanelIds,
        edge,
        label: edge,
        joinSide: edge,
        joinSiblingPanelIds: combinedBoundaryPanels,
        swapSiblingPanelIds: []
      });
    }

    return boundaryTargets;
  });
}

export function resolvePanelMenuSwapTargets(root: LayoutNode, panelId: string): LayoutMenuTarget[] {
  const edges: LayoutEdge[] = ['left', 'right', 'top', 'bottom'];

  return edges.flatMap((edge) => {
    const area = findNearestSwapArea(root, panelId, edge);

    if (!area) {
      return [];
    }

    const siblingEdge = resolveOppositeEdge(edge);
    const sourcePanelIds = listPanels(area.sourceNode).map((panel) => panel.id);
    const boundaryNodes = collectBoundaryNodes(area.siblingNode, siblingEdge);
    const boundaryPanelSets = boundaryNodes.map((node) => listPanels(node).map((panel) => panel.id));
    const combinedBoundaryPanels = boundaryNodes.length > 1
      ? normalizePanelIdSet(boundaryPanelSets.flat())
      : null;

    const boundaryTargets = boundaryPanelSets.map((panelIds, index) => ({
      id: `panel:${panelId}:swap:${edge}:${index}`,
      panelId,
      areaId: `panel:${panelId}:swap:${edge}:${index}`,
      areaPanelIds: sourcePanelIds,
      edge,
      label: edge,
      joinSide: edge,
      joinSiblingPanelIds: [],
      swapSiblingPanelIds: panelIds
    }));

    if (combinedBoundaryPanels && combinedBoundaryPanels.length > 0) {
      boundaryTargets.unshift({
        id: `panel:${panelId}:swap:${edge}:group`,
        panelId,
        areaId: `panel:${panelId}:swap:${edge}:group`,
        areaPanelIds: sourcePanelIds,
        edge,
        label: edge,
        joinSide: edge,
        joinSiblingPanelIds: [],
        swapSiblingPanelIds: combinedBoundaryPanels
      });
    }

    return boundaryTargets;
  });
}

export function getLayoutMenuActions(options: {
  edge?: LayoutEdge;
  panelId?: string | null;
  target?: LayoutMenuTarget | null;
  targets?: LayoutMenuTarget[];
  joinEnabled?: boolean;
  swapAreasEnabled?: boolean;
} = {}): LayoutMenuActionItem[] {
  const {
    edge = 'top',
    panelId = null,
    target = null,
    targets = [],
    joinEnabled = false,
    swapAreasEnabled = false
  } = options;
  const activeTarget =
    target ??
    (targets.length > 0
      ? targets[0]
      : panelId
      ? {
          id: `panel:${panelId}`,
          panelId,
          areaId: `panel:${panelId}`,
          areaPanelIds: [panelId],
          edge,
          label: '',
          joinSide: edge,
          joinSiblingPanelIds: [],
          swapSiblingPanelIds: []
        }
        : null);

  return [
    {
      id: 'split:vertical',
      label: 'Vertical Split',
      group: 'split',
      enabled: true,
      selection:
        activeTarget?.panelId
          ? {
              kind: 'split',
              orientation: 'vertical',
              panelId: activeTarget.panelId,
              edge: activeTarget.edge
            }
          : null
    },
    {
      id: 'split:horizontal',
      label: 'Horizontal Split',
      group: 'split',
      enabled: true,
      selection:
        activeTarget?.panelId
          ? {
              kind: 'split',
              orientation: 'horizontal',
              panelId: activeTarget.panelId,
              edge: activeTarget.edge
            }
          : null
    },
    {
      id: 'join-areas',
      label: 'Join Areas',
      group: 'transform',
      enabled: joinEnabled,
      selection:
        joinEnabled && activeTarget?.panelId
          ? {
              kind: 'join',
              panelId: activeTarget.panelId,
              edge: activeTarget.edge,
              side: activeTarget.joinSide,
              sourceAreaPanelIds: activeTarget.areaPanelIds,
              siblingAreaPanelIds: activeTarget.joinSiblingPanelIds
            }
          : null
    },
    {
      id: 'swap-areas',
      label: 'Swap Areas',
      group: 'transform',
      enabled: swapAreasEnabled,
      selection:
        swapAreasEnabled && activeTarget?.panelId
          ? {
              kind: 'swap',
              panelId: activeTarget.panelId,
              edge: activeTarget.edge,
              sourceAreaPanelIds: activeTarget.areaPanelIds,
              siblingAreaPanelIds: activeTarget.swapSiblingPanelIds
            }
          : null
    }
  ];
}

export function selectLayoutMenuAction(
  state: LayoutInteractionState,
  selection: LayoutMenuActionSelection | null
): LayoutInteractionResolution {
  if (state.mode !== 'split-menu' || !selection) {
    return {
      kind: 'state',
      state
    };
  }

  if (selection.kind === 'split') {
    return selectLayoutSplitOrientation(
      {
        ...state,
        panelId: selection.panelId,
        edge: selection.edge
      },
      selection.orientation
    );
  }

  if (selection.kind === 'swap') {
    return {
      kind: 'commit-swap',
      state: dismissLayoutInteraction(),
      swap: {
        panelId: selection.panelId,
        edge: selection.edge,
        sourceAreaPanelIds: selection.sourceAreaPanelIds,
        siblingAreaPanelIds: selection.siblingAreaPanelIds
      }
    };
  }

  if (selection.kind === 'join') {
    return {
      kind: 'commit-join',
      state: dismissLayoutInteraction(),
      join: {
        panelId: selection.panelId,
        edge: selection.edge,
        side: selection.side,
        sourceAreaPanelIds: selection.sourceAreaPanelIds,
        siblingAreaPanelIds: selection.siblingAreaPanelIds
      }
    };
  }

  return {
    kind: 'state',
    state
  };
}

export function getEdgeSemanticOrientation(edge: LayoutEdge): SplitOrientation {
  return edge === 'left' || edge === 'right' ? 'vertical' : 'horizontal';
}

export function isAlignedEdgePreview(edge: LayoutEdge, orientation: SplitOrientation): boolean {
  return (
    ((edge === 'left' || edge === 'right') && orientation === 'vertical') ||
    ((edge === 'top' || edge === 'bottom') && orientation === 'horizontal')
  );
}

export function getDockSidesForOrientation(orientation: SplitOrientation): [LayoutDockSide, LayoutDockSide] {
  return orientation === 'vertical' ? ['left', 'right'] : ['top', 'bottom'];
}

export function selectLayoutSplitOrientation(
  state: LayoutInteractionState,
  orientation: SplitOrientation
): LayoutInteractionResolution {
  if (state.mode !== 'split-menu') {
    return {
      kind: 'state',
      state
    };
  }

  return {
    kind: 'state',
    state: {
      mode: 'split-preview',
      panelId: state.panelId,
      edge: state.edge,
      orientation,
      cuts: 1,
      pointerRatio: 0.5
    }
  };
}

export function updateLayoutSplitPreview(
  state: LayoutInteractionState,
  panelId: string | null,
  pointerRatio: number
): LayoutInteractionState {
  if (state.mode !== 'split-preview') {
    return state;
  }

  return {
    ...state,
    panelId,
    pointerRatio: Math.max(0.12, Math.min(0.88, Number(pointerRatio.toFixed(4))))
  };
}

export function startLayoutSplitPreview(input: {
  panelId: string;
  edge: LayoutEdge;
  orientation: SplitOrientation;
  cuts?: number;
  pointerRatio?: number;
}): LayoutInteractionState {
  return {
    mode: 'split-preview',
    panelId: input.panelId,
    edge: input.edge,
    orientation: input.orientation,
    cuts: Math.max(1, Math.min(5, input.cuts ?? 1)),
    pointerRatio: Math.max(0.12, Math.min(0.88, Number((input.pointerRatio ?? 0.5).toFixed(4))))
  };
}

const MIN_BOUNDARY_BAND_RATIO = 0.14;
const MAX_BOUNDARY_BAND_RATIO = 0.42;

function clampBoundaryBandRatio(value: number): number {
  return Math.max(MIN_BOUNDARY_BAND_RATIO, Math.min(MAX_BOUNDARY_BAND_RATIO, Number(value.toFixed(4))));
}

export function startBoundaryPull(input: {
  windowId?: string;
  anchor: LayoutInteractionAnchor;
  horizontalEdge?: 'left' | 'right' | null;
  verticalEdge?: 'top' | 'bottom' | null;
  source?: 'edge' | 'corner';
  neutralThreshold?: number;
  creationThreshold?: number;
}): LayoutInteractionState {
  return {
    mode: 'boundary-pull',
    ...(input.windowId !== undefined ? { windowId: input.windowId } : {}),
    source: input.source ?? ((input.horizontalEdge && input.verticalEdge) ? 'corner' : 'edge'),
    anchor: input.anchor,
    pointer: input.anchor,
    horizontalEdge: input.horizontalEdge ?? null,
    verticalEdge: input.verticalEdge ?? null,
    neutralThreshold: input.neutralThreshold ?? 20,
    creationThreshold: input.creationThreshold ?? 72,
    horizontalDistance: 0,
    verticalDistance: 0,
    horizontalBandRatio: null,
    verticalBandRatio: null
  };
}

export function updateBoundaryPull(
  state: LayoutInteractionState,
  pointer: LayoutInteractionAnchor,
  viewport: { width: number; height: number }
): LayoutInteractionState {
  if (state.mode !== 'boundary-pull') {
    return state;
  }

  const rawHorizontalDistance =
    state.horizontalEdge === 'left'
      ? pointer.x - state.anchor.x
      : state.horizontalEdge === 'right'
        ? state.anchor.x - pointer.x
        : 0;
  const rawVerticalDistance =
    state.verticalEdge === 'top'
      ? pointer.y - state.anchor.y
      : state.verticalEdge === 'bottom'
        ? state.anchor.y - pointer.y
        : 0;
  const horizontalDistance = Math.max(0, rawHorizontalDistance);
  const verticalDistance = Math.max(0, rawVerticalDistance);

  return {
    ...state,
    pointer,
    horizontalDistance,
    verticalDistance,
    horizontalBandRatio:
      state.horizontalEdge && horizontalDistance >= state.creationThreshold && viewport.width > 0
        ? clampBoundaryBandRatio(horizontalDistance / viewport.width)
        : null,
    verticalBandRatio:
      state.verticalEdge && verticalDistance >= state.creationThreshold && viewport.height > 0
        ? clampBoundaryBandRatio(verticalDistance / viewport.height)
        : null
  };
}

export function commitBoundaryPull(state: LayoutInteractionState): LayoutInteractionResolution {
  if (state.mode !== 'boundary-pull') {
    return {
      kind: 'state',
      state
    };
  }

  const boundaryPull: {
    left?: number;
    right?: number;
    top?: number;
    bottom?: number;
  } = {};

  if (state.horizontalEdge && state.horizontalBandRatio !== null) {
    boundaryPull[state.horizontalEdge] = state.horizontalBandRatio;
  }

  if (state.verticalEdge && state.verticalBandRatio !== null) {
    boundaryPull[state.verticalEdge] = state.verticalBandRatio;
  }

  if (Object.keys(boundaryPull).length === 0) {
    return {
      kind: 'state',
      state: dismissLayoutInteraction()
    };
  }

  return {
    kind: 'commit-boundary-pull',
    state: dismissLayoutInteraction(),
    boundaryPull: { ...boundaryPull, ...(state.windowId !== undefined ? { windowId: state.windowId } : {}) }
  };
}

export function startIntersectionResize(input: {
  anchor: LayoutInteractionAnchor;
  columnSplitId: string;
  rowSplitId: string;
  columnBaseSizes: [number, number];
  rowBaseSizes: [number, number];
}): LayoutInteractionState {
  return {
    mode: 'intersection-resize',
    anchor: input.anchor,
    pointer: input.anchor,
    columnSplitId: input.columnSplitId,
    rowSplitId: input.rowSplitId,
    columnBaseSizes: input.columnBaseSizes,
    rowBaseSizes: input.rowBaseSizes,
    columnPreviewSizes: input.columnBaseSizes,
    rowPreviewSizes: input.rowBaseSizes
  };
}

export function updateIntersectionResize(
  state: LayoutInteractionState,
  pointer: LayoutInteractionAnchor,
  dimensions: { width: number; height: number }
): LayoutInteractionState {
  if (state.mode !== 'intersection-resize') {
    return state;
  }

  const deltaX = pointer.x - state.anchor.x;
  const deltaY = pointer.y - state.anchor.y;
  const columnRatioDelta = dimensions.width > 0 ? deltaX / dimensions.width : 0;
  const rowRatioDelta = dimensions.height > 0 ? deltaY / dimensions.height : 0;

  return {
    ...state,
    pointer,
    columnPreviewSizes: normalizeSplitSizes([
      state.columnBaseSizes[0] + columnRatioDelta,
      state.columnBaseSizes[1] - columnRatioDelta
    ]),
    rowPreviewSizes: normalizeSplitSizes([
      state.rowBaseSizes[0] + rowRatioDelta,
      state.rowBaseSizes[1] - rowRatioDelta
    ])
  };
}

export function commitIntersectionResize(state: LayoutInteractionState): LayoutInteractionResolution {
  if (state.mode !== 'intersection-resize') {
    return {
      kind: 'state',
      state
    };
  }

  return {
    kind: 'commit-intersection-resize',
    state: dismissLayoutInteraction(),
    intersectionResize: {
      columnSplitId: state.columnSplitId,
      rowSplitId: state.rowSplitId,
      columnSizes: state.columnPreviewSizes,
      rowSizes: state.rowPreviewSizes
    }
  };
}

function getPreferredPanelIdInNode(node: LayoutNode, preferredPanelId?: string | null): string | null {
  if (node.kind === 'stack') {
    if (preferredPanelId && node.children.some((panel) => panel.id === preferredPanelId)) {
      return preferredPanelId;
    }

    return node.activeChildId;
  }

  return getPreferredPanelIdInNode(node.children[0], preferredPanelId) ?? getPreferredPanelIdInNode(node.children[1], preferredPanelId);
}

function isLayoutMenuTarget(value: LayoutMenuTarget | null): value is LayoutMenuTarget {
  return !!value;
}

function collectBoundaryPanelIds(targets: LayoutMenuTarget[]): string[] {
  return Array.from(new Set(targets.map((target) => target.panelId)));
}

function collectBoundaryNodes(node: LayoutNode, edge: LayoutEdge): LayoutNode[] {
  if (node.kind === 'stack') {
    return [node];
  }

  if (edge === 'left') {
    return node.orientation === 'horizontal'
      ? collectBoundaryNodes(node.children[0], edge)
      : [...collectBoundaryNodes(node.children[0], edge), ...collectBoundaryNodes(node.children[1], edge)];
  }

  if (edge === 'right') {
    return node.orientation === 'horizontal'
      ? collectBoundaryNodes(node.children[1], edge)
      : [...collectBoundaryNodes(node.children[0], edge), ...collectBoundaryNodes(node.children[1], edge)];
  }

  if (edge === 'top') {
    return node.orientation === 'vertical'
      ? collectBoundaryNodes(node.children[0], edge)
      : [...collectBoundaryNodes(node.children[0], edge), ...collectBoundaryNodes(node.children[1], edge)];
  }

  return node.orientation === 'vertical'
    ? collectBoundaryNodes(node.children[1], edge)
    : [...collectBoundaryNodes(node.children[0], edge), ...collectBoundaryNodes(node.children[1], edge)];
}

function resolveOppositeEdge(edge: LayoutEdge): LayoutEdge {
  switch (edge) {
    case 'left':
      return 'right';
    case 'right':
      return 'left';
    case 'top':
      return 'bottom';
    case 'bottom':
      return 'top';
  }
}
function collectWorkspaceEdgeMenuTargets(node: LayoutNode, edge: LayoutEdge): LayoutMenuTarget[] {
  if (node.kind === 'stack') {
    const panelId = getPreferredPanelIdInNode(node);
    return panelId
      ? [
          {
            id: `panel:${panelId}`,
            panelId,
            areaId: `panel:${panelId}`,
            areaPanelIds: [panelId],
            edge,
            label: '',
            joinSide: edge,
            joinSiblingPanelIds: [],
            swapSiblingPanelIds: []
          }
        ]
      : [];
  }

  if (edge === 'left') {
    return node.orientation === 'horizontal'
      ? collectWorkspaceEdgeMenuTargets(node.children[0], edge)
      : [
          ...collectWorkspaceEdgeMenuTargets(node.children[0], edge),
          ...collectWorkspaceEdgeMenuTargets(node.children[1], edge)
        ];
  }

  if (edge === 'right') {
    return node.orientation === 'horizontal'
      ? collectWorkspaceEdgeMenuTargets(node.children[1], edge)
      : [
          ...collectWorkspaceEdgeMenuTargets(node.children[0], edge),
          ...collectWorkspaceEdgeMenuTargets(node.children[1], edge)
        ];
  }

  if (edge === 'top') {
    return node.orientation === 'vertical'
      ? collectWorkspaceEdgeMenuTargets(node.children[0], edge)
      : [
          ...collectWorkspaceEdgeMenuTargets(node.children[0], edge),
          ...collectWorkspaceEdgeMenuTargets(node.children[1], edge)
        ];
  }

  return node.orientation === 'vertical'
    ? collectWorkspaceEdgeMenuTargets(node.children[1], edge)
    : [
        ...collectWorkspaceEdgeMenuTargets(node.children[0], edge),
        ...collectWorkspaceEdgeMenuTargets(node.children[1], edge)
      ];
}

export function resolveImmediateJoinSiblingPanelIds(root: LayoutNode, panelId: string, edge: LayoutEdge): string[] {
  const siblingNode = findImmediateJoinSiblingNode(root, panelId, edge);
  return siblingNode ? listPanels(siblingNode).map((panel) => panel.id) : [];
}

export function resolveImmediateSwapAreaPanelIds(root: LayoutNode, panelId: string, edge: LayoutEdge): string[] {
  const area = findImmediateSwapArea(root, panelId, edge);
  return area ? listPanels(area.sourceNode).map((panel) => panel.id) : [panelId];
}

export function resolveImmediateSwapSiblingPanelIds(root: LayoutNode, panelId: string, edge: LayoutEdge): string[] {
  const area = findImmediateSwapArea(root, panelId, edge);
  return area ? listPanels(area.siblingNode).map((panel) => panel.id) : [];
}

function resolveNearestSwapAreaPanelIds(root: LayoutNode, panelId: string, edge: LayoutEdge): string[] {
  const area = findNearestSwapArea(root, panelId, edge);
  return area ? listPanels(area.sourceNode).map((panel) => panel.id) : [panelId];
}

function resolveNearestSwapSiblingPanelIds(root: LayoutNode, panelId: string, edge: LayoutEdge): string[] {
  const area = findNearestSwapArea(root, panelId, edge);
  return area ? listPanels(area.siblingNode).map((panel) => panel.id) : [];
}

function resolveImmediateSwapAreaId(root: LayoutNode, panelId: string, edge: LayoutEdge): string {
  const area = findImmediateSwapArea(root, panelId, edge);

  if (!area) {
    return `panel:${panelId}`;
  }

  return `${area.splitId}:child:${area.childIndex}`;
}

interface LayoutBranchAncestor {
  splitId: string;
  orientation: SplitOrientation;
  childIndex: 0 | 1;
  sibling: LayoutNode;
}

interface ImmediateSwapArea {
  splitId: string;
  childIndex: 0 | 1;
  sourceNode: LayoutNode;
  siblingNode: LayoutNode;
}

function findImmediateSwapArea(root: LayoutNode, panelId: string, edge: LayoutEdge): ImmediateSwapArea | null {
  const ancestors = findLayoutBranchAncestors(root, panelId);
  const targetOrientation = edge === 'left' || edge === 'right' ? 'horizontal' : 'vertical';
  const expectedChildIndex = edge === 'left' || edge === 'top' ? 1 : 0;
  let current = root;

  for (let index = 0; index < ancestors.length; index += 1) {
    const ancestor = ancestors[index];

    if (current.kind === 'stack') {
      return null;
    }

    if (ancestor.orientation === targetOrientation && ancestor.childIndex === expectedChildIndex) {
      return {
        splitId: ancestor.splitId,
        childIndex: ancestor.childIndex,
        sourceNode: current.children[ancestor.childIndex],
        siblingNode: ancestor.sibling
      };
    }

    current = current.children[ancestor.childIndex];
  }

  return null;
}

function findNearestSwapArea(root: LayoutNode, panelId: string, edge: LayoutEdge): ImmediateSwapArea | null {
  const ancestors = findLayoutBranchAncestors(root, panelId);
  const targetOrientation = edge === 'left' || edge === 'right' ? 'horizontal' : 'vertical';
  const expectedChildIndex = edge === 'left' || edge === 'top' ? 1 : 0;

  if (ancestors.length === 0) {
    return null;
  }

  const pathNodes: SplitNode[] = [];
  let current = root;

  for (const ancestor of ancestors) {
    if (current.kind === 'stack') {
      return null;
    }

    pathNodes.push(current);
    current = current.children[ancestor.childIndex];
  }

  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const ancestor = ancestors[index];

    if (ancestor.orientation !== targetOrientation || ancestor.childIndex !== expectedChildIndex) {
      continue;
    }

    const splitNode = pathNodes[index];

    return {
      splitId: ancestor.splitId,
      childIndex: ancestor.childIndex,
      sourceNode: splitNode.children[ancestor.childIndex],
      siblingNode: ancestor.sibling
    };
  }

  return null;
}

function normalizePanelIdSet(panelIds: string[]): string[] {
  return Array.from(new Set(panelIds)).sort();
}

function findImmediateJoinSiblingNode(root: LayoutNode, panelId: string, edge: LayoutEdge): LayoutNode | null {
  const ancestors = findLayoutBranchAncestors(root, panelId);
  const targetOrientation = edge === 'left' || edge === 'right' ? 'horizontal' : 'vertical';
  const expectedChildIndex = edge === 'left' || edge === 'top' ? 1 : 0;

  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const ancestor = ancestors[index];

    if (ancestor.orientation === targetOrientation && ancestor.childIndex === expectedChildIndex) {
      return ancestor.sibling;
    }
  }

  return null;
}

function findLayoutBranchAncestors(
  node: LayoutNode,
  panelId: string,
  trail: LayoutBranchAncestor[] = []
): LayoutBranchAncestor[] {
  if (node.kind === 'stack') {
    return node.children.some((panel) => panel.id === panelId) ? trail : [];
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
        childIndex,
        sibling: node.children[childIndex === 0 ? 1 : 0]
      }
    ]);
  }

  return [];
}

export function adjustLayoutSplitPreviewCuts(
  state: LayoutInteractionState,
  delta: number
): LayoutInteractionState {
  if (state.mode !== 'split-preview') {
    return state;
  }

  return {
    ...state,
    cuts: Math.max(1, Math.min(5, state.cuts + delta))
  };
}

export function commitLayoutSplitPreview(state: LayoutInteractionState): LayoutInteractionResolution {
  if (state.mode !== 'split-preview' || !state.panelId) {
    return {
      kind: 'state',
      state
    };
  }

  return {
    kind: 'commit-subdivide',
    state: dismissLayoutInteraction(),
    subdivide: {
      panelId: state.panelId,
      orientation: state.orientation,
      edge: state.edge,
      cuts: state.cuts,
      pointerRatio: state.pointerRatio
    }
  };
}

export function commitLayoutSubdivideSelection(input: {
  panelId: string;
  edge: LayoutEdge;
  orientation: SplitOrientation;
  cuts: number;
  pointerRatio: number;
}): LayoutInteractionResolution {
  return {
    kind: 'commit-subdivide',
    state: dismissLayoutInteraction(),
    subdivide: {
      panelId: input.panelId,
      edge: input.edge,
      orientation: input.orientation,
      cuts: Math.max(1, Math.min(5, Math.round(input.cuts))),
      pointerRatio: Math.max(0.12, Math.min(0.88, Number(input.pointerRatio.toFixed(4))))
    }
  };
}

export function previewLayoutSplitSide(
  state: LayoutInteractionState,
  side: LayoutDockSide | null
): LayoutInteractionState {
  if (state.mode !== 'split-side-pick') {
    return state;
  }

  return {
    ...state,
    hoveredSide: side
  };
}

export function confirmLayoutSplitSide(
  state: LayoutInteractionState,
  side: LayoutDockSide
): LayoutInteractionResolution {
  if (state.mode !== 'split-side-pick') {
    return {
      kind: 'state',
      state
    };
  }

  const allowedSides = getDockSidesForOrientation(state.orientation);

  if (!allowedSides.includes(side)) {
    return {
      kind: 'state',
      state
    };
  }

  return {
    kind: 'commit-split',
    state: dismissLayoutInteraction(),
    split: {
      panelId: state.panelId,
      orientation: toDomainSplitOrientation(state.orientation),
      side
    }
  };
}

function toDomainSplitOrientation(orientation: SplitOrientation): SplitOrientation {
  return orientation === 'vertical' ? 'horizontal' : 'vertical';
}
