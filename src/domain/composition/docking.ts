export type DockableEntityKind =
  | 'panel'
  | 'tool-instance'
  | 'shell-widget'
  | 'tool-widget'
  | 'widget-placement';

export type DockContainerKind =
  | 'workspace-panel-stack'
  | 'workspace-split'
  | 'shell-region'
  | 'tool-side'
  | 'widget-zone';

export type DockAxis = 'horizontal' | 'vertical' | 'grid' | 'tabs';

export type DockMode =
  | 'append'
  | 'reorder'
  | 'tab'
  | 'split'
  | 'stack'
  | 'replace';

export type DockPlanRejectionReason =
  | 'invalid-entity'
  | 'invalid-container'
  | 'unsupported-kind'
  | 'unsupported-mode'
  | 'missing-context'
  | 'already-connected';

export interface DockableEntity {
  id: string;
  kind: DockableEntityKind;
  capabilityId?: string | null;
  sourceContainerId?: string | null;
  contextToolIds?: string[];
}

export interface DockContainer {
  id: string;
  kind: DockContainerKind;
  acceptedEntityKinds: DockableEntityKind[];
  axis: DockAxis;
  supportedModes: DockMode[];
  contextToolIds?: string[];
}

export interface DockContainerRuntimeState {
  id: string;
  kind?: DockContainerKind;
  isVisible: boolean;
  activeEntityId: string | null;
  entityIds: string[];
}

export type DockContainerRuntimeStateById = Record<string, DockContainerRuntimeState | undefined>;

export interface DockContext {
  availableToolIds?: Iterable<string>;
  connectedCapabilityIds?: Iterable<string>;
  connectedEntityIds?: Iterable<string>;
}

export interface DockPlacement {
  beforeEntityId?: string | null;
  afterEntityId?: string | null;
}

export interface DockPlan {
  accepted: boolean;
  entityId: string;
  containerId: string;
  mode: DockMode;
  placement: DockPlacement;
  reason?: DockPlanRejectionReason;
}

export interface CreateDockPlanInput {
  entity: DockableEntity;
  container: DockContainer;
  mode: DockMode;
  placement?: DockPlacement | null;
  context?: DockContext;
  allowConnectedCapability?: boolean;
  allowConnectedEntity?: boolean;
}

export function createDockContainerRuntimeState(input: {
  id: string;
  kind?: DockContainerKind;
  isVisible?: boolean;
  entityIds?: string[];
  activeEntityId?: string | null;
}): DockContainerRuntimeState {
  const entityIds = normalizeEntityIds(input.entityIds ?? []);
  const activeEntityId = normalizeActiveEntityId(input.activeEntityId, entityIds);

  return {
    id: input.id.trim(),
    kind: input.kind,
    isVisible: input.isVisible ?? entityIds.length > 0,
    activeEntityId,
    entityIds
  };
}

export function normalizeDockContainerRuntimeState(
  value: unknown,
  fallback: DockContainerRuntimeState
): DockContainerRuntimeState {
  if (!isRecord(value)) {
    return fallback;
  }

  const entityIds = Array.isArray(value.entityIds)
    ? normalizeEntityIds(value.entityIds.filter((entityId): entityId is string => typeof entityId === 'string'))
    : fallback.entityIds;
  const activeEntityId = normalizeActiveEntityId(
    typeof value.activeEntityId === 'string' ? value.activeEntityId : fallback.activeEntityId,
    entityIds
  );

  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id.trim() : fallback.id,
    kind: isDockContainerKind(value.kind) ? value.kind : fallback.kind,
    isVisible: typeof value.isVisible === 'boolean' ? value.isVisible : fallback.isVisible,
    activeEntityId,
    entityIds
  };
}

export function setDockContainerVisible(
  stateById: DockContainerRuntimeStateById,
  containerId: string,
  isVisible: boolean
): DockContainerRuntimeStateById {
  const normalizedContainerId = containerId.trim();
  const state = stateById[normalizedContainerId];

  if (!state || state.isVisible === isVisible) {
    return stateById;
  }

  return {
    ...stateById,
    [normalizedContainerId]: {
      ...state,
      isVisible
    }
  };
}

export function dockEntityInContainerRuntimeState(
  state: DockContainerRuntimeState,
  entityId: string,
  placement: DockPlacement | null | undefined = {}
): DockContainerRuntimeState {
  const entityIds = insertDockableEntityId(state.entityIds, entityId, placement);

  return {
    ...state,
    isVisible: true,
    activeEntityId: entityId.trim() || state.activeEntityId,
    entityIds
  };
}

export function normalizeDockPlacement(placement: DockPlacement | null | undefined): DockPlacement {
  return {
    beforeEntityId: normalizeOptionalId(placement?.beforeEntityId),
    afterEntityId: normalizeOptionalId(placement?.afterEntityId)
  };
}

export function hasDockPlacement(placement: DockPlacement | null | undefined): boolean {
  const normalizedPlacement = normalizeDockPlacement(placement);
  return Boolean(normalizedPlacement.beforeEntityId || normalizedPlacement.afterEntityId);
}

export function insertDockableEntityId(
  entityIds: string[],
  entityId: string,
  placement: DockPlacement | null | undefined = {}
): string[] {
  const normalizedEntityId = entityId.trim();

  if (!normalizedEntityId) {
    return entityIds;
  }

  const baseEntityIds = entityIds.filter((currentEntityId) => currentEntityId !== normalizedEntityId);
  const normalizedPlacement = normalizeDockPlacement(placement);

  if (normalizedPlacement.beforeEntityId) {
    const beforeIndex = baseEntityIds.indexOf(normalizedPlacement.beforeEntityId);

    if (beforeIndex >= 0) {
      return [
        ...baseEntityIds.slice(0, beforeIndex),
        normalizedEntityId,
        ...baseEntityIds.slice(beforeIndex)
      ];
    }
  }

  if (normalizedPlacement.afterEntityId) {
    const afterIndex = baseEntityIds.indexOf(normalizedPlacement.afterEntityId);

    if (afterIndex >= 0) {
      return [
        ...baseEntityIds.slice(0, afterIndex + 1),
        normalizedEntityId,
        ...baseEntityIds.slice(afterIndex + 1)
      ];
    }
  }

  return [...baseEntityIds, normalizedEntityId];
}

export function createDockPlan(input: CreateDockPlanInput): DockPlan {
  const entityId = input.entity.id.trim();
  const containerId = input.container.id.trim();
  const placement = normalizeDockPlacement(input.placement);

  if (!entityId) {
    return rejectDockPlan(entityId, containerId, input.mode, placement, 'invalid-entity');
  }

  if (!containerId) {
    return rejectDockPlan(entityId, containerId, input.mode, placement, 'invalid-container');
  }

  if (!input.container.acceptedEntityKinds.includes(input.entity.kind)) {
    return rejectDockPlan(entityId, containerId, input.mode, placement, 'unsupported-kind');
  }

  if (!input.container.supportedModes.includes(input.mode)) {
    return rejectDockPlan(entityId, containerId, input.mode, placement, 'unsupported-mode');
  }

  if (!hasRequiredContext(input.entity.contextToolIds, input.context?.availableToolIds)) {
    return rejectDockPlan(entityId, containerId, input.mode, placement, 'missing-context');
  }

  if (!hasRequiredContext(input.container.contextToolIds, input.context?.availableToolIds)) {
    return rejectDockPlan(entityId, containerId, input.mode, placement, 'missing-context');
  }

  const connectedEntityIds = toSet(input.context?.connectedEntityIds);
  const connectedCapabilityIds = toSet(input.context?.connectedCapabilityIds);
  const capabilityId = input.entity.capabilityId?.trim() || null;

  if (!input.allowConnectedEntity && connectedEntityIds.has(entityId)) {
    return rejectDockPlan(entityId, containerId, input.mode, placement, 'already-connected');
  }

  if (!input.allowConnectedCapability && capabilityId && connectedCapabilityIds.has(capabilityId)) {
    return rejectDockPlan(entityId, containerId, input.mode, placement, 'already-connected');
  }

  return {
    accepted: true,
    entityId,
    containerId,
    mode: input.mode,
    placement
  };
}

function rejectDockPlan(
  entityId: string,
  containerId: string,
  mode: DockMode,
  placement: DockPlacement,
  reason: DockPlanRejectionReason
): DockPlan {
  return {
    accepted: false,
    entityId,
    containerId,
    mode,
    placement,
    reason
  };
}

function normalizeOptionalId(value: string | null | undefined): string | null {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : null;
}

function hasRequiredContext(requiredToolIds: string[] | undefined, availableToolIds: Iterable<string> | undefined): boolean {
  const requiredIds = requiredToolIds?.map((toolId) => toolId.trim()).filter(Boolean) ?? [];

  if (requiredIds.length === 0) {
    return true;
  }

  const availableIds = toSet(availableToolIds);
  return requiredIds.some((toolId) => availableIds.has(toolId));
}

function toSet(values: Iterable<string> | undefined): Set<string> {
  const normalizedValues = new Set<string>();

  for (const value of values ?? []) {
    const normalizedValue = value.trim();

    if (normalizedValue) {
      normalizedValues.add(normalizedValue);
    }
  }

  return normalizedValues;
}

function normalizeEntityIds(entityIds: string[]): string[] {
  const normalizedEntityIds: string[] = [];

  for (const entityId of entityIds) {
    const normalizedEntityId = entityId.trim();

    if (normalizedEntityId && !normalizedEntityIds.includes(normalizedEntityId)) {
      normalizedEntityIds.push(normalizedEntityId);
    }
  }

  return normalizedEntityIds;
}

function normalizeActiveEntityId(activeEntityId: string | null | undefined, entityIds: string[]): string | null {
  const normalizedActiveEntityId = activeEntityId?.trim();

  if (normalizedActiveEntityId && entityIds.includes(normalizedActiveEntityId)) {
    return normalizedActiveEntityId;
  }

  return entityIds[0] ?? null;
}

function isDockContainerKind(value: unknown): value is DockContainerKind {
  return (
    value === 'workspace-panel-stack' ||
    value === 'workspace-split' ||
    value === 'shell-region' ||
    value === 'tool-side' ||
    value === 'widget-zone'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
