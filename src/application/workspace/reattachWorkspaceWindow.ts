import type { Workspace } from '../../domain/workspace/model';
import { createSplit } from '../../domain/workspace/factories';
import { findStackPathById, updateStackById } from './layoutTree';

/** Recover the current detached layout, never a snapshot captured before detaching. */
export function reattachWorkspaceWindow(workspace: Workspace, input: {
  windowId: string;
  sourceWindowId: string;
  sourceStackId: string;
}): Workspace {
  const detached = workspace.windows.find((entry) => entry.id === input.windowId);
  const source = workspace.windows.find((entry) => entry.id === input.sourceWindowId);
  if (!detached || !source || detached.id === source.id) return workspace;

  const detachedRoot = detached.root;
  const stackExists = findStackPathById(source.root, input.sourceStackId);
  const root = detachedRoot.kind === 'stack' && stackExists
    ? updateStackById(source.root, input.sourceStackId, (stack) => ({
        ...stack,
        children: [...stack.children, ...detachedRoot.children],
        activeChildId: detachedRoot.activeChildId
      }))
    : createSplit('horizontal', [source.root, detachedRoot]);

  return {
    ...workspace,
    activeWindowId: source.id,
    windows: workspace.windows.filter((entry) => entry.id !== detached.id)
      .map((entry) => entry.id === source.id ? { ...entry, root } : entry)
  };
}
