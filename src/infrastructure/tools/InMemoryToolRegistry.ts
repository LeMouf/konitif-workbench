import type { ToolCatalogPort, ToolDefinition } from '../../domain/tool/model';

export type RegisteredToolComponent = unknown;
export type RegisteredToolComponentModule = {
  default: RegisteredToolComponent;
};
export type RegisteredToolComponentLoader = () => Promise<
  RegisteredToolComponent | RegisteredToolComponentModule
>;

export interface RegisteredTool {
  definition: ToolDefinition;
  component?: RegisteredToolComponent;
  loadComponent?: RegisteredToolComponentLoader;
  configComponent?: RegisteredToolComponent;
  loadConfigComponent?: RegisteredToolComponentLoader;
}

export type ToolRegistryDuplicateResolutionPolicy = 'first-registration-wins';

export interface ToolRegistryEntryMetadata {
  id: string;
  title: string;
  panelTitle: string;
  description: string;
  componentMode: 'component' | 'loader' | 'component-and-loader';
}

export interface ToolRegistryDuplicateDiagnostic {
  kind: 'duplicate-id';
  registryKind: 'tool';
  duplicateId: string;
  existing: ToolRegistryEntryMetadata;
  incoming: ToolRegistryEntryMetadata;
  existingRegistrationOrder: number;
  incomingRegistrationOrder: number;
  resolutionPolicy: ToolRegistryDuplicateResolutionPolicy;
}

export class InMemoryToolRegistry implements ToolCatalogPort {
  private readonly entries = new Map<string, RegisteredTool>();
  private readonly registrationOrders = new Map<string, number>();
  private readonly duplicateDiagnostics: ToolRegistryDuplicateDiagnostic[] = [];
  private nextRegistrationOrder = 0;
  private revision = 0;
  private readonly revisionListeners = new Set<(revision: number) => void>();

  /** Observe admitted registrations, not duplicate diagnostics or direct object mutations. */
  subscribeRevision(listener: (revision: number) => void): () => void {
    const subscriber = (revision: number) => listener(revision);
    this.revisionListeners.add(subscriber);
    try {
      subscriber(this.revision);
    } catch (error) {
      this.revisionListeners.delete(subscriber);
      throw error;
    }
    return () => { this.revisionListeners.delete(subscriber); };
  }

  register(entry: RegisteredTool): void {
    if (!entry.component && !entry.loadComponent) {
      throw new Error(`Tool "${entry.definition.id}" must register a component or component loader.`);
    }

    const incomingRegistrationOrder = ++this.nextRegistrationOrder;
    const existingEntry = this.entries.get(entry.definition.id);

    if (existingEntry) {
      this.duplicateDiagnostics.push({
        kind: 'duplicate-id',
        registryKind: 'tool',
        duplicateId: entry.definition.id,
        existing: createToolRegistryEntryMetadata(existingEntry),
        incoming: createToolRegistryEntryMetadata(entry),
        existingRegistrationOrder: this.registrationOrders.get(entry.definition.id) ?? 0,
        incomingRegistrationOrder,
        resolutionPolicy: 'first-registration-wins'
      });
      return;
    }

    this.entries.set(entry.definition.id, entry);
    this.registrationOrders.set(entry.definition.id, incomingRegistrationOrder);
    this.revision += 1;
    for (const listener of [...this.revisionListeners]) {
      if (this.revisionListeners.has(listener)) listener(this.revision);
    }
  }

  get(toolId: string): RegisteredTool | undefined {
    return this.entries.get(toolId);
  }

  getDefinition(toolId: string): ToolDefinition | undefined {
    return this.entries.get(toolId)?.definition;
  }

  list(): RegisteredTool[] {
    return [...this.entries.values()];
  }

  listDiagnostics(): ToolRegistryDuplicateDiagnostic[] {
    return this.duplicateDiagnostics.map(cloneToolRegistryDuplicateDiagnostic);
  }
}

function createToolRegistryEntryMetadata(entry: RegisteredTool): ToolRegistryEntryMetadata {
  return {
    id: entry.definition.id,
    title: entry.definition.title,
    panelTitle: entry.definition.panelTitle,
    description: entry.definition.description,
    componentMode: resolveToolComponentMode(entry)
  };
}

function resolveToolComponentMode(entry: RegisteredTool): ToolRegistryEntryMetadata['componentMode'] {
  if (entry.component && entry.loadComponent) {
    return 'component-and-loader';
  }

  return entry.component ? 'component' : 'loader';
}

function cloneToolRegistryDuplicateDiagnostic(
  diagnostic: ToolRegistryDuplicateDiagnostic
): ToolRegistryDuplicateDiagnostic {
  return {
    ...diagnostic,
    existing: { ...diagnostic.existing },
    incoming: { ...diagnostic.incoming }
  };
}
