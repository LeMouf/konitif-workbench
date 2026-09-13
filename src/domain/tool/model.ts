import type { JsonObject } from '../shared/json';
import type { KonitifToolCapabilities } from '@konitif/core';
import type { WorkbenchIconInput } from '../icon/model';
import type { ShellRegionId } from '../shell/model';
import type { WorkbenchReadingLevel, WorkbenchReadingLevelPresentation } from '../presentation/readingLevel';

export type ToolOpeningPolicy =
  | {
      mode: 'singleton-global';
      onOpen: 'focus-existing';
    }
  | {
      mode: 'multi-instance';
    };

export type ToolPanelSplitPolicy =
  | {
      mode: 'fresh-instance';
    }
  | {
      mode: 'clone-serializable-state';
    }
  | {
      mode: 'share-instance';
    }
  | {
      mode: 'custom';
    };

export type ToolShellStatusTone = 'neutral' | 'attention' | 'success';

export interface ToolShellStatus {
  label: string;
  tone?: ToolShellStatusTone;
}

export interface ToolPanelLoadingState {
  label: string;
  detail?: string;
}

export interface ToolResourceLoadingState {
  label: string;
  detail?: string;
  /**
   * Normalized progress ratio in the [0, 1] range.
   * `null` or `undefined` means indeterminate.
   */
  progress?: number | null;
}

export interface ToolShellState {
  status: ToolShellStatus | null;
  /** Optional user override persisted for this Tool instance only. */
  readingLevel?: WorkbenchReadingLevel;
}

export interface ToolShellCommand {
  id: string;
  title: string;
  description: string;
  keywords?: string[];
}

export interface ToolShellHeaderActionLabelContext {
  command: ToolShellCommand;
  definition: ToolDefinition;
  instance: ToolInstance;
}

export interface ToolShellHeaderAction {
  commandId: string;
  label: string;
  icon?: WorkbenchIconInput;
  group?: 'tool' | 'dock';
  frequency?: 'common' | 'advanced' | 'debug';
  headerButton?: boolean;
  labelTranslationKey?: string;
  resolveLabel?(context: ToolShellHeaderActionLabelContext): string;
  resolveLabelTranslationKey?(context: ToolShellHeaderActionLabelContext): string | null;
  resolveActive?(context: ToolShellHeaderActionLabelContext): boolean;
  children?: ToolShellHeaderAction[];
}

export interface ToolShellWidgetDock {
  commandId: string;
  dockId: string;
  title: string;
  icon?: WorkbenchIconInput;
  defaultRegionId: ShellRegionId;
  defaultVisible?: boolean;
  legacyVisibleKey?: string | null;
  rootWidgetId?: string | null;
  showLabel?: string;
  hideLabel?: string;
  showTranslationKey?: string;
  hideTranslationKey?: string;
}

export interface ToolShellCommandContext {
  commandId: string;
  definition: ToolDefinition;
  instance: ToolInstance;
}

export interface ToolShellCommandResult {
  nextState?: JsonObject;
  nextPanelTitleOverride?: string | null;
  nextStatus?: ToolShellStatus | null;
}

export interface ToolShellContributionDefinition {
  initialStatus?: ToolShellStatus | null;
  /**
   * Selects the single surface responsible for rendering the Tool status.
   * The panel chrome remains the compatibility default; Tools that already
   * expose the status in their own header must opt into `tool-header` to avoid
   * projecting the same information twice.
   */
  statusPlacement?: 'panel-chrome' | 'tool-header';
  commands?: ToolShellCommand[];
  headerActions?: ToolShellHeaderAction[];
  widgetDocks?: ToolShellWidgetDock[];
  executeCommand?(context: ToolShellCommandContext): ToolShellCommandResult | null;
}

export type ToolFullscreenCompanionPlacement =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export interface ToolFullscreenCompanionSize {
  width: number;
  height: number;
}

export interface ToolFullscreenCompanionChromePolicy {
  header?: boolean;
  menu?: boolean;
  fullscreen?: boolean;
  dockButtons?: boolean;
}

export interface ToolFullscreenCompanionBehaviorPolicy {
  pinned?: boolean;
  draggable?: boolean;
  collapsible?: boolean;
  passthroughWhenCollapsed?: boolean;
}

export interface ToolFullscreenCompanionActivationPolicy {
  sourceStateKey: string;
  defaultEnabled?: boolean;
}

export interface ToolFullscreenCompanionDefinition {
  id: string;
  toolId: string;
  mode: string;
  sourceStateKeys?: string[];
  placement: ToolFullscreenCompanionPlacement;
  size: ToolFullscreenCompanionSize;
  chrome?: ToolFullscreenCompanionChromePolicy;
  behavior?: ToolFullscreenCompanionBehaviorPolicy;
  activation?: ToolFullscreenCompanionActivationPolicy;
}

export interface ToolDefinition {
  id: string;
  title: string;
  icon?: WorkbenchIconInput;
  /**
   * Default panel title applied when a tool is opened into a panel.
   */
  panelTitle: string;
  description: string;
  keywords?: string[];
  openingPolicy: ToolOpeningPolicy;
  /**
   * Versioned capabilities supplied and consumed by the Tool.
   * The Workbench resolves these declarations against its registered catalog and
   * projects availability to the hosted Tool without exposing neighboring state.
   */
  capabilities?: KonitifToolCapabilities;
  /**
   * Future-facing split semantics:
   * - `fresh-instance`: create a brand new tool instance in the new panel
   * - `clone-serializable-state`: duplicate from current serializable state into a new instance
   * - `share-instance`: point both panels at the same tool instance
   * - `custom`: reserved for tool-specific logic later
   *
   * Current workbench behavior still preserves the existing panel/tool instance during layout reorganizations,
   * and does not yet automatically duplicate tools on split.
   */
  panelSplitPolicy?: ToolPanelSplitPolicy;
  /** Generic shell presentation preferences declared by the hosted tool. */
  panelPresentation?: {
    immersiveWhenTabsHidden?: boolean;
    /** Optional shared Casual / Advanced / Expert projection contract. */
    readingLevel?: WorkbenchReadingLevelPresentation;
  };
  /**
   * Serializable default instance state used when creating a new tool instance.
   */
  initialState: JsonObject;
  /**
   * Optional shell-facing contribution surface resolved by the workbench.
   */
  shell?: ToolShellContributionDefinition;
  /**
   * Optional companion tools rendered by the shell when this tool owns a fullscreen panel.
   * The fullscreen tool declares the companion relationship; the companion tool provides a
   * mode-specific projection through its normal component surface.
   */
  fullscreenCompanions?: ToolFullscreenCompanionDefinition[];
}

export interface ToolInstance {
  id: string;
  toolId: string;
  /**
   * Serializable instance state owned by the workspace snapshot.
   */
  state: JsonObject;
  /**
   * Optional serializable title override requested by the hosted tool runtime.
   * `null` means "use the ToolDefinition.panelTitle default".
   */
  panelTitleOverride: string | null;
  /**
   * Optional serializable shell-facing state controlled through the tool runtime.
   */
  shellState?: ToolShellState;
}

export interface ToolCatalogPort {
  getDefinition(toolId: string): ToolDefinition | undefined;
}

export type ToolCatalog = ToolCatalogPort;
