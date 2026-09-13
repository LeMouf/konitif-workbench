import {
  normalizeWorkbenchReadingLevels,
  resolveWorkbenchReadingLevel,
  type WorkbenchReadingLevel
} from '../presentation/readingLevel';
import type { WorkbenchIconInput } from '../icon/model';
import type {
  ToolDefinition,
  ToolInstance,
  ToolPanelLoadingState,
  ToolResourceLoadingState,
  ToolShellCommand,
  ToolShellHeaderAction,
  ToolShellWidgetDock,
  ToolShellState,
  ToolShellStatus
} from './model';

export function normalizePanelTitleOverride(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

export function normalizeToolShellStatus(value: unknown): ToolShellStatus | null {
  if (value === null || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<ToolShellStatus>;
  if (typeof candidate.label !== 'string') {
    return null;
  }

  const label = candidate.label.trim();

  if (label.length === 0) {
    return null;
  }

  const tone = candidate.tone ?? 'neutral';
  return {
    label,
    tone: tone === 'attention' || tone === 'success' ? tone : 'neutral'
  };
}

export function normalizeToolPanelLoadingState(
  value: ToolPanelLoadingState | null | undefined
): ToolPanelLoadingState | null {
  if (!value) {
    return null;
  }

  const label = value.label.trim();

  if (label.length === 0) {
    return null;
  }

  const detail = value.detail?.trim();
  return detail
    ? {
        label,
        detail
      }
    : {
        label
      };
}

export function normalizeToolResourceLoadingState(
  value: ToolResourceLoadingState | null | undefined
): ToolResourceLoadingState | null {
  if (!value) {
    return null;
  }

  const label = value.label.trim();

  if (label.length === 0) {
    return null;
  }

  const detail = value.detail?.trim();
  const rawProgress = value.progress;
  const progress =
    typeof rawProgress === 'number' && Number.isFinite(rawProgress)
      ? Math.max(0, Math.min(rawProgress, 1))
      : null;

  return {
    label,
    ...(detail ? { detail } : {}),
    ...(progress === null ? {} : { progress })
  };
}

export function createInitialToolShellState(definition: ToolDefinition): ToolShellState {
  return {
    status: normalizeToolShellStatus(definition.shell?.initialStatus)
  };
}

export const TOOL_READING_LEVEL_MENU_COMMAND_ID = 'workbench.tool.reading-level';
export const CYCLE_TOOL_READING_LEVEL_COMMAND_ID = 'workbench.tool.reading-level.cycle';
export const INHERIT_TOOL_READING_LEVEL_COMMAND_ID = 'workbench.tool.reading-level.inherit';
export const SET_TOOL_READING_LEVEL_CASUAL_COMMAND_ID = 'workbench.tool.reading-level.casual';
export const SET_TOOL_READING_LEVEL_ADVANCED_COMMAND_ID = 'workbench.tool.reading-level.advanced';
export const SET_TOOL_READING_LEVEL_EXPERT_COMMAND_ID = 'workbench.tool.reading-level.expert';

export function resolveToolReadingLevel(
  definition: ToolDefinition,
  instance: ToolInstance,
  inheritedDefault?: WorkbenchReadingLevel
): WorkbenchReadingLevel {
  return resolveWorkbenchReadingLevel(
    instance.shellState?.readingLevel,
    definition.panelPresentation?.readingLevel,
    inheritedDefault
  );
}

export function resolvePanelTitle(definition: ToolDefinition, instance: ToolInstance): string {
  return normalizePanelTitleOverride(instance.panelTitleOverride) ?? definition.panelTitle;
}

export interface ResolvedToolShellHeaderAction {
  commandId: string;
  label: string;
  icon?: WorkbenchIconInput;
  group: 'tool' | 'dock';
  frequency?: 'common' | 'advanced' | 'debug';
  headerButton?: boolean;
  active?: boolean;
  labelTranslationKey?: string;
  title: string;
  description: string;
  keywords?: string[];
  children?: ResolvedToolShellHeaderAction[];
}

export interface ResolvedToolShellContribution {
  status: ToolShellStatus | null;
  statusPlacement: 'panel-chrome' | 'tool-header';
  commands: ToolShellCommand[];
  headerActions: ResolvedToolShellHeaderAction[];
  widgetDocks: ToolShellWidgetDock[];
}

export function resolveToolShellContribution(
  definition: ToolDefinition,
  instance: ToolInstance,
  inheritedReadingLevel?: WorkbenchReadingLevel
): ResolvedToolShellContribution {
  const readingLevelPresentation = definition.panelPresentation?.readingLevel;
  const availableReadingLevels = normalizeWorkbenchReadingLevels(readingLevelPresentation);
  const readingLevel = resolveToolReadingLevel(definition, instance, inheritedReadingLevel);
  const exposesReadingLevelChoice = availableReadingLevels.length > 1;
  const readingCommands: ToolShellCommand[] = exposesReadingLevelChoice
    ? [
        {
          id: TOOL_READING_LEVEL_MENU_COMMAND_ID,
          title: 'Reading level',
          description: 'Cycle the Tool projection through its available reading levels.'
        },
        {
          id: INHERIT_TOOL_READING_LEVEL_COMMAND_ID,
          title: 'Use default reading level',
          description: 'Remove the local override and use the Tool or shell default.'
        },
        ...availableReadingLevels.map((level) => ({
          id: `workbench.tool.reading-level.${level}`,
          title: `${level[0]?.toUpperCase()}${level.slice(1)} reading level`,
          description: `Project this Tool at the ${level} reading level.`
        }))
      ]
    : [];
  const commands = [...(definition.shell?.commands ?? []), ...readingCommands];
  const commandsById = new Map(commands.map((command) => [command.id, command]));
  const resolveHeaderAction = (action: ToolShellHeaderAction): ResolvedToolShellHeaderAction | null => {
    const command = commandsById.get(action.commandId);

    if (!command) {
      return null;
    }

    const children = (action.children ?? []).flatMap((child) => {
      const resolvedChild = resolveHeaderAction(child);
      return resolvedChild ? [resolvedChild] : [];
    });

    const active = action.resolveActive?.({ command, definition, instance }) ?? false;

    return {
      commandId: action.commandId,
      label: action.resolveLabel?.({ command, definition, instance }) || action.label,
      icon: action.icon,
      group: action.group ?? 'tool',
      frequency: action.frequency,
      ...(action.headerButton ? { headerButton: true } : {}),
      ...(active ? { active } : {}),
      labelTranslationKey:
        action.resolveLabelTranslationKey?.({ command, definition, instance }) ?? action.labelTranslationKey,
      title: command.title,
      description: command.description,
      keywords: command.keywords,
      ...(children.length > 0 ? { children } : {})
    };
  };
  const readingLevelAction: ToolShellHeaderAction[] = exposesReadingLevelChoice
    ? [
        {
          commandId: TOOL_READING_LEVEL_MENU_COMMAND_ID,
          label: 'Reading level',
          labelTranslationKey: 'ui.shell.tool.readingLevel.label',
          icon: 'action.settings',
          group: 'tool',
          frequency: 'advanced',
          children: [
            {
              commandId: INHERIT_TOOL_READING_LEVEL_COMMAND_ID,
              label: 'Use default',
              labelTranslationKey: 'ui.shell.readingLevel.inherit',
              group: 'tool',
              frequency: 'advanced',
              resolveActive: () => instance.shellState?.readingLevel === undefined
            },
            ...availableReadingLevels.map((level) => ({
              commandId: `workbench.tool.reading-level.${level}`,
              label: `${level[0]?.toUpperCase()}${level.slice(1)}`,
              labelTranslationKey: `ui.shell.readingLevel.${level}`,
              group: 'tool' as const,
              frequency: 'advanced' as const,
              resolveActive: () => instance.shellState?.readingLevel !== undefined && readingLevel === level
            }))
          ]
        }
      ]
    : [];
  const headerActions = [...(definition.shell?.headerActions ?? []), ...readingLevelAction].flatMap(
    (action): ResolvedToolShellHeaderAction[] => {
      const resolvedAction = resolveHeaderAction(action);
      return resolvedAction ? [resolvedAction] : [];
    }
  );

  return {
    status: instance.shellState
      ? normalizeToolShellStatus(instance.shellState.status)
      : normalizeToolShellStatus(definition.shell?.initialStatus),
    statusPlacement: definition.shell?.statusPlacement ?? 'panel-chrome',
    commands,
    headerActions,
    widgetDocks: (definition.shell?.widgetDocks ?? []).map((dock) => ({ ...dock }))
  };
}
