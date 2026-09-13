import { cloneJsonObject, isJsonObject } from '../../domain/shared/json';
import type { ToolCatalogPort } from '../../domain/tool/model';
import {
  CYCLE_TOOL_READING_LEVEL_COMMAND_ID,
  INHERIT_TOOL_READING_LEVEL_COMMAND_ID,
  normalizePanelTitleOverride,
  normalizeToolShellStatus,
  resolvePanelTitle,
  resolveToolReadingLevel,
  SET_TOOL_READING_LEVEL_ADVANCED_COMMAND_ID,
  SET_TOOL_READING_LEVEL_CASUAL_COMMAND_ID,
  SET_TOOL_READING_LEVEL_EXPERT_COMMAND_ID
} from '../../domain/tool/shell';
import { normalizeWorkbenchReadingLevels, type WorkbenchReadingLevel } from '../../domain/presentation/readingLevel';
import type { Workspace } from '../../domain/workspace/model';
import { findPanelInWorkspace } from '../../domain/workspace/selectors';
import { updatePanelById } from './layoutTree';

interface RunToolShellCommandInput {
  panelId: string;
  toolInstanceId: string;
  commandId: string;
  inheritedReadingLevel?: WorkbenchReadingLevel;
}

export function runToolShellCommand(
  workspace: Workspace,
  input: RunToolShellCommandInput,
  toolCatalog: ToolCatalogPort
): Workspace {
  const panel = findPanelInWorkspace(workspace, input.panelId);
  const toolInstance = workspace.toolInstances[input.toolInstanceId];

  if (!panel || panel.toolInstanceId !== input.toolInstanceId || !toolInstance) {
    return workspace;
  }

  const toolDefinition = toolCatalog.getDefinition(toolInstance.toolId);
  if (toolDefinition) {
    const nextReadingLevel = resolveReadingLevelCommand(
      toolDefinition,
      toolInstance,
      input.commandId,
      input.inheritedReadingLevel
    );
    if (nextReadingLevel) {
      const inheritedShellState = { ...(toolInstance.shellState ?? {
        status: null
      }) };
      delete inheritedShellState.readingLevel;
      return {
        ...workspace,
        toolInstances: {
          ...workspace.toolInstances,
          [input.toolInstanceId]: {
            ...toolInstance,
            shellState: {
              ...inheritedShellState,
              status: toolInstance.shellState?.status ?? null,
              ...(nextReadingLevel === 'inherit' ? {} : { readingLevel: nextReadingLevel })
            }
          }
        }
      };
    }
  }
  const shell = toolDefinition?.shell;
  const command = shell?.commands?.find((entry) => entry.id === input.commandId);

  if (!toolDefinition || !shell || !command || !shell.executeCommand) {
    return workspace;
  }

  const result = shell.executeCommand({
    commandId: input.commandId,
    definition: toolDefinition,
    instance: toolInstance
  });

  if (!result) {
    return workspace;
  }

  if ('nextState' in result && result.nextState !== undefined && !isJsonObject(result.nextState)) {
    return workspace;
  }

  let nextToolInstance = toolInstance;
  let shouldUpdateToolInstance = false;
  let shouldUpdatePanelTitle = false;

  if ('nextState' in result && result.nextState !== undefined) {
    nextToolInstance = {
      ...nextToolInstance,
      state: cloneJsonObject(result.nextState)
    };
    shouldUpdateToolInstance = true;
  }

  if ('nextStatus' in result) {
    const nextStatus = normalizeToolShellStatus(result.nextStatus);
    if (result.nextStatus !== null && nextStatus === null) {
      return workspace;
    }
    nextToolInstance = {
      ...nextToolInstance,
      shellState: {
        ...nextToolInstance.shellState,
        status: nextStatus
      }
    };
    shouldUpdateToolInstance = true;
  }

  if ('nextPanelTitleOverride' in result) {
    nextToolInstance = {
      ...nextToolInstance,
      panelTitleOverride: normalizePanelTitleOverride(result.nextPanelTitleOverride ?? null)
    };
    shouldUpdateToolInstance = true;
    shouldUpdatePanelTitle = true;
  }

  if (!shouldUpdateToolInstance) {
    return workspace;
  }

  const nextWorkspace = {
    ...workspace,
    toolInstances: {
      ...workspace.toolInstances,
      [input.toolInstanceId]: nextToolInstance
    }
  };

  if (!shouldUpdatePanelTitle) {
    return nextWorkspace;
  }

  return {
    ...nextWorkspace,
    windows: nextWorkspace.windows.map((window) => ({
      ...window,
      root: updatePanelById(window.root, input.panelId, (currentPanel) => ({
        ...currentPanel,
        title: resolvePanelTitle(toolDefinition, nextToolInstance)
      }))
    }))
  };
}

function resolveReadingLevelCommand(
  definition: NonNullable<ReturnType<ToolCatalogPort['getDefinition']>>,
  instance: Parameters<typeof resolveToolReadingLevel>[1],
  commandId: string,
  inheritedReadingLevel?: WorkbenchReadingLevel
): WorkbenchReadingLevel | 'inherit' | null {
  const presentation = definition.panelPresentation?.readingLevel;
  if (!presentation) return null;

  const availableLevels = normalizeWorkbenchReadingLevels(presentation);
  if (availableLevels.length <= 1) return null;

  if (commandId === INHERIT_TOOL_READING_LEVEL_COMMAND_ID) {
    return 'inherit';
  }
  const requestedLevelByCommand: Partial<Record<string, WorkbenchReadingLevel>> = {
    [SET_TOOL_READING_LEVEL_CASUAL_COMMAND_ID]: 'casual',
    [SET_TOOL_READING_LEVEL_ADVANCED_COMMAND_ID]: 'advanced',
    [SET_TOOL_READING_LEVEL_EXPERT_COMMAND_ID]: 'expert'
  };
  const requestedLevel = requestedLevelByCommand[commandId];

  if (requestedLevel) {
    return availableLevels.includes(requestedLevel) ? requestedLevel : null;
  }

  if (commandId !== CYCLE_TOOL_READING_LEVEL_COMMAND_ID && commandId !== 'workbench.tool.reading-level') {
    return null;
  }

  const currentLevel = resolveToolReadingLevel(definition, instance, inheritedReadingLevel);
  const currentIndex = Math.max(0, availableLevels.indexOf(currentLevel));
  return availableLevels[(currentIndex + 1) % availableLevels.length] ?? presentation.defaultLevel;
}
