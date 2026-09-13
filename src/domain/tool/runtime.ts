import type { JsonObject } from '../shared/json';
import type { KonitifToolConsumedCapability } from '@konitif/core';
import type { WorkbenchRuntimeProjectionSessionPatch } from '../runtime/model';
import type { WorkbenchReadingLevel } from '../presentation/readingLevel';
import type { ToolDefinition, ToolInstance, ToolPanelLoadingState, ToolResourceLoadingState, ToolShellStatus } from './model';

// Compatibility facade: shell helpers have one implementation, independent of runtime services.
export * from './shell';

export interface ToolRuntimeSessionInfo {
  activePanelId: string | null;
  activeToolInstanceId: string | null;
  isActivePanel: boolean;
  isActiveToolInstance: boolean;
  layoutEditingEnabled: boolean;
}

export type ToolRuntimeCapabilityAvailability =
  | 'missing'
  | 'incompatible'
  | 'available'
  | 'mounted'
  | 'active';

export interface ToolRuntimeCapabilityProvider {
  toolId: string;
  capabilityVersion: string;
  toolVersion: string | null;
  availability: 'available' | 'mounted' | 'active';
  panelIds: readonly string[];
  toolInstanceIds: readonly string[];
}

export interface ToolRuntimeCapabilityProjection {
  requirement: Readonly<KonitifToolConsumedCapability>;
  availability: ToolRuntimeCapabilityAvailability;
  providers: readonly ToolRuntimeCapabilityProvider[];
}

export interface ToolRuntimeCapabilitySnapshot {
  list(): readonly ToolRuntimeCapabilityProjection[];
  get(capabilityId: string): ToolRuntimeCapabilityProjection | null;
}

export interface ToolRuntimeCapabilityAccess extends ToolRuntimeCapabilitySnapshot {
  /** Ask the shell to focus an existing compatible provider or open one. */
  request(capabilityId: string): boolean;
}

export interface ToolRuntimeContext {
  /**
   * Stable identity for the currently hosted tool instance.
   */
  toolInstanceId: string;
  /**
   * Stable identity for the panel currently hosting the tool.
   */
  panelId: string;
  /** Shell-owned reading projection for the hosted Tool. */
  readingLevel: WorkbenchReadingLevel;
  /**
   * Readonly session/focus snapshot for the current render.
   */
  session: Readonly<ToolRuntimeSessionInfo>;
  /** Shell-owned, readonly projection of the capabilities declared by this Tool. */
  capabilities: ToolRuntimeCapabilityAccess;
  /**
   * Replace the tool's serializable state snapshot.
   * Returns `false` when the payload is rejected.
   */
  setState(nextState: JsonObject): boolean;
  /**
   * Override the displayed panel title. Pass `null` to restore the definition default.
   * Returns `false` when the target panel or instance can no longer be resolved.
   */
  setPanelTitleOverride(nextTitle: string | null): boolean;
  /**
   * Update the tool's serializable shell status contribution. Pass `null` to clear it.
   * Returns `false` when the target instance can no longer be resolved.
   */
  setShellStatus(nextStatus: ToolShellStatus | null): boolean;
  /**
   * Update the panel-scoped loading overlay controlled by the hosted tool.
   * Returns `false` when the target instance can no longer be resolved.
   */
  setPanelLoading(nextLoading: ToolPanelLoadingState | null): boolean;
  /**
   * Update the top docked resource loading indicator controlled by the hosted tool.
   * Returns `false` when the target instance can no longer be resolved.
   */
  setResourceLoading(nextLoading: ToolResourceLoadingState | null): boolean;
  /**
   * Publish session-level projection metadata such as selected/focused entities.
   * Returns `false` when the host does not expose a projection session bridge.
   */
  publishRuntimeProjectionSession(patch: WorkbenchRuntimeProjectionSessionPatch): boolean;
  /**
   * Execute a registered shell command against the current tool instance.
   * Returns `false` when the command cannot be resolved or does not change state.
   */
  runCommand(commandId: string): boolean;
  /**
   * Ask the workspace host to open or focus a registered tool.
   * Returns `false` when the tool cannot be resolved or workspace state is unchanged.
   */
  openTool(toolId: string): boolean;
  /**
   * Returns whether the global app history currently exposes an undo step.
   */
  canUndoHistory(): boolean;
  /**
   * Returns whether the global app history currently exposes a redo step.
   */
  canRedoHistory(): boolean;
  /**
   * Undo the last app-scoped workspace mutation.
   * Returns `false` when no history step is available.
   */
  undoHistory(): boolean;
  /**
   * Redo the last reverted app-scoped workspace mutation.
   * Returns `false` when no history step is available.
   */
  redoHistory(): boolean;
}

/**
 * Lifecycle boundaries for hosted tools:
 * - mount: the tool component is instantiated by ToolHost for a resolved panel/tool pair
 * - restore: serialized ToolInstance.state is provided as normal props on mount; there is no separate hydrate hook
 * - unmount: the component is removed when the host panel closes, changes tool instance, or leaves the tree
 */
export interface HostedToolProps {
  definition: ToolDefinition;
  instance: ToolInstance;
  runtime: ToolRuntimeContext;
}
