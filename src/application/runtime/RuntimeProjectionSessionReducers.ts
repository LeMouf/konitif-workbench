import { createRuntimeProjectionSessionKey } from './RuntimeProjectionSessionKeys';
import type {
  RuntimeProjectionSessionEntry,
  RuntimeProjectionSessionOpenInput,
  RuntimeProjectionSessionPatch,
  RuntimeProjectionSessionState
} from './RuntimeProjectionSessionTypes';

export function createRuntimeProjectionSessionState(
  entries: RuntimeProjectionSessionEntry[] = [],
  activeKey: string | null = null
): RuntimeProjectionSessionState {
  const entriesByKey = Object.fromEntries(entries.map((entry) => [entry.key, cloneRuntimeProjectionSessionEntry(entry)]));
  const fallbackActiveKey = activeKey && entriesByKey[activeKey] ? activeKey : entries[0]?.key ?? null;

  return {
    activeKey: fallbackActiveKey,
    entries: entriesByKey
  };
}

export function upsertRuntimeProjectionSessionEntry(
  state: RuntimeProjectionSessionState,
  input: RuntimeProjectionSessionOpenInput
): RuntimeProjectionSessionState {
  const key = createRuntimeProjectionSessionKey(input.target);
  const now = input.now ?? new Date().toISOString();
  const previous = state.entries[key] ?? null;
  const toolInstanceIds = input.toolInstanceId
    ? appendUnique(previous?.toolInstanceIds ?? [], input.toolInstanceId)
    : previous?.toolInstanceIds ?? [];

  return {
    activeKey: key,
    entries: {
      ...state.entries,
      [key]: {
        key,
        target: { ...input.target },
        viewerId: input.viewerId,
        viewerTitle: input.viewerTitle ?? previous?.viewerTitle ?? input.viewerId,
        toolInstanceIds,
        status: input.status ?? 'open',
        selectedEntityId: previous?.selectedEntityId ?? null,
        focusedEntityId: previous?.focusedEntityId ?? null,
        openedAt: previous?.openedAt ?? now,
        updatedAt: now,
        lastError: null
      }
    }
  };
}

export function patchRuntimeProjectionSessionEntry(
  state: RuntimeProjectionSessionState,
  patch: RuntimeProjectionSessionPatch
): RuntimeProjectionSessionState {
  const key = createRuntimeProjectionSessionKey(patch.target);
  const previous = state.entries[key];

  if (!previous) {
    return state;
  }

  const now = patch.now ?? new Date().toISOString();
  const nextToolInstanceIds = patch.toolInstanceId
    ? appendUnique(previous.toolInstanceIds, patch.toolInstanceId)
    : previous.toolInstanceIds;

  return {
    ...state,
    activeKey: state.activeKey ?? key,
    entries: {
      ...state.entries,
      [key]: {
        ...previous,
        viewerId: patch.viewerId ?? previous.viewerId,
        toolInstanceIds: nextToolInstanceIds,
        status: patch.status ?? previous.status,
        selectedEntityId:
          patch.selectedEntityId === undefined ? previous.selectedEntityId : patch.selectedEntityId,
        focusedEntityId:
          patch.focusedEntityId === undefined ? previous.focusedEntityId : patch.focusedEntityId,
        updatedAt: now,
        lastError: patch.lastError === undefined ? previous.lastError : patch.lastError
      }
    }
  };
}

export function removeRuntimeProjectionSessionToolInstance(
  state: RuntimeProjectionSessionState,
  toolInstanceId: string
): RuntimeProjectionSessionState {
  const nextEntries: Record<string, RuntimeProjectionSessionEntry> = {};

  for (const [key, entry] of Object.entries(state.entries)) {
    const nextToolInstanceIds = entry.toolInstanceIds.filter((id) => id !== toolInstanceId);

    if (nextToolInstanceIds.length > 0) {
      nextEntries[key] = {
        ...entry,
        toolInstanceIds: nextToolInstanceIds
      };
    }
  }

  const activeKey = state.activeKey && nextEntries[state.activeKey] ? state.activeKey : Object.keys(nextEntries)[0] ?? null;

  return {
    activeKey,
    entries: nextEntries
  };
}

export function listRuntimeProjectionSessionEntries(
  state: RuntimeProjectionSessionState
): RuntimeProjectionSessionEntry[] {
  return Object.values(state.entries)
    .map(cloneRuntimeProjectionSessionEntry)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

export function getActiveRuntimeProjectionSessionEntry(
  state: RuntimeProjectionSessionState
): RuntimeProjectionSessionEntry | null {
  return state.activeKey && state.entries[state.activeKey]
    ? cloneRuntimeProjectionSessionEntry(state.entries[state.activeKey])
    : null;
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

function appendUnique(values: string[], nextValue: string): string[] {
  return values.includes(nextValue) ? values : [...values, nextValue];
}
