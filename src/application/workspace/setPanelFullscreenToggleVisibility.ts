import type { Workspace } from '../../domain/workspace/model';
import { updateActiveWindowRoot, updatePanelById } from './layoutTree';

interface SetPanelFullscreenToggleVisibilityInput {
  panelId: string;
  visible: boolean;
}

export function setPanelFullscreenToggleVisibility(
  workspace: Workspace,
  input: SetPanelFullscreenToggleVisibilityInput
): Workspace {
  return updateActiveWindowRoot(workspace, (root) =>
    updatePanelById(root, input.panelId, (panel) => ({
      ...panel,
      showFullscreenToggle: input.visible
    }))
  );
}
