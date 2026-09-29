import type { ShellRegionId, ShellRegionPresentation, ShellState } from '../shell/model';
import type { JsonObject } from '../shared/json';

export type WorkbenchToolDockActionSide = 'top' | 'right' | 'bottom' | 'left';

export interface WorkbenchToolDockVisibilityConfig {
  dockId: string;
  legacyVisibleKey?: string | null;
  defaultVisible?: boolean;
}

export interface WorkbenchGroupedToolDockConfig extends WorkbenchToolDockVisibilityConfig {
  defaultRegionId: ShellRegionId;
  rootWidgetId?: string | null;
}

export interface WorkbenchToolDockRootConfig extends WorkbenchToolDockVisibilityConfig {
  commandId: string;
  widgetId: string;
  defaultRegionId: ShellRegionId;
}

export interface WorkbenchToolDockRootLocation {
  regionId: ShellRegionId;
  isVisible: boolean;
  isOpen: boolean;
  activeWidgetId: string | null;
  presentation?: ShellRegionPresentation;
  size?: number;
}

export function resolveWorkbenchToolDockSide(
  regionId: ShellRegionId | null | undefined
): WorkbenchToolDockActionSide {
  if (regionId === 'left' || regionId === 'right' || regionId === 'bottom') {
    return regionId;
  }

  return 'left';
}

export function readWorkbenchToolDockVisibility(
  state: unknown,
  config: WorkbenchToolDockVisibilityConfig
): boolean {
  if (!isRecord(state)) {
    return config.defaultVisible ?? false;
  }

  const dockContainers = state.dockContainers;

  if (isRecord(dockContainers)) {
    const dock = dockContainers[config.dockId];

    if (isRecord(dock) && typeof dock.isVisible === 'boolean') {
      return dock.isVisible;
    }
  }

  if (config.legacyVisibleKey && typeof state[config.legacyVisibleKey] === 'boolean') {
    return state[config.legacyVisibleKey] === true;
  }

  return config.defaultVisible ?? false;
}

export function resolveWorkbenchToolDockEffectiveVisibility(input: {
  rootLocation: WorkbenchToolDockRootLocation | null;
  internalVisible: boolean;
  widgetId: string;
}): boolean {
  const location = input.rootLocation;

  if (!location) {
    return input.internalVisible;
  }

  return location.isVisible && location.isOpen && (
    location.presentation === 'stack' || location.activeWidgetId === input.widgetId
  );
}

export function resolveWorkbenchToolDockRootLocation(
  shellState: ShellState,
  widgetId: string
): WorkbenchToolDockRootLocation | null {
  const regionIds: ShellRegionId[] = ['left', 'right', 'bottom'];

  for (const regionId of regionIds) {
    const region = shellState.regions[regionId];

    if (region.widgetIds.includes(widgetId)) {
      return {
        regionId,
        isVisible: region.isVisible && !(region.hiddenWidgetIds ?? []).includes(widgetId),
        isOpen: region.isOpen,
        activeWidgetId: region.activeWidgetId,
        presentation: region.presentation ?? 'tabs',
        size: region.size
      };
    }
  }

  return null;
}

export function patchWorkbenchToolDockVisibilityState(
  state: unknown,
  input: WorkbenchToolDockVisibilityConfig & { isVisible: boolean }
): JsonObject {
  const currentState = isRecord(state) ? state : {};
  const dockContainers = isRecord(currentState.dockContainers) ? currentState.dockContainers : {};
  const currentDock = dockContainers[input.dockId];
  const currentDockState = isRecord(currentDock) ? currentDock : {};
  const nextState: JsonObject = {
    ...(currentState as JsonObject),
    dockContainers: {
      ...(dockContainers as JsonObject),
      [input.dockId]: {
        ...(currentDockState as JsonObject),
        isVisible: input.isVisible
      }
    }
  };

  if (input.legacyVisibleKey) {
    nextState[input.legacyVisibleKey] = input.isVisible;
  }

  return nextState;
}

/**
 * Normalizes the single-dock visibility request emitted by a tabbed tool dock
 * into one atomic state snapshot for every dock sharing the same region.
 * Docks projected into a root shell region remain independently managed.
 */
export function normalizeGroupedWorkbenchToolDockVisibility(
  currentState: JsonObject,
  requestedState: JsonObject,
  docks: readonly WorkbenchGroupedToolDockConfig[],
  individuallyManagedDockIds: ReadonlySet<string> = new Set()
): JsonObject {
  const changedDocks = docks.filter(
    (dock) =>
      readWorkbenchToolDockVisibility(currentState, dock) !==
      readWorkbenchToolDockVisibility(requestedState, dock)
  );

  if (changedDocks.length !== 1) {
    return requestedState;
  }

  const changedDock = changedDocks[0];

  if (individuallyManagedDockIds.has(changedDock.dockId)) {
    return requestedState;
  }

  const groupedDocks = docks.filter(
    (dock) => dock.defaultRegionId === changedDock.defaultRegionId
  );

  if (groupedDocks.length < 2) {
    return requestedState;
  }

  const isVisible = readWorkbenchToolDockVisibility(requestedState, changedDock);

  return groupedDocks.reduce<JsonObject>(
    (state, dock) => patchWorkbenchToolDockVisibilityState(state, {
      ...dock,
      isVisible
    }),
    requestedState
  );
}

export function normalizeGroupedWorkbenchToolDockVisibilityForShellState(
  currentState: JsonObject,
  requestedState: JsonObject,
  docks: readonly WorkbenchGroupedToolDockConfig[],
  shellState: ShellState
): JsonObject {
  const rootManagedDockIds = new Set(
    docks.flatMap((dock) =>
      dock.rootWidgetId && resolveWorkbenchToolDockRootLocation(shellState, dock.rootWidgetId)
        ? [dock.dockId]
        : []
    )
  );

  return normalizeGroupedWorkbenchToolDockVisibility(
    currentState,
    requestedState,
    docks,
    rootManagedDockIds
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
