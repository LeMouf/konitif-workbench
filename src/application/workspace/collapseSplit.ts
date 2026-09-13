import type { LayoutNode } from '../../domain/layout/model';
import type { Workspace } from '../../domain/workspace/model';
import { listPanels } from '../../domain/layout/selectors';
import { pruneUnusedToolInstances, updateCanonicalizedActiveWindowRoot } from './finalizeWorkspace';
import { updateWorkspaceTargetWindow } from './targetWindow';

interface CollapseSplitInput {
  splitId: string;
  removeChildIndex: 0 | 1;
}

export function collapseSplit(workspace: Workspace, input: CollapseSplitInput): Workspace {
  return updateWorkspaceTargetWindow(workspace, input.splitId, (selected) => collapseSplitInActiveWindow(selected, input));
}

function collapseSplitInActiveWindow(workspace: Workspace, input: CollapseSplitInput): Workspace {
  let removedNode: LayoutNode | null = null;
  let didCollapse = false;

  const nextWorkspace = updateCanonicalizedActiveWindowRoot(workspace, (root) => {
    const nextRoot = collapseSplitNode(root, input.splitId, input.removeChildIndex, (node) => {
      removedNode = node;
      didCollapse = true;
    });

    return didCollapse ? nextRoot : root;
  });

  if (!didCollapse || !removedNode) {
    return workspace;
  }

  const removedToolInstanceIds = new Set(
    listPanels(removedNode)
      .map((panel) => panel.toolInstanceId)
      .filter((toolInstanceId): toolInstanceId is string => !!toolInstanceId)
  );

  if (removedToolInstanceIds.size === 0) {
    return nextWorkspace;
  }

  return pruneUnusedToolInstances(nextWorkspace, removedToolInstanceIds);
}

function collapseSplitNode(
  node: LayoutNode,
  splitId: string,
  removeChildIndex: 0 | 1,
  onCollapse: (removedNode: LayoutNode) => void
): LayoutNode {
  if (node.kind === 'stack') {
    return node;
  }

  if (node.id === splitId) {
    const removedNode = node.children[removeChildIndex];
    const survivor = node.children[removeChildIndex === 0 ? 1 : 0];
    onCollapse(removedNode);
    return survivor;
  }

  return {
    ...node,
    children: [
      collapseSplitNode(node.children[0], splitId, removeChildIndex, onCollapse),
      collapseSplitNode(node.children[1], splitId, removeChildIndex, onCollapse)
    ]
  };
}
