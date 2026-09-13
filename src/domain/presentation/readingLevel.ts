export const WORKBENCH_READING_LEVELS = ['casual', 'advanced', 'expert'] as const;

export const DEFAULT_WORKBENCH_READING_LEVEL: WorkbenchReadingLevel = 'casual';

export type WorkbenchReadingLevel = (typeof WORKBENCH_READING_LEVELS)[number];

export interface WorkbenchReadingLevelPresentation {
  /** Optional authored override of the inherited user preference. */
  defaultLevel?: WorkbenchReadingLevel;
  availableLevels?: readonly WorkbenchReadingLevel[];
}

export function isWorkbenchReadingLevel(value: unknown): value is WorkbenchReadingLevel {
  return typeof value === 'string' && WORKBENCH_READING_LEVELS.includes(value as WorkbenchReadingLevel);
}

export function normalizeWorkbenchReadingLevels(
  presentation: WorkbenchReadingLevelPresentation | null | undefined
): WorkbenchReadingLevel[] {
  if (!presentation) return [];

  const requested = presentation.availableLevels ?? WORKBENCH_READING_LEVELS;
  const normalized = WORKBENCH_READING_LEVELS.filter((level) => requested.includes(level));

  if (presentation.defaultLevel && !normalized.includes(presentation.defaultLevel)) {
    normalized.push(presentation.defaultLevel);
    normalized.sort(
      (left, right) => WORKBENCH_READING_LEVELS.indexOf(left) - WORKBENCH_READING_LEVELS.indexOf(right)
    );
  }

  return normalized;
}

export function resolveWorkbenchReadingLevel(
  value: unknown,
  presentation: WorkbenchReadingLevelPresentation | null | undefined,
  inheritedDefault: WorkbenchReadingLevel = DEFAULT_WORKBENCH_READING_LEVEL
): WorkbenchReadingLevel {
  const availableLevels = normalizeWorkbenchReadingLevels(presentation);
  const requestedFallback = presentation?.defaultLevel ?? inheritedDefault;
  const fallback =
    availableLevels.length === 0 || availableLevels.includes(requestedFallback)
      ? requestedFallback
      : availableLevels[0] ?? DEFAULT_WORKBENCH_READING_LEVEL;

  return isWorkbenchReadingLevel(value) && (availableLevels.length === 0 || availableLevels.includes(value))
    ? value
    : fallback;
}

export function isAudienceVisibleAtReadingLevel(
  audience: WorkbenchReadingLevel,
  readingLevel: WorkbenchReadingLevel
): boolean {
  return WORKBENCH_READING_LEVELS.indexOf(audience) <= WORKBENCH_READING_LEVELS.indexOf(readingLevel);
}
