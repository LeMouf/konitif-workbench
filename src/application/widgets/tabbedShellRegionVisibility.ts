import type { ShellRegionState } from '../../domain/shell/model';

export type TabbedShellRegionVisibilityIntent =
  | { kind: 'widget' }
  | { kind: 'close-group' }
  | { kind: 'open-group'; revealWidgetIds: string[] };

/**
 * Projects a widget visibility request into the coordination required by a
 * tabbed shell region. The host remains responsible for applying the intent.
 */
export function resolveTabbedShellRegionVisibilityIntent(
  region: ShellRegionState,
  widgetId: string,
  isVisible: boolean,
): TabbedShellRegionVisibilityIntent {
  if (
    (region.presentation ?? 'tabs') !== 'tabs'
    || region.widgetIds.length < 2
    || !region.widgetIds.includes(widgetId)
  ) {
    return { kind: 'widget' };
  }

  if (!isVisible) {
    return { kind: 'close-group' };
  }

  return {
    kind: 'open-group',
    revealWidgetIds: region.widgetIds.filter((candidateId) => candidateId !== widgetId),
  };
}
