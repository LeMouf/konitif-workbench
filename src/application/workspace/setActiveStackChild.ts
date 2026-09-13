import type { Workspace } from '../../domain/workspace/model';
import { updateActiveWindowRoot, updateStackById } from './layoutTree';

interface SetActiveStackChildInput {
  stackId: string;
  panelId: string;
}

export function setActiveStackChild(workspace: Workspace, input: SetActiveStackChildInput): Workspace {
  return updateActiveWindowRoot(workspace, (root) =>
    updateStackById(root, input.stackId, (stack) => {
      if (!stack.children.some((panel) => panel.id === input.panelId)) {
        return stack;
      }

      return {
        ...stack,
        activeChildId: input.panelId
      };
    })
  );
}
