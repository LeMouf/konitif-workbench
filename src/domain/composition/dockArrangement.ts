import type {
  DockableEntity,
  DockableEntityKind,
  DockAxis,
  DockContainerRuntimeState,
  DockPlacement
} from './docking';

export const DOCK_ARRANGEMENT_SCHEMA_VERSION = 1 as const;

export type DockArrangementPresentation = 'tabs' | 'stack' | 'split';

export interface DockArrangementEntityNode {
  nodeType: 'entity';
  nodeId: string;
  entity: DockableEntity;
}

export interface DockArrangementGroupNode {
  nodeType: 'group';
  nodeId: string;
  presentation: DockArrangementPresentation;
  axis: DockAxis;
  children: DockArrangementNode[];
  activeChildId: string | null;
  sizes?: number[];
}

export type DockArrangementNode = DockArrangementEntityNode | DockArrangementGroupNode;

export interface DockArrangement {
  schemaVersion: typeof DOCK_ARRANGEMENT_SCHEMA_VERSION;
  root: DockArrangementGroupNode;
}

export type DockArrangementIssueCode =
  | 'empty-node-id'
  | 'duplicate-node-id'
  | 'empty-entity-id'
  | 'duplicate-entity'
  | 'invalid-active-child'
  | 'invalid-axis'
  | 'invalid-size-count';

export interface DockArrangementIssue {
  code: DockArrangementIssueCode;
  nodeId: string;
  entityKey?: string;
}

export interface DockArrangementEntityPlacement extends DockPlacement {
  targetGroupId?: string | null;
  activate?: boolean;
}

export function createDockArrangement(input: {
  id: string;
  presentation?: DockArrangementPresentation;
  axis?: DockAxis;
  entities?: DockableEntity[];
  activeEntityId?: string | null;
}): DockArrangement {
  const children = (input.entities ?? [])
    .map(createDockArrangementEntityNode)
    .filter((node): node is DockArrangementEntityNode => node !== null);
  const activeChild = children.find((child) => child.entity.id === input.activeEntityId) ?? children[0] ?? null;

  return {
    schemaVersion: DOCK_ARRANGEMENT_SCHEMA_VERSION,
    root: {
      nodeType: 'group',
      nodeId: normalizeId(input.id) || 'dock-root',
      presentation: input.presentation ?? 'tabs',
      axis: normalizeGroupAxis(input.presentation ?? 'tabs', input.axis),
      children,
      activeChildId: activeChild?.nodeId ?? null
    }
  };
}

export function createDockArrangementEntityNode(entity: DockableEntity): DockArrangementEntityNode | null {
  const normalizedEntity = normalizeDockableEntity(entity);

  if (!normalizedEntity) {
    return null;
  }

  return {
    nodeType: 'entity',
    nodeId: `entity:${getDockableEntityKey(normalizedEntity)}`,
    entity: normalizedEntity
  };
}

export function createDockArrangementGroup(input: {
  id: string;
  presentation: DockArrangementPresentation;
  axis?: DockAxis;
  children?: DockArrangementNode[];
  activeChildId?: string | null;
  sizes?: number[];
}): DockArrangementGroupNode {
  const children = input.children ?? [];

  return {
    nodeType: 'group',
    nodeId: normalizeId(input.id) || 'dock-group',
    presentation: input.presentation,
    axis: normalizeGroupAxis(input.presentation, input.axis),
    children,
    activeChildId: normalizeActiveChildId(input.activeChildId, children),
    ...(input.presentation === 'split' && input.sizes
      ? { sizes: normalizeSizes(input.sizes, children.length) }
      : {})
  };
}

export function getDockableEntityKey(entity: Pick<DockableEntity, 'id' | 'kind'>): string {
  return `${entity.kind}:${normalizeId(entity.id)}`;
}

export function listDockArrangementEntities(arrangement: DockArrangement): DockableEntity[] {
  const entities: DockableEntity[] = [];
  visitDockArrangement(arrangement.root, (node) => {
    if (node.nodeType === 'entity') {
      entities.push(node.entity);
    }
  });
  return entities;
}

export function findDockArrangementGroup(
  arrangement: DockArrangement,
  groupId: string
): DockArrangementGroupNode | null {
  const normalizedGroupId = normalizeId(groupId);
  let match: DockArrangementGroupNode | null = null;

  visitDockArrangement(arrangement.root, (node) => {
    if (!match && node.nodeType === 'group' && node.nodeId === normalizedGroupId) {
      match = node;
    }
  });

  return match;
}

export function upsertDockArrangementEntity(
  arrangement: DockArrangement,
  entity: DockableEntity,
  placement: DockArrangementEntityPlacement = {}
): DockArrangement {
  const entityNode = createDockArrangementEntityNode(entity);

  if (!entityNode) {
    return arrangement;
  }

  const entityKey = getDockableEntityKey(entityNode.entity);
  const withoutEntity = removeEntityNode(arrangement.root, entityKey);
  const targetGroupId = normalizeId(placement.targetGroupId ?? '') || withoutEntity.nodeId;
  const nextRoot = insertEntityNode(withoutEntity, targetGroupId, entityNode, placement);

  if (nextRoot === withoutEntity) {
    return arrangement;
  }

  return {
    ...arrangement,
    root: nextRoot
  };
}

export function removeDockArrangementEntity(
  arrangement: DockArrangement,
  entity: Pick<DockableEntity, 'id' | 'kind'>
): DockArrangement {
  const entityKey = getDockableEntityKey(entity);
  const root = removeEntityNode(arrangement.root, entityKey);

  return root === arrangement.root ? arrangement : { ...arrangement, root };
}

export function setDockArrangementActiveEntity(
  arrangement: DockArrangement,
  entity: Pick<DockableEntity, 'id' | 'kind'>
): DockArrangement {
  const entityKey = getDockableEntityKey(entity);
  const root = activateEntityNode(arrangement.root, entityKey).node;

  return root === arrangement.root ? arrangement : { ...arrangement, root };
}

export function createDockArrangementFromContainerRuntimeState(
  state: DockContainerRuntimeState,
  entityKind: DockableEntityKind,
  presentation: DockArrangementPresentation = 'tabs'
): DockArrangement {
  return createDockArrangement({
    id: state.id,
    presentation,
    axis: presentation === 'tabs' ? 'tabs' : 'vertical',
    entities: state.entityIds.map((id) => ({ id, kind: entityKind })),
    activeEntityId: state.activeEntityId
  });
}

export function projectDockArrangementToContainerRuntimeState(
  arrangement: DockArrangement,
  fallback: Pick<DockContainerRuntimeState, 'id' | 'kind' | 'isVisible'>
): DockContainerRuntimeState {
  const entities = listDockArrangementEntities(arrangement);
  const activeEntity = resolveActiveDockArrangementEntity(arrangement.root);

  return {
    id: fallback.id,
    kind: fallback.kind,
    isVisible: fallback.isVisible,
    activeEntityId: activeEntity?.id ?? entities[0]?.id ?? null,
    entityIds: entities.map((entity) => entity.id)
  };
}

export function validateDockArrangement(arrangement: DockArrangement): DockArrangementIssue[] {
  const issues: DockArrangementIssue[] = [];
  const nodeIds = new Set<string>();
  const entityKeys = new Set<string>();

  visitDockArrangement(arrangement.root, (node) => {
    if (!normalizeId(node.nodeId)) {
      issues.push({ code: 'empty-node-id', nodeId: node.nodeId });
    } else if (nodeIds.has(node.nodeId)) {
      issues.push({ code: 'duplicate-node-id', nodeId: node.nodeId });
    } else {
      nodeIds.add(node.nodeId);
    }

    if (node.nodeType === 'entity') {
      const entityKey = getDockableEntityKey(node.entity);

      if (!normalizeId(node.entity.id)) {
        issues.push({ code: 'empty-entity-id', nodeId: node.nodeId, entityKey });
      } else if (entityKeys.has(entityKey)) {
        issues.push({ code: 'duplicate-entity', nodeId: node.nodeId, entityKey });
      } else {
        entityKeys.add(entityKey);
      }
      return;
    }

    if (node.activeChildId !== null && !node.children.some((child) => child.nodeId === node.activeChildId)) {
      issues.push({ code: 'invalid-active-child', nodeId: node.nodeId });
    }
    if (!isAxisCompatible(node.presentation, node.axis)) {
      issues.push({ code: 'invalid-axis', nodeId: node.nodeId });
    }
    if (node.sizes && node.sizes.length !== node.children.length) {
      issues.push({ code: 'invalid-size-count', nodeId: node.nodeId });
    }
  });

  return issues;
}

function removeEntityNode(group: DockArrangementGroupNode, entityKey: string): DockArrangementGroupNode {
  let changed = false;
  const children = group.children.flatMap((child): DockArrangementNode[] => {
    if (child.nodeType === 'entity') {
      if (getDockableEntityKey(child.entity) === entityKey) {
        changed = true;
        return [];
      }
      return [child];
    }

    const nextChild = removeEntityNode(child, entityKey);
    changed ||= nextChild !== child;
    return [nextChild];
  });

  if (!changed) {
    return group;
  }

  return {
    ...group,
    children,
    activeChildId: normalizeActiveChildId(group.activeChildId, children),
    ...(group.sizes ? { sizes: normalizeSizes(group.sizes, children.length) } : {})
  };
}

function insertEntityNode(
  group: DockArrangementGroupNode,
  targetGroupId: string,
  entityNode: DockArrangementEntityNode,
  placement: DockArrangementEntityPlacement
): DockArrangementGroupNode {
  if (group.nodeId === targetGroupId) {
    const children = insertNode(group.children, entityNode, placement);
    return {
      ...group,
      children,
      activeChildId: placement.activate === false
        ? normalizeActiveChildId(group.activeChildId, children)
        : entityNode.nodeId,
      ...(group.sizes ? { sizes: normalizeSizes(group.sizes, children.length) } : {})
    };
  }

  let changed = false;
  const children = group.children.map((child) => {
    if (child.nodeType === 'entity') {
      return child;
    }

    const nextChild = insertEntityNode(child, targetGroupId, entityNode, placement);
    changed ||= nextChild !== child;
    return nextChild;
  });

  return changed ? { ...group, children } : group;
}

function insertNode(
  children: DockArrangementNode[],
  node: DockArrangementEntityNode,
  placement: DockArrangementEntityPlacement
): DockArrangementNode[] {
  const beforeId = normalizeId(placement.beforeEntityId ?? '');
  const afterId = normalizeId(placement.afterEntityId ?? '');
  const beforeIndex = beforeId ? children.findIndex((child) => matchesEntityId(child, beforeId)) : -1;
  const afterIndex = afterId ? children.findIndex((child) => matchesEntityId(child, afterId)) : -1;

  if (beforeIndex >= 0) {
    return [...children.slice(0, beforeIndex), node, ...children.slice(beforeIndex)];
  }
  if (afterIndex >= 0) {
    return [...children.slice(0, afterIndex + 1), node, ...children.slice(afterIndex + 1)];
  }
  return [...children, node];
}

function activateEntityNode(
  group: DockArrangementGroupNode,
  entityKey: string
): { node: DockArrangementGroupNode; found: boolean } {
  for (const child of group.children) {
    if (child.nodeType === 'entity') {
      if (getDockableEntityKey(child.entity) === entityKey) {
        if (group.activeChildId === child.nodeId) {
          return { node: group, found: true };
        }
        return { node: { ...group, activeChildId: child.nodeId }, found: true };
      }
      continue;
    }

    const result = activateEntityNode(child, entityKey);
    if (result.found) {
      const children = group.children.map((candidate) => candidate === child ? result.node : candidate);
      return {
        node: {
          ...group,
          children,
          activeChildId: child.nodeId
        },
        found: true
      };
    }
  }

  return { node: group, found: false };
}

function resolveActiveDockArrangementEntity(node: DockArrangementNode): DockableEntity | null {
  if (node.nodeType === 'entity') {
    return node.entity;
  }

  const activeChild = node.children.find((child) => child.nodeId === node.activeChildId) ?? node.children[0];
  return activeChild ? resolveActiveDockArrangementEntity(activeChild) : null;
}

function normalizeDockableEntity(entity: DockableEntity): DockableEntity | null {
  const id = normalizeId(entity.id);

  if (!id) {
    return null;
  }

  return {
    ...entity,
    id,
    capabilityId: normalizeOptionalId(entity.capabilityId),
    sourceContainerId: normalizeOptionalId(entity.sourceContainerId),
    contextToolIds: normalizeIds(entity.contextToolIds ?? [])
  };
}

function normalizeActiveChildId(activeChildId: string | null | undefined, children: DockArrangementNode[]): string | null {
  const normalizedId = normalizeId(activeChildId ?? '');
  return children.some((child) => child.nodeId === normalizedId) ? normalizedId : children[0]?.nodeId ?? null;
}

function normalizeSizes(sizes: number[], childCount: number): number[] {
  if (childCount === 0) {
    return [];
  }

  const positiveSizes = Array.from({ length: childCount }, (_, index) => {
    const value = sizes[index];
    return Number.isFinite(value) && value > 0 ? value : 1;
  });
  const total = positiveSizes.reduce((sum, value) => sum + value, 0);
  return positiveSizes.map((value) => value / total);
}

function normalizeGroupAxis(presentation: DockArrangementPresentation, axis: DockAxis | undefined): DockAxis {
  if (presentation === 'tabs') {
    return 'tabs';
  }
  if (axis === 'horizontal' || axis === 'vertical') {
    return axis;
  }
  return 'vertical';
}

function isAxisCompatible(presentation: DockArrangementPresentation, axis: DockAxis): boolean {
  return presentation === 'tabs'
    ? axis === 'tabs'
    : axis === 'horizontal' || axis === 'vertical';
}

function matchesEntityId(node: DockArrangementNode, entityId: string): boolean {
  return node.nodeType === 'entity' && node.entity.id === entityId;
}

function normalizeIds(values: string[]): string[] {
  return [...new Set(values.map(normalizeId).filter(Boolean))];
}

function normalizeOptionalId(value: string | null | undefined): string | null {
  return normalizeId(value ?? '') || null;
}

function normalizeId(value: string): string {
  return value.trim();
}

function visitDockArrangement(node: DockArrangementNode, visitor: (node: DockArrangementNode) => void): void {
  visitor(node);
  if (node.nodeType === 'group') {
    node.children.forEach((child) => visitDockArrangement(child, visitor));
  }
}
