import type { WorkbenchIconInput } from '../icon/model';

export type ShellRegionId = 'left' | 'right' | 'bottom';

export type ShellRegionPresentation = 'tabs' | 'stack';

export type ShellRegionAxis = 'horizontal' | 'vertical';

export type ShellWidgetScope = 'global' | 'contextual';

export interface ShellRegionState {
  id: ShellRegionId;
  isVisible: boolean;
  isOpen: boolean;
  size: number;
  activeWidgetId: string | null;
  widgetIds: string[];
  hiddenWidgetIds?: string[];
  presentation?: ShellRegionPresentation;
  axis?: ShellRegionAxis;
}

export interface ShellState {
  regions: Record<ShellRegionId, ShellRegionState>;
}

export interface ShellWidgetPlacement {
  beforeWidgetId?: string | null;
  afterWidgetId?: string | null;
}

export interface ShellWidgetDefinition {
  id: string;
  capabilityId?: string | null;
  title: string;
  icon?: WorkbenchIconInput;
  description: string;
  defaultRegion: ShellRegionId;
  scope: ShellWidgetScope;
  contextToolIds?: string[];
  hidePanelHeader?: boolean;
  initiallyConnected?: boolean;
}

export interface ShellWidgetCatalogPort {
  getDefinition(widgetId: string): ShellWidgetDefinition | undefined;
  list?(): ShellWidgetDefinition[];
}

export type ShellWidgetCatalog = ShellWidgetCatalogPort;
