import type { WorkspaceValidationIssue } from '../../domain/workspace/validation';
import { parseWorkspaceSnapshot, validateWorkspaceSnapshot } from '../../domain/workspace/validation';
import type { Workspace } from '../../domain/workspace/model';

export interface WorkspaceSnapshotImportResult {
  ok: boolean;
  workspace?: Workspace;
  error?: string;
  issues?: WorkspaceValidationIssue[];
}

export function exportWorkspaceSnapshot(workspace: Workspace): string {
  return JSON.stringify(workspace, null, 2);
}

export function importWorkspaceSnapshot(source: string): WorkspaceSnapshotImportResult {
  try {
    const parsedValue = JSON.parse(source) as unknown;
    const issues = validateWorkspaceSnapshot(parsedValue);

    if (issues.length > 0) {
      return {
        ok: false,
        error: issues[0].message,
        issues
      };
    }

    const workspace = parseWorkspaceSnapshot(parsedValue);

    if (!workspace) {
      return {
        ok: false,
        error: 'Workspace snapshot could not be normalized.'
      };
    }

    return {
      ok: true,
      workspace
    };
  } catch {
    return {
      ok: false,
      error: 'Workspace snapshot must be valid JSON.'
    };
  }
}
