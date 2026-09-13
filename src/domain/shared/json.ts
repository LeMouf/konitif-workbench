export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export type JsonArray = JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) {
    return true;
  }

  switch (typeof value) {
    case 'string':
    case 'number':
    case 'boolean':
      return Number.isFinite(value) || typeof value !== 'number';
    case 'object':
      if (Array.isArray(value)) {
        return value.every((entry) => isJsonValue(entry));
      }

      return Object.values(value as Record<string, unknown>).every((entry) => isJsonValue(entry));
    default:
      return false;
  }
}

export function isJsonObject(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value) && isJsonValue(value);
}

export function cloneJsonObject<T extends JsonObject>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
