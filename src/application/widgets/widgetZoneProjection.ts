export type WorkbenchWidgetZoneProjectionReason =
  | 'closed'
  | 'visible-content'
  | 'empty-edit-drop-target'
  | 'empty-runtime';

export interface WorkbenchWidgetZoneProjection {
  visible: boolean;
  acceptsPlacementDrop: boolean;
  reason: WorkbenchWidgetZoneProjectionReason;
}

/**
 * Projects an authored widget-zone state into host-facing visibility and drop
 * affordances without owning either the zone content or its renderer.
 */
export function projectWorkbenchWidgetZone(input: {
  containerOpen: boolean;
  visiblePlacementCount: number;
  layoutEditingEnabled: boolean;
}): WorkbenchWidgetZoneProjection {
  if (!input.containerOpen) {
    return { visible: false, acceptsPlacementDrop: false, reason: 'closed' };
  }

  if (input.visiblePlacementCount > 0) {
    return {
      visible: true,
      acceptsPlacementDrop: input.layoutEditingEnabled,
      reason: 'visible-content'
    };
  }

  if (input.layoutEditingEnabled) {
    return { visible: true, acceptsPlacementDrop: true, reason: 'empty-edit-drop-target' };
  }

  return { visible: false, acceptsPlacementDrop: false, reason: 'empty-runtime' };
}
