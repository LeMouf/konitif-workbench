import type { JsonObject } from '../../domain/shared/json';
import { cloneJsonObject, isJsonObject } from '../../domain/shared/json';
import type { Workspace } from '../../domain/workspace/model';

interface UpdateToolStateInput {
  toolInstanceId: string;
  nextState: JsonObject;
}

export function updateToolState(workspace: Workspace, input: UpdateToolStateInput): Workspace {
  if (!isJsonObject(input.nextState)) {
    return workspace;
  }

  const toolInstance = workspace.toolInstances[input.toolInstanceId];

  if (!toolInstance) {
    return workspace;
  }

  return {
    ...workspace,
    toolInstances: {
      ...workspace.toolInstances,
      [input.toolInstanceId]: {
        ...toolInstance,
        state: cloneJsonObject(input.nextState)
      }
    }
  };
}
