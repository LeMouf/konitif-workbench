import type { LayoutDockSide } from '../../domain/layout/interaction';
import type { SplitOrientation } from '../../domain/layout/model';
import type { Workspace } from '../../domain/workspace/model';
import { containsPanel } from '../../domain/layout/selectors';
import { getActiveWindow } from '../../domain/workspace/selectors';
import { createPanel, createSplit, createStack } from '../../domain/workspace/factories';
import { canonicalizeLayout } from './canonicalizeLayout';
import { replaceStackContainingPanel, updateActiveWindowRoot } from './layoutTree';

interface SplitPanelInput {
  panelId: string;
  orientation: SplitOrientation;
  side?: LayoutDockSide;
}

export function splitPanel(workspace: Workspace, input: SplitPanelInput): Workspace {
  const activeWindow = getActiveWindow(workspace);

  if (!activeWindow || !containsPanel(activeWindow.root, input.panelId)) {
    return workspace;
  }

  const nextRoot = replaceStackContainingPanel(activeWindow.root, input.panelId, (stack) => {
    const newStack = createStack([createPanel('New panel')]);
    const nextChildren: [typeof newStack | typeof stack, typeof newStack | typeof stack] =
      input.orientation === 'horizontal' && input.side === 'left'
        ? [newStack, stack]
        : input.orientation === 'vertical' && input.side === 'top'
          ? [newStack, stack]
          : [stack, newStack];

    return createSplit(input.orientation, nextChildren);
  });

  return updateActiveWindowRoot(workspace, () => canonicalizeLayout(nextRoot));
}
