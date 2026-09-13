import type {
  WorkbenchRuntimeProjectionCatalogEntry,
  WorkbenchRuntimeSnapshot
} from '../../domain/runtime/model';

export function normalizeProjectionCatalogFromWorkspace(
  workspace: WorkbenchRuntimeSnapshot['workspace']
): WorkbenchRuntimeProjectionCatalogEntry[] {
  if (!workspace) {
    return [];
  }

  return Object.entries(workspace.projections)
    .map(([projectionKind, sources]) => ({
      projectionKind,
      version: 'workspace-catalog',
      sources: Array.isArray(sources) ? [...sources] : []
    }))
    .sort(compareProjectionCatalogEntries);
}

export function normalizeProjectionCatalogFromEvent(
  payload: unknown,
  fallback: WorkbenchRuntimeProjectionCatalogEntry[]
): WorkbenchRuntimeProjectionCatalogEntry[] {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const eventPayload = payload as Record<string, unknown>;
  const projectors = Array.isArray(eventPayload.projectors) ? eventPayload.projectors : null;

  if (projectors) {
    return projectors
      .map(normalizeProjectionCatalogEntry)
      .filter((entry): entry is WorkbenchRuntimeProjectionCatalogEntry => Boolean(entry))
      .sort(compareProjectionCatalogEntries);
  }

  const entry = normalizeProjectionCatalogEntry(eventPayload);

  return entry ? [entry] : fallback;
}

export function normalizeProjectionCatalogEntry(value: unknown): WorkbenchRuntimeProjectionCatalogEntry | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const projectionKind = typeof payload.projectionKind === 'string' ? payload.projectionKind : null;
  const version = typeof payload.version === 'string' ? payload.version : 'runtime-catalog';
  const sources = Array.isArray(payload.sources)
    ? payload.sources.filter((source): source is string => typeof source === 'string')
    : [];

  return projectionKind
    ? {
        projectionKind,
        version,
        sources
      }
    : null;
}

export function compareProjectionCatalogEntries(
  left: WorkbenchRuntimeProjectionCatalogEntry,
  right: WorkbenchRuntimeProjectionCatalogEntry
): number {
  return left.projectionKind.localeCompare(right.projectionKind);
}
