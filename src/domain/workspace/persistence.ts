import type { Workspace } from './model';

export interface WorkspacePersistencePort {
  load(): Workspace | null;
  save(workspace: Workspace): void;
}
