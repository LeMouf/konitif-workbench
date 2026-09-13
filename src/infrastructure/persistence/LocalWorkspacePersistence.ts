import type { Workspace } from '../../domain/workspace/model';
import type { WorkspacePersistencePort } from '../../domain/workspace/persistence';
import { parseWorkspaceSnapshot } from '../../domain/workspace/validation';

export class LocalWorkspacePersistence implements WorkspacePersistencePort {
  constructor(private readonly storageKey: string) {}

  load(): Workspace | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    const rawWorkspace = localStorage.getItem(this.storageKey);

    if (!rawWorkspace) {
      return null;
    }

    try {
      const parsedWorkspace = JSON.parse(rawWorkspace) as unknown;
      return parseWorkspaceSnapshot(parsedWorkspace);
    } catch {
      return null;
    }
  }

  save(workspace: Workspace): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(this.storageKey, JSON.stringify(workspace));
  }
}
