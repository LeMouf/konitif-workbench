import type { WorkbenchRuntimeProjectionSessionPatch } from '../../domain/runtime/model';
import type { JsonObject } from '../../domain/shared/json';
import type {
  ToolSurfaceViewerCatalogPort,
  ToolSurfaceViewerCompatibilityInput,
  ToolSurfaceViewerDefinition
} from '../../domain/surface/model';
import type { ToolInstance } from '../../domain/tool/model';

export type RegisteredSurfaceViewerComponent = unknown;
export type RegisteredSurfaceViewerComponentModule = {
  default: RegisteredSurfaceViewerComponent;
};
export type RegisteredSurfaceViewerComponentLoader = () => Promise<
  RegisteredSurfaceViewerComponent | RegisteredSurfaceViewerComponentModule
>;
export interface RegisteredSurfaceViewerSessionAdapterInput {
  toolInstanceId: string;
  toolInstance: ToolInstance;
  viewer: ToolSurfaceViewerDefinition;
  patch: WorkbenchRuntimeProjectionSessionPatch & { toolInstanceId?: string | null };
}
export type RegisteredSurfaceViewerSessionAdapter = (
  input: RegisteredSurfaceViewerSessionAdapterInput
) => JsonObject | null;

export interface RegisteredSurfaceViewer {
  definition: ToolSurfaceViewerDefinition;
  component?: RegisteredSurfaceViewerComponent;
  loadComponent?: RegisteredSurfaceViewerComponentLoader;
  applyRuntimeProjectionSession?: RegisteredSurfaceViewerSessionAdapter;
}

export type SurfaceViewerRegistryDuplicateResolutionPolicy = 'first-registration-wins';

export interface SurfaceViewerRegistryEntryMetadata {
  id: string;
  title: string;
  version: string;
  summary: string;
  surfaceKinds: string[];
  projectionKinds: string[];
  componentMode: 'component' | 'loader' | 'component-and-loader';
}

export interface SurfaceViewerRegistryDuplicateDiagnostic {
  kind: 'duplicate-id';
  registryKind: 'surface-viewer';
  duplicateId: string;
  existing: SurfaceViewerRegistryEntryMetadata;
  incoming: SurfaceViewerRegistryEntryMetadata;
  existingRegistrationOrder: number;
  incomingRegistrationOrder: number;
  resolutionPolicy: SurfaceViewerRegistryDuplicateResolutionPolicy;
}

export class InMemorySurfaceViewerRegistry implements ToolSurfaceViewerCatalogPort {
  private readonly entries = new Map<string, RegisteredSurfaceViewer>();
  private readonly registrationOrders = new Map<string, number>();
  private readonly duplicateDiagnostics: SurfaceViewerRegistryDuplicateDiagnostic[] = [];
  private nextRegistrationOrder = 0;

  register(entry: RegisteredSurfaceViewer): void {
    if (!entry.component && !entry.loadComponent) {
      throw new Error(
        `Surface viewer "${entry.definition.id}" must register a component or component loader.`
      );
    }

    const incomingRegistrationOrder = ++this.nextRegistrationOrder;
    const existingEntry = this.entries.get(entry.definition.id);

    if (existingEntry) {
      this.duplicateDiagnostics.push({
        kind: 'duplicate-id',
        registryKind: 'surface-viewer',
        duplicateId: entry.definition.id,
        existing: createSurfaceViewerRegistryEntryMetadata(existingEntry),
        incoming: createSurfaceViewerRegistryEntryMetadata(entry),
        existingRegistrationOrder: this.registrationOrders.get(entry.definition.id) ?? 0,
        incomingRegistrationOrder,
        resolutionPolicy: 'first-registration-wins'
      });
      return;
    }

    this.entries.set(entry.definition.id, cloneRegisteredSurfaceViewer(entry));
    this.registrationOrders.set(entry.definition.id, incomingRegistrationOrder);
  }

  get(viewerId: string): RegisteredSurfaceViewer | undefined {
    const entry = this.entries.get(viewerId);
    return entry ? cloneRegisteredSurfaceViewer(entry) : undefined;
  }

  getDefinition(viewerId: string): ToolSurfaceViewerDefinition | undefined {
    const entry = this.entries.get(viewerId);
    return entry ? cloneSurfaceViewerDefinition(entry.definition) : undefined;
  }

  list(): ToolSurfaceViewerDefinition[] {
    return [...this.entries.values()]
      .map((entry) => cloneSurfaceViewerDefinition(entry.definition))
      .sort(compareSurfaceViewers);
  }

  listRegistered(): RegisteredSurfaceViewer[] {
    return [...this.entries.values()]
      .map((entry) => cloneRegisteredSurfaceViewer(entry))
      .sort((left, right) => compareSurfaceViewers(left.definition, right.definition));
  }

  listCompatible(input: ToolSurfaceViewerCompatibilityInput): ToolSurfaceViewerDefinition[] {
    return this.listRegisteredCompatible(input).map((entry) =>
      cloneSurfaceViewerDefinition(entry.definition)
    );
  }

  listRegisteredCompatible(input: ToolSurfaceViewerCompatibilityInput): RegisteredSurfaceViewer[] {
    return [...this.entries.values()]
      .filter((entry) => isCompatibleSurfaceViewer(entry.definition, input))
      .map((entry) => cloneRegisteredSurfaceViewer(entry))
      .sort((left, right) => compareSurfaceViewers(left.definition, right.definition));
  }

  listDiagnostics(): SurfaceViewerRegistryDuplicateDiagnostic[] {
    return this.duplicateDiagnostics.map(cloneSurfaceViewerRegistryDuplicateDiagnostic);
  }
}

function createSurfaceViewerRegistryEntryMetadata(
  entry: RegisteredSurfaceViewer
): SurfaceViewerRegistryEntryMetadata {
  return {
    id: entry.definition.id,
    title: entry.definition.title,
    version: entry.definition.version,
    summary: entry.definition.summary,
    surfaceKinds: [...entry.definition.surfaceKinds],
    projectionKinds: [...entry.definition.projectionKinds],
    componentMode: resolveSurfaceViewerComponentMode(entry)
  };
}

function resolveSurfaceViewerComponentMode(
  entry: RegisteredSurfaceViewer
): SurfaceViewerRegistryEntryMetadata['componentMode'] {
  if (entry.component && entry.loadComponent) {
    return 'component-and-loader';
  }

  return entry.component ? 'component' : 'loader';
}

function cloneSurfaceViewerRegistryDuplicateDiagnostic(
  diagnostic: SurfaceViewerRegistryDuplicateDiagnostic
): SurfaceViewerRegistryDuplicateDiagnostic {
  return {
    ...diagnostic,
    existing: {
      ...diagnostic.existing,
      surfaceKinds: [...diagnostic.existing.surfaceKinds],
      projectionKinds: [...diagnostic.existing.projectionKinds]
    },
    incoming: {
      ...diagnostic.incoming,
      surfaceKinds: [...diagnostic.incoming.surfaceKinds],
      projectionKinds: [...diagnostic.incoming.projectionKinds]
    }
  };
}

function isCompatibleSurfaceViewer(
  definition: ToolSurfaceViewerDefinition,
  input: ToolSurfaceViewerCompatibilityInput
): boolean {
  const requiredCapabilities = input.requiredCapabilities ?? [];

  return (
    definition.surfaceKinds.includes(input.surfaceKind) &&
    definition.projectionKinds.includes(input.projectionKind) &&
    requiredCapabilities.every((capability) => definition.capabilities.includes(capability))
  );
}

function compareSurfaceViewers(
  left: ToolSurfaceViewerDefinition,
  right: ToolSurfaceViewerDefinition
): number {
  const priorityDelta = (right.priority ?? 0) - (left.priority ?? 0);

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const titleDelta = left.title.localeCompare(right.title);

  if (titleDelta !== 0) {
    return titleDelta;
  }

  return left.id.localeCompare(right.id);
}

function cloneRegisteredSurfaceViewer(entry: RegisteredSurfaceViewer): RegisteredSurfaceViewer {
  return {
    ...entry,
    definition: cloneSurfaceViewerDefinition(entry.definition)
  };
}

function cloneSurfaceViewerDefinition(
  definition: ToolSurfaceViewerDefinition
): ToolSurfaceViewerDefinition {
  return {
    ...definition,
    surfaceKinds: [...definition.surfaceKinds],
    projectionKinds: [...definition.projectionKinds],
    capabilities: [...definition.capabilities]
  };
}
