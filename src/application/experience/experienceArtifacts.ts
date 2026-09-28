import type { WorkspacePresetArtifact } from '../workspace/presetArtifacts';
import { serializeWorkspacePresetArtifact } from '../workspace/presetArtifacts';

export const WORKBENCH_EXPERIENCE_SCHEMA = 'konitif.workbench-experience' as const;
export const WORKBENCH_EXPERIENCE_SCHEMA_VERSION = 1 as const;

export interface ExperienceIdentity {
  kind: 'experience';
  value: string;
}

export interface ExperienceRevisionIdentity {
  kind: 'experience-revision';
  value: string;
}

export type ExperienceLifecycleStatus = 'active' | 'archived' | 'tombstoned';

export interface ExperienceContentAddressPort {
  sha256(canonicalJson: string): Promise<string>;
}

export interface WorkspacePresetContentReference {
  kind: 'workspace-preset';
  id: string;
  revision: string;
  contentId: string;
}

export interface ExperienceTransformation {
  order: number;
  kind: string;
  summary: string;
}

export type WorkspaceExperiencePresetBinding =
  | {
      mode: 'reference';
      source: WorkspacePresetContentReference;
    }
  | {
      mode: 'override';
      source: WorkspacePresetContentReference;
      result: WorkspacePresetContentReference;
      transformations: readonly ExperienceTransformation[];
    };

export interface WorkbenchExperienceRevision<TSpecialization = unknown> {
  schema: typeof WORKBENCH_EXPERIENCE_SCHEMA;
  schemaVersion: typeof WORKBENCH_EXPERIENCE_SCHEMA_VERSION;
  id: ExperienceRevisionIdentity;
  experienceId: ExperienceIdentity;
  parentRevisionId: ExperienceRevisionIdentity | null;
  derivedFrom: ExperienceRevisionIdentity | null;
  preset: WorkspaceExperiencePresetBinding;
  specialization: TSpecialization;
}

export interface WorkbenchExperience<TMetadata = unknown> {
  id: ExperienceIdentity;
  headRevisionId: ExperienceRevisionIdentity;
  lifecycle: ExperienceLifecycleStatus;
  metadata: TMetadata;
}

export type ExperienceArtifactDiagnosticCode =
  | 'experience.invalid-identity'
  | 'experience.invalid-content-id'
  | 'experience.preset-identity-conflict'
  | 'experience.preset-content-conflict'
  | 'experience.invalid-override';

export interface ExperienceArtifactDiagnostic {
  code: ExperienceArtifactDiagnosticCode;
  path: string;
  message: string;
}

export type ExperienceArtifactResult<T> =
  | { ok: true; value: T; diagnostics: [] }
  | { ok: false; diagnostics: ExperienceArtifactDiagnostic[] };

export function defineExperienceIdentity(value: string): ExperienceIdentity {
  return { kind: 'experience', value: requireIdentity(value, 'Experience') };
}

export function defineExperienceRevisionIdentity(value: string): ExperienceRevisionIdentity {
  return { kind: 'experience-revision', value: requireIdentity(value, 'Experience revision') };
}

export async function createWorkspacePresetContentReference(
  artifact: WorkspacePresetArtifact,
  content: ExperienceContentAddressPort
): Promise<WorkspacePresetContentReference> {
  const contentId = await content.sha256(serializeWorkspacePresetArtifact(artifact));
  if (!isContentId(contentId)) {
    throw new TypeError('Workspace preset content addressing must return a lowercase SHA-256 digest.');
  }
  return freezeDetached({
    kind: 'workspace-preset',
    id: artifact.id,
    revision: artifact.version,
    contentId
  });
}

export async function admitWorkspacePresetContentReference(
  reference: WorkspacePresetContentReference,
  artifact: WorkspacePresetArtifact,
  content: ExperienceContentAddressPort
): Promise<ExperienceArtifactResult<WorkspacePresetContentReference>> {
  if (!isContentId(reference.contentId)) {
    return refused(
      'experience.invalid-content-id',
      '$.contentId',
      'Workspace preset content identity must be a lowercase SHA-256 digest.'
    );
  }
  if (reference.kind !== 'workspace-preset' || reference.id !== artifact.id || reference.revision !== artifact.version) {
    return refused(
      'experience.preset-identity-conflict',
      '$',
      'Workspace preset identity and revision must match their immutable reference.'
    );
  }
  const resolved = await createWorkspacePresetContentReference(artifact, content);
  if (resolved.contentId !== reference.contentId) {
    return refused(
      'experience.preset-content-conflict',
      '$.contentId',
      'Workspace preset reference is bound to different canonical content.'
    );
  }
  return accepted(reference);
}

export async function createWorkspaceExperiencePresetBinding(input: {
  source: WorkspacePresetArtifact;
  result?: WorkspacePresetArtifact;
  transformations?: readonly ExperienceTransformation[];
}, content: ExperienceContentAddressPort): Promise<ExperienceArtifactResult<WorkspaceExperiencePresetBinding>> {
  const source = await createWorkspacePresetContentReference(input.source, content);
  if (!input.result) {
    return accepted(freezeDetached({ mode: 'reference', source }));
  }

  const transformations = normalizeTransformations(input.transformations ?? []);
  if (!transformations) {
    return refused(
      'experience.invalid-override',
      '$.transformations',
      'A workspace preset override requires ordered, non-empty transformation records.'
    );
  }
  const result = await createWorkspacePresetContentReference(input.result, content);
  if (source.contentId === result.contentId) {
    return refused(
      'experience.invalid-override',
      '$.result',
      'A workspace preset override must produce content distinct from its source.'
    );
  }
  return accepted(freezeDetached({ mode: 'override', source, result, transformations }));
}

export async function admitWorkspaceExperiencePresetBinding(input: {
  binding: WorkspaceExperiencePresetBinding;
  source: WorkspacePresetArtifact;
  result?: WorkspacePresetArtifact;
}, content: ExperienceContentAddressPort): Promise<ExperienceArtifactResult<WorkspaceExperiencePresetBinding>> {
  const source = await admitWorkspacePresetContentReference(input.binding.source, input.source, content);
  if (!source.ok) return source;

  if (input.binding.mode === 'reference') {
    if (input.result) {
      return refused('experience.invalid-override', '$.result', 'A reference binding cannot admit override content.');
    }
    return accepted(freezeDetached(input.binding));
  }

  const transformations = normalizeTransformations(input.binding.transformations);
  if (!transformations || !input.result) {
    return refused(
      'experience.invalid-override',
      '$',
      'An override binding requires its resolved result and ordered transformation records.'
    );
  }
  const result = await admitWorkspacePresetContentReference(input.binding.result, input.result, content);
  if (!result.ok) return result;
  if (input.binding.source.contentId === input.binding.result.contentId) {
    return refused(
      'experience.invalid-override',
      '$.result',
      'A workspace preset override must produce content distinct from its source.'
    );
  }
  return accepted(freezeDetached({ ...input.binding, transformations }));
}

function normalizeTransformations(
  values: readonly ExperienceTransformation[]
): readonly ExperienceTransformation[] | null {
  if (values.length === 0) return null;
  const normalized = values.map((value, index) => ({
    order: value.order,
    kind: value.kind.trim(),
    summary: value.summary.trim()
  }));
  if (normalized.some((value, index) => value.order !== index || !value.kind || !value.summary)) {
    return null;
  }
  return freezeDetached(normalized);
}

function requireIdentity(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${label} identity is required.`);
  return normalized;
}

function isContentId(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

function accepted<T>(value: T): ExperienceArtifactResult<T> {
  return { ok: true, value: freezeDetached(value), diagnostics: [] };
}

function refused(
  code: ExperienceArtifactDiagnosticCode,
  path: string,
  message: string
): ExperienceArtifactResult<never> {
  return { ok: false, diagnostics: [{ code, path, message }] };
}

function freezeDetached<T>(value: T): T {
  return deepFreeze(structuredClone(value));
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  return Object.freeze(value);
}
