import type { WorkbenchRuntimeSharedStateEntry } from '../../domain/runtime/model';
import { isJsonValue } from './WorkbenchRuntimeSanitizers';

export function upsertSharedStateEntryFromEvent(
  entries: WorkbenchRuntimeSharedStateEntry[],
  payload: unknown
): WorkbenchRuntimeSharedStateEntry[] {
  const entry = normalizeSharedStateEntry(payload);

  return entry ? upsertSharedStateEntry(entries, entry) : entries;
}

export function upsertSharedStateEntry(
  entries: WorkbenchRuntimeSharedStateEntry[],
  nextEntry: WorkbenchRuntimeSharedStateEntry
): WorkbenchRuntimeSharedStateEntry[] {
  return [
    ...entries.filter((entry) => entry.key !== nextEntry.key),
    nextEntry
  ].sort(compareSharedStateEntries);
}

export function normalizeSharedStateEntry(value: unknown): WorkbenchRuntimeSharedStateEntry | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const key = typeof payload.key === 'string' ? payload.key : null;
  const scope = normalizeSharedStateScope(payload.scope);
  const valuePayload = isJsonValue(payload.value) ? payload.value : null;
  const version = typeof payload.version === 'number' && Number.isFinite(payload.version)
    ? payload.version
    : 0;
  const updatedAt = typeof payload.updatedAt === 'string' ? payload.updatedAt : '';
  const revision = typeof payload.revision === 'string' && payload.revision
    ? payload.revision
    : `${version}:${updatedAt}`;
  const originClientId =
    typeof payload.originClientId === 'string'
      ? payload.originClientId
      : null;

  return key && scope
    ? {
        key,
        scope,
        value: valuePayload,
        version,
        revision,
        updatedAt,
        originClientId
      }
    : null;
}

export function normalizeSharedStateScope(value: unknown): WorkbenchRuntimeSharedStateEntry['scope'] | null {
  return value === 'product' || value === 'session' || value === 'gesture' ? value : null;
}

export function compareSharedStateEntries(
  left: WorkbenchRuntimeSharedStateEntry,
  right: WorkbenchRuntimeSharedStateEntry
): number {
  return left.key.localeCompare(right.key);
}
