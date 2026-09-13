import type { ShellWidgetCatalogPort, ShellWidgetDefinition, ShellRegionId } from '../../domain/shell/model';

export type RegisteredShellWidgetComponent = unknown;
export type RegisteredShellWidgetComponentModule = {
  default: RegisteredShellWidgetComponent;
};
export type RegisteredShellWidgetComponentLoader = () => Promise<
  RegisteredShellWidgetComponent | RegisteredShellWidgetComponentModule
>;

export interface RegisteredShellWidget {
  definition: ShellWidgetDefinition;
  component?: RegisteredShellWidgetComponent;
  loadComponent?: RegisteredShellWidgetComponentLoader;
}

export type ShellWidgetRegistryDuplicateResolutionPolicy = 'first-registration-wins';

export interface ShellWidgetRegistryEntryMetadata {
  id: string;
  title: string;
  description: string;
  defaultRegion: ShellRegionId;
  scope: ShellWidgetDefinition['scope'];
  componentMode: 'component' | 'loader' | 'component-and-loader';
}

export interface ShellWidgetRegistryDuplicateDiagnostic {
  kind: 'duplicate-id';
  registryKind: 'shell-widget';
  duplicateId: string;
  existing: ShellWidgetRegistryEntryMetadata;
  incoming: ShellWidgetRegistryEntryMetadata;
  existingRegistrationOrder: number;
  incomingRegistrationOrder: number;
  resolutionPolicy: ShellWidgetRegistryDuplicateResolutionPolicy;
}

export class InMemoryShellWidgetRegistry implements ShellWidgetCatalogPort {
  private readonly entries = new Map<string, RegisteredShellWidget>();
  private readonly registrationOrders = new Map<string, number>();
  private readonly duplicateDiagnostics: ShellWidgetRegistryDuplicateDiagnostic[] = [];
  private nextRegistrationOrder = 0;

  register(entry: RegisteredShellWidget): void {
    if (!entry.component && !entry.loadComponent) {
      throw new Error(`Shell widget "${entry.definition.id}" must register a component or component loader.`);
    }

    const incomingRegistrationOrder = ++this.nextRegistrationOrder;
    const existingEntry = this.entries.get(entry.definition.id);

    if (existingEntry) {
      this.duplicateDiagnostics.push({
        kind: 'duplicate-id',
        registryKind: 'shell-widget',
        duplicateId: entry.definition.id,
        existing: createShellWidgetRegistryEntryMetadata(existingEntry),
        incoming: createShellWidgetRegistryEntryMetadata(entry),
        existingRegistrationOrder: this.registrationOrders.get(entry.definition.id) ?? 0,
        incomingRegistrationOrder,
        resolutionPolicy: 'first-registration-wins'
      });
      return;
    }

    this.entries.set(entry.definition.id, entry);
    this.registrationOrders.set(entry.definition.id, incomingRegistrationOrder);
  }

  get(widgetId: string): RegisteredShellWidget | undefined {
    return this.entries.get(widgetId);
  }

  getDefinition(widgetId: string): ShellWidgetDefinition | undefined {
    return this.entries.get(widgetId)?.definition;
  }

  list(): ShellWidgetDefinition[] {
    return [...this.entries.values()].map((entry) => entry.definition);
  }

  listByRegion(regionId: ShellRegionId): RegisteredShellWidget[] {
    return [...this.entries.values()].filter((entry) => entry.definition.defaultRegion === regionId);
  }

  listDiagnostics(): ShellWidgetRegistryDuplicateDiagnostic[] {
    return this.duplicateDiagnostics.map(cloneShellWidgetRegistryDuplicateDiagnostic);
  }
}

function createShellWidgetRegistryEntryMetadata(
  entry: RegisteredShellWidget
): ShellWidgetRegistryEntryMetadata {
  return {
    id: entry.definition.id,
    title: entry.definition.title,
    description: entry.definition.description,
    defaultRegion: entry.definition.defaultRegion,
    scope: entry.definition.scope,
    componentMode: resolveShellWidgetComponentMode(entry)
  };
}

function resolveShellWidgetComponentMode(
  entry: RegisteredShellWidget
): ShellWidgetRegistryEntryMetadata['componentMode'] {
  if (entry.component && entry.loadComponent) {
    return 'component-and-loader';
  }

  return entry.component ? 'component' : 'loader';
}

function cloneShellWidgetRegistryDuplicateDiagnostic(
  diagnostic: ShellWidgetRegistryDuplicateDiagnostic
): ShellWidgetRegistryDuplicateDiagnostic {
  return {
    ...diagnostic,
    existing: { ...diagnostic.existing },
    incoming: { ...diagnostic.incoming }
  };
}
