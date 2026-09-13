import type { RuntimeInspectableStatus } from '../../domain/runtime/model';
import type { JsonValue } from '../../domain/shared/json';

export function normalizeRuntimeObjectSnapshot(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function normalizeRuntimeInspectableStatus(value: unknown): RuntimeInspectableStatus | null {
  return value === 'active' || value === 'idle' || value === 'degraded' || value === 'error' || value === 'unknown'
    ? value
    : null;
}

export function normalizeRuntimeStringArray(value: unknown): string[] | null {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string').map((entry) => sanitizeRuntimeText(entry, 120))
    : null;
}

export function normalizeRuntimeNullableString(value: unknown): string | null {
  return typeof value === 'string' ? sanitizeRuntimeText(value, 500) : null;
}

export function sanitizeRuntimeJson(value: unknown, depth = 0): JsonValue {
  if (value === null || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return sanitizeRuntimeText(value);
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (Array.isArray(value)) {
    if (depth >= 4) {
      return `[Array(${value.length})]`;
    }

    return value.slice(0, 50).map((entry) => sanitizeRuntimeJson(entry, depth + 1));
  }

  if (value && typeof value === 'object') {
    if (depth >= 4) {
      return '[Object]';
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 50)
        .map(([key, entry]) => [sanitizeRuntimeText(key, 120), sanitizeRuntimeJson(entry, depth + 1)])
    );
  }

  return null;
}

export function sanitizeRuntimeText(value: string, maxLength = 2000): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}

export function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return true;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (typeof value === 'object') {
    return Object.values(value).every(isJsonValue);
  }

  return false;
}
