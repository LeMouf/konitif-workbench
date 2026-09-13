import type { WorkbenchIconInput } from '../icon/model';
import type { WorkbenchReadingLevel, WorkbenchReadingLevelPresentation } from '../presentation/readingLevel';
import type {
  WorkbenchWidgetPlacement,
  WorkbenchWidgetZoneDefinition,
  WorkbenchWidgetZoneSurface
} from './composition';

export type WorkbenchWidgetContext = Record<string, unknown>;

export interface WorkbenchWidgetDefinition {
  id: string;
  title: string;
  description: string;
  icon?: WorkbenchIconInput;
  supportedSurfaces?: WorkbenchWidgetZoneSurface[];
  presentation?: {
    readingLevel?: WorkbenchReadingLevelPresentation;
  };
}

export interface WorkbenchWidgetCatalogPort {
  getDefinition(widgetId: string): WorkbenchWidgetDefinition | undefined;
  list?(): WorkbenchWidgetDefinition[];
}

export interface WorkbenchWidgetRuntimeContext {
  zone: WorkbenchWidgetZoneDefinition;
  placement: WorkbenchWidgetPlacement;
  context: WorkbenchWidgetContext;
  /** Reading projection resolved by the Widget container, never by its content. */
  readingLevel: WorkbenchReadingLevel;
}

export interface HostedWorkbenchWidgetProps {
  definition: WorkbenchWidgetDefinition;
  runtime: WorkbenchWidgetRuntimeContext;
}

export function createWorkbenchWidgetRuntimeContext(input: {
  zone: WorkbenchWidgetZoneDefinition;
  placement: WorkbenchWidgetPlacement;
  context?: WorkbenchWidgetContext | null;
  readingLevel?: WorkbenchReadingLevel;
}): WorkbenchWidgetRuntimeContext {
  return {
    zone: input.zone,
    placement: input.placement,
    context: input.context ?? {},
    readingLevel: input.readingLevel ?? 'casual'
  };
}
