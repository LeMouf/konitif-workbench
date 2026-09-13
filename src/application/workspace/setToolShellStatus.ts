import type { Workspace } from '../../domain/workspace/model';
import type { ToolShellStatus } from '../../domain/tool/model';
import { normalizeToolShellStatus } from '../../domain/tool/shell';

interface SetToolShellStatusInput {
  toolInstanceId: string;
  nextStatus: ToolShellStatus | null;
}

export function setToolShellStatus(workspace: Workspace, input: SetToolShellStatusInput): Workspace {
  const toolInstance = workspace.toolInstances[input.toolInstanceId];

  if (!toolInstance) {
    return workspace;
  }

  const nextStatus = normalizeToolShellStatus(input.nextStatus);
  if (input.nextStatus !== null && nextStatus === null) {
    return workspace;
  }
  const currentStatusValue = toolInstance.shellState?.status ?? null;
  const currentStatus = normalizeToolShellStatus(currentStatusValue);
  const currentStatusIsWellFormed = currentStatusValue === null || currentStatus !== null;
  if (
    currentStatusIsWellFormed &&
    currentStatus?.label === nextStatus?.label &&
    currentStatus?.tone === nextStatus?.tone
  ) {
    return workspace;
  }

  return {
    ...workspace,
    toolInstances: {
      ...workspace.toolInstances,
      [input.toolInstanceId]: {
        ...toolInstance,
        shellState: {
          ...toolInstance.shellState,
          status: nextStatus
        }
      }
    }
  };
}
