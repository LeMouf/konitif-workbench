import type {
  ExperienceIdentity,
  ExperienceLifecycleStatus,
  ExperienceRevisionIdentity,
  WorkbenchExperience,
  WorkbenchExperienceRevision,
} from './experienceArtifacts';
import type {
  ExperienceLifecycleDiagnostic,
  WorkbenchExperienceDraft,
  WorkbenchExperienceLifecycleValue,
} from './experienceLifecycle';

export interface ExperienceRevisionReference {
  experienceId: ExperienceIdentity;
  revisionId: ExperienceRevisionIdentity;
}

export interface WorkbenchExperienceRepositorySnapshot<TMetadata = unknown, TSpecialization = unknown> {
  experiences: readonly WorkbenchExperience<TMetadata>[];
  revisions: readonly WorkbenchExperienceRevision<TSpecialization>[];
}

export type WorkbenchExperienceRepositoryErrorCode =
  | 'experience.repository.not-found'
  | 'experience.repository.already-exists'
  | 'experience.repository.head-conflict'
  | 'experience.repository.lifecycle-conflict'
  | 'experience.repository.invalid-artifact'
  | 'experience.repository.unavailable';

export interface WorkbenchExperienceRepositoryError {
  code: WorkbenchExperienceRepositoryErrorCode;
  message: string;
  lifecycleDiagnostic?: ExperienceLifecycleDiagnostic;
}

export type WorkbenchExperienceRepositoryResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: WorkbenchExperienceRepositoryError };

export interface WorkbenchExperienceRepository<TMetadata = unknown, TSpecialization = unknown> {
  hydrate(): Promise<WorkbenchExperienceRepositoryResult<
    WorkbenchExperienceRepositorySnapshot<TMetadata, TSpecialization>
  >>;
  list(): Promise<WorkbenchExperienceRepositoryResult<readonly WorkbenchExperience<TMetadata>[]>>;
  resolveRevision(
    reference: ExperienceRevisionReference,
  ): Promise<WorkbenchExperienceRepositoryResult<WorkbenchExperienceRevision<TSpecialization>>>;
  create(
    value: WorkbenchExperienceLifecycleValue<TMetadata, TSpecialization>,
  ): Promise<WorkbenchExperienceRepositoryResult<
    WorkbenchExperienceLifecycleValue<TMetadata, TSpecialization>
  >>;
  saveRevision(input: {
    experience: WorkbenchExperience<TMetadata>;
    draft: WorkbenchExperienceDraft<TSpecialization>;
    expectedHeadRevisionId: ExperienceRevisionIdentity;
    revisionId: ExperienceRevisionIdentity;
    metadata?: TMetadata;
  }): Promise<WorkbenchExperienceRepositoryResult<
    WorkbenchExperienceLifecycleValue<TMetadata, TSpecialization>
  >>;
  transitionLifecycle(input: {
    experienceId: ExperienceIdentity;
    expected: Exclude<ExperienceLifecycleStatus, 'tombstoned'>;
    next: ExperienceLifecycleStatus;
  }): Promise<WorkbenchExperienceRepositoryResult<WorkbenchExperience<TMetadata>>>;
}
