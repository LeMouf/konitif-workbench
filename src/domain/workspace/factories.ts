import type { NonEmptyArray, SplitOrientation, SplitNode, StackNode } from '../layout/model';
import type { PanelNode } from '../panel/model';
import type { Workspace, WorkspaceWindow } from './model';
import type { LayoutNode } from '../layout/model';
import { createId } from '../shared/id';
import { normalizeSplitSizes } from '../layout/validation';
import { WORKSPACE_SNAPSHOT_VERSION } from './validation';

export function createPanel(title = 'Untitled panel'): PanelNode {
  return {
    id: createId('panel'),
    title,
    toolInstanceId: null,
    showFullscreenToggle: true
  };
}

export function createStack(panels: NonEmptyArray<PanelNode> = [createPanel()]): StackNode {
  return {
    id: createId('stack'),
    kind: 'stack',
    activeChildId: panels[0].id,
    headerVisible: true,
    children: panels
  };
}

export function createSplit(
  orientation: SplitOrientation,
  children: readonly [StackNode | SplitNode, StackNode | SplitNode],
  sizes: [number, number] = [1, 1]
): SplitNode {
  return {
    id: createId('split'),
    kind: 'split',
    orientation,
    sizes: normalizeSplitSizes(sizes),
    children
  };
}

export function createWorkspaceWindow(root: LayoutNode = createStack(), title = 'Primary Window'): WorkspaceWindow {
  return {
    id: createId('window'),
    title,
    root
  };
}

export function createWorkspaceShell(window = createWorkspaceWindow()): Workspace {
  return {
    id: createId('workspace'),
    version: WORKSPACE_SNAPSHOT_VERSION,
    activeWindowId: window.id,
    fullscreenPanelId: null,
    designSystemThemeSession: null,
    windows: [window],
    toolInstances: {}
  };
}
