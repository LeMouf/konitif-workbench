import type { ShellRegionId, ShellState } from '../../domain/shell/model';
import type { WorkspaceSessionState } from '../../domain/workspace/session';
import { validateWorkspaceSnapshot } from '../../domain/workspace/validation';
import { createWorkspaceSessionState } from './session';

export const WORKSPACE_PRESET_ARTIFACT_SCHEMA = 'konitif.workspace-preset' as const;
export const WORKSPACE_PRESET_ARTIFACT_SCHEMA_VERSION = 1 as const;

export interface WorkspacePresetCompatibility {
  fixtureSchemaVersions: string[];
  projectSchemaVersions: string[];
}

export interface WorkspacePresetCatalogMetadata {
  label: string;
  description: string;
  icon: string;
}

export interface WorkspacePresetArtifact {
  schema: typeof WORKSPACE_PRESET_ARTIFACT_SCHEMA;
  schemaVersion: typeof WORKSPACE_PRESET_ARTIFACT_SCHEMA_VERSION;
  id: string;
  name: string;
  version: string;
  catalog: WorkspacePresetCatalogMetadata;
  compatibility: WorkspacePresetCompatibility;
  workspaceSession: WorkspaceSessionState;
  shellState: ShellState;
}

export type WorkspacePresetDiagnosticCode =
  | 'workspace-preset.invalid-json'
  | 'workspace-preset.invalid-schema'
  | 'workspace-preset.invalid-id'
  | 'workspace-preset.invalid-name'
  | 'workspace-preset.invalid-version'
  | 'workspace-preset.invalid-catalog'
  | 'workspace-preset.invalid-compatibility'
  | 'workspace-preset.invalid-workspace'
  | 'workspace-preset.invalid-focus'
  | 'workspace-preset.invalid-shell'
  | 'workspace-preset.fixture-schema-incompatible'
  | 'workspace-preset.project-schema-incompatible';

export interface WorkspacePresetDiagnostic {
  code: WorkspacePresetDiagnosticCode;
  path: string;
  message: string;
}

export interface AuthorWorkspacePresetInput {
  id: string;
  name: string;
  version: string;
  catalog?: Partial<WorkspacePresetCatalogMetadata>;
  compatibility: WorkspacePresetCompatibility;
  workspaceSession: WorkspaceSessionState;
  shellState: ShellState;
}

export type WorkspacePresetResult =
  | { ok: true; artifact: WorkspacePresetArtifact; diagnostics: [] }
  | { ok: false; artifact?: undefined; diagnostics: WorkspacePresetDiagnostic[] };

export interface WorkspacePresetCompatibilityRequest {
  fixtureSchemaVersion?: string | null;
  projectSchemaVersion?: string | null;
}

const PRESET_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const PRESET_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const SHELL_REGION_IDS: ShellRegionId[] = ['left', 'right', 'bottom'];

export function authorWorkspacePreset(input: AuthorWorkspacePresetInput): WorkspacePresetResult {
  const artifact: WorkspacePresetArtifact = {
    schema: WORKSPACE_PRESET_ARTIFACT_SCHEMA,
    schemaVersion: WORKSPACE_PRESET_ARTIFACT_SCHEMA_VERSION,
    id: input.id.trim(),
    name: input.name.trim(),
    version: input.version.trim(),
    catalog: normalizeCatalogMetadata(input.name, input.catalog),
    compatibility: normalizeCompatibility(input.compatibility),
    workspaceSession: createWorkspaceSessionState(
      input.workspaceSession.workspace,
      input.workspaceSession.focus
    ),
    shellState: input.shellState
  };
  const diagnostics = validateWorkspacePresetArtifact(artifact);

  return diagnostics.length > 0
    ? { ok: false, diagnostics }
    : { ok: true, artifact: cloneCanonicalValue(artifact), diagnostics: [] };
}

export function serializeWorkspacePresetArtifact(artifact: WorkspacePresetArtifact): string {
  const diagnostics = validateWorkspacePresetArtifact(artifact);

  if (diagnostics.length > 0) {
    throw new Error(diagnostics[0]?.message ?? 'Workspace preset artifact is invalid.');
  }

  return `${JSON.stringify(sortCanonicalValue(artifact), null, 2)}\n`;
}

export function importWorkspacePresetArtifact(
  source: string,
  compatibilityRequest: WorkspacePresetCompatibilityRequest = {}
): WorkspacePresetResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    return {
      ok: false,
      diagnostics: [diagnostic('workspace-preset.invalid-json', '$', 'Workspace preset must be valid JSON.')]
    };
  }

  const migrated = migrateWorkspacePresetArtifact(parsed);
  const diagnostics = validateWorkspacePresetArtifact(migrated);

  if (diagnostics.length > 0) {
    return { ok: false, diagnostics };
  }

  const artifact = cloneCanonicalValue(migrated as WorkspacePresetArtifact);
  const compatibilityDiagnostics = evaluateWorkspacePresetCompatibility(artifact, compatibilityRequest);

  return compatibilityDiagnostics.length > 0
    ? { ok: false, diagnostics: compatibilityDiagnostics }
    : { ok: true, artifact, diagnostics: [] };
}

export function evaluateWorkspacePresetCompatibility(
  artifact: WorkspacePresetArtifact,
  request: WorkspacePresetCompatibilityRequest
): WorkspacePresetDiagnostic[] {
  const diagnostics: WorkspacePresetDiagnostic[] = [];
  const fixtureSchemaVersion = request.fixtureSchemaVersion?.trim();
  const projectSchemaVersion = request.projectSchemaVersion?.trim();

  if (fixtureSchemaVersion && !artifact.compatibility.fixtureSchemaVersions.includes(fixtureSchemaVersion)) {
    diagnostics.push(
      diagnostic(
        'workspace-preset.fixture-schema-incompatible',
        '$.compatibility.fixtureSchemaVersions',
        `Preset ${artifact.id}@${artifact.version} does not support fixture schema ${fixtureSchemaVersion}. Supported versions: ${formatSupportedVersions(artifact.compatibility.fixtureSchemaVersions)}.`
      )
    );
  }

  if (projectSchemaVersion && !artifact.compatibility.projectSchemaVersions.includes(projectSchemaVersion)) {
    diagnostics.push(
      diagnostic(
        'workspace-preset.project-schema-incompatible',
        '$.compatibility.projectSchemaVersions',
        `Preset ${artifact.id}@${artifact.version} does not support project schema ${projectSchemaVersion}. Supported versions: ${formatSupportedVersions(artifact.compatibility.projectSchemaVersions)}.`
      )
    );
  }

  return diagnostics;
}

export function validateWorkspacePresetArtifact(value: unknown): WorkspacePresetDiagnostic[] {
  if (!isRecord(value)) {
    return [diagnostic('workspace-preset.invalid-schema', '$', 'Workspace preset must be an object.')];
  }

  const diagnostics: WorkspacePresetDiagnostic[] = [];

  if (
    value.schema !== WORKSPACE_PRESET_ARTIFACT_SCHEMA ||
    value.schemaVersion !== WORKSPACE_PRESET_ARTIFACT_SCHEMA_VERSION
  ) {
    diagnostics.push(
      diagnostic(
        'workspace-preset.invalid-schema',
        '$.schema',
        `Workspace preset must use ${WORKSPACE_PRESET_ARTIFACT_SCHEMA} schema version ${WORKSPACE_PRESET_ARTIFACT_SCHEMA_VERSION}.`
      )
    );
  }

  if (typeof value.id !== 'string' || !PRESET_ID_PATTERN.test(value.id)) {
    diagnostics.push(
      diagnostic(
        'workspace-preset.invalid-id',
        '$.id',
        'Workspace preset id must be a lowercase dot-or-dash identifier.'
      )
    );
  }

  if (typeof value.name !== 'string' || value.name.trim().length < 2 || value.name.trim().length > 80) {
    diagnostics.push(
      diagnostic(
        'workspace-preset.invalid-name',
        '$.name',
        'Workspace preset name must contain 2 to 80 characters.'
      )
    );
  }

  if (typeof value.version !== 'string' || !PRESET_VERSION_PATTERN.test(value.version)) {
    diagnostics.push(
      diagnostic(
        'workspace-preset.invalid-version',
        '$.version',
        'Workspace preset version must use semantic versioning.'
      )
    );
  }

  diagnostics.push(...validateCatalogMetadata(value.catalog));
  diagnostics.push(...validateCompatibility(value.compatibility));
  diagnostics.push(...validateWorkspaceSession(value.workspaceSession));
  diagnostics.push(...validateShellState(value.shellState));

  return diagnostics;
}

export function projectWorkspacePresetCatalogMetadata(
  artifact: WorkspacePresetArtifact
): WorkspacePresetCatalogMetadata & { id: string } {
  return {
    id: artifact.id,
    ...cloneCanonicalValue(artifact.catalog)
  };
}

function validateCatalogMetadata(value: unknown): WorkspacePresetDiagnostic[] {
  if (
    !isRecord(value) ||
    typeof value.label !== 'string' ||
    value.label.trim().length < 2 ||
    value.label.trim().length > 80 ||
    typeof value.description !== 'string' ||
    value.description.trim().length < 2 ||
    value.description.trim().length > 240 ||
    typeof value.icon !== 'string' ||
    value.icon.trim().length < 2 ||
    value.icon.trim().length > 80
  ) {
    return [
      diagnostic(
        'workspace-preset.invalid-catalog',
        '$.catalog',
        'Workspace preset catalog metadata must provide a label, description, and icon.'
      )
    ];
  }

  return [];
}

function normalizeCatalogMetadata(
  name: string,
  value: Partial<WorkspacePresetCatalogMetadata> | undefined
): WorkspacePresetCatalogMetadata {
  const normalizedName = name.trim();

  return {
    label: value?.label?.trim() || normalizedName,
    description: value?.description?.trim() || `${normalizedName} workspace preset.`,
    icon: value?.icon?.trim() || 'layout.workspace'
  };
}

function migrateWorkspacePresetArtifact(value: unknown): unknown {
  if (!isRecord(value) || value.catalog !== undefined) {
    return value;
  }

  const name = typeof value.name === 'string' ? value.name : '';

  return {
    ...value,
    catalog: normalizeCatalogMetadata(name, undefined)
  };
}

function validateCompatibility(value: unknown): WorkspacePresetDiagnostic[] {
  if (!isRecord(value)) {
    return [
      diagnostic(
        'workspace-preset.invalid-compatibility',
        '$.compatibility',
        'Workspace preset compatibility must be an object.'
      )
    ];
  }

  const fixtureVersions = validateVersionList(value.fixtureSchemaVersions);
  const projectVersions = validateVersionList(value.projectSchemaVersions);

  return fixtureVersions && projectVersions
    ? []
    : [
        diagnostic(
          'workspace-preset.invalid-compatibility',
          '$.compatibility',
          'Workspace preset compatibility must declare non-empty unique fixture and project schema version lists.'
        )
      ];
}

function validateWorkspaceSession(value: unknown): WorkspacePresetDiagnostic[] {
  if (!isRecord(value) || !isRecord(value.focus)) {
    return [
      diagnostic(
        'workspace-preset.invalid-workspace',
        '$.workspaceSession',
        'Workspace preset must contain a workspace session and focus state.'
      )
    ];
  }

  const workspaceIssues = validateWorkspaceSnapshot(value.workspace);

  if (workspaceIssues.length > 0) {
    return workspaceIssues.map((issue) =>
      diagnostic('workspace-preset.invalid-workspace', `$.workspaceSession.${issue.path}`, issue.message)
    );
  }

  const normalized = createWorkspaceSessionState(
    value.workspace as WorkspaceSessionState['workspace'],
    value.focus
  );

  if (
    value.focus.activePanelId !== normalized.focus.activePanelId ||
    value.focus.activeToolInstanceId !== normalized.focus.activeToolInstanceId
  ) {
    return [
      diagnostic(
        'workspace-preset.invalid-focus',
        '$.workspaceSession.focus',
        'Workspace preset focus must reference the focused panel and its tool instance.'
      )
    ];
  }

  return [];
}

function validateShellState(value: unknown): WorkspacePresetDiagnostic[] {
  if (!isRecord(value) || !isRecord(value.regions)) {
    return [
      diagnostic(
        'workspace-preset.invalid-shell',
        '$.shellState',
        'Workspace preset must contain shell regions.'
      )
    ];
  }

  for (const regionId of SHELL_REGION_IDS) {
    const region = value.regions[regionId];

    if (
      !isRecord(region) ||
      region.id !== regionId ||
      typeof region.isVisible !== 'boolean' ||
      typeof region.isOpen !== 'boolean' ||
      typeof region.size !== 'number' ||
      !Number.isFinite(region.size) ||
      !Array.isArray(region.widgetIds) ||
      !region.widgetIds.every((widgetId) => typeof widgetId === 'string') ||
      (region.activeWidgetId !== null && typeof region.activeWidgetId !== 'string')
    ) {
      return [
        diagnostic(
          'workspace-preset.invalid-shell',
          `$.shellState.regions.${regionId}`,
          `Workspace preset shell region ${regionId} is incomplete or invalid.`
        )
      ];
    }

    if (region.activeWidgetId && !region.widgetIds.includes(region.activeWidgetId)) {
      return [
        diagnostic(
          'workspace-preset.invalid-shell',
          `$.shellState.regions.${regionId}.activeWidgetId`,
          `Workspace preset shell region ${regionId} must activate one of its declared widgets.`
        )
      ];
    }
  }

  return [];
}

function validateVersionList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => typeof entry === 'string' && entry.trim().length > 0) &&
    new Set(value).size === value.length
  );
}

function normalizeCompatibility(value: WorkspacePresetCompatibility): WorkspacePresetCompatibility {
  return {
    fixtureSchemaVersions: normalizeVersionList(value.fixtureSchemaVersions),
    projectSchemaVersions: normalizeVersionList(value.projectSchemaVersions)
  };
}

function normalizeVersionList(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right, 'en')
  );
}

function formatSupportedVersions(values: string[]): string {
  return values.length > 0 ? values.join(', ') : 'none';
}

function diagnostic(
  code: WorkspacePresetDiagnosticCode,
  path: string,
  message: string
): WorkspacePresetDiagnostic {
  return { code, path, message };
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneCanonicalValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(sortCanonicalValue(value))) as T;
}

function sortCanonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortCanonicalValue);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right, 'en'))
      .filter((key) => value[key] !== undefined)
      .map((key) => [key, sortCanonicalValue(value[key])])
  );
}
