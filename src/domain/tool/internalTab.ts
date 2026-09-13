import type { JsonObject } from '../shared/json';

/**
 * Canonical Tool-instance state key for a Tool-owned internal tab.
 *
 * Panel tabs remain owned by the Workbench layout. Tabs rendered inside a
 * Tool are instead part of that Tool's serializable projection and must never
 * be promoted to global shell state or persisted through a parallel store.
 */
export const TOOL_INTERNAL_TAB_STATE_KEY = 'activeInternalTab';

export function resolveToolInternalTab<TTab extends string>(
  state: JsonObject | null | undefined,
  supportedTabs: readonly TTab[],
  fallback: TTab
): TTab {
  const candidate = state?.[TOOL_INTERNAL_TAB_STATE_KEY];
  return typeof candidate === 'string' && supportedTabs.includes(candidate as TTab)
    ? (candidate as TTab)
    : fallback;
}

export function withToolInternalTab(
  state: JsonObject | null | undefined,
  activeTab: string
): JsonObject {
  return {
    ...(state ?? {}),
    [TOOL_INTERNAL_TAB_STATE_KEY]: activeTab
  };
}
