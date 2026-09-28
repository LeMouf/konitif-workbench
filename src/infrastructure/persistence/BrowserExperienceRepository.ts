import {
  WORKBENCH_EXPERIENCE_SCHEMA,
  WORKBENCH_EXPERIENCE_SCHEMA_VERSION,
  type ExperienceIdentity,
  type ExperienceLifecycleStatus,
  type ExperienceRevisionIdentity,
  type WorkbenchExperience,
  type WorkbenchExperienceRevision,
  type WorkspaceExperiencePresetBinding,
} from '../../application/experience/experienceArtifacts';
import {
  saveWorkbenchExperienceRevision,
  transitionWorkbenchExperienceLifecycle,
  type WorkbenchExperienceLifecycleValue,
} from '../../application/experience/experienceLifecycle';
import type {
  ExperienceRevisionReference,
  WorkbenchExperienceRepository,
  WorkbenchExperienceRepositoryErrorCode,
  WorkbenchExperienceRepositoryResult,
  WorkbenchExperienceRepositorySnapshot,
} from '../../application/experience/experienceRepository';

export interface BrowserExperienceRepositoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface StoredWorkbenchExperienceRepository<TMetadata, TSpecialization> {
  schema: 'konitif.workbench-experience-repository';
  schemaVersion: 1;
  experiences: WorkbenchExperience<TMetadata>[];
  revisions: WorkbenchExperienceRevision<TSpecialization>[];
}

/**
 * Browser persistence adapter for the generic Workbench Experience authority.
 * Products choose the storage key and keep migration and specialization policy
 * outside this adapter.
 */
export function createBrowserWorkbenchExperienceRepository<
  TMetadata = unknown,
  TSpecialization = unknown,
>(input: {
  storageKey: string;
  storage?: BrowserExperienceRepositoryStorage | null;
}): WorkbenchExperienceRepository<TMetadata, TSpecialization> {
  const storage = input.storage === undefined ? resolveBrowserStorage() : input.storage;
  const storageKey = requireStorageKey(input.storageKey);

  return {
    hydrate: () => hydrate<TMetadata, TSpecialization>(storage, storageKey),
    async list() {
      const snapshot = await hydrate<TMetadata, TSpecialization>(storage, storageKey);
      return snapshot.ok ? accepted(snapshot.value.experiences) : snapshot;
    },
    async resolveRevision(reference) {
      const snapshot = await hydrate<TMetadata, TSpecialization>(storage, storageKey);
      if (!snapshot.ok) return snapshot;
      const revision = findRevision(snapshot.value, reference);
      return revision
        ? accepted(revision)
        : refused('experience.repository.not-found', `Experience revision ${reference.revisionId.value} was not found.`);
    },
    async create(value) {
      const snapshot = await hydrate<TMetadata, TSpecialization>(storage, storageKey);
      if (!snapshot.ok) return snapshot;
      if (snapshot.value.experiences.some(candidate => candidate.id.value === value.experience.id.value)) {
        return refused('experience.repository.already-exists', `Experience ${value.experience.id.value} already exists.`);
      }
      if (snapshot.value.revisions.some(candidate => candidate.id.value === value.revision.id.value)) {
        return refused('experience.repository.already-exists', `Experience revision ${value.revision.id.value} already exists.`);
      }
      const persisted = persist(storage, storageKey, {
        experiences: [...snapshot.value.experiences, value.experience],
        revisions: [...snapshot.value.revisions, value.revision],
      });
      return persisted.ok ? accepted(value) : persisted;
    },
    async saveRevision(value) {
      const snapshot = await hydrate<TMetadata, TSpecialization>(storage, storageKey);
      if (!snapshot.ok) return snapshot;
      const experience = snapshot.value.experiences.find(
        candidate => candidate.id.value === value.draft.experienceId.value,
      );
      if (!experience) {
        return refused('experience.repository.not-found', `Experience ${value.draft.experienceId.value} was not found.`);
      }
      if (snapshot.value.revisions.some(candidate => candidate.id.value === value.revisionId.value)) {
        return refused('experience.repository.already-exists', `Experience revision ${value.revisionId.value} already exists.`);
      }
      const saved = saveWorkbenchExperienceRevision({
        experience,
        draft: value.draft,
        expectedHeadRevisionId: value.expectedHeadRevisionId,
        revisionId: value.revisionId,
        derivedFrom: value.derivedFrom,
        metadata: value.metadata,
      });
      if (!saved.ok) return lifecycleRefused(saved.diagnostics[0]);
      const persisted = persist(storage, storageKey, {
        experiences: snapshot.value.experiences.map(candidate =>
          candidate.id.value === saved.value.experience.id.value ? saved.value.experience : candidate
        ),
        revisions: [...snapshot.value.revisions, saved.value.revision],
      });
      return persisted.ok ? accepted(saved.value) : persisted;
    },
    async transitionLifecycle(value) {
      const snapshot = await hydrate<TMetadata, TSpecialization>(storage, storageKey);
      if (!snapshot.ok) return snapshot;
      const experience = snapshot.value.experiences.find(
        candidate => candidate.id.value === value.experienceId.value,
      );
      if (!experience) {
        return refused('experience.repository.not-found', `Experience ${value.experienceId.value} was not found.`);
      }
      const transitioned = transitionWorkbenchExperienceLifecycle({
        experience,
        expected: value.expected,
        next: value.next,
      });
      if (!transitioned.ok) return lifecycleRefused(transitioned.diagnostics[0]);
      const persisted = persist(storage, storageKey, {
        experiences: snapshot.value.experiences.map(candidate =>
          candidate.id.value === transitioned.value.id.value ? transitioned.value : candidate
        ),
        revisions: snapshot.value.revisions,
      });
      return persisted.ok ? accepted(transitioned.value) : persisted;
    },
  };
}

async function hydrate<TMetadata, TSpecialization>(
  storage: BrowserExperienceRepositoryStorage | null,
  storageKey: string,
): Promise<WorkbenchExperienceRepositoryResult<WorkbenchExperienceRepositorySnapshot<TMetadata, TSpecialization>>> {
  if (!storage) return refused('experience.repository.unavailable', 'Browser Experience storage is unavailable.');
  let raw: string | null;
  try {
    raw = storage.getItem(storageKey);
  } catch {
    return refused('experience.repository.unavailable', 'Browser Experience storage could not be read.');
  }
  if (!raw) return accepted({ experiences: [], revisions: [] });
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isStoredRepository<TMetadata, TSpecialization>(parsed)) {
      return refused('experience.repository.invalid-artifact', 'Stored Experience repository does not match the Workbench contract.');
    }
    return accepted({ experiences: parsed.experiences, revisions: parsed.revisions });
  } catch {
    return refused('experience.repository.invalid-artifact', 'Stored Experience repository is not valid JSON.');
  }
}

function persist<TMetadata, TSpecialization>(
  storage: BrowserExperienceRepositoryStorage | null,
  storageKey: string,
  snapshot: WorkbenchExperienceRepositorySnapshot<TMetadata, TSpecialization>,
): WorkbenchExperienceRepositoryResult<WorkbenchExperienceRepositorySnapshot<TMetadata, TSpecialization>> {
  if (!storage) return refused('experience.repository.unavailable', 'Browser Experience storage is unavailable.');
  const stored: StoredWorkbenchExperienceRepository<TMetadata, TSpecialization> = {
    schema: 'konitif.workbench-experience-repository',
    schemaVersion: 1,
    experiences: [...snapshot.experiences],
    revisions: [...snapshot.revisions],
  };
  try {
    storage.setItem(storageKey, JSON.stringify(stored));
    return accepted(snapshot);
  } catch {
    return refused('experience.repository.unavailable', 'Browser Experience storage could not be updated.');
  }
}

function findRevision<TMetadata, TSpecialization>(
  snapshot: WorkbenchExperienceRepositorySnapshot<TMetadata, TSpecialization>,
  reference: ExperienceRevisionReference,
): WorkbenchExperienceRevision<TSpecialization> | undefined {
  return snapshot.revisions.find(candidate =>
    candidate.experienceId.value === reference.experienceId.value
    && candidate.id.value === reference.revisionId.value
  );
}

function isStoredRepository<TMetadata, TSpecialization>(
  value: unknown,
): value is StoredWorkbenchExperienceRepository<TMetadata, TSpecialization> {
  if (!isRecord(value)) return false;
  if (
    value.schema !== 'konitif.workbench-experience-repository'
    || value.schemaVersion !== 1
    || !Array.isArray(value.experiences)
    || !Array.isArray(value.revisions)
  ) return false;
  const experiences = value.experiences as unknown[];
  const revisions = value.revisions as unknown[];
  if (!experiences.every(isWorkbenchExperience) || !revisions.every(isWorkbenchExperienceRevision)) return false;
  return experiences.every(experience => revisions.some(revision =>
    isRecord(revision)
    && isIdentity(revision.experienceId, 'experience')
    && isIdentity(revision.id, 'experience-revision')
    && revision.experienceId.value === (experience as WorkbenchExperience<unknown>).id.value
    && revision.id.value === (experience as WorkbenchExperience<unknown>).headRevisionId.value
  ));
}

function isWorkbenchExperience(value: unknown): value is WorkbenchExperience<unknown> {
  return isRecord(value)
    && isIdentity(value.id, 'experience')
    && isIdentity(value.headRevisionId, 'experience-revision')
    && isLifecycle(value.lifecycle)
    && Object.hasOwn(value, 'metadata');
}

function isWorkbenchExperienceRevision(value: unknown): value is WorkbenchExperienceRevision<unknown> {
  return isRecord(value)
    && value.schema === WORKBENCH_EXPERIENCE_SCHEMA
    && value.schemaVersion === WORKBENCH_EXPERIENCE_SCHEMA_VERSION
    && isIdentity(value.id, 'experience-revision')
    && isIdentity(value.experienceId, 'experience')
    && isNullableIdentity(value.parentRevisionId, 'experience-revision')
    && isNullableIdentity(value.derivedFrom, 'experience-revision')
    && isPresetBinding(value.preset)
    && Object.hasOwn(value, 'specialization');
}

function isPresetBinding(value: unknown): value is WorkspaceExperiencePresetBinding {
  if (!isRecord(value) || !isContentReference(value.source)) return false;
  if (value.mode === 'reference') return true;
  return value.mode === 'override'
    && isContentReference(value.result)
    && Array.isArray(value.transformations)
    && value.transformations.length > 0
    && value.transformations.every((item, index) =>
      isRecord(item)
      && item.order === index
      && typeof item.kind === 'string'
      && item.kind.trim().length > 0
      && typeof item.summary === 'string'
      && item.summary.trim().length > 0
    );
}

function isContentReference(value: unknown): boolean {
  return isRecord(value)
    && value.kind === 'workspace-preset'
    && typeof value.id === 'string'
    && value.id.trim().length > 0
    && typeof value.revision === 'string'
    && value.revision.trim().length > 0
    && typeof value.contentId === 'string'
    && /^[a-f0-9]{64}$/.test(value.contentId);
}

function isIdentity(value: unknown, kind: 'experience' | 'experience-revision'): value is ExperienceIdentity | ExperienceRevisionIdentity {
  return isRecord(value)
    && value.kind === kind
    && typeof value.value === 'string'
    && value.value.trim().length > 0;
}

function isNullableIdentity(value: unknown, kind: 'experience-revision'): boolean {
  return value === null || isIdentity(value, kind);
}

function isLifecycle(value: unknown): value is ExperienceLifecycleStatus {
  return value === 'active' || value === 'archived' || value === 'tombstoned';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function lifecycleRefused(
  diagnostic: { code: string; message: string } | undefined,
): WorkbenchExperienceRepositoryResult<never> {
  const code = diagnostic?.code === 'experience.lifecycle.head-conflict'
    ? 'experience.repository.head-conflict'
    : 'experience.repository.lifecycle-conflict';
  return refused(code, diagnostic?.message ?? 'Experience lifecycle operation was refused.');
}

function accepted<T>(value: T): WorkbenchExperienceRepositoryResult<T> {
  return { ok: true, value: freezeDetached(value) };
}

function refused(
  code: WorkbenchExperienceRepositoryErrorCode,
  message: string,
): WorkbenchExperienceRepositoryResult<never> {
  return { ok: false, error: { code, message } };
}

function requireStorageKey(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError('Browser Experience repository storage key is required.');
  return normalized;
}

function resolveBrowserStorage(): BrowserExperienceRepositoryStorage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

function freezeDetached<T>(value: T): T {
  return deepFreeze(structuredClone(value));
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  return Object.freeze(value);
}
