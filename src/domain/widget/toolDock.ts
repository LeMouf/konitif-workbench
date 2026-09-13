import type { ShellRegionId, ShellRegionPresentation } from '../shell/model';
import type { JsonObject } from '../shared/json';

export type WorkbenchToolDockActionSide = 'top' | 'right' | 'bottom' | 'left';

export interface WorkbenchToolDockVisibilityConfig {
  dockId: string;
  legacyVisibleKey?: string | null;
  defaultVisible?: boolean;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
