import type { Workspace } from '../../domain/workspace/model';
import { updateActiveWindowRoot, updateStackById } from './layoutTree';

interface SetStackHeaderVisibilityInput {
  stackId: string;
  visible: boolean;
}

export function setStackHeaderVisibility(
  workspace: Workspace,
  input: SetStackHeaderVisibilityInput
): Workspace {
  return updateActiveWindowRoot(workspace, (root) =>
    updateStackById(root, input.stackId, (stack) => ({
      ...stack,
      headerVisible: input.visible
    }))
  );
}
