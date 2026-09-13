// Local, explicit hosting slice. This is not the complete Workbench API or a
// resource lifecycle runtime. Implementations and workspace schemas stay shared.
export { createWorkspace } from './application/workspace/createWorkspace';
export { openTool } from './application/workspace/openTool';
export { splitPanel } from './application/workspace/splitPanel';
export { swapPanelArea } from './application/workspace/swapPanelArea';
export { closePanel } from './application/workspace/closePanel';
export { updateToolState } from './application/workspace/updateToolState';
export { exportWorkspaceSnapshot, importWorkspaceSnapshot } from './application/workspace/snapshots';
export { listPanelsInWorkspace } from './domain/workspace/selectors';
export { validateWorkspace } from './domain/workspace/validation';
export { InMemoryToolRegistry } from './infrastructure/tools/InMemoryToolRegistry';
export type { Workspace } from './domain/workspace/model';
export type { WorkspacePersistencePort } from './domain/workspace/persistence';
export type { ToolDefinition, ToolInstance, ToolCatalogPort } from './domain/tool/model';
export type { OpenToolResult } from './application/workspace/openTool';
export type { WorkspaceSnapshotImportResult } from './application/workspace/snapshots';
