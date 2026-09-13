import type {
  ShellState,
  ShellRegionId,
  ShellRegionState,
  ShellRegionAxis,
  ShellRegionPresentation,
  ShellWidgetCatalogPort,
  ShellWidgetPlacement
} from '../../domain/shell/model';
import {
  hasDockPlacement,
  insertDockableEntityId,
  type DockPlacement
} from '../../domain/composition/docking';

export const DEFAULT_SHELL_REGION_SIZES: Record<ShellRegionId, number> = {
  left: 240,
  right: 320,
  bottom: 220
};

export const MIN_SHELL_REGION_SIZES: Record<ShellRegionId, number> = {
  left: 180,
  right: 180,
  bottom: 124
};

export const SHELL_REGION_RESIZE_CLOSE_OFFSET_PX = 32;

export function resolveShellRegionPresentation(region: ShellRegionState): ShellRegionPresentation {
  return region.presentation ?? 'tabs';
}

export function resolveShellRegionAxis(region: ShellRegionState): ShellRegionAxis {
  return region.axis ?? (region.id === 'bottom' ? 'horizontal' : 'vertical');
}

export function isShellRegionWidgetVisible(region: ShellRegionState, widgetId: string): boolean {
  return region.widgetIds.includes(widgetId) && !(region.hiddenWidgetIds ?? []).includes(widgetId);
}

export function listVisibleShellRegionWidgetIds(region: ShellRegionState): string[] {
  const hiddenWidgetIds = new Set(region.hiddenWidgetIds ?? []);
  return region.widgetIds.filter((widgetId) => !hiddenWidgetIds.has(widgetId));
}

export function setShellRegionArrangement(
  shellState: ShellState,
  regionId: ShellRegionId,
  presentation: ShellRegionPresentation,
  axis?: ShellRegionAxis
): ShellState {
  const region = shellState.regions[regionId];

  if (!region) {
    return shellState;
  }

  const nextAxis = axis ?? resolveShellRegionAxis(region);

  if (resolveShellRegionPresentation(region) === presentation && resolveShellRegionAxis(region) === nextAxis) {
    return shellState;
  }

  return updateShellRegion(shellState, regionId, {
    ...region,
    presentation,
    axis: nextAxis
  });
}

export function createShellState(
  widgetCatalog: ShellWidgetCatalogPort,
  options: { openRegionIds?: ShellRegionId[] } = {}
): ShellState {
  return {
    regions: {
      left: createShellRegionState('left', widgetCatalog, options),
      right: createShellRegionState('right', widgetCatalog, options),
      bottom: createShellRegionState('bottom', widgetCatalog, options)
    }
  };
}

export function setShellRegionVisible(shellState: ShellState, regionId: ShellRegionId, isVisible: boolean): ShellState {
  const region = shellState.regions[regionId];

  if (!region || region.isVisible === isVisible) {
    return shellState;
  }

  return updateShellRegion(shellState, regionId, {
    ...region,
    isVisible
  });
}

export function setShellRegionOpen(shellState: ShellState, regionId: ShellRegionId, isOpen: boolean): ShellState {
  const region = shellState.regions[regionId];

  if (!region || region.isOpen === isOpen) {
    return shellState;
  }

  return updateShellRegion(shellState, regionId, {
    ...region,
    isOpen
  });
}

export function toggleShellRegionOpen(shellState: ShellState, regionId: ShellRegionId): ShellState {
  const region = shellState.regions[regionId];
  return region ? setShellRegionOpen(shellState, regionId, !region.isOpen) : shellState;
}

export function setShellRegionSize(shellState: ShellState, regionId: ShellRegionId, size: number): ShellState {
  const region = shellState.regions[regionId];

  if (!region || !Number.isFinite(size)) {
    return shellState;
  }

  const normalizedSize = Math.max(MIN_SHELL_REGION_SIZES[regionId], Math.round(size));

  if (region.size === normalizedSize) {
    return shellState;
  }

  return updateShellRegion(shellState, regionId, {
    ...region,
    size: normalizedSize
  });
}

export function shouldCloseShellRegionFromResize(regionId: ShellRegionId, requestedSize: number): boolean {
  if (!Number.isFinite(requestedSize)) {
    return false;
  }

  return Math.round(requestedSize) <= MIN_SHELL_REGION_SIZES[regionId] - SHELL_REGION_RESIZE_CLOSE_OFFSET_PX;
}

export function activateShellWidget(shellState: ShellState, regionId: ShellRegionId, widgetId: string): ShellState {
  const region = shellState.regions[regionId];

  if (!region || !region.widgetIds.includes(widgetId)) {
    return shellState;
  }

  if (
    region.activeWidgetId === widgetId &&
    region.isVisible &&
    region.isOpen &&
    isShellRegionWidgetVisible(region, widgetId)
  ) {
    return shellState;
  }

  return updateShellRegion(shellState, regionId, {
    ...region,
    isVisible: true,
    isOpen: true,
    activeWidgetId: widgetId,
    hiddenWidgetIds: (region.hiddenWidgetIds ?? []).filter((hiddenWidgetId) => hiddenWidgetId !== widgetId)
  });
}

export function setShellRegionWidgetVisible(
  shellState: ShellState,
  regionId: ShellRegionId,
  widgetId: string,
  isVisible: boolean
): ShellState {
  const region = shellState.regions[regionId];

  if (!region || !region.widgetIds.includes(widgetId)) {
    return shellState;
  }

  const currentlyVisible = isShellRegionWidgetVisible(region, widgetId);

  if (currentlyVisible === isVisible) {
    return isVisible && (!region.isVisible || !region.isOpen || region.activeWidgetId !== widgetId)
      ? activateShellWidget(shellState, regionId, widgetId)
      : shellState;
  }

  const hiddenWidgetIds = isVisible
    ? (region.hiddenWidgetIds ?? []).filter((hiddenWidgetId) => hiddenWidgetId !== widgetId)
    : [...new Set([...(region.hiddenWidgetIds ?? []), widgetId])];
  const visibleWidgetIds = region.widgetIds.filter((candidateId) => !hiddenWidgetIds.includes(candidateId));
  const activeWidgetId = visibleWidgetIds.includes(region.activeWidgetId ?? '')
    ? region.activeWidgetId
    : visibleWidgetIds[0] ?? null;

  return updateShellRegion(shellState, regionId, {
    ...region,
    isVisible: visibleWidgetIds.length > 0 ? (isVisible ? true : region.isVisible) : false,
    isOpen: visibleWidgetIds.length > 0 ? (isVisible ? true : region.isOpen) : false,
    activeWidgetId: isVisible ? widgetId : activeWidgetId,
    hiddenWidgetIds
  });
}

export function addShellWidgetToRegion(
  shellState: ShellState,
  regionId: ShellRegionId,
  widgetId: string,
  placement: ShellWidgetPlacement = {}
): ShellState {
  const region = shellState.regions[regionId];
  const normalizedWidgetId = widgetId.trim();

  if (!region || !normalizedWidgetId) {
    return shellState;
  }

  if (region.widgetIds.includes(normalizedWidgetId) && !hasShellWidgetPlacement(placement)) {
    return activateShellWidget(shellState, regionId, normalizedWidgetId);
  }

  let nextShellState = shellState;
  const regionIds: ShellRegionId[] = ['left', 'right', 'bottom'];

  for (const currentRegionId of regionIds) {
    const currentRegion = nextShellState.regions[currentRegionId];

    if (currentRegionId === regionId || !currentRegion?.widgetIds.includes(normalizedWidgetId)) {
      continue;
    }

    const widgetIds = currentRegion.widgetIds.filter((currentWidgetId) => currentWidgetId !== normalizedWidgetId);
    const hiddenWidgetIds = (currentRegion.hiddenWidgetIds ?? []).filter(
      (hiddenWidgetId) => hiddenWidgetId !== normalizedWidgetId
    );
    const visibleWidgetIds = widgetIds.filter((widgetId) => !hiddenWidgetIds.includes(widgetId));
    nextShellState = updateShellRegion(nextShellState, currentRegionId, {
      ...currentRegion,
      isVisible: visibleWidgetIds.length > 0 ? currentRegion.isVisible : false,
      isOpen: visibleWidgetIds.length > 0 ? currentRegion.isOpen : false,
      activeWidgetId: visibleWidgetIds.includes(currentRegion.activeWidgetId ?? '')
        ? currentRegion.activeWidgetId
        : visibleWidgetIds[0] ?? null,
      widgetIds,
      hiddenWidgetIds
    });
  }

  const nextRegion = nextShellState.regions[regionId];
  const widgetIds = insertShellWidgetId(nextRegion.widgetIds, normalizedWidgetId, placement);

  return updateShellRegion(nextShellState, regionId, {
    ...nextRegion,
    isVisible: true,
    isOpen: true,
    activeWidgetId: normalizedWidgetId,
    widgetIds,
    hiddenWidgetIds: (nextRegion.hiddenWidgetIds ?? []).filter(
      (hiddenWidgetId) => hiddenWidgetId !== normalizedWidgetId
    )
  });
}

export function moveShellWidgetToRegion(
  shellState: ShellState,
  targetRegionId: ShellRegionId,
  widgetId: string,
  placement: ShellWidgetPlacement = {}
): ShellState {
  const normalizedWidgetId = widgetId.trim();
  const targetRegion = shellState.regions[targetRegionId];

  if (!targetRegion || !normalizedWidgetId) {
    return shellState;
  }

  let sourceRegionId: ShellRegionId | null = null;
  let nextShellState = shellState;
  const regionIds: ShellRegionId[] = ['left', 'right', 'bottom'];

  for (const regionId of regionIds) {
    const region = nextShellState.regions[regionId];

    if (!region?.widgetIds.includes(normalizedWidgetId)) {
      continue;
    }

    sourceRegionId = regionId;

    if (regionId === targetRegionId) {
      const widgetIds = insertShellWidgetId(region.widgetIds, normalizedWidgetId, placement);

      return updateShellRegion(shellState, targetRegionId, {
        ...region,
        isVisible: true,
        isOpen: true,
        activeWidgetId: normalizedWidgetId,
        widgetIds,
        hiddenWidgetIds: (region.hiddenWidgetIds ?? []).filter(
          (hiddenWidgetId) => hiddenWidgetId !== normalizedWidgetId
        )
      });
    }

    const widgetIds = region.widgetIds.filter((currentWidgetId) => currentWidgetId !== normalizedWidgetId);
    const hiddenWidgetIds = (region.hiddenWidgetIds ?? []).filter(
      (hiddenWidgetId) => hiddenWidgetId !== normalizedWidgetId
    );
    const visibleWidgetIds = widgetIds.filter((widgetId) => !hiddenWidgetIds.includes(widgetId));
    nextShellState = updateShellRegion(nextShellState, regionId, {
      ...region,
      isVisible: visibleWidgetIds.length > 0 ? region.isVisible : false,
      isOpen: visibleWidgetIds.length > 0 ? region.isOpen : false,
      activeWidgetId: visibleWidgetIds.includes(region.activeWidgetId ?? '')
        ? region.activeWidgetId
        : visibleWidgetIds[0] ?? null,
      widgetIds,
      hiddenWidgetIds
    });
  }

  if (!sourceRegionId) {
    return addShellWidgetToRegion(shellState, targetRegionId, normalizedWidgetId, placement);
  }

  const nextTargetRegion = nextShellState.regions[targetRegionId];
  const widgetIds = insertShellWidgetId(nextTargetRegion.widgetIds, normalizedWidgetId, placement);

  return updateShellRegion(nextShellState, targetRegionId, {
    ...nextTargetRegion,
    isVisible: true,
    isOpen: true,
    activeWidgetId: normalizedWidgetId,
    widgetIds,
    hiddenWidgetIds: (nextTargetRegion.hiddenWidgetIds ?? []).filter(
      (hiddenWidgetId) => hiddenWidgetId !== normalizedWidgetId
    )
  });
}

export function removeShellWidgetFromRegion(
  shellState: ShellState,
  regionId: ShellRegionId,
  widgetId: string
): ShellState {
  const region = shellState.regions[regionId];
  const normalizedWidgetId = widgetId.trim();

  if (!region || !normalizedWidgetId || !region.widgetIds.includes(normalizedWidgetId)) {
    return shellState;
  }

  const widgetIds = region.widgetIds.filter((currentWidgetId) => currentWidgetId !== normalizedWidgetId);
  const hiddenWidgetIds = (region.hiddenWidgetIds ?? []).filter(
    (hiddenWidgetId) => hiddenWidgetId !== normalizedWidgetId
  );
  const visibleWidgetIds = widgetIds.filter((candidateId) => !hiddenWidgetIds.includes(candidateId));
  const activeWidgetId = visibleWidgetIds.includes(region.activeWidgetId ?? '')
    ? region.activeWidgetId
    : visibleWidgetIds[0] ?? null;

  return updateShellRegion(shellState, regionId, {
    ...region,
    isVisible: visibleWidgetIds.length > 0 ? region.isVisible : false,
    isOpen: visibleWidgetIds.length > 0 ? region.isOpen : false,
    activeWidgetId,
    widgetIds,
    hiddenWidgetIds
  });
}

function createShellRegionState(
  regionId: ShellRegionId,
  widgetCatalog: ShellWidgetCatalogPort,
  options: { openRegionIds?: ShellRegionId[] } = {}
): ShellRegionState {
  const widgetIds = listShellWidgetsForRegion(widgetCatalog, regionId);
  const shouldOpen = widgetIds.length > 0 && Boolean(options.openRegionIds?.includes(regionId));

  return {
    id: regionId,
    isVisible: shouldOpen,
    isOpen: shouldOpen,
    size: DEFAULT_SHELL_REGION_SIZES[regionId],
    activeWidgetId: widgetIds[0] ?? null,
    widgetIds,
    hiddenWidgetIds: [],
    presentation: 'tabs',
    axis: regionId === 'bottom' ? 'horizontal' : 'vertical'
  };
}

function listShellWidgetsForRegion(widgetCatalog: ShellWidgetCatalogPort, regionId: ShellRegionId): string[] {
  const widgetIds: string[] = [];

  if (!('list' in widgetCatalog) || typeof widgetCatalog.list !== 'function') {
    return widgetIds;
  }

  for (const widget of widgetCatalog.list()) {
    if (widget.defaultRegion === regionId && widget.initiallyConnected !== false) {
      widgetIds.push(widget.id);
    }
  }

  return widgetIds;
}

function isPlaceholderShellWidgetId(widgetId: string): boolean {
  return widgetId.endsWith('.empty');
}

function hasShellWidgetPlacement(placement: ShellWidgetPlacement): boolean {
  return hasDockPlacement(toDockPlacement(placement));
}

function insertShellWidgetId(
  widgetIds: string[],
  widgetId: string,
  placement: ShellWidgetPlacement = {}
): string[] {
  const baseWidgetIds = widgetIds
    .filter((currentWidgetId) => !isPlaceholderShellWidgetId(currentWidgetId))
    .filter((currentWidgetId) => currentWidgetId !== widgetId);
  return insertDockableEntityId(baseWidgetIds, widgetId, toDockPlacement(placement));
}

function toDockPlacement(placement: ShellWidgetPlacement = {}): DockPlacement {
  return {
    beforeEntityId: placement.beforeWidgetId,
    afterEntityId: placement.afterWidgetId
  };
}

function updateShellRegion(shellState: ShellState, regionId: ShellRegionId, nextRegion: ShellRegionState): ShellState {
  return {
    ...shellState,
    regions: {
      ...shellState.regions,
      [regionId]: nextRegion
    }
  };
}
