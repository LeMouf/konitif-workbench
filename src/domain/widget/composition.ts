import type { WorkbenchIconInput } from '../icon/model';
import type { JsonObject } from '../shared/json';

export type WorkbenchWidgetZoneSurface =
  | 'shell'
  | 'panel'
  | 'panel-header'
  | 'panel-footer'
  | 'side'
  | 'tool'
  | 'tool-dock';

export type WorkbenchWidgetZoneChrome = 'none' | 'header' | 'tabs';
export type WorkbenchWidgetZonePresentation = 'tabs' | 'stack';
export type WorkbenchWidgetZoneAxis = 'horizontal' | 'vertical';

export interface WorkbenchWidgetZoneDefinition {
  id: string;
  title: string;
  surface: WorkbenchWidgetZoneSurface;
  chrome?: WorkbenchWidgetZoneChrome;
  /** How multiple placements are projected inside the zone. Defaults to tabs. */
  presentation?: WorkbenchWidgetZonePresentation;
  /** Ordering axis used by stacked zones and their drag/drop projection. */
  axis?: WorkbenchWidgetZoneAxis;
  icon?: WorkbenchIconInput;
  description?: string;
}

export interface WorkbenchWidgetPlacement {
  id: string;
  widgetId: string;
  zoneId: string;
  title: string;
  order?: number;
  icon?: WorkbenchIconInput;
  isVisible?: boolean;
  isPinned?: boolean;
  state?: JsonObject;
}

export interface WorkbenchWidgetZoneComposition {
  zones: WorkbenchWidgetZoneDefinition[];
  placements: WorkbenchWidgetPlacement[];
  activePlacementByZoneId?: Record<string, string | null | undefined>;
}

export interface WorkbenchWidgetZoneLayoutState {
  activePlacementId?: string | null;
  placementOrder?: string[];
  hiddenPlacementIds?: string[];
  pinnedPlacementIds?: string[];
  presentation?: WorkbenchWidgetZonePresentation;
  axis?: WorkbenchWidgetZoneAxis;
}

export type WorkbenchWidgetZoneLayoutStateByZoneId = Record<string, WorkbenchWidgetZoneLayoutState | undefined>;

export interface WorkbenchWidgetPlacementMove {
  placementId: string;
  zoneId: string;
  beforePlacementId?: string | null;
  afterPlacementId?: string | null;
}

export interface ResolvedWorkbenchWidgetZone {
  zone: WorkbenchWidgetZoneDefinition;
  allPlacements: WorkbenchWidgetPlacement[];
  placements: WorkbenchWidgetPlacement[];
  activePlacement: WorkbenchWidgetPlacement | null;
}

export function resolveWorkbenchWidgetZone(
  composition: WorkbenchWidgetZoneComposition,
  zoneId: string
): ResolvedWorkbenchWidgetZone | null {
  const zone = composition.zones.find((entry) => entry.id === zoneId);

  if (!zone) {
    return null;
  }

  const allPlacements = listWorkbenchWidgetZonePlacements(composition, zoneId, { includeHidden: true });
  const placements = listWorkbenchWidgetZonePlacements(composition, zoneId);
  const activePlacementId = composition.activePlacementByZoneId?.[zoneId] ?? null;
  const activePlacement =
    placements.find((placement) => placement.id === activePlacementId) ??
    placements.find((placement) => placement.isPinned) ??
    placements[0] ??
    null;

  return {
    zone,
    allPlacements,
    placements,
    activePlacement
  };
}

export function listWorkbenchWidgetZonePlacements(
  composition: WorkbenchWidgetZoneComposition,
  zoneId: string,
  options: { includeHidden?: boolean } = {}
): WorkbenchWidgetPlacement[] {
  return composition.placements
    .filter((placement) => placement.zoneId === zoneId && (options.includeHidden || placement.isVisible !== false))
    .sort(compareWorkbenchWidgetPlacements);
}

/**
 * Returns the placements rendered by a zone without transferring placement
 * authority to the host component. Tab zones project only the active entity;
 * stack zones project every visible entity in canonical order.
 */
export function listWorkbenchWidgetZoneRenderedPlacements(
  resolvedZone: ResolvedWorkbenchWidgetZone | null
): WorkbenchWidgetPlacement[] {
  if (!resolvedZone) {
    return [];
  }

  return resolvedZone.zone.presentation === 'stack'
    ? resolvedZone.placements
    : resolvedZone.activePlacement
      ? [resolvedZone.activePlacement]
      : [];
}

export function compareWorkbenchWidgetPlacements(
  left: WorkbenchWidgetPlacement,
  right: WorkbenchWidgetPlacement
): number {
  const leftOrder = Number.isFinite(left.order) ? Number(left.order) : 0;
  const rightOrder = Number.isFinite(right.order) ? Number(right.order) : 0;

  return leftOrder - rightOrder || left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
}

export function activateWorkbenchWidgetPlacement(
  composition: WorkbenchWidgetZoneComposition,
  zoneId: string,
  placementId: string
): WorkbenchWidgetZoneComposition {
  const placement = listWorkbenchWidgetZonePlacements(composition, zoneId)
    .find((candidate) => candidate.id === placementId);

  if (!placement) {
    return composition;
  }

  return {
    ...composition,
    activePlacementByZoneId: {
      ...composition.activePlacementByZoneId,
      [zoneId]: placement.id
    }
  };
}

export function moveWorkbenchWidgetPlacement(
  composition: WorkbenchWidgetZoneComposition,
  move: WorkbenchWidgetPlacementMove
): WorkbenchWidgetZoneComposition {
  const movingPlacement = composition.placements.find((placement) => placement.id === move.placementId);
  const targetZone = composition.zones.find((zone) => zone.id === move.zoneId);

  if (!movingPlacement || !targetZone) {
    return composition;
  }

  const sourceZoneId = movingPlacement.zoneId;
  const targetZoneId = targetZone.id;
  const sourceWasActive = composition.activePlacementByZoneId?.[sourceZoneId] === movingPlacement.id;
  const targetPlacements = listWorkbenchWidgetZonePlacements(composition, targetZoneId, { includeHidden: true })
    .filter((placement) => placement.id !== movingPlacement.id);
  const insertedTargetPlacements = insertWorkbenchWidgetPlacement(targetPlacements, movingPlacement, {
    beforePlacementId: move.beforePlacementId ?? null,
    afterPlacementId: move.afterPlacementId ?? null
  });
  const nextTargetOrders = createWorkbenchWidgetPlacementOrderMap(insertedTargetPlacements);
  const nextSourceOrders = createWorkbenchWidgetPlacementOrderMap(
    listWorkbenchWidgetZonePlacements(composition, sourceZoneId, { includeHidden: true })
      .filter((placement) => placement.id !== movingPlacement.id)
  );
  const nextPlacements = composition.placements.map((placement) => {
    if (placement.id === movingPlacement.id) {
      return {
        ...placement,
        zoneId: targetZoneId,
        order: nextTargetOrders.get(placement.id) ?? 0,
        isVisible: true
      };
    }

    if (placement.zoneId === targetZoneId) {
      return {
        ...placement,
        order: nextTargetOrders.get(placement.id) ?? placement.order
      };
    }

    if (placement.zoneId === sourceZoneId) {
      return {
        ...placement,
        order: nextSourceOrders.get(placement.id) ?? placement.order
      };
    }

    return placement;
  });
  const nextComposition: WorkbenchWidgetZoneComposition = {
    ...composition,
    placements: nextPlacements,
    activePlacementByZoneId: {
      ...composition.activePlacementByZoneId,
      [targetZoneId]: movingPlacement.id
    }
  };

  if (sourceWasActive && sourceZoneId !== targetZoneId) {
    nextComposition.activePlacementByZoneId = {
      ...nextComposition.activePlacementByZoneId,
      [sourceZoneId]: resolveWorkbenchWidgetZone(nextComposition, sourceZoneId)?.activePlacement?.id ?? null
    };
  }

  return nextComposition;
}

export function createWorkbenchWidgetZoneLayoutState(
  composition: WorkbenchWidgetZoneComposition,
  zoneId: string
): WorkbenchWidgetZoneLayoutState {
  const zonePlacements = composition.placements
    .filter((placement) => placement.zoneId === zoneId)
    .sort(compareWorkbenchWidgetPlacements);
  const zone = composition.zones.find((candidate) => candidate.id === zoneId);
  const resolvedZone = resolveWorkbenchWidgetZone(composition, zoneId);

  return {
    activePlacementId: resolvedZone?.activePlacement?.id ?? null,
    placementOrder: zonePlacements.map((placement) => placement.id),
    hiddenPlacementIds: zonePlacements
      .filter((placement) => placement.isVisible === false)
      .map((placement) => placement.id),
    pinnedPlacementIds: zonePlacements
      .filter((placement) => placement.isPinned === true)
      .map((placement) => placement.id),
    presentation: zone?.presentation,
    axis: zone?.axis
  };
}

export function applyWorkbenchWidgetZoneLayoutState(
  composition: WorkbenchWidgetZoneComposition,
  layoutStateByZoneId: WorkbenchWidgetZoneLayoutStateByZoneId
): WorkbenchWidgetZoneComposition {
  const nextZones = composition.zones.map((zone) => {
    const layoutState = layoutStateByZoneId[zone.id];

    if (!layoutState) {
      return zone;
    }

    return {
      ...zone,
      ...(layoutState.presentation ? { presentation: layoutState.presentation } : {}),
      ...(layoutState.axis ? { axis: layoutState.axis } : {})
    };
  });
  const nextPlacements = composition.placements.map((placement) => {
    const layoutState = layoutStateByZoneId[placement.zoneId];

    if (!layoutState) {
      return placement;
    }

    const nextPlacement: WorkbenchWidgetPlacement = { ...placement };
    const orderIndex = layoutState.placementOrder?.indexOf(placement.id) ?? -1;

    if (orderIndex >= 0) {
      nextPlacement.order = orderIndex * 10;
    }

    if (layoutState.hiddenPlacementIds) {
      nextPlacement.isVisible = !layoutState.hiddenPlacementIds.includes(placement.id);
    }

    if (layoutState.pinnedPlacementIds) {
      nextPlacement.isPinned = layoutState.pinnedPlacementIds.includes(placement.id);
    }

    return nextPlacement;
  });
  let nextComposition: WorkbenchWidgetZoneComposition = {
    ...composition,
    zones: nextZones,
    placements: nextPlacements,
    activePlacementByZoneId: {
      ...composition.activePlacementByZoneId
    }
  };

  for (const [zoneId, layoutState] of Object.entries(layoutStateByZoneId)) {
    if (!layoutState) {
      continue;
    }

    const activePlacementId = layoutState.activePlacementId ?? null;
    const activePlacement = activePlacementId
      ? listWorkbenchWidgetZonePlacements(nextComposition, zoneId).find((placement) => placement.id === activePlacementId)
      : null;
    const resolvedZone = resolveWorkbenchWidgetZone({
      ...nextComposition,
      activePlacementByZoneId: {
        ...nextComposition.activePlacementByZoneId,
        [zoneId]: activePlacement?.id ?? null
      }
    }, zoneId);

    nextComposition = {
      ...nextComposition,
      activePlacementByZoneId: {
        ...nextComposition.activePlacementByZoneId,
        [zoneId]: activePlacement?.id ?? resolvedZone?.activePlacement?.id ?? null
      }
    };
  }

  return nextComposition;
}

export function createWorkbenchWidgetZoneComposition(input: {
  zone: WorkbenchWidgetZoneDefinition;
  placements: WorkbenchWidgetPlacement[];
  activePlacementId?: string | null;
}): WorkbenchWidgetZoneComposition {
  const placements = input.placements.map((placement) => ({
    ...placement,
    zoneId: input.zone.id,
    isVisible: placement.isVisible ?? true
  }));
  const visiblePlacementIds = new Set(placements.filter((placement) => placement.isVisible !== false).map((placement) => placement.id));
  const activePlacementId = input.activePlacementId && visiblePlacementIds.has(input.activePlacementId)
    ? input.activePlacementId
    : placements.find((placement) => placement.isPinned && placement.isVisible !== false)?.id ??
      placements.find((placement) => placement.isVisible !== false)?.id ??
      null;

  return {
    zones: [input.zone],
    placements,
    activePlacementByZoneId: {
      [input.zone.id]: activePlacementId
    }
  };
}

export function createSingleWorkbenchWidgetZoneComposition(input: {
  zone: WorkbenchWidgetZoneDefinition;
  placement: WorkbenchWidgetPlacement;
}): WorkbenchWidgetZoneComposition {
  return createWorkbenchWidgetZoneComposition({
    zone: input.zone,
    placements: [input.placement],
    activePlacementId: input.placement.id
  });
}

function insertWorkbenchWidgetPlacement(
  placements: WorkbenchWidgetPlacement[],
  movingPlacement: WorkbenchWidgetPlacement,
  placement: Pick<WorkbenchWidgetPlacementMove, 'beforePlacementId' | 'afterPlacementId'>
): WorkbenchWidgetPlacement[] {
  const beforeIndex = placement.beforePlacementId
    ? placements.findIndex((candidate) => candidate.id === placement.beforePlacementId)
    : -1;

  if (beforeIndex >= 0) {
    return [
      ...placements.slice(0, beforeIndex),
      movingPlacement,
      ...placements.slice(beforeIndex)
    ];
  }

  const afterIndex = placement.afterPlacementId
    ? placements.findIndex((candidate) => candidate.id === placement.afterPlacementId)
    : -1;

  if (afterIndex >= 0) {
    return [
      ...placements.slice(0, afterIndex + 1),
      movingPlacement,
      ...placements.slice(afterIndex + 1)
    ];
  }

  return [...placements, movingPlacement];
}

function createWorkbenchWidgetPlacementOrderMap(placements: readonly WorkbenchWidgetPlacement[]): Map<string, number> {
  return new Map(placements.map((placement, index) => [placement.id, index * 10]));
}
