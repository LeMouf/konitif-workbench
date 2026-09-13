import type { WorkbenchRuntimeSharedStateEntry } from '../../domain/runtime/model';
import {
  createRuntimeProjectionSessionSharedStateKey,
  isRuntimeProjectionSessionSharedStateKey
} from './RuntimeProjectionSessionKeys';
import {
  normalizeRuntimeProjectionSessionEntry,
  serializeRuntimeProjectionSessionEntry
} from './RuntimeProjectionSessionSerialization';
import type {
  RuntimeProjectionSessionEntry,
  RuntimeProjectionSessionSharedStateMergeResult,
  RuntimeProjectionSessionState
} from './RuntimeProjectionSessionTypes';

export function mergeRuntimeProjectionSessionSharedStateEntries(
  state: RuntimeProjectionSessionState,
  sharedStateEntries: WorkbenchRuntimeSharedStateEntry[]
): RuntimeProjectionSessionSharedStateMergeResult {
  let nextState = state;
  const signatures: Record<string, string> = {};
  const changedEntries: RuntimeProjectionSessionEntry[] = [];
  let changed = false;

  for (const sharedStateEntry of sharedStateEntries) {
    if (
      sharedStateEntry.scope !== 'session' ||
      !isRuntimeProjectionSessionSharedStateKey(sharedStateEntry.key)
    ) {
      continue;
    }

    const entry = normalizeRuntimeProjectionSessionEntry(sharedStateEntry.value);

    if (!entry || createRuntimeProjectionSessionSharedStateKey(entry.target) !== sharedStateEntry.key) {
      continue;
    }

    signatures[entry.key] = JSON.stringify(serializeRuntimeProjectionSessionEntry(entry));

    const previous = nextState.entries[entry.key] ?? null;

    if (previous && compareRuntimeProjectionSessionUpdatedAt(previous.updatedAt, entry.updatedAt) >= 0) {
      continue;
    }

    nextState = {
      activeKey: nextState.activeKey ?? entry.key,
      entries: {
        ...nextState.entries,
        [entry.key]: cloneRuntimeProjectionSessionEntry(entry)
      }
    };
    changedEntries.push(cloneRuntimeProjectionSessionEntry(entry));
    changed = true;
  }

  return {
    state: nextState,
    signatures,
    changedEntries,
    changed
  };
}

function cloneRuntimeProjectionSessionEntry(
  entry: RuntimeProjectionSessionEntry
): RuntimeProjectionSessionEntry {
  return {
    ...entry,
    target: { ...entry.target },
    toolInstanceIds: [...entry.toolInstanceIds]
  };
}

function compareRuntimeProjectionSessionUpdatedAt(left: string, right: string): number {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);

  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
    return leftTime - rightTime;
  }

  return left.localeCompare(right);
}
