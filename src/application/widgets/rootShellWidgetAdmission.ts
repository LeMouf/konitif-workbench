import type {
  ShellRegionId,
  ShellState,
  ShellWidgetPlacement
} from '../../domain/shell/model';

export interface RootShellWidgetAdmissionActions {
  moveShellWidgetToRegion(
    regionId: ShellRegionId,
    widgetId: string,
    placement?: ShellWidgetPlacement
  ): void;
  activateShellWidget(regionId: ShellRegionId, widgetId: string): void;
  setShellRegionVisible(regionId: ShellRegionId, isVisible: boolean): void;
  setShellRegionOpen(regionId: ShellRegionId, isOpen: boolean): void;
}

export function isShellWidgetAlreadyPlaced(shell: ShellState, widgetId: string): boolean {
  return Object.values(shell.regions).some((region) => region.widgetIds.includes(widgetId));
}

/**
 * Admits one missing root Widget without allowing the placement operation to
 * overwrite the region state restored from the Workspace.
 */
export function admitShellWidgetPlacementPreservingRegionState(
  shell: ShellState,
  actions: RootShellWidgetAdmissionActions,
  regionId: ShellRegionId,
  widgetId: string,
  placement: ShellWidgetPlacement = {}
): boolean {
  if (isShellWidgetAlreadyPlaced(shell, widgetId)) {
    return false;
  }

  const region = shell.regions[regionId];
  actions.moveShellWidgetToRegion(regionId, widgetId, placement);

  if (region.activeWidgetId) {
    actions.activateShellWidget(regionId, region.activeWidgetId);
  }

  actions.setShellRegionVisible(regionId, region.isVisible);
  actions.setShellRegionOpen(regionId, region.isOpen);
  return true;
}
