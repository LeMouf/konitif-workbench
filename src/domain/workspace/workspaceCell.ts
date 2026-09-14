export type WorkspaceCellCapabilityClassification = 'provided' | 'required' | 'optional' | 'private';

export type WorkspaceCellBoundaryStatus = 'explicit' | 'implicit' | 'hidden' | 'missing';

export type WorkspaceCellProjectionStatus = 'explicit' | 'implicit' | 'hidden' | 'missing';

export type WorkspaceCellIncarnationStatus = 'live' | 'persisted' | 'transient' | 'derived';

export type WorkspaceCellHostScope = 'root' | 'panel' | 'tool' | 'widget' | 'observer';

export interface WorkspaceCellIdentity {
  id: string;
  label: string;
  source: string;
  description: string;
}

export interface WorkspaceCellCapability {
  id: string;
  label: string;
  classification: WorkspaceCellCapabilityClassification;
  description: string;
}

export interface WorkspaceCellBoundary {
  id: string;
  label: string;
  status: WorkspaceCellBoundaryStatus;
  description: string;
}

export interface WorkspaceCellCompositionElement {
  id: string;
  label: string;
  kind: 'workspace' | 'window' | 'layout-tree' | 'split' | 'stack' | 'panel' | 'tool-instance' | 'widget-zone' | 'widget-placement';
  description: string;
}

export interface WorkspaceCellProjection {
  id: string;
  label: string;
  status: WorkspaceCellProjectionStatus;
  description: string;
}

export interface WorkspaceCellIncarnation {
  id: string;
  label: string;
  status: WorkspaceCellIncarnationStatus;
  description: string;
}

export interface WorkspaceCellHostSurface {
  id: string;
  label: string;
  hostScope: WorkspaceCellHostScope;
  description: string;
}

export interface WorkspaceCellDeclaration {
  id: 'workbench.workspace';
  moduleId: 'workbench.workspace';
  identity: WorkspaceCellIdentity;
  capabilities: readonly WorkspaceCellCapability[];
  boundaries: readonly WorkspaceCellBoundary[];
  composition: readonly WorkspaceCellCompositionElement[];
  projections: readonly WorkspaceCellProjection[];
  incarnation: readonly WorkspaceCellIncarnation[];
  hostSurfaces: readonly WorkspaceCellHostSurface[];
}

const workspaceCellIdentity = {
  id: 'workbench.workspace',
  label: 'Workspace',
  source: 'src/domain/workspace',
  description: 'Structural host module for windows, layout trees, panels, tool instances, widget zones, and persisted workspace snapshots.'
} as const satisfies WorkspaceCellIdentity;

const workspaceCellCapabilities = [
  {
    id: 'workspace.create-shell',
    label: 'Create workspace shell',
    classification: 'provided',
    description: 'Provides the structural workspace shell made of windows, a root layout tree, panel stacks, and empty tool slots.'
  },
  {
    id: 'workspace.open-tools',
    label: 'Open tools',
    classification: 'provided',
    description: 'Places tool instances into panels and preserves singleton tool placement rules when a catalog definition requires them.'
  },
  {
    id: 'workspace.split-panels',
    label: 'Split panels',
    classification: 'provided',
    description: 'Creates horizontal and vertical layout splits around stack and panel surfaces.'
  },
  {
    id: 'workspace.dock-panels',
    label: 'Dock panels',
    classification: 'provided',
    description: 'Moves panels between stacks, workspace edges, and tab positions while preserving canonical layout structure.'
  },
  {
    id: 'workspace.close-focus-panels',
    label: 'Close and focus panels',
    classification: 'provided',
    description: 'Controls panel closure, active stack child state, active panel focus, and active tool instance focus.'
  },
  {
    id: 'workspace.manage-windows',
    label: 'Manage windows',
    classification: 'provided',
    description: 'Hosts one or more workspace windows and tracks the active window as the current structural root.'
  },
  {
    id: 'workspace.compose-widget-zones',
    label: 'Compose widget zones',
    classification: 'provided',
    description: 'Composes widget zones, placements, ordering, active placement state, visibility, and pinning.'
  },
  {
    id: 'workspace.persist-snapshots',
    label: 'Persist snapshots',
    classification: 'provided',
    description: 'Exports and imports workspace snapshots through JSON validation and normalization.'
  },
  {
    id: 'workspace.host-tool-instances',
    label: 'Host tool instances',
    classification: 'provided',
    description: 'Owns live tool instances as workspace state and binds them to panel nodes.'
  },
  {
    id: 'workspace.project-layout',
    label: 'Project layout',
    classification: 'provided',
    description: 'Projects layout trees into visible panel chrome, split handles, docking previews, and fullscreen surfaces.'
  },
  {
    id: 'workspace.tool-catalog',
    label: 'Tool catalog',
    classification: 'required',
    description: 'Requires tool definitions when opening a tool and creating the corresponding tool shell state.'
  },
  {
    id: 'workspace.widget-catalog',
    label: 'Widget catalog',
    classification: 'required',
    description: 'Requires widget definitions to resolve placements into hosted widget runtime contexts.'
  }
] as const satisfies readonly WorkspaceCellCapability[];

const workspaceCellBoundaries = [
  {
    id: 'boundary.workspace.definition-instance',
    label: 'Workbench definition vs workspace instance',
    status: 'explicit',
    description: 'Separates declared workbench configuration from the instantiated Workspace object that users manipulate.'
  },
  {
    id: 'boundary.workspace.state-focus',
    label: 'Workspace state vs focus state',
    status: 'explicit',
    description: 'Separates durable workspace structure from transient focus over active panels and tool instances.'
  },
  {
    id: 'boundary.workspace.window-root',
    label: 'Window vs root layout',
    status: 'explicit',
    description: 'Each workspace window owns one layout root; the workspace tracks which window is active.'
  },
  {
    id: 'boundary.workspace.layout-panel',
    label: 'Layout node vs panel',
    status: 'explicit',
    description: 'Separates split and stack layout structure from concrete panel nodes hosted by stacks.'
  },
  {
    id: 'boundary.workspace.panel-tool-instance',
    label: 'Panel vs tool instance',
    status: 'explicit',
    description: 'Panels reference tool instances without becoming the tool implementation itself.'
  },
  {
    id: 'boundary.workspace.core-ui',
    label: 'Workspace core vs UI projection',
    status: 'implicit',
    description: 'Core declares workspace and layout state while workbench-ui projects it into DOM chrome and interaction surfaces.'
  },
  {
    id: 'boundary.workspace.widget-zone-placement',
    label: 'Widget zone vs placement',
    status: 'explicit',
    description: 'Separates widget zone definitions from concrete widget placements, ordering, active state, and visibility.'
  },
  {
    id: 'boundary.workspace.snapshot-incarnation',
    label: 'Living workspace vs snapshot',
    status: 'explicit',
    description: 'Separates the live Workspace incarnation from serialized JSON snapshots used for persistence and restore.'
  },
  {
    id: 'boundary.workspace.shell-tool-docks',
    label: 'Shell regions vs internal tool docks',
    status: 'hidden',
    description: 'Root shell widget regions and tool-internal docks share composition concepts but their unified ownership is still being stabilized.'
  },
  {
    id: 'boundary.workspace.interaction-state',
    label: 'Interaction state ownership',
    status: 'implicit',
    description: 'Resize, drag, dock preview, fullscreen, and layout menu state are derived from workspace state but owned by interaction controllers.'
  }
] as const satisfies readonly WorkspaceCellBoundary[];

const workspaceCellComposition = [
  {
    id: 'composition.workspace.root',
    label: 'Workspace',
    kind: 'workspace',
    description: 'Top-level structural host with identity, version, active window, windows, fullscreen panel, theme session, and tool instances.'
  },
  {
    id: 'composition.workspace.windows',
    label: 'Windows',
    kind: 'window',
    description: 'Workspace windows provide named roots for independent layout trees.'
  },
  {
    id: 'composition.workspace.layout-tree',
    label: 'Layout tree',
    kind: 'layout-tree',
    description: 'Recursive tree that alternates between split nodes and stack nodes.'
  },
  {
    id: 'composition.workspace.splits',
    label: 'Splits',
    kind: 'split',
    description: 'Horizontal and vertical split nodes hold exactly two children and normalized sizes.'
  },
  {
    id: 'composition.workspace.stacks',
    label: 'Stacks',
    kind: 'stack',
    description: 'Stack nodes contain one or more panels and a current active child.'
  },
  {
    id: 'composition.workspace.panels',
    label: 'Panels',
    kind: 'panel',
    description: 'Panels hold chrome state and optional references to hosted tool instances.'
  },
  {
    id: 'composition.workspace.tool-instances',
    label: 'Tool instances',
    kind: 'tool-instance',
    description: 'Tool instances carry tool id, panel title override, shell state, and tool-local state.'
  },
  {
    id: 'composition.workspace.widget-zones',
    label: 'Widget zones',
    kind: 'widget-zone',
    description: 'Widget zone definitions declare shell, panel, side, tool, and tool-dock surfaces.'
  },
  {
    id: 'composition.workspace.widget-placements',
    label: 'Widget placements',
    kind: 'widget-placement',
    description: 'Widget placements connect widgets to zones with ordering, visibility, pinning, and placement state.'
  }
] as const satisfies readonly WorkspaceCellCompositionElement[];

const workspaceCellProjections = [
  {
    id: 'projection.workspace.layout-tree',
    label: 'Layout tree',
    status: 'explicit',
    description: 'Projects workspace windows, splits, stacks, panels, and active child state into a visible layout surface.'
  },
  {
    id: 'projection.workspace.panel-chrome',
    label: 'Panel chrome',
    status: 'explicit',
    description: 'Projects panel headers, tool selectors, action menus, fullscreen controls, and stack tabs.'
  },
  {
    id: 'projection.workspace.split-handles',
    label: 'Split handles',
    status: 'explicit',
    description: 'Projects resize handles and split interaction affordances from layout geometry.'
  },
  {
    id: 'projection.workspace.docking-preview',
    label: 'Docking preview',
    status: 'explicit',
    description: 'Projects dock targets, boundary pulls, insertion previews, and compatible drop zones.'
  },
  {
    id: 'projection.workspace.widget-zones',
    label: 'Widget zones',
    status: 'explicit',
    description: 'Projects widget zones and placements into shell, root, panel, side, tool, and tool-dock surfaces.'
  },
  {
    id: 'projection.workspace.snapshot',
    label: 'Snapshot',
    status: 'explicit',
    description: 'Projects live workspace state to JSON snapshots and validates snapshots back into workspace structure.'
  },
  {
    id: 'projection.workspace.focus',
    label: 'Focus',
    status: 'explicit',
    description: 'Projects active panel and active tool instance focus as the current workspace attention point.'
  },
  {
    id: 'projection.workspace.fullscreen',
    label: 'Fullscreen',
    status: 'explicit',
    description: 'Projects fullscreen panel state and panel fullscreen toggle visibility.'
  },
  {
    id: 'projection.workspace.boundary-map',
    label: 'Boundary map',
    status: 'missing',
    description: 'A consolidated projection of workspace ownership and interaction boundaries has not been materialized yet.'
  }
] as const satisfies readonly WorkspaceCellProjection[];

const workspaceCellIncarnation = [
  {
    id: 'incarnation.workspace.active-workspace',
    label: 'Active workspace',
    status: 'live',
    description: 'The current Workspace object being manipulated by shell, layout, panel, tool, and widget interactions.'
  },
  {
    id: 'incarnation.workspace.active-window',
    label: 'Active window',
    status: 'live',
    description: 'The currently active workspace window and root layout tree.'
  },
  {
    id: 'incarnation.workspace.focus',
    label: 'Focus',
    status: 'transient',
    description: 'Current active panel id and active tool instance id.'
  },
  {
    id: 'incarnation.workspace.fullscreen-panel',
    label: 'Fullscreen panel',
    status: 'transient',
    description: 'Current fullscreen panel id, if any.'
  },
  {
    id: 'incarnation.workspace.tool-instances',
    label: 'Live tool instances',
    status: 'live',
    description: 'Live tool instance state hosted by panels.'
  },
  {
    id: 'incarnation.workspace.stack-active-child',
    label: 'Stack active child',
    status: 'live',
    description: 'Active child state for each panel stack.'
  },
  {
    id: 'incarnation.workspace.widget-placement-state',
    label: 'Widget placement state',
    status: 'persisted',
    description: 'Widget placement ordering, visibility, pinning, active placement, and placement-local state.'
  },
  {
    id: 'incarnation.workspace.interaction-state',
    label: 'Interaction state',
    status: 'transient',
    description: 'Drag, resize, dock preview, fullscreen transition, and layout menu state derived during user interaction.'
  },
  {
    id: 'incarnation.workspace.snapshot',
    label: 'Persisted snapshot',
    status: 'persisted',
    description: 'Serialized workspace snapshot that can be restored into a live Workspace incarnation.'
  },
  {
    id: 'incarnation.workspace.layout-geometry',
    label: 'Layout geometry',
    status: 'derived',
    description: 'DOM and interaction geometry derived from the layout tree for previews, handles, and resize operations.'
  }
] as const satisfies readonly WorkspaceCellIncarnation[];

const workspaceCellHostSurfaces = [
  {
    id: 'host.workspace.root-shell',
    label: 'Root shell',
    hostScope: 'root',
    description: 'Top-level shell surface that hosts workspace regions, global controls, and root widget zones.'
  },
  {
    id: 'host.workspace.window',
    label: 'Workspace window',
    hostScope: 'root',
    description: 'Window-level host for one root layout tree.'
  },
  {
    id: 'host.workspace.panel-stack',
    label: 'Panel stack',
    hostScope: 'panel',
    description: 'Stack host that manages panel tabs and active child state.'
  },
  {
    id: 'host.workspace.panel',
    label: 'Panel',
    hostScope: 'panel',
    description: 'Panel host for one tool instance and panel chrome.'
  },
  {
    id: 'host.workspace.tool-dock',
    label: 'Tool dock',
    hostScope: 'tool',
    description: 'Internal tool dock host surface for tool-local widget zones.'
  },
  {
    id: 'host.workspace.widget-zone',
    label: 'Widget zone',
    hostScope: 'widget',
    description: 'Named widget zone that hosts widget placements and active placement state.'
  },
  {
    id: 'host.workspace.observer',
    label: 'Observer',
    hostScope: 'observer',
    description: 'Diagnostic or projection observer surface that reads workspace state without owning it.'
  }
] as const satisfies readonly WorkspaceCellHostSurface[];

export const workspaceCellDeclaration = {
  id: 'workbench.workspace',
  moduleId: 'workbench.workspace',
  identity: workspaceCellIdentity,
  capabilities: workspaceCellCapabilities,
  boundaries: workspaceCellBoundaries,
  composition: workspaceCellComposition,
  projections: workspaceCellProjections,
  incarnation: workspaceCellIncarnation,
  hostSurfaces: workspaceCellHostSurfaces
} as const satisfies WorkspaceCellDeclaration;

export function getWorkspaceCellBoundariesByStatus(status: WorkspaceCellBoundaryStatus): WorkspaceCellBoundary[] {
  return workspaceCellDeclaration.boundaries.filter((boundary) => boundary.status === status);
}

export function getWorkspaceCellProjectionsByStatus(status: WorkspaceCellProjectionStatus): WorkspaceCellProjection[] {
  return workspaceCellDeclaration.projections.filter((projection) => projection.status === status);
}

export function getWorkspaceCellIncarnationByStatus(status: WorkspaceCellIncarnationStatus): WorkspaceCellIncarnation[] {
  return workspaceCellDeclaration.incarnation.filter((incarnation) => incarnation.status === status);
}
