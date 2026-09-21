import type { ShellWidgetCatalogPort } from '../../domain/shell/model';
import type { ToolCatalogPort } from '../../domain/tool/model';
import {
  evaluateWorkspacePresetCompatibility,
  type WorkspacePresetArtifact,
  type WorkspacePresetCompatibilityRequest,
  type WorkspacePresetDiagnostic
} from './presetArtifacts';

export interface WorkspacePresetSelectionRequest<Origin extends string = string> {
  kind: 'workspace-preset-source';
  origin: Origin;
  presetId: string;
  expectedVersion: string | null;
}

export interface WorkspacePresetSelectionCandidates {
  sources: readonly WorkspacePresetArtifact[];
  toolCatalog: ToolCatalogPort;
  shellWidgetCatalog: ShellWidgetCatalogPort;
}

export interface ResolvedWorkspacePresetSelection<Origin extends string = string> {
  kind: 'workspace-preset-source';
  request: WorkspacePresetSelectionRequest<Origin>;
  source: WorkspacePresetArtifact;
  toolCatalog: ToolCatalogPort;
  shellWidgetCatalog: ShellWidgetCatalogPort;
}

export type WorkspacePresetSelectionFailureCode =
  | 'workspace-preset-selection.invalid-request'
  | 'workspace-preset-selection.unknown'
  | 'workspace-preset-selection.ambiguous'
  | 'workspace-preset-selection.version-incompatible'
  | 'workspace-preset-selection.incompatible';

export type WorkspacePresetSelectionResult<Origin extends string = string> =
  | {
      ok: true;
      selection: ResolvedWorkspacePresetSelection<Origin>;
    }
  | {
      ok: false;
      code: WorkspacePresetSelectionFailureCode;
      message: string;
      diagnostics: WorkspacePresetDiagnostic[];
    };

export function resolveWorkspacePresetSelection<Origin extends string>(input: {
  request: WorkspacePresetSelectionRequest<Origin>;
  candidates: WorkspacePresetSelectionCandidates;
  compatibilityRequest?: WorkspacePresetCompatibilityRequest;
}): WorkspacePresetSelectionResult<Origin> {
  const { request, candidates } = input;
  if (!request.presetId || request.presetId.trim() !== request.presetId) {
    return failure('workspace-preset-selection.invalid-request', 'Workspace preset selection requires a normalized preset id.');
  }
  if (
    request.expectedVersion !== null &&
    (!request.expectedVersion || request.expectedVersion.trim() !== request.expectedVersion)
  ) {
    return failure('workspace-preset-selection.invalid-request', 'Workspace preset selection contains an invalid expected version.');
  }

  const matchingSources = candidates.sources.filter(candidate => candidate.id === request.presetId);
  if (matchingSources.length === 0) {
    return failure('workspace-preset-selection.unknown', `Workspace preset "${request.presetId}" is unknown.`);
  }
  if (matchingSources.length > 1) {
    return failure('workspace-preset-selection.ambiguous', `Workspace preset identity "${request.presetId}" is ambiguous.`);
  }

  const source = matchingSources[0]!;
  if (request.expectedVersion !== null && source.version !== request.expectedVersion) {
    return failure(
      'workspace-preset-selection.version-incompatible',
      `Workspace preset "${request.presetId}" resolved to ${source.version}, not ${request.expectedVersion}.`
    );
  }

  const diagnostics = evaluateWorkspacePresetCompatibility(source, input.compatibilityRequest ?? {});
  if (diagnostics.length > 0) {
    return {
      ok: false,
      code: 'workspace-preset-selection.incompatible',
      message: diagnostics.map(diagnostic => diagnostic.message).join(' '),
      diagnostics
    };
  }

  return {
    ok: true,
    selection: {
      kind: 'workspace-preset-source',
      request,
      source,
      toolCatalog: candidates.toolCatalog,
      shellWidgetCatalog: candidates.shellWidgetCatalog
    }
  };
}

function failure(
  code: Exclude<WorkspacePresetSelectionFailureCode, 'workspace-preset-selection.incompatible'>,
  message: string
): WorkspacePresetSelectionResult<never> {
  return { ok: false, code, message, diagnostics: [] };
}
