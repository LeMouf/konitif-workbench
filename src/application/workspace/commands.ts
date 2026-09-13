import type { LayoutDockSide, LayoutEdge } from '../../domain/layout/interaction';
import type { WorkbenchReadingLevel } from '../../domain/presentation/readingLevel';
import type { ToolCatalogPort } from '../../domain/tool/model';
import {
  listPanelsInWorkspace,
  findPanelInWorkspace,
  findStackContainingPanelInWorkspace,
  findStackInWorkspace,
  findWindowContainingPanel,
  findToolPlacementByToolId,
  getPreferredFocusedPanelId
} from '../../domain/workspace/selectors';
import { closePanel } from './closePanel';
import { detachPanelToWindow } from './detachPanelToWindow';
import { joinPanelArea } from './joinPanelArea';
import { openTool } from './openTool';
import { runToolShellCommand } from './runToolShellCommand';
import { setPanelFullscreenToggleVisibility } from './setPanelFullscreenToggleVisibility';
import { setStackHeaderVisibility } from './setStackHeaderVisibility';
import { setActiveStackChild } from './setActiveStackChild';
import { focusPanel } from './focusPanel';
import { selectWorkspaceTargetWindow } from './targetWindow';
import { splitPanel } from './splitPanel';
import { swapPanelArea } from './swapPanelArea';
import { createPanel } from '../../domain/workspace/factories';
import { updateActiveWindowRoot, updateStackById } from './layoutTree';
import { createWorkspaceSessionState, getFocusedPanel, type WorkspaceSessionState } from './session';

export type WorkspaceCommand =
  | { type: 'open-tool'; toolId: string }
  | { type: 'open-tool-in-panel'; panelId: string; toolId: string }
  | { type: 'open-tool-in-new-tab'; panelId: string; toolId: string }
  | { type: 'split-panel-horizontal' }
  | { type: 'split-panel-vertical' }
  | {
      type: 'split-panel-to-side';
      orientation: 'horizontal' | 'vertical';
      side: LayoutDockSide;
      panelId?: string;
    }
  | { type: 'join-panel-area'; panelId: string; edge: LayoutEdge }
  | { type: 'swap-panel-area'; panelId: string; edge: LayoutEdge }
  | { type: 'close-active-panel' }
  | { type: 'close-panel'; panelId: string }
  | { type: 'detach-panel-to-window'; panelId: string }
  | { type: 'focus-panel'; panelId: string }
  | { type: 'activate-tab'; stackId: string; panelId: string }
  | { type: 'set-stack-header-visibility'; stackId: string; visible: boolean }
  | { type: 'set-panel-fullscreen-toggle-visibility'; panelId: string; visible: boolean }
  | {
      type: 'run-tool-shell-command';
      panelId: string;
      toolInstanceId: string;
      commandId: string;
      /** Current shell default used only to resolve an inherited Tool reading level. */
      inheritedReadingLevel?: WorkbenchReadingLevel;
    };

interface WorkspaceCommandContext {
  toolCatalog: ToolCatalogPort;
}

/**
 * Command handling owns focus transitions so Svelte components only emit user intent.
 */
export function dispatchWorkspaceCommand(
  state: WorkspaceSessionState,
  command: WorkspaceCommand,
  context: WorkspaceCommandContext
): WorkspaceSessionState {
  const targetId =
    command.type === 'set-stack-header-visibility' ? command.stackId :
    command.type === 'set-panel-fullscreen-toggle-visibility' ||
    command.type === 'close-panel' || command.type === 'join-panel-area' ||
    command.type === 'swap-panel-area' ? command.panelId :
    command.type === 'split-panel-to-side' ? command.panelId ?? state.focus.activePanelId :
    command.type === 'split-panel-horizontal' || command.type === 'split-panel-vertical' ||
    command.type === 'close-active-panel' || command.type === 'open-tool' ? state.focus.activePanelId : null;
  const normalizedState = createWorkspaceSessionState(
    selectWorkspaceTargetWindow(state.workspace, targetId), state.focus
  );

  switch (command.type) {
    case 'focus-panel':
      return focusPanel(normalizedState, command.panelId);
    case 'activate-tab':
      return activateTab(normalizedState, command.stackId, command.panelId);
    case 'set-stack-header-visibility':
      return setStackHeaderVisibilityFromCommand(normalizedState, command.stackId, command.visible);
    case 'set-panel-fullscreen-toggle-visibility':
      return setPanelFullscreenToggleVisibilityFromCommand(normalizedState, command.panelId, command.visible);
    case 'open-tool':
      return openToolFromFocus(normalizedState, command.toolId, context.toolCatalog);
    case 'open-tool-in-panel':
      return openToolInPanel(normalizedState, command.panelId, command.toolId, context.toolCatalog);
    case 'open-tool-in-new-tab':
      return openToolInNewTab(normalizedState, command.panelId, command.toolId, context.toolCatalog);
    case 'run-tool-shell-command':
      return runFocusedToolShellCommand(normalizedState, command, context.toolCatalog);
    case 'split-panel-horizontal':
      return splitFocusedPanel(normalizedState, 'horizontal');
    case 'split-panel-vertical':
      return splitFocusedPanel(normalizedState, 'vertical');
    case 'split-panel-to-side':
      return splitPanelToSide(normalizedState, command.orientation, command.side, command.panelId ?? null);
    case 'join-panel-area':
      return joinPanelAreaFromCommand(normalizedState, command.panelId, command.edge);
    case 'swap-panel-area':
      return swapPanelAreaFromCommand(normalizedState, command.panelId, command.edge);
    case 'close-active-panel':
      return closeFocusedPanel(normalizedState);
    case 'close-panel':
      return closePanelById(normalizedState, command.panelId);
    case 'detach-panel-to-window':
      return detachPanelFromCommand(normalizedState, command.panelId);
  }
}

function runFocusedToolShellCommand(
  state: WorkspaceSessionState,
  command: Extract<WorkspaceCommand, { type: 'run-tool-shell-command' }>,
  toolCatalog: ToolCatalogPort
): WorkspaceSessionState {
  const nextWorkspace = runToolShellCommand(
    state.workspace,
    {
      panelId: command.panelId,
      toolInstanceId: command.toolInstanceId,
      commandId: command.commandId,
      inheritedReadingLevel: command.inheritedReadingLevel
    },
    toolCatalog
  );

  return createWorkspaceSessionState(nextWorkspace, { activePanelId: command.panelId });
}

function activateTab(state: WorkspaceSessionState, stackId: string, panelId: string): WorkspaceSessionState {
  const stack = findStackInWorkspace(state.workspace, stackId);

  if (!stack || !stack.children.some((panel) => panel.id === panelId)) {
    return state;
  }

  // A tab belongs to its containing window, not necessarily the window last
  // activated by a synchronized client. Reuse the canonical focus transition.
  return focusPanel(state, panelId);
}

function setStackHeaderVisibilityFromCommand(
  state: WorkspaceSessionState,
  stackId: string,
  visible: boolean
): WorkspaceSessionState {
  const stack = findStackInWorkspace(state.workspace, stackId);

  if (!stack) {
    return state;
  }

  const nextWorkspace = setStackHeaderVisibility(state.workspace, { stackId, visible });
  return createWorkspaceSessionState(nextWorkspace, state.focus);
}

function setPanelFullscreenToggleVisibilityFromCommand(
  state: WorkspaceSessionState,
  panelId: string,
  visible: boolean
): WorkspaceSessionState {
  const panel = findPanelInWorkspace(state.workspace, panelId);

  if (!panel) {
    return state;
  }

  const nextWorkspace = setPanelFullscreenToggleVisibility(state.workspace, { panelId, visible });
  return createWorkspaceSessionState(nextWorkspace, state.focus);
}

function openToolFromFocus(
  state: WorkspaceSessionState,
  toolId: string,
  toolCatalog: ToolCatalogPort
): WorkspaceSessionState {
  const focusedPanel = getFocusedPanel(state);

  if (!focusedPanel) {
    return state;
  }

  const focusedWorkspace = ensurePanelVisible(state.workspace, focusedPanel.id);
  const openToolResult = openTool(focusedWorkspace, { panelId: focusedPanel.id, toolId }, toolCatalog);

  return createWorkspaceSessionState(openToolResult.workspace, {
    activePanelId: openToolResult.panelId ?? focusedPanel.id
  });
}

function openToolInPanel(
  state: WorkspaceSessionState,
  panelId: string,
  toolId: string,
  toolCatalog: ToolCatalogPort
): WorkspaceSessionState {
  const targetPanel = findPanelInWorkspace(state.workspace, panelId);

  if (!targetPanel) {
    return state;
  }

  const visibleState = focusPanel(state, panelId);
  const visibleWorkspace = ensurePanelVisible(visibleState.workspace, panelId);
  const openToolResult = openTool(
    visibleWorkspace,
    { panelId, toolId, singletonPlacement: 'move-to-panel' },
    toolCatalog
  );

  return createWorkspaceSessionState(openToolResult.workspace, {
    activePanelId: openToolResult.panelId ?? panelId
  });
}

function openToolInNewTab(
  state: WorkspaceSessionState,
  panelId: string,
  toolId: string,
  toolCatalog: ToolCatalogPort
): WorkspaceSessionState {
  const targetPanel = findPanelInWorkspace(state.workspace, panelId);
  const toolDefinition = toolCatalog.getDefinition(toolId);

  if (!targetPanel || !toolDefinition) {
    return state;
  }

  const existingPlacement = findToolPlacementByToolId(state.workspace, toolId);

  if (
    toolDefinition.openingPolicy.mode === 'singleton-global' && existingPlacement &&
    findWindowContainingPanel(state.workspace, existingPlacement.panelId)?.id ===
      findWindowContainingPanel(state.workspace, panelId)?.id
  ) {
    return focusPanel(state, existingPlacement.panelId);
  }

  const visibleState = focusPanel(state, panelId);
  const containingStack = findStackContainingPanelInWorkspace(visibleState.workspace, panelId);

  if (!containingStack) {
    return state;
  }

  const panel = createPanel('New panel');
  const nextWorkspace = updateActiveWindowRoot(visibleState.workspace, (root) =>
    updateStackById(root, containingStack.id, (stack) => ({
      ...stack,
      activeChildId: panel.id,
      children: [...stack.children, panel] as typeof stack.children
    }))
  );
  // Explicit addition targets this window. Reuse a remote singleton rather
  // than focusing a logical window whose browser tab may no longer exist.
  const openToolResult = openTool(
    nextWorkspace,
    { panelId: panel.id, toolId, singletonPlacement: 'move-to-panel' },
    toolCatalog
  );

  return createWorkspaceSessionState(openToolResult.workspace, {
    activePanelId: openToolResult.panelId ?? panel.id
  });
}

function splitFocusedPanel(
  state: WorkspaceSessionState,
  orientation: 'horizontal' | 'vertical'
): WorkspaceSessionState {
  return splitPanelToSide(state, orientation, orientation === 'horizontal' ? 'right' : 'bottom');
}

function splitPanelToSide(
  state: WorkspaceSessionState,
  orientation: 'horizontal' | 'vertical',
  side: LayoutDockSide,
  panelId: string | null = null
): WorkspaceSessionState {
  const focusedPanel = getFocusedPanel(state);
  const targetPanelId = panelId ?? focusedPanel?.id ?? null;

  if (!targetPanelId) {
    return state;
  }

  const baseWorkspace = ensurePanelVisible(state.workspace, targetPanelId);
  const previousPanelIds = new Set(listPanelsInWorkspace(baseWorkspace).map((panel) => panel.id));
  const nextWorkspace = splitPanel(baseWorkspace, { panelId: targetPanelId, orientation, side });
  const newPanel = listPanelsInWorkspace(nextWorkspace).find((panel) => !previousPanelIds.has(panel.id));

  return createWorkspaceSessionState(nextWorkspace, { activePanelId: newPanel?.id ?? targetPanelId });
}

function closeFocusedPanel(state: WorkspaceSessionState): WorkspaceSessionState {
  const focusedPanel = getFocusedPanel(state);

  if (!focusedPanel) {
    return state;
  }

  return closePanelById(state, focusedPanel.id);
}

function closePanelById(state: WorkspaceSessionState, panelId: string): WorkspaceSessionState {
  const sourceStack = findStackContainingPanelInWorkspace(state.workspace, panelId);

  if (!sourceStack) {
    return state;
  }

  const nextWorkspace = closePanel(state.workspace, { panelId });
  const survivingStack = findStackInWorkspace(nextWorkspace, sourceStack.id);
  const nextFocusedPanelId =
    state.focus.activePanelId === panelId
      ? (survivingStack?.activeChildId ?? getPreferredFocusedPanelId(nextWorkspace))
      : state.focus.activePanelId;

  return createWorkspaceSessionState(nextWorkspace, { activePanelId: nextFocusedPanelId ?? null });
}

function detachPanelFromCommand(state: WorkspaceSessionState, panelId: string): WorkspaceSessionState {
  const result = detachPanelToWindow(state.workspace, { panelId });

  if (!result) {
    return state;
  }

  const nextFocusedPanelId =
    state.focus.activePanelId === panelId
      ? getPreferredFocusedPanelId(result.workspace)
      : state.focus.activePanelId;

  return createWorkspaceSessionState(result.workspace, { activePanelId: nextFocusedPanelId ?? null });
}

function joinPanelAreaFromCommand(
  state: WorkspaceSessionState,
  panelId: string,
  edge: LayoutEdge
): WorkspaceSessionState {
  const side = edge;
  const nextWorkspace = joinPanelArea(state.workspace, { panelId, edge, side });
  const nextFocusedPanelId =
    findPanelInWorkspace(nextWorkspace, panelId)?.id ??
    getPreferredFocusedPanelId(nextWorkspace) ??
    state.focus.activePanelId;

  return createWorkspaceSessionState(nextWorkspace, { activePanelId: nextFocusedPanelId ?? null });
}

function swapPanelAreaFromCommand(
  state: WorkspaceSessionState,
  panelId: string,
  edge: LayoutEdge
): WorkspaceSessionState {
  const nextWorkspace = swapPanelArea(state.workspace, { panelId, edge });
  const nextFocusedPanelId =
    findPanelInWorkspace(nextWorkspace, panelId)?.id ??
    getPreferredFocusedPanelId(nextWorkspace) ??
    state.focus.activePanelId;

  return createWorkspaceSessionState(nextWorkspace, { activePanelId: nextFocusedPanelId ?? null });
}

function ensurePanelVisible(workspace: WorkspaceSessionState['workspace'], panelId: string) {
  const containingStack = findStackContainingPanelInWorkspace(workspace, panelId);

  if (!containingStack || containingStack.activeChildId === panelId) {
    return workspace;
  }

  return setActiveStackChild(workspace, { stackId: containingStack.id, panelId });
}
