import type {
  WorkbenchWidgetCatalogPort,
  WorkbenchWidgetDefinition
} from '../../domain/widget/model';
import type { WorkbenchWidgetZoneSurface } from '../../domain/widget/composition';

export type RegisteredWorkbenchWidgetComponent = unknown;
export type RegisteredWorkbenchWidgetComponentModule = {
  default: RegisteredWorkbenchWidgetComponent;
};
export type RegisteredWorkbenchWidgetComponentLoader = () => Promise<
  RegisteredWorkbenchWidgetComponent | RegisteredWorkbenchWidgetComponentModule
>;

export interface RegisteredWorkbenchWidget {
  definition: WorkbenchWidgetDefinition;
  component?: RegisteredWorkbenchWidgetComponent;
  loadComponent?: RegisteredWorkbenchWidgetComponentLoader;
}

export class InMemoryWorkbenchWidgetRegistry implements WorkbenchWidgetCatalogPort {
  private readonly entries = new Map<string, RegisteredWorkbenchWidget>();

  register(entry: RegisteredWorkbenchWidget): void {
    if (!entry.component && !entry.loadComponent) {
      throw new Error(`Workbench widget "${entry.definition.id}" must register a component or component loader.`);
    }

    this.entries.set(entry.definition.id, {
      ...entry,
      definition: cloneWorkbenchWidgetDefinition(entry.definition)
    });
  }

  get(widgetId: string): RegisteredWorkbenchWidget | undefined {
    return this.entries.get(widgetId);
  }

  getDefinition(widgetId: string): WorkbenchWidgetDefinition | undefined {
    const definition = this.entries.get(widgetId)?.definition;

    return definition ? cloneWorkbenchWidgetDefinition(definition) : undefined;
  }

  list(): WorkbenchWidgetDefinition[] {
    return [...this.entries.values()].map((entry) => cloneWorkbenchWidgetDefinition(entry.definition));
  }

  listBySurface(surface: WorkbenchWidgetZoneSurface): RegisteredWorkbenchWidget[] {
    return [...this.entries.values()]
      .filter((entry) => {
        const supportedSurfaces = entry.definition.supportedSurfaces;
        return !supportedSurfaces?.length || supportedSurfaces.includes(surface);
      });
  }
}

function cloneWorkbenchWidgetDefinition(definition: WorkbenchWidgetDefinition): WorkbenchWidgetDefinition {
  return {
    ...definition,
    supportedSurfaces: definition.supportedSurfaces ? [...definition.supportedSurfaces] : undefined
  };
}
