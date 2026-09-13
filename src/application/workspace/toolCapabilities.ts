import { isKonitifCapabilityVersionCompatible } from '@konitif/core';
import type {
  ToolDefinition,
  ToolInstance
} from '../../domain/tool/model';
import type {
  ToolRuntimeCapabilityProjection,
  ToolRuntimeCapabilityProvider,
  ToolRuntimeCapabilitySnapshot
} from '../../domain/tool/runtime';
import type { Workspace } from '../../domain/workspace/model';
import { listPanelsInWorkspace } from '../../domain/workspace/selectors';
import type { WorkspaceFocus } from './session';

export interface ResolveToolRuntimeCapabilitySnapshotInput {
  consumerDefinition: ToolDefinition;
  registeredDefinitions: readonly ToolDefinition[];
  workspace: Workspace;
  focus: WorkspaceFocus;
}

export function resolveToolRuntimeCapabilitySnapshot(
  input: ResolveToolRuntimeCapabilitySnapshotInput
): ToolRuntimeCapabilitySnapshot {
  const placementsByToolId = collectToolPlacements(input.workspace);
  const projections = Object.freeze((input.consumerDefinition.capabilities?.consumes ?? []).map((requirement) => {
    const declaredProviders = input.registeredDefinitions.flatMap((definition) =>
      (definition.capabilities?.provides ?? [])
        .filter((provided) => provided.id === requirement.id)
        .map((provided) => ({ definition, provided }))
    );
    const compatibleProviders = declaredProviders.filter(({ provided }) =>
      isKonitifCapabilityVersionCompatible(provided.version, requirement.versionRange)
    );
    const providers = compatibleProviders.map(({ definition, provided }) => {
      const placements = placementsByToolId.get(definition.id) ?? [];
      return Object.freeze({
        toolId: definition.id,
        capabilityVersion: provided.version,
        toolVersion: null,
        availability: resolveProviderAvailability(placements, input.focus),
        panelIds: Object.freeze(placements.map((placement) => placement.panelId)),
        toolInstanceIds: Object.freeze(placements.map((placement) => placement.toolInstance.id))
      }) satisfies ToolRuntimeCapabilityProvider;
    });

    return Object.freeze({
      requirement: Object.freeze({ ...requirement }),
      availability:
        providers.some((provider) => provider.availability === 'active')
          ? 'active'
          : providers.some((provider) => provider.availability === 'mounted')
            ? 'mounted'
            : providers.length > 0
              ? 'available'
              : declaredProviders.length > 0
                ? 'incompatible'
                : 'missing',
      providers: Object.freeze(providers)
    }) satisfies ToolRuntimeCapabilityProjection;
  }));
  const projectionById = new Map(projections.map((projection) => [projection.requirement.id, projection]));

  return Object.freeze({
    list: () => projections,
    get: (capabilityId: string) => projectionById.get(capabilityId) ?? null
  });
}

function collectToolPlacements(workspace: Workspace): Map<
  string,
  Array<{ panelId: string; toolInstance: ToolInstance }>
> {
  const placements = new Map<string, Array<{ panelId: string; toolInstance: ToolInstance }>>();

  for (const panel of listPanelsInWorkspace(workspace)) {
    const toolInstance = panel.toolInstanceId ? workspace.toolInstances[panel.toolInstanceId] : null;

    if (!toolInstance) {
      continue;
    }

    const entries = placements.get(toolInstance.toolId) ?? [];
    entries.push({ panelId: panel.id, toolInstance });
    placements.set(toolInstance.toolId, entries);
  }

  return placements;
}

function resolveProviderAvailability(
  placements: ReadonlyArray<{ panelId: string; toolInstance: ToolInstance }>,
  focus: WorkspaceFocus
): ToolRuntimeCapabilityProvider['availability'] {
  if (placements.some((placement) => placement.toolInstance.id === focus.activeToolInstanceId)) {
    return 'active';
  }

  return placements.length > 0 ? 'mounted' : 'available';
}
