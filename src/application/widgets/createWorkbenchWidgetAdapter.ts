import type { WorkbenchWidgetDefinition } from '../../domain/widget/model';
import type {
  RegisteredWorkbenchWidget,
  RegisteredWorkbenchWidgetComponentLoader
} from '../../infrastructure/widgets/InMemoryWorkbenchWidgetRegistry';
import { bindWidgetImplementation, type WidgetDefinitionCatalog } from '@konitif/widgets';

export type WorkbenchWidgetDefinitionCatalogPort = Pick<WidgetDefinitionCatalog, 'getDefinition'>;

export type WorkbenchWidgetHosting = Pick<WorkbenchWidgetDefinition,
  'icon' | 'supportedSurfaces' | 'presentation'>;

/** Candidate bridge; neither registers nor loads, and owns no placement state. */
export function createWorkbenchWidgetAdapter(
  catalog: WorkbenchWidgetDefinitionCatalogPort,
  widgetId: string,
  load: RegisteredWorkbenchWidgetComponentLoader
) {
  // Widgets currently gives its catalog nominal identity through a private Map,
  // while this bridge only needs the public lookup capability. Keep the
  // cross-version boundary structural and contain the nominal cast here.
  const binding = bindWidgetImplementation(catalog as WidgetDefinitionCatalog, widgetId, load);
  return Object.freeze({
    source: binding.definition,
    project(host: WorkbenchWidgetHosting = {}): RegisteredWorkbenchWidget {
      for (const key of ['id', 'title', 'description']) {
        if (key in host) throw new Error(`Host override of widget ${key} refused`);
      }
      const readingLevel = host.presentation?.readingLevel;
      // This record is a disposable compatibility snapshot, not a second catalog.
      const definition: WorkbenchWidgetDefinition = {
        id: binding.definition.id,
        title: binding.definition.title,
        description: binding.definition.description,
        ...(host.icon === undefined ? {} : { icon: typeof host.icon === 'string' ? host.icon : { ...host.icon } }),
        ...(host.supportedSurfaces === undefined ? {} : { supportedSurfaces: [...host.supportedSurfaces] }),
        ...(host.presentation === undefined ? {} : { presentation: {
          ...(readingLevel === undefined ? {} : { readingLevel: {
            ...readingLevel,
            ...(readingLevel.availableLevels === undefined ? {} : { availableLevels: [...readingLevel.availableLevels] })
          } })
        } })
      };
      return { definition, loadComponent: binding.load };
    }
  });
}
