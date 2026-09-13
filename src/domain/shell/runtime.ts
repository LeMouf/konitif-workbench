import type { PanelNode } from '../panel/model';
import type { DesignSystemThemeSession } from '../design-system/themeSession';
import type { JsonObject } from '../shared/json';
import type { ToolCatalogPort, ToolDefinition, ToolInstance } from '../tool/model';
import type { Workspace } from '../workspace/model';
import { findPanelInWorkspace } from '../workspace/selectors';
import type { WorkspaceFocus } from '../workspace/session';
import { resolveToolReadingLevel } from '../tool/shell';
import type { WorkbenchReadingLevel } from '../presentation/readingLevel';
import type { ShellRegionId, ShellWidgetDefinition } from './model';

export interface ShellWidgetSessionInfo {
  activePanelId: string | null;
  activePanelTitle: string | null;
  activeToolInstanceId: string | null;
  activeToolId: string | null;
  activeToolTitle: string | null;
}

export interface ShellWidgetDesignSystemEntity {
  id: string;
  kind: string;
  title: string;
  summary: string;
  status: string;
  source: string;
  designNodeIds: string[];
  tokens: string[];
  cssVariables: string[];
  widgetIds: string[];
  toolIds: string[];
  runtimeProjectionKinds: string[];
  capabilities: string[];
}

export interface ShellWidgetDesignSystemRelation {
  id: string;
  from: string;
  to: string;
  kind: string;
}

export interface ShellWidgetDesignSystemContext {
  themeSession: DesignSystemThemeSession | null;
  entities: ShellWidgetDesignSystemEntity[];
  relations: ShellWidgetDesignSystemRelation[];
  totals: {
    entities: number;
    widgets: number;
    tools: number;
    panels: number;
    runtimeProjections: number;
    undoBridges: number;
  };
}

export interface ShellWidgetRuntimeContext {
  regionId: ShellRegionId;
  widgetId: string;
  workspace: Workspace;
  focus: WorkspaceFocus;
  session: Readonly<ShellWidgetSessionInfo>;
  designSystem: Readonly<ShellWidgetDesignSystemContext> | null;
  /** Reading projection inherited from the active Tool when one exists. */
  readingLevel: WorkbenchReadingLevel;
  setActiveToolState(nextState: JsonObject): boolean;
  setToolState(toolInstanceId: string, nextState: JsonObject): boolean;
}

export interface HostedShellWidgetProps {
  definition: ShellWidgetDefinition;
  runtime: ShellWidgetRuntimeContext;
}

interface CreateShellWidgetRuntimeContextInput {
  regionId: ShellRegionId;
  widgetId: string;
  workspace: Workspace;
  focus: WorkspaceFocus;
  toolCatalog: ToolCatalogPort;
  designSystem?: ShellWidgetDesignSystemContext | null;
  updateToolState?: (toolInstanceId: string, nextState: JsonObject) => boolean;
  inheritedReadingLevel?: WorkbenchReadingLevel;
}

export function createShellWidgetRuntimeContext(
  input: CreateShellWidgetRuntimeContextInput
): ShellWidgetRuntimeContext {
  const focusedPanel = input.focus.activePanelId
    ? findPanelInWorkspace(input.workspace, input.focus.activePanelId)
    : undefined;
  const focusedToolInstance = input.focus.activeToolInstanceId
    ? input.workspace.toolInstances[input.focus.activeToolInstanceId]
    : undefined;
  const focusedToolDefinition = focusedToolInstance
    ? input.toolCatalog.getDefinition(focusedToolInstance.toolId)
    : undefined;

  return {
    regionId: input.regionId,
    widgetId: input.widgetId,
    workspace: input.workspace,
    focus: input.focus,
    session: createShellWidgetSessionInfo(focusedPanel, focusedToolInstance, focusedToolDefinition),
    designSystem: input.designSystem ?? null,
    readingLevel:
      focusedToolInstance && focusedToolDefinition
        ? resolveToolReadingLevel(
            focusedToolDefinition,
            focusedToolInstance,
            input.inheritedReadingLevel
          )
        : input.inheritedReadingLevel ?? 'casual',
    setActiveToolState(nextState) {
      const toolInstanceId = input.focus.activeToolInstanceId;

      return toolInstanceId ? input.updateToolState?.(toolInstanceId, nextState) ?? false : false;
    },
    setToolState(toolInstanceId, nextState) {
      return toolInstanceId ? input.updateToolState?.(toolInstanceId, nextState) ?? false : false;
    }
  };
}

function createShellWidgetSessionInfo(
  panel: PanelNode | undefined,
  toolInstance: ToolInstance | undefined,
  toolDefinition: ToolDefinition | undefined
): ShellWidgetSessionInfo {
  return {
    activePanelId: panel?.id ?? null,
    activePanelTitle: panel?.title ?? null,
    activeToolInstanceId: toolInstance?.id ?? null,
    activeToolId: toolInstance?.toolId ?? null,
    activeToolTitle: toolDefinition?.title ?? null
  };
}
