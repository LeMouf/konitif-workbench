// Explicit workspace contracts for state orchestration. No host adapters.
// Reexports preserve the authority and identity of the existing implementations.
export {
  setShellRegionArrangement,
  setShellRegionWidgetProportions,
  createShellState,
  setShellRegionVisible,
  setShellRegionOpen,
  setShellRegionSize,
  activateShellWidget,
  setShellRegionWidgetVisible,
  addShellWidgetToRegion,
  moveShellWidgetToRegion,
  removeShellWidgetFromRegion
} from './application/shell/state';
export {
  collapseSplit
} from './application/workspace/collapseSplit';
export {
  collapseSplitBoundary
} from './application/workspace/collapseSplitBoundary';
export {
  dispatchWorkspaceCommand,
  type WorkspaceCommand
} from './application/workspace/commands';
export {
  createPeripheralBands
} from './application/workspace/createPeripheralBands';
export {
  createWorkspace
} from './application/workspace/createWorkspace';
export {
  detachPanelToWindow
} from './application/workspace/detachPanelToWindow';
export {
  reattachWorkspaceWindow
} from './application/workspace/reattachWorkspaceWindow';
export {
  dockPanel
} from './application/workspace/dockPanel';
export {
  joinPanelArea
} from './application/workspace/joinPanelArea';
export {
  createLayoutInteractionState,
  openLayoutSplitMenu,
  dismissLayoutInteraction,
  startPanelDrag,
  updatePanelDrag,
  commitPanelDock,
  selectLayoutMenuAction,
  selectLayoutSplitOrientation,
  updateLayoutSplitPreview,
  startLayoutSplitPreview,
  startBoundaryPull,
  updateBoundaryPull,
  commitBoundaryPull,
  startIntersectionResize,
  updateIntersectionResize,
  commitIntersectionResize,
  adjustLayoutSplitPreviewCuts,
  commitLayoutSplitPreview,
  commitLayoutSubdivideSelection,
  previewLayoutSplitSide,
  confirmLayoutSplitSide,
  type LayoutMenuActionSelection,
  type LayoutInteractionResolution
} from './application/workspace/layoutInteraction';
export {
  createWorkspaceSessionFromPreset,
  type WorkspacePresetId
} from './application/workspace/presets';
export {
  type WorkspacePresetArtifact
} from './application/workspace/presetArtifacts';
export {
  resizeSplit
} from './application/workspace/resizeSplit';
export {
  resizeSplitBoundary
} from './application/workspace/resizeSplitBoundary';
export {
  runToolShellCommand
} from './application/workspace/runToolShellCommand';
export {
  createWorkspaceSessionState,
  type WorkspaceFocus,
  type WorkspaceSessionState
} from './application/workspace/session';
export {
  setDesignSystemThemeSession
} from './application/workspace/setDesignSystemThemeSession';
export {
  normalizeWorkspaceFullscreenPanel,
  setWorkspaceFullscreenPanel
} from './application/workspace/setWorkspaceFullscreenPanel';
export {
  setToolPanelTitleOverride
} from './application/workspace/setToolPanelTitleOverride';
export {
  exportWorkspaceSnapshot,
  importWorkspaceSnapshot,
  type WorkspaceSnapshotImportResult
} from './application/workspace/snapshots';
export {
  subdividePanel
} from './application/workspace/subdividePanel';
export {
  swapPanelArea
} from './application/workspace/swapPanelArea';
export {
  type ToolRuntimeHostActions
} from './application/workspace/toolRuntime';
export {
  updateToolState
} from './application/workspace/updateToolState';
export {
  type SplitOrientation
} from './domain/layout/model';
export {
  type LayoutEdge,
  type LayoutDockSide,
  type LayoutMenuActionId,
  type LayoutMenuTarget,
  type LayoutDockTarget,
  type LayoutInteractionState
} from './domain/layout/interaction';
export {
  type DesignSystemThemeSession
} from './domain/design-system/themeSession';
export {
  type ShellRegionId,
  type ShellRegionPresentation,
  type ShellRegionAxis,
  type ShellState,
  type ShellWidgetPlacement,
  type ShellWidgetCatalog
} from './domain/shell/model';
export {
  type JsonObject
} from './domain/shared/json';
export {
  type ToolShellStatus,
  type ToolPanelLoadingState,
  type ToolResourceLoadingState,
  type ToolCatalog
} from './domain/tool/model';
export {
  normalizeToolShellStatus,
  normalizeToolPanelLoadingState,
  normalizeToolResourceLoadingState
} from './domain/tool/runtime';
export {
  type Workspace
} from './domain/workspace/model';
export {
  type WorkspacePersistencePort
} from './domain/workspace/persistence';
export {
  findPanelInWorkspace,
  getPreferredFocusedPanelId
} from './domain/workspace/selectors';
export {
  validateWorkspace
} from './domain/workspace/validation';
export * from './application/workspace/presetArtifacts';
export * from './application/workspace/presetSelection';
export * from './application/workspace/usageSnapshots';
export * from './application/launch/workbenchLaunchPolicy';
export * from './application/tool/experienceToolSelection';
export * from './application/workspace/unassignTool';
export * from './application/workspace/parkedTool';
export * from './application/workspace/workspacePresetCatalogAdmission';
export type { WorkbenchCatalogElementVersion } from './domain/catalog/version';
export type { WorkbenchCatalogMedia, WorkbenchCatalogPresentation } from './domain/catalog/presentation';
// Authored seed construction uses the same factories as the complete Workbench.
export { createPanel, createStack, createSplit, createWorkspaceWindow, createWorkspaceShell } from './domain/workspace/factories';
export { cloneJsonObject } from './domain/shared/json';
export { createInitialToolShellState } from './domain/tool/shell';
export { patchWorkbenchToolDockVisibilityState } from './domain/widget/toolDock';
export type { ToolDefinition, ToolInstance, ToolCatalogPort } from './domain/tool/model';
export type { ShellWidgetCatalogPort } from './domain/shell/model';
export { InMemoryToolRegistry } from './infrastructure/tools/InMemoryToolRegistry';
