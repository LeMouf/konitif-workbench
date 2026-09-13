import type { DesignSystemThemeSession } from '../../domain/design-system/themeSession';
import { normalizeDesignSystemThemeSession } from '../../domain/design-system/themeSession';
import type { Workspace } from '../../domain/workspace/model';

export function setDesignSystemThemeSession(
  workspace: Workspace,
  nextSession: DesignSystemThemeSession | null
): Workspace {
  const normalizedSession = nextSession ? normalizeDesignSystemThemeSession(nextSession) : null;
  const currentSession = workspace.designSystemThemeSession ?? null;

  if (JSON.stringify(currentSession) === JSON.stringify(normalizedSession)) {
    return workspace;
  }

  return {
    ...workspace,
    designSystemThemeSession: normalizedSession
  };
}
