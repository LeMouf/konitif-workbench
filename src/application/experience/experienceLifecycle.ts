import {
  defineExperienceIdentity,
  defineExperienceRevisionIdentity,
  type ExperienceIdentity,
  type ExperienceLifecycleStatus,
  type ExperienceRevisionIdentity,
  type WorkbenchExperience,
  type WorkbenchExperienceRevision,
  type WorkspaceExperiencePresetBinding,
} from './experienceArtifacts';

export interface ExperienceDraftIdentity {
  kind: 'experience-draft';
  value: string;
}

export interface WorkbenchExperienceDraft<TSpecialization = unknown> {
  id: ExperienceDraftIdentity;
  experienceId: ExperienceIdentity;
  baseRevisionId: ExperienceRevisionIdentity;
  preset: WorkspaceExperiencePresetBinding;
  specialization: TSpecialization;
}

export interface WorkbenchExperienceLifecycleValue<TMetadata = unknown, TSpecialization = unknown> {
  experience: WorkbenchExperience<TMetadata>;
  revision: WorkbenchExperienceRevision<TSpecialization>;
}

export type ExperienceLifecycleDiagnosticCode =
  | 'experience.lifecycle.experience-mismatch'
  | 'experience.lifecycle.head-conflict'
  | 'experience.lifecycle.inactive'
  | 'experience.lifecycle.status-conflict';

export interface ExperienceLifecycleDiagnostic {
  code: ExperienceLifecycleDiagnosticCode;
  path: string;
  message: string;
  expected?: string;
  actual?: string;
}

export type ExperienceLifecycleResult<T> =
  | { ok: true; value: T; diagnostics: [] }
  | { ok: false; diagnostics: ExperienceLifecycleDiagnostic[] };

export function defineExperienceDraftIdentity(value: string): ExperienceDraftIdentity {
  return { kind: 'experience-draft', value: requireIdentity(value, 'Experience draft') };
}

export function createWorkbenchExperience<TMetadata, TSpecialization>(input: {
  experienceId: ExperienceIdentity;
  revisionId: ExperienceRevisionIdentity;
  metadata: TMetadata;
  preset: WorkspaceExperiencePresetBinding;
  specialization: TSpecialization;
  derivedFrom?: ExperienceRevisionIdentity | null;
}): WorkbenchExperienceLifecycleValue<TMetadata, TSpecialization> {
  return freezeDetached({
    experience: {
      id: defineExperienceIdentity(input.experienceId.value),
      headRevisionId: defineExperienceRevisionIdentity(input.revisionId.value),
      lifecycle: 'active',
      metadata: input.metadata,
    },
    revision: {
      schema: 'konitif.workbench-experience',
      schemaVersion: 1,
      id: defineExperienceRevisionIdentity(input.revisionId.value),
      experienceId: defineExperienceIdentity(input.experienceId.value),
      parentRevisionId: null,
      derivedFrom: input.derivedFrom ?? null,
      preset: input.preset,
      specialization: input.specialization,
    },
  });
}

export function createWorkbenchExperienceDraft<TSpecialization>(input: {
  draftId: ExperienceDraftIdentity;
  revision: WorkbenchExperienceRevision<TSpecialization>;
}): WorkbenchExperienceDraft<TSpecialization> {
  return freezeDetached({
    id: defineExperienceDraftIdentity(input.draftId.value),
    experienceId: input.revision.experienceId,
    baseRevisionId: input.revision.id,
    preset: input.revision.preset,
    specialization: input.revision.specialization,
  });
}

export function updateWorkbenchExperienceDraft<TSpecialization>(input: {
  draft: WorkbenchExperienceDraft<TSpecialization>;
  preset: WorkspaceExperiencePresetBinding;
  specialization: TSpecialization;
}): WorkbenchExperienceDraft<TSpecialization> {
  return freezeDetached({
    ...input.draft,
    preset: input.preset,
    specialization: input.specialization,
  });
}

export function saveWorkbenchExperienceRevision<TMetadata, TSpecialization>(input: {
  experience: WorkbenchExperience<TMetadata>;
  draft: WorkbenchExperienceDraft<TSpecialization>;
  expectedHeadRevisionId: ExperienceRevisionIdentity;
  revisionId: ExperienceRevisionIdentity;
  metadata?: TMetadata;
}): ExperienceLifecycleResult<WorkbenchExperienceLifecycleValue<TMetadata, TSpecialization>> {
  if (input.experience.lifecycle !== 'active') {
    return refused(
      'experience.lifecycle.inactive',
      '$.experience.lifecycle',
      'Only an active Experience can receive a new revision.',
      'active',
      input.experience.lifecycle,
    );
  }
  if (input.draft.experienceId.value !== input.experience.id.value) {
    return refused(
      'experience.lifecycle.experience-mismatch',
      '$.draft.experienceId',
      'The draft and Experience identities do not match.',
      input.experience.id.value,
      input.draft.experienceId.value,
    );
  }
  const actualHead = input.experience.headRevisionId.value;
  if (
    input.expectedHeadRevisionId.value !== actualHead
    || input.draft.baseRevisionId.value !== actualHead
  ) {
    return refused(
      'experience.lifecycle.head-conflict',
      '$.expectedHeadRevisionId',
      'The draft base is no longer the expected Experience head.',
      input.expectedHeadRevisionId.value,
      actualHead,
    );
  }

  const revisionId = defineExperienceRevisionIdentity(input.revisionId.value);
  return accepted({
    experience: {
      ...input.experience,
      headRevisionId: revisionId,
      metadata: input.metadata ?? input.experience.metadata,
    },
    revision: {
      schema: 'konitif.workbench-experience',
      schemaVersion: 1,
      id: revisionId,
      experienceId: input.experience.id,
      parentRevisionId: input.draft.baseRevisionId,
      derivedFrom: null,
      preset: input.draft.preset,
      specialization: input.draft.specialization,
    },
  });
}

export function transitionWorkbenchExperienceLifecycle<TMetadata>(input: {
  experience: WorkbenchExperience<TMetadata>;
  expected: Exclude<ExperienceLifecycleStatus, 'tombstoned'>;
  next: ExperienceLifecycleStatus;
}): ExperienceLifecycleResult<WorkbenchExperience<TMetadata>> {
  if (input.experience.lifecycle === 'tombstoned') {
    return refused(
      'experience.lifecycle.inactive',
      '$.experience.lifecycle',
      'A tombstoned Experience cannot transition again.',
      input.expected,
      input.experience.lifecycle,
    );
  }
  if (input.experience.lifecycle === input.next) return accepted(input.experience);
  if (input.experience.lifecycle !== input.expected) {
    return refused(
      'experience.lifecycle.status-conflict',
      '$.expected',
      'The Experience lifecycle no longer matches the expected status.',
      input.expected,
      input.experience.lifecycle,
    );
  }
  if (!isAllowedTransition(input.experience.lifecycle, input.next)) {
    return refused(
      'experience.lifecycle.status-conflict',
      '$.next',
      `Experience lifecycle cannot transition from ${input.experience.lifecycle} to ${input.next}.`,
      undefined,
      input.next,
    );
  }
  return accepted({ ...input.experience, lifecycle: input.next });
}

function isAllowedTransition(
  current: Exclude<ExperienceLifecycleStatus, 'tombstoned'>,
  next: ExperienceLifecycleStatus,
): boolean {
  return next === 'tombstoned'
    || (current === 'active' && next === 'archived')
    || (current === 'archived' && next === 'active');
}

function requireIdentity(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${label} identity is required.`);
  return normalized;
}

function accepted<T>(value: T): ExperienceLifecycleResult<T> {
  return { ok: true, value: freezeDetached(value), diagnostics: [] };
}

function refused(
  code: ExperienceLifecycleDiagnosticCode,
  path: string,
  message: string,
  expected?: string,
  actual?: string,
): ExperienceLifecycleResult<never> {
  return {
    ok: false,
    diagnostics: [{ code, path, message, ...(expected ? { expected } : {}), ...(actual ? { actual } : {}) }],
  };
}

function freezeDetached<T>(value: T): T {
  return deepFreeze(structuredClone(value));
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  return Object.freeze(value);
}
