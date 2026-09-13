import type { LayoutNode } from '../../domain/layout/model';
import type { Workspace } from '../../domain/workspace/model';
import { collectReferencedToolInstanceIds } from '../../domain/workspace/selectors';
import { canonicalizeLayout } from './canonicalizeLayout';
import { updateActiveWindowRoot } from './layoutTree';

export function updateCanonicalizedActiveWindowRoot(
  workspace: Workspace,
  updater: (root: LayoutNode) => LayoutNode
): Workspace {
  return updateActiveWindowRoot(workspace, (root) => canonicalizeLayout(updater(root)));
}

export function pruneUnusedToolInstances(
  workspace: Workspace,
  candidateToolInstanceIds?: Iterable<string>
): Workspace {
  const liveToolInstanceIds = collectReferencedToolInstanceIds(workspace);

  if (!candidateToolInstanceIds) {
    return {
      ...workspace,
      toolInstances: Object.fromEntries(
        Object.entries(workspace.toolInstances).filter(([toolInstanceId]) => liveToolInstanceIds.has(toolInstanceId))
      )
    };
  }

  const candidateSet = new Set(candidateToolInstanceIds);

  if (candidateSet.size === 0) {
    return workspace;
  }

  return {
    ...workspace,
    toolInstances: Object.fromEntries(
      Object.entries(workspace.toolInstances).filter(
        ([toolInstanceId]) => !candidateSet.has(toolInstanceId) || liveToolInstanceIds.has(toolInstanceId)
      )
    )
  };
}
