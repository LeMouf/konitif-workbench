import {
  workspaceCellDeclaration,
  type WorkspaceCellBoundary,
  type WorkspaceCellBoundaryStatus,
  type WorkspaceCellCapability,
  type WorkspaceCellCapabilityClassification,
  type WorkspaceCellCompositionElement,
  type WorkspaceCellHostScope,
  type WorkspaceCellHostSurface,
  type WorkspaceCellIncarnation,
  type WorkspaceCellIncarnationStatus,
  type WorkspaceCellProjection,
  type WorkspaceCellProjectionStatus
} from './workspaceCell';

export type WorkspaceCellGraphNodeKind =
  | 'cell'
  | 'identity'
  | 'capability'
  | 'boundary'
  | 'composition'
  | 'projection'
  | 'incarnation'
  | 'host-surface';

export type WorkspaceCellGraphEdgeVerb =
  | 'declares'
  | 'provides'
  | 'requires'
  | 'guards'
  | 'composes'
  | 'projects'
  | 'incarnates'
  | 'hosts'
  | 'owns';

export interface WorkspaceCellGraphNode {
  id: string;
  label: string;
  kind: WorkspaceCellGraphNodeKind;
  status?: string;
  classification?: string;
}

export interface WorkspaceCellGraphEdge {
  id: string;
  source: string;
  target: string;
  verb: WorkspaceCellGraphEdgeVerb;
  reason: string;
}

export interface WorkspaceCellGraphProjection {
  id: string;
  nodes: WorkspaceCellGraphNode[];
  edges: WorkspaceCellGraphEdge[];
}

export interface WorkspaceCellHostSurfaceComparison {
  expected: string[];
  provided: string[];
  missing: string[];
  extra: string[];
  matching: string[];
}

const capabilityClassifications: readonly WorkspaceCellCapabilityClassification[] = [
  'provided',
  'required',
  'optional',
  'private'
];

const boundaryStatuses: readonly WorkspaceCellBoundaryStatus[] = ['explicit', 'implicit', 'hidden', 'missing'];

const compositionKinds: readonly WorkspaceCellCompositionElement['kind'][] = [
  'workspace',
  'window',
  'layout-tree',
  'split',
  'stack',
  'panel',
  'tool-instance',
  'widget-zone',
  'widget-placement'
];

const projectionStatuses: readonly WorkspaceCellProjectionStatus[] = ['explicit', 'implicit', 'hidden', 'missing'];

const incarnationStatuses: readonly WorkspaceCellIncarnationStatus[] = ['live', 'persisted', 'transient', 'derived'];

const hostSurfaceScopes: readonly WorkspaceCellHostScope[] = ['root', 'panel', 'tool', 'widget', 'observer'];

export function getWorkspaceCellGraphProjection(): WorkspaceCellGraphProjection {
  const cellId = workspaceCellDeclaration.id;
  const identityId = `identity:${workspaceCellDeclaration.identity.id}`;
  const nodes: WorkspaceCellGraphNode[] = [
    {
      id: cellId,
      label: 'Workspace Cell',
      kind: 'cell'
    },
    {
      id: identityId,
      label: workspaceCellDeclaration.identity.label,
      kind: 'identity',
      status: workspaceCellDeclaration.identity.source
    },
    ...workspaceCellDeclaration.capabilities.map((capability) => ({
      id: capability.id,
      label: capability.label,
      kind: 'capability' as const,
      classification: capability.classification
    })),
    ...workspaceCellDeclaration.boundaries.map((boundary) => ({
      id: boundary.id,
      label: boundary.label,
      kind: 'boundary' as const,
      status: boundary.status
    })),
    ...workspaceCellDeclaration.composition.map((element) => ({
      id: element.id,
      label: element.label,
      kind: 'composition' as const,
      status: element.kind
    })),
    ...workspaceCellDeclaration.projections.map((projection) => ({
      id: projection.id,
      label: projection.label,
      kind: 'projection' as const,
      status: projection.status
    })),
    ...workspaceCellDeclaration.incarnation.map((incarnation) => ({
      id: incarnation.id,
      label: incarnation.label,
      kind: 'incarnation' as const,
      status: incarnation.status
    })),
    ...workspaceCellDeclaration.hostSurfaces.map((hostSurface) => ({
      id: hostSurface.id,
      label: hostSurface.label,
      kind: 'host-surface' as const,
      status: hostSurface.hostScope
    }))
  ];

  const edges: WorkspaceCellGraphEdge[] = [
    createGraphEdge({
      source: cellId,
      target: identityId,
      verb: 'declares',
      reason: workspaceCellDeclaration.identity.description
    }),
    ...workspaceCellDeclaration.capabilities.map((capability) =>
      createGraphEdge({
        source: cellId,
        target: capability.id,
        verb: resolveCapabilityVerb(capability),
        reason: capability.description
      })
    ),
    ...workspaceCellDeclaration.boundaries.map((boundary) =>
      createGraphEdge({
        source: boundary.id,
        target: cellId,
        verb: 'guards',
        reason: boundary.description
      })
    ),
    ...workspaceCellDeclaration.composition.map((element) =>
      createGraphEdge({
        source: cellId,
        target: element.id,
        verb: 'composes',
        reason: element.description
      })
    ),
    ...workspaceCellDeclaration.projections.map((projection) =>
      createGraphEdge({
        source: cellId,
        target: projection.id,
        verb: 'projects',
        reason: projection.description
      })
    ),
    ...workspaceCellDeclaration.incarnation.map((incarnation) =>
      createGraphEdge({
        source: cellId,
        target: incarnation.id,
        verb: 'incarnates',
        reason: incarnation.description
      })
    ),
    ...workspaceCellDeclaration.hostSurfaces.map((hostSurface) =>
      createGraphEdge({
        source: cellId,
        target: hostSurface.id,
        verb: 'hosts',
        reason: hostSurface.description
      })
    )
  ];

  return {
    id: `${cellId}.projection.graph`,
    nodes,
    edges
  };
}

export function getWorkspaceCellMermaid(): string {
  const graph = getWorkspaceCellGraphProjection();
  const lines = ['flowchart LR'];

  for (const node of graph.nodes) {
    lines.push(`  ${toMermaidNodeId(node.id)}["${escapeMermaidLabel(`${node.label}\\n${node.id}`)}"]`);
  }

  for (const edge of graph.edges) {
    lines.push(
      `  ${toMermaidNodeId(edge.source)} -- "${escapeMermaidLabel(edge.verb)}" --> ${toMermaidNodeId(edge.target)}`
    );
  }

  return lines.join('\n');
}

export function getWorkspaceCellCapabilitiesByClassification(): Record<
  WorkspaceCellCapabilityClassification,
  WorkspaceCellCapability[]
> {
  return groupBy(workspaceCellDeclaration.capabilities, capabilityClassifications, (capability) => capability.classification);
}

export function getWorkspaceCellBoundariesByStatus(): Record<WorkspaceCellBoundaryStatus, WorkspaceCellBoundary[]> {
  return groupBy(workspaceCellDeclaration.boundaries, boundaryStatuses, (boundary) => boundary.status);
}

export function getWorkspaceCellCompositionByKind(): Record<
  WorkspaceCellCompositionElement['kind'],
  WorkspaceCellCompositionElement[]
> {
  return groupBy(workspaceCellDeclaration.composition, compositionKinds, (element) => element.kind);
}

export function getWorkspaceCellProjectionsByStatus(): Record<WorkspaceCellProjectionStatus, WorkspaceCellProjection[]> {
  return groupBy(workspaceCellDeclaration.projections, projectionStatuses, (projection) => projection.status);
}

export function getWorkspaceCellIncarnationByStatus(): Record<WorkspaceCellIncarnationStatus, WorkspaceCellIncarnation[]> {
  return groupBy(workspaceCellDeclaration.incarnation, incarnationStatuses, (incarnation) => incarnation.status);
}

export function getWorkspaceCellHostSurfacesByScope(): Record<WorkspaceCellHostScope, WorkspaceCellHostSurface[]> {
  return groupBy(workspaceCellDeclaration.hostSurfaces, hostSurfaceScopes, (hostSurface) => hostSurface.hostScope);
}

export function compareWorkspaceCellHostSurfaces(
  hostSurfaceIds: readonly string[]
): WorkspaceCellHostSurfaceComparison {
  const expected = uniqueSortedStrings(workspaceCellDeclaration.hostSurfaces.map((hostSurface) => hostSurface.id));
  const provided = uniqueSortedStrings(hostSurfaceIds);
  const expectedSet = new Set(expected);
  const providedSet = new Set(provided);

  return {
    expected,
    provided,
    missing: expected.filter((hostSurfaceId) => !providedSet.has(hostSurfaceId)),
    extra: provided.filter((hostSurfaceId) => !expectedSet.has(hostSurfaceId)),
    matching: expected.filter((hostSurfaceId) => providedSet.has(hostSurfaceId))
  };
}

function createGraphEdge(edge: Omit<WorkspaceCellGraphEdge, 'id'>): WorkspaceCellGraphEdge {
  return {
    ...edge,
    id: `edge:${edge.source}:${edge.verb}:${edge.target}`
  };
}

function resolveCapabilityVerb(capability: WorkspaceCellCapability): WorkspaceCellGraphEdgeVerb {
  if (capability.classification === 'required' || capability.classification === 'optional') {
    return 'requires';
  }

  if (capability.classification === 'private') {
    return 'owns';
  }

  return 'provides';
}

function groupBy<TEntry, TGroup extends string>(
  entries: readonly TEntry[],
  groups: readonly TGroup[],
  selectGroup: (entry: TEntry) => TGroup
): Record<TGroup, TEntry[]> {
  const grouped = {} as Record<TGroup, TEntry[]>;

  for (const group of groups) {
    grouped[group] = [];
  }

  for (const entry of entries) {
    grouped[selectGroup(entry)].push(entry);
  }

  return grouped;
}

function uniqueSortedStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function toMermaidNodeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, '_');
}

function escapeMermaidLabel(value: string): string {
  return value.replace(/"/g, '\\"');
}
