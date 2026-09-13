import { containsPanel, findStack, findSplit } from '../../domain/layout/selectors';
import type { Workspace } from '../../domain/workspace/model';

/** Resolve the mutation context from an explicit layout target, not remote focus. */
export function selectWorkspaceTargetWindow(workspace: Workspace, targetId: string | null | undefined): Workspace {
  if (!targetId) return workspace;
  const owner = workspace.windows.find(({ root }) =>
    containsPanel(root, targetId) || findStack(root, targetId) || findSplit(root, targetId)
  );
  return owner && owner.id !== workspace.activeWindowId
    ? { ...workspace, activeWindowId: owner.id }
    : workspace;
}

export function updateWorkspaceTargetWindow(
  workspace: Workspace,
  targetId: string,
  update: (selected: Workspace) => Workspace
): Workspace {
  const selected = selectWorkspaceTargetWindow(workspace, targetId);
  const next = update(selected);
  // A refused/no-op mutation must not change the active window by itself.
  const unchangedWindows = next.windows.length === selected.windows.length && next.windows.every((window, index) => {
    const previous = selected.windows[index];
    return window.id === previous.id && window.root === previous.root && window.title === previous.title;
  });
  return unchangedWindows && next.toolInstances === selected.toolInstances
    ? workspace
    : next;
}
