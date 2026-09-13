import type { Workspace } from '../../domain/workspace/model';
import { normalizeSplitSizes } from '../../domain/layout/validation';
import { updateActiveWindowRoot, updateSplitById } from './layoutTree';
import { updateWorkspaceTargetWindow } from './targetWindow';

interface ResizeSplitInput {
  splitId: string;
  sizes: [number, number];
}

export function resizeSplit(workspace: Workspace, input: ResizeSplitInput): Workspace {
  return updateWorkspaceTargetWindow(workspace, input.splitId, (selected) => resizeSplitInActiveWindow(selected, input));
}

function resizeSplitInActiveWindow(workspace: Workspace, input: ResizeSplitInput): Workspace {
  return updateActiveWindowRoot(workspace, (root) =>
    updateSplitById(root, input.splitId, (split) => ({
      ...split,
      sizes: normalizeSplitSizes(input.sizes)
    }))
  );
}
