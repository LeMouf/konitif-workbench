import type { LayoutDockSide } from './interaction';
import type { LayoutNode, SplitOrientation, SplitNode, StackNode } from './model';
import type { PanelNode } from '../panel/model';
import type { JsonObject } from '../shared/json';
import type { ShellRegionId, ShellState } from '../shell/model';
import type { Workspace, WorkspaceWindow } from '../workspace/model';

export type LayoutSurfaceKind = 'shell' | 'workspace';
export type LayoutSurfaceAreaRole = 'root' | 'region' | 'split' | 'stack' | 'panel';
export type LayoutSurfaceActionKind =
  | 'activate'
  | 'collapse'
  | 'close'
  | 'dock'
  | 'move'
  | 'resize'
  | 'split'
  | 'toggle-open'
  | 'toggle-visibility';

export interface LayoutSurfaceActionProjection {
  kind: LayoutSurfaceActionKind;
  targetId: string;
  label: string;
  metadata?: JsonObject;
}

export interface LayoutSurfaceAreaProjection {
  id: string;
  sourceId: string;
  surfaceId: string;
  role: LayoutSurfaceAreaRole;
  title: string;
  parentId: string | null;
  childIds: string[];
  isActive: boolean;
  isVisible: boolean;
  isOpen: boolean;
  actions: LayoutSurfaceActionProjection[];
  metadata?: JsonObject;
}

export interface LayoutSurfaceBoundaryProjection {
  id: string;
  sourceId: string;
  surfaceId: string;
  orientation: SplitOrientation;
  areaIds: [string, string];
  actions: LayoutSurfaceActionProjection[];
  metadata?: JsonObject;
}

export interface LayoutSurfaceProjection {
  id: string;
  kind: LayoutSurfaceKind;
  title: string;
  rootAreaId: string;
  areas: Record<string, LayoutSurfaceAreaProjection>;
  boundaries: Record<string, LayoutSurfaceBoundaryProjection>;
}

export interface LayoutUserActionIntent {
  kind: LayoutSurfaceActionKind;
  surfaceId: string;
  targetId: string;
  side?: LayoutDockSide;
  orientation?: SplitOrientation;
  metadata?: JsonObject;
}

const shellRegionOrder: ShellRegionId[] = ['left', 'right', 'bottom'];

export function createShellLayoutSurfaceProjection(shellState: ShellState): LayoutSurfaceProjection {
  const surfaceId = 'shell:core';
  const rootAreaId = `${surfaceId}:root`;
  const areas: Record<string, LayoutSurfaceAreaProjection> = {};
  const boundaries: Record<string, LayoutSurfaceBoundaryProjection> = {};
  const childIds = shellRegionOrder.map((regionId) => createShellRegionAreaId(surfaceId, regionId));

  areas[rootAreaId] = {
    id: rootAreaId,
    sourceId: 'shell',
    surfaceId,
    role: 'root',
    title: 'Core shell',
    parentId: null,
    childIds,
    isActive: true,
    isVisible: true,
    isOpen: true,
    actions: [],
    metadata: {
      regionIds: shellRegionOrder
    }
  };

  for (const regionId of shellRegionOrder) {
    const region = shellState.regions[regionId];
    const areaId = createShellRegionAreaId(surfaceId, regionId);
    const boundaryId = `${surfaceId}:boundary:${regionId}`;

    areas[areaId] = {
      id: areaId,
      sourceId: regionId,
      surfaceId,
      role: 'region',
      title: `${regionId} region`,
      parentId: rootAreaId,
      childIds: [],
      isActive: region.isOpen,
      isVisible: region.isVisible,
      isOpen: region.isOpen,
      actions: [
        createLayoutSurfaceAction('toggle-open', areaId, 'Toggle region'),
        createLayoutSurfaceAction('toggle-visibility', areaId, 'Toggle visibility'),
        createLayoutSurfaceAction('resize', boundaryId, 'Resize region')
      ],
      metadata: {
        activeWidgetId: region.activeWidgetId,
        regionId,
        size: region.size,
        widgetIds: [...region.widgetIds]
      }
    };

    boundaries[boundaryId] = {
      id: boundaryId,
      sourceId: regionId,
      surfaceId,
      orientation: regionId === 'bottom' ? 'vertical' : 'horizontal',
      areaIds: [rootAreaId, areaId],
      actions: [createLayoutSurfaceAction('resize', boundaryId, 'Resize region')],
      metadata: {
        regionId
      }
    };
  }

  return {
    id: surfaceId,
    kind: 'shell',
    title: 'Core shell',
    rootAreaId,
    areas,
    boundaries
  };
}

export function createWorkspaceLayoutSurfaceProjection(
  workspace: Workspace,
  windowId = workspace.activeWindowId
): LayoutSurfaceProjection {
  const activeWindow = resolveWorkspaceWindow(workspace, windowId);
  const surfaceId = `workspace:${workspace.id}:${activeWindow?.id ?? 'missing-window'}`;
  const areas: Record<string, LayoutSurfaceAreaProjection> = {};
  const boundaries: Record<string, LayoutSurfaceBoundaryProjection> = {};

  if (!activeWindow) {
    const rootAreaId = `${surfaceId}:root`;
    areas[rootAreaId] = {
      id: rootAreaId,
      sourceId: workspace.id,
      surfaceId,
      role: 'root',
      title: 'Workspace',
      parentId: null,
      childIds: [],
      isActive: false,
      isVisible: true,
      isOpen: true,
      actions: [],
      metadata: {
        activeWindowId: workspace.activeWindowId
      }
    };

    return {
      id: surfaceId,
      kind: 'workspace',
      title: 'Workspace',
      rootAreaId,
      areas,
      boundaries
    };
  }

  const rootAreaId = projectWorkspaceLayoutNode({
    node: activeWindow.root,
    surfaceId,
    parentId: null,
    workspace,
    areas,
    boundaries
  });

  return {
    id: surfaceId,
    kind: 'workspace',
    title: activeWindow.title,
    rootAreaId,
    areas,
    boundaries
  };
}

export function createLayoutSurfaceAction(
  kind: LayoutSurfaceActionKind,
  targetId: string,
  label: string,
  metadata?: JsonObject
): LayoutSurfaceActionProjection {
  return {
    kind,
    targetId,
    label,
    ...(metadata ? { metadata } : {})
  };
}

function resolveWorkspaceWindow(workspace: Workspace, windowId: string): WorkspaceWindow | undefined {
  return workspace.windows.find((entry) => entry.id === windowId) ?? workspace.windows[0];
}

function projectWorkspaceLayoutNode(input: {
  node: LayoutNode;
  surfaceId: string;
  parentId: string | null;
  workspace: Workspace;
  areas: Record<string, LayoutSurfaceAreaProjection>;
  boundaries: Record<string, LayoutSurfaceBoundaryProjection>;
}): string {
  if (input.node.kind === 'split') {
    return projectWorkspaceSplit(input.node, input);
  }

  return projectWorkspaceStack(input.node, input);
}

function projectWorkspaceSplit(
  split: SplitNode,
  input: {
    surfaceId: string;
    parentId: string | null;
    workspace: Workspace;
    areas: Record<string, LayoutSurfaceAreaProjection>;
    boundaries: Record<string, LayoutSurfaceBoundaryProjection>;
  }
): string {
  const areaId = createWorkspaceAreaId(input.surfaceId, split.id);
  const childIds = split.children.map((child) =>
    projectWorkspaceLayoutNode({
      ...input,
      node: child,
      parentId: areaId
    })
  ) as [string, string];
  const boundaryId = `${input.surfaceId}:boundary:${split.id}`;

  input.areas[areaId] = {
    id: areaId,
    sourceId: split.id,
    surfaceId: input.surfaceId,
    role: 'split',
    title: `${split.orientation} split`,
    parentId: input.parentId,
    childIds,
    isActive: false,
    isVisible: true,
    isOpen: true,
    actions: [
      createLayoutSurfaceAction('resize', boundaryId, 'Resize split'),
      createLayoutSurfaceAction('collapse', boundaryId, 'Collapse split')
    ],
    metadata: {
      orientation: split.orientation,
      sizes: [...split.sizes]
    }
  };

  input.boundaries[boundaryId] = {
    id: boundaryId,
    sourceId: split.id,
    surfaceId: input.surfaceId,
    orientation: split.orientation,
    areaIds: childIds,
    actions: [
      createLayoutSurfaceAction('resize', boundaryId, 'Resize split'),
      createLayoutSurfaceAction('collapse', boundaryId, 'Collapse split')
    ],
    metadata: {
      splitId: split.id,
      sizes: [...split.sizes]
    }
  };

  return areaId;
}

function projectWorkspaceStack(
  stack: StackNode,
  input: {
    surfaceId: string;
    parentId: string | null;
    workspace: Workspace;
    areas: Record<string, LayoutSurfaceAreaProjection>;
    boundaries: Record<string, LayoutSurfaceBoundaryProjection>;
  }
): string {
  const areaId = createWorkspaceAreaId(input.surfaceId, stack.id);
  const childIds = stack.children.map((panel) =>
    projectWorkspacePanel(panel, {
      ...input,
      parentId: areaId,
      activePanelId: stack.activeChildId
    })
  );

  input.areas[areaId] = {
    id: areaId,
    sourceId: stack.id,
    surfaceId: input.surfaceId,
    role: 'stack',
    title: 'Panel stack',
    parentId: input.parentId,
    childIds,
    isActive: true,
    isVisible: true,
    isOpen: true,
    actions: [
      createLayoutSurfaceAction('activate', areaId, 'Activate stack'),
      createLayoutSurfaceAction('dock', areaId, 'Dock panel'),
      createLayoutSurfaceAction('split', areaId, 'Split stack'),
      createLayoutSurfaceAction('move', areaId, 'Move stack')
    ],
    metadata: {
      activeChildId: stack.activeChildId,
      headerVisible: stack.headerVisible ?? true,
      panelIds: stack.children.map((panel) => panel.id)
    }
  };

  return areaId;
}

function projectWorkspacePanel(
  panel: PanelNode,
  input: {
    surfaceId: string;
    parentId: string;
    workspace: Workspace;
    areas: Record<string, LayoutSurfaceAreaProjection>;
    boundaries: Record<string, LayoutSurfaceBoundaryProjection>;
    activePanelId: string;
  }
): string {
  const areaId = createWorkspaceAreaId(input.surfaceId, panel.id);
  const toolInstance = panel.toolInstanceId ? input.workspace.toolInstances[panel.toolInstanceId] : undefined;

  input.areas[areaId] = {
    id: areaId,
    sourceId: panel.id,
    surfaceId: input.surfaceId,
    role: 'panel',
    title: panel.title,
    parentId: input.parentId,
    childIds: [],
    isActive: input.activePanelId === panel.id,
    isVisible: input.workspace.fullscreenPanelId ? input.workspace.fullscreenPanelId === panel.id : true,
    isOpen: true,
    actions: [
      createLayoutSurfaceAction('activate', areaId, 'Activate panel'),
      createLayoutSurfaceAction('dock', areaId, 'Dock panel'),
      createLayoutSurfaceAction('move', areaId, 'Move panel'),
      createLayoutSurfaceAction('split', areaId, 'Split panel'),
      createLayoutSurfaceAction('close', areaId, 'Close panel')
    ],
    metadata: {
      showFullscreenToggle: panel.showFullscreenToggle ?? true,
      toolId: toolInstance?.toolId ?? null,
      toolInstanceId: panel.toolInstanceId
    }
  };

  return areaId;
}

function createShellRegionAreaId(surfaceId: string, regionId: ShellRegionId): string {
  return `${surfaceId}:region:${regionId}`;
}

function createWorkspaceAreaId(surfaceId: string, sourceId: string): string {
  return `${surfaceId}:area:${sourceId}`;
}
