import type { Workspace } from './model';
import { normalizeDesignSystemThemeSession } from '../design-system/themeSession';
import { isJsonObject } from '../shared/json';
import { validateLayout } from '../layout/validation';
import { collectReferencedToolInstanceIds } from './selectors';
import { listPanels, listSplits, listStacks } from '../layout/selectors';

export const WORKSPACE_SNAPSHOT_VERSION = 1;

export interface WorkspaceValidationIssue {
  path: string;
  message: string;
}

export function validateWorkspace(workspace: Workspace): WorkspaceValidationIssue[] {
  return validateWorkspaceSnapshot(workspace);
}

export function isWorkspaceSnapshot(value: unknown): value is Workspace {
  return validateWorkspaceSnapshot(value).length === 0;
}

export function parseWorkspaceSnapshot(value: unknown): Workspace | null {
  if (!isWorkspaceSnapshot(value)) {
    return null;
  }

  const workspace = value as Workspace;

  return {
    ...workspace,
    fullscreenPanelId: workspace.fullscreenPanelId ?? null,
    designSystemThemeSession: normalizeDesignSystemThemeSession(workspace.designSystemThemeSession) ?? null
  };
}

export function validateWorkspaceSnapshot(value: unknown): WorkspaceValidationIssue[] {
  const issues: WorkspaceValidationIssue[] = [];

  if (!isRecord(value)) {
    return [{ path: 'workspace', message: 'Workspace snapshot must be an object.' }];
  }

  if (!isNonEmptyString(value.id)) {
    issues.push({ path: 'workspace.id', message: 'Workspace id must be a non-empty string.' });
  }

  if (value.version !== WORKSPACE_SNAPSHOT_VERSION) {
    issues.push({
      path: 'workspace.version',
      message: `Workspace version must equal ${WORKSPACE_SNAPSHOT_VERSION}.`
    });
  }

  if (!isNonEmptyString(value.activeWindowId)) {
    issues.push({ path: 'workspace.activeWindowId', message: 'activeWindowId must be a non-empty string.' });
  }

  if (
    value.fullscreenPanelId !== undefined &&
    value.fullscreenPanelId !== null &&
    !isNonEmptyString(value.fullscreenPanelId)
  ) {
    issues.push({
      path: 'workspace.fullscreenPanelId',
      message: 'fullscreenPanelId must be a non-empty string, null, or omitted.'
    });
  }

  if (
    value.designSystemThemeSession !== undefined &&
    value.designSystemThemeSession !== null &&
    !normalizeDesignSystemThemeSession(value.designSystemThemeSession)
  ) {
    issues.push({
      path: 'workspace.designSystemThemeSession',
      message: 'designSystemThemeSession must be a valid design system theme session object, null, or omitted.'
    });
  }

  if (!Array.isArray(value.windows) || value.windows.length === 0) {
    issues.push({ path: 'workspace.windows', message: 'Workspace must contain at least one window.' });
  }

  if (!isRecord(value.toolInstances)) {
    issues.push({ path: 'workspace.toolInstances', message: 'toolInstances must be an object map.' });
  }

  if (issues.length > 0) {
    return issues;
  }

  const workspace = value as unknown as Workspace;
  const windowIds = new Set<string>();
  const toolInstanceIds = new Set<string>();
  const globalPanelIds = new Map<string, string>();
  const globalStackIds = new Map<string, string>();
  const globalSplitIds = new Map<string, string>();

  for (let index = 0; index < workspace.windows.length; index += 1) {
    const window = workspace.windows[index] as unknown;
    const windowPath = `workspace.windows[${index}]`;

    if (!isRecord(window)) {
      issues.push({ path: windowPath, message: 'Window must be an object.' });
      continue;
    }

    if (!isNonEmptyString(window.id)) {
      issues.push({ path: `${windowPath}.id`, message: 'Window id must be a non-empty string.' });
    } else if (windowIds.has(window.id)) {
      issues.push({ path: `${windowPath}.id`, message: 'Window ids must be unique.' });
    } else {
      windowIds.add(window.id);
    }

    if (!isNonEmptyString(window.title)) {
      issues.push({ path: `${windowPath}.title`, message: 'Window title must be a non-empty string.' });
    }

    if (!isRecord(window.root) || !('kind' in window.root)) {
      issues.push({ path: `${windowPath}.root`, message: 'Window root must be a layout node.' });
      continue;
    }

    const root = window.root as unknown as Workspace['windows'][number]['root'];
    issues.push(...validateLayout(root));

    for (const panel of listPanels(root)) {
      const previousPath = globalPanelIds.get(panel.id);
      const currentPath = `${windowPath}.root.panel:${panel.id}`;

      if (previousPath) {
        issues.push({
          path: currentPath,
          message: `Panel id must be globally unique across windows (already used at ${previousPath}).`
        });
      } else {
        globalPanelIds.set(panel.id, currentPath);
      }
    }

    for (const stack of listStacks(root)) {
      const previousPath = globalStackIds.get(stack.id);
      const currentPath = `${windowPath}.root.stack:${stack.id}`;

      if (previousPath) {
        issues.push({
          path: currentPath,
          message: `Stack id must be globally unique across windows (already used at ${previousPath}).`
        });
      } else {
        globalStackIds.set(stack.id, currentPath);
      }
    }

    for (const split of listSplits(root)) {
      const previousPath = globalSplitIds.get(split.id);
      const currentPath = `${windowPath}.root.split:${split.id}`;

      if (previousPath) {
        issues.push({
          path: currentPath,
          message: `Split id must be globally unique across windows (already used at ${previousPath}).`
        });
      } else {
        globalSplitIds.set(split.id, currentPath);
      }
    }
  }

  if (!windowIds.has(workspace.activeWindowId)) {
    issues.push({ path: 'workspace.activeWindowId', message: 'activeWindowId must reference an existing window.' });
  }

  if (workspace.fullscreenPanelId !== undefined && workspace.fullscreenPanelId !== null) {
    if (!globalPanelIds.has(workspace.fullscreenPanelId)) {
      issues.push({
        path: 'workspace.fullscreenPanelId',
        message: 'fullscreenPanelId must reference an existing panel when provided.'
      });
    }
  }

  for (const [toolInstanceId, entry] of Object.entries(workspace.toolInstances)) {
    const toolPath = `workspace.toolInstances.${toolInstanceId}`;

    if (!isRecord(entry)) {
      issues.push({ path: toolPath, message: 'Tool instance must be an object.' });
      continue;
    }

    if (toolInstanceIds.has(toolInstanceId)) {
      issues.push({ path: toolPath, message: 'Tool instance ids must be unique.' });
    }

    toolInstanceIds.add(toolInstanceId);

    if (entry.id !== toolInstanceId) {
      issues.push({ path: `${toolPath}.id`, message: 'Tool instance id must match its map key.' });
    }

    if (!isNonEmptyString(entry.toolId)) {
      issues.push({ path: `${toolPath}.toolId`, message: 'Tool instance toolId must be a non-empty string.' });
    }

    if (!isJsonObject(entry.state)) {
      issues.push({ path: `${toolPath}.state`, message: 'Tool instance state must be a serializable object.' });
    }

    if (entry.panelTitleOverride !== null && !isNonEmptyString(entry.panelTitleOverride)) {
      issues.push({
        path: `${toolPath}.panelTitleOverride`,
        message: 'Tool instance panelTitleOverride must be a non-empty string or null.'
      });
    }

    if (entry.shellState !== undefined) {
      if (!isRecord(entry.shellState)) {
        issues.push({
          path: `${toolPath}.shellState`,
          message: 'Tool instance shellState must be an object when provided.'
        });
      } else {
        const status = entry.shellState.status;

        if (status !== null && status !== undefined) {
          if (!isRecord(status)) {
            issues.push({
              path: `${toolPath}.shellState.status`,
              message: 'Tool instance shellState.status must be an object or null.'
            });
          } else {
            if (!isNonEmptyString(status.label)) {
              issues.push({
                path: `${toolPath}.shellState.status.label`,
                message: 'Tool shell status label must be a non-empty string.'
              });
            }

            if (status.tone !== undefined && !['neutral', 'attention', 'success'].includes(String(status.tone))) {
              issues.push({
                path: `${toolPath}.shellState.status.tone`,
                message: 'Tool shell status tone must be neutral, attention, or success.'
              });
            }
          }
        }
      }
    }
  }

  const referencedToolInstanceIds = collectReferencedToolInstanceIds(workspace);

  for (const toolInstanceId of referencedToolInstanceIds) {
    if (!workspace.toolInstances[toolInstanceId]) {
      issues.push({
        path: `workspace.toolInstances.${toolInstanceId}`,
        message: 'Every referenced tool instance must exist in the workspace map.'
      });
    }
  }

  for (const toolInstanceId of Object.keys(workspace.toolInstances)) {
    if (!referencedToolInstanceIds.has(toolInstanceId)) {
      issues.push({
        path: `workspace.toolInstances.${toolInstanceId}`,
        message: 'Tool instances must be referenced by a panel.'
      });
    }
  }

  return issues;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
