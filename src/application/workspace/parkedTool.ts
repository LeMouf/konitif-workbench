import type { ToolInstance } from '../../domain/tool/model';
import type { WorkspaceSessionState } from '../../domain/workspace/session';
import { findPanelInWorkspace, listPanelsInWorkspace } from '../../domain/workspace/selectors';
import { createWorkspaceSessionState } from './session';
import { updatePanelById } from './layoutTree';
import { unassignTool } from './unassignTool';

export interface ParkedWorkspaceTool {
  schemaVersion: 1;
  toolId: string;
  instances: Record<string, ToolInstance>;
  panelBindings: Array<{ panelId: string; title: string; toolInstanceId: string }>;
  activePanelId: string | null;
}

export function parkWorkspaceTool(
  session: WorkspaceSessionState,
  toolId: string
): { session: WorkspaceSessionState; parked: ParkedWorkspaceTool | null } {
  const instances = Object.fromEntries(
    Object.entries(session.workspace.toolInstances)
      .filter(([, instance]) => instance.toolId === toolId)
      .map(([instanceId, instance]) => [instanceId, structuredClone(instance)])
  );
  const instanceIds = new Set(Object.keys(instances));
  if (instanceIds.size === 0) return { session, parked: null };
  const panelBindings = listPanelsInWorkspace(session.workspace)
    .filter(panel => panel.toolInstanceId !== null && instanceIds.has(panel.toolInstanceId))
    .map(panel => ({ panelId: panel.id, title: panel.title, toolInstanceId: panel.toolInstanceId! }));
  const workspace = unassignTool(session.workspace, toolId);
  return {
    session: createWorkspaceSessionState(workspace, { activePanelId: session.focus.activePanelId }),
    parked: {
      schemaVersion: 1,
      toolId,
      instances,
      panelBindings,
      activePanelId: instanceIds.has(session.focus.activeToolInstanceId ?? '')
        ? session.focus.activePanelId
        : null
    }
  };
}

export function restoreParkedWorkspaceTool(
  session: WorkspaceSessionState,
  parked: ParkedWorkspaceTool
): { session: WorkspaceSessionState; restored: boolean } {
  if (!isParkedWorkspaceTool(parked)) return { session, restored: false };
  const instanceIds = new Set(Object.keys(parked.instances));
  const panelsAreAvailable = parked.panelBindings.every(binding => {
    const panel = findPanelInWorkspace(session.workspace, binding.panelId);
    return panel && (panel.toolInstanceId === null || panel.toolInstanceId === binding.toolInstanceId);
  });
  const instancesAreAvailable = [...instanceIds].every(instanceId => {
    const current = session.workspace.toolInstances[instanceId];
    return !current;
  });
  if (!panelsAreAvailable || !instancesAreAvailable) return { session, restored: false };

  let windows = session.workspace.windows;
  for (const binding of parked.panelBindings) {
    windows = windows.map(window => ({
      ...window,
      root: updatePanelById(window.root, binding.panelId, panel => ({
        ...panel,
        title: binding.title,
        toolInstanceId: binding.toolInstanceId
      }))
    }));
  }
  const workspace = {
    ...session.workspace,
    windows,
    toolInstances: {
      ...session.workspace.toolInstances,
      ...structuredClone(parked.instances)
    }
  };
  return {
    session: createWorkspaceSessionState(workspace, {
      activePanelId: parked.activePanelId ?? session.focus.activePanelId
    }),
    restored: true
  };
}

export function isParkedWorkspaceTool(value: unknown): value is ParkedWorkspaceTool {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<ParkedWorkspaceTool>;
  if (candidate.schemaVersion !== 1 || typeof candidate.toolId !== 'string' || !candidate.toolId) return false;
  if (!candidate.instances || typeof candidate.instances !== 'object' || Array.isArray(candidate.instances)) return false;
  if (!Array.isArray(candidate.panelBindings)) return false;
  const instances = candidate.instances as Record<string, ToolInstance>;
  if (Object.entries(instances).some(([id, instance]) =>
    !instance || instance.id !== id || instance.toolId !== candidate.toolId ||
    !instance.state || typeof instance.state !== 'object' || Array.isArray(instance.state)
  )) return false;
  if (candidate.panelBindings.some(binding =>
    !binding || typeof binding.panelId !== 'string' || typeof binding.title !== 'string' ||
    typeof binding.toolInstanceId !== 'string' || !instances[binding.toolInstanceId]
  )) return false;
  return candidate.activePanelId === null || typeof candidate.activePanelId === 'string';
}
