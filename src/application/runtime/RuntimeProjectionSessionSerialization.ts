import type { WorkbenchRuntimeProjectionTarget } from '../../domain/runtime/model';
import type { JsonObject } from '../../domain/shared/json';
import { createRuntimeProjectionSessionKey } from './RuntimeProjectionSessionKeys';
import type {
  RuntimeProjectionSessionEntry,
  RuntimeProjectionSessionPatch,
  RuntimeProjectionSessionStatus
} from './RuntimeProjectionSessionTypes';

export function serializeRuntimeProjectionSessionEntry(
  entry: RuntimeProjectionSessionEntry
): JsonObject {
  return {
    key: entry.key,
    target: {
      projectionKind: entry.target.projectionKind,
      sourceFile: entry.target.sourceFile
    },
    viewerId: entry.viewerId,
    viewerTitle: entry.viewerTitle,
    toolInstanceIds: [...entry.toolInstanceIds],
    status: entry.status,
    selectedEntityId: entry.selectedEntityId,
    focusedEntityId: entry.focusedEntityId,
    openedAt: entry.openedAt,
    updatedAt: entry.updatedAt,
    lastError: entry.lastError
  };
}

export function createRuntimeProjectionSessionPatchFromEntry(
  entry: RuntimeProjectionSessionEntry
): RuntimeProjectionSessionPatch {
  return {
    target: {
      projectionKind: entry.target.projectionKind,
      sourceFile: entry.target.sourceFile
    },
    viewerId: entry.viewerId,
    status: entry.status,
    selectedEntityId: entry.selectedEntityId,
    focusedEntityId: entry.focusedEntityId,
    lastError: entry.lastError,
    now: entry.updatedAt
  };
}

export function normalizeRuntimeProjectionSessionEntry(input: unknown): RuntimeProjectionSessionEntry | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const record = input as Record<string, unknown>;
  const target = normalizeRuntimeProjectionSessionTarget(record.target);

  if (!target) {
    return null;
  }

  const key = typeof record.key === 'string' ? record.key : createRuntimeProjectionSessionKey(target);
  const viewerId = typeof record.viewerId === 'string' ? record.viewerId : null;

  if (key !== createRuntimeProjectionSessionKey(target) || !viewerId) {
    return null;
  }

  return {
    key,
    target,
    viewerId,
    viewerTitle: typeof record.viewerTitle === 'string' ? record.viewerTitle : viewerId,
    toolInstanceIds: Array.isArray(record.toolInstanceIds)
      ? record.toolInstanceIds.filter((id): id is string => typeof id === 'string')
      : [],
    status: normalizeRuntimeProjectionSessionStatus(record.status),
    selectedEntityId: normalizeNullableString(record.selectedEntityId),
    focusedEntityId: normalizeNullableString(record.focusedEntityId),
    openedAt: typeof record.openedAt === 'string' ? record.openedAt : '',
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : '',
    lastError: normalizeNullableString(record.lastError)
  };
}

function normalizeRuntimeProjectionSessionTarget(input: unknown): WorkbenchRuntimeProjectionTarget | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const record = input as Record<string, unknown>;
  const projectionKind = typeof record.projectionKind === 'string' ? record.projectionKind : null;
  const sourceFile = typeof record.sourceFile === 'string' ? record.sourceFile : null;

  return projectionKind && sourceFile
    ? {
        projectionKind,
        sourceFile
      }
    : null;
}

function normalizeRuntimeProjectionSessionStatus(input: unknown): RuntimeProjectionSessionStatus {
  return input === 'opening' ||
    input === 'open' ||
    input === 'refreshing' ||
    input === 'stale' ||
    input === 'error'
    ? input
    : 'open';
}

function normalizeNullableString(input: unknown): string | null {
  return typeof input === 'string' ? input : null;
}
