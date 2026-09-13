import type {
  RuntimeManagerSnapshot,
  RuntimeServiceSnapshot,
  RuntimeStoreSnapshot
} from '../../domain/runtime/model';
import type {
  RuntimeManagerRegistration,
  RuntimeServiceRegistration,
  RuntimeStoreRegistration
} from './RuntimeRegistryTypes';
import {
  normalizeRuntimeInspectableStatus,
  normalizeRuntimeNullableString,
  normalizeRuntimeObjectSnapshot,
  normalizeRuntimeStringArray,
  sanitizeRuntimeJson
} from './WorkbenchRuntimeSanitizers';

export function createRuntimeStoreSnapshot(registration: RuntimeStoreRegistration): RuntimeStoreSnapshot {
  const value = safeReadRuntimeValue(registration.getSnapshot, registration.value);

  return {
    id: registration.id,
    label: registration.label ?? registration.id,
    scope: registration.scope ?? 'runtime',
    status: registration.status ?? 'active',
    value: sanitizeRuntimeJson(value),
    updatedAt: new Date().toISOString(),
    metadata: sanitizeRuntimeJson(registration.metadata ?? {})
  };
}

export function createRuntimeServiceSnapshot(registration: RuntimeServiceRegistration): RuntimeServiceSnapshot {
  const snapshot = normalizeRuntimeObjectSnapshot(safeReadRuntimeValue(registration.getSnapshot, {}));

  return {
    id: registration.id,
    label: registration.label ?? registration.id,
    status: normalizeRuntimeInspectableStatus(snapshot.status) ?? registration.status ?? 'unknown',
    capabilities: normalizeRuntimeStringArray(snapshot.capabilities) ?? registration.capabilities ?? [],
    endpoint: normalizeRuntimeNullableString(snapshot.endpoint) ?? registration.endpoint ?? null,
    lastError: normalizeRuntimeNullableString(snapshot.lastError) ?? registration.lastError ?? null,
    updatedAt: new Date().toISOString(),
    metadata: sanitizeRuntimeJson(snapshot.metadata ?? registration.metadata ?? {})
  };
}

export function createRuntimeManagerSnapshot(registration: RuntimeManagerRegistration): RuntimeManagerSnapshot {
  const snapshot = normalizeRuntimeObjectSnapshot(safeReadRuntimeValue(registration.getSnapshot, {}));

  return {
    id: registration.id,
    label: registration.label ?? registration.id,
    status: normalizeRuntimeInspectableStatus(snapshot.status) ?? registration.status ?? 'unknown',
    responsibilities: normalizeRuntimeStringArray(snapshot.responsibilities) ?? registration.responsibilities ?? [],
    lastError: normalizeRuntimeNullableString(snapshot.lastError) ?? registration.lastError ?? null,
    updatedAt: new Date().toISOString(),
    metadata: sanitizeRuntimeJson(snapshot.metadata ?? registration.metadata ?? {})
  };
}

export function safeReadRuntimeValue(read: (() => unknown) | undefined, fallback: unknown): unknown {
  if (!read) {
    return fallback;
  }

  try {
    return read();
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
