export const DESIGN_SYSTEM_THEME_SESSION_VERSION = 1;

export type DesignSystemThemeMode = 'dark' | 'light';

export interface DesignSystemThemeSession {
  version: typeof DESIGN_SYSTEM_THEME_SESSION_VERSION;
  mode: DesignSystemThemeMode;
  draftValues: Record<string, string>;
  draftPast: Array<Record<string, string>>;
  draftFuture: Array<Record<string, string>>;
}

export function createDesignSystemThemeSession(
  input: Partial<DesignSystemThemeSession> = {}
): DesignSystemThemeSession {
  return {
    version: DESIGN_SYSTEM_THEME_SESSION_VERSION,
    mode: normalizeDesignSystemThemeMode(input.mode),
    draftValues: cloneDraftValues(input.draftValues),
    draftPast: cloneDraftHistory(input.draftPast),
    draftFuture: cloneDraftHistory(input.draftFuture)
  };
}

export function normalizeDesignSystemThemeSession(input: unknown): DesignSystemThemeSession | null {
  if (!isRecord(input)) {
    return null;
  }

  return createDesignSystemThemeSession({
    mode: normalizeDesignSystemThemeMode(input.mode),
    draftValues: normalizeDraftValues(input.draftValues),
    draftPast: normalizeDraftHistory(input.draftPast),
    draftFuture: normalizeDraftHistory(input.draftFuture)
  });
}

export function normalizeDesignSystemThemeMode(input: unknown): DesignSystemThemeMode {
  return input === 'light' ? 'light' : 'dark';
}

function normalizeDraftHistory(input: unknown): Array<Record<string, string>> {
  return Array.isArray(input) ? input.map(normalizeDraftValues) : [];
}

function cloneDraftHistory(input: Array<Record<string, string>> | undefined): Array<Record<string, string>> {
  return input?.map(cloneDraftValues) ?? [];
}

function normalizeDraftValues(input: unknown): Record<string, string> {
  if (!isRecord(input)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  );
}

function cloneDraftValues(input: Record<string, string> | undefined): Record<string, string> {
  return input ? { ...input } : {};
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === 'object' && !Array.isArray(input);
}
