import {
  validateWorkspacePresetArtifact,
  evaluateWorkspacePresetCompatibility,
  type WorkspacePresetArtifact
} from './presetArtifacts';
import type { Workspace } from '../../domain/workspace/model';
import type { WorkspaceFocus } from '../../domain/workspace/session';
import type { ShellState } from '../../domain/shell/model';

export interface WorkspaceUsageContext {
  fixtureSchemaVersion: string;
  projectSchemaVersion: string;
  hostContract: string;
}

export interface WorkspaceUsageSnapshot {
  schema: 'konitif.workspace-usage';
  schemaVersion: 1;
  source: { presetId: string; revision: string; contentId: string };
  context: WorkspaceUsageContext;
  fragments: Record<string, string>;
  parentSnapshotId: string | null;
}

export interface WorkspaceUsageFragments {
  workspace: Workspace;
  shell: ShellState;
  focus: WorkspaceFocus;
  [name: string]: unknown;
}

export interface WorkspaceUsageBundle {
  snapshotId: string;
  snapshot: WorkspaceUsageSnapshot;
  source: WorkspacePresetArtifact;
  fragments: WorkspaceUsageFragments;
}

export interface WorkspaceUsageDiagnostic {
  code: 'usage.invalid-shape' | 'usage.invalid-content' | 'usage.incomplete-fragments' |
    'usage.incompatible-context' | 'usage.source-conflict' | 'usage.invalid-state';
  path: string;
  message: string;
}

export type WorkspaceUsageResult =
  | { ok: true; bundle: WorkspaceUsageBundle; diagnostics: [] }
  | { ok: false; diagnostics: WorkspaceUsageDiagnostic[] };

export interface WorkspaceUsageContentPort {
  sha256(canonicalJson: string): Promise<string>;
}

export function serializeWorkspaceUsageContent(value: unknown): string {
  const ancestors = new Set<object>();
  function encode(entry: unknown): string {
    if (entry === null || typeof entry === 'boolean' || typeof entry === 'string') return JSON.stringify(entry);
    if (typeof entry === 'number' && Number.isFinite(entry)) return JSON.stringify(entry);
    if (typeof entry !== 'object' || ancestors.has(entry)) throw new TypeError('Usage content must be finite acyclic JSON.');
    if (!Array.isArray(entry) && Object.getPrototypeOf(entry) !== Object.prototype && Object.getPrototypeOf(entry) !== null) {
      throw new TypeError('Usage objects must be plain JSON records.');
    }
    ancestors.add(entry);
    const text = Array.isArray(entry)
      ? `[${Array.from({ length: entry.length }, (_, index) => {
        const descriptor = Object.getOwnPropertyDescriptor(entry, String(index));
        if (!descriptor || !('value' in descriptor)) throw new TypeError('Usage arrays must contain data indices, not accessors or holes.');
        return encode(descriptor.value);
      }).join(',')}]`
      : `{${Object.keys(entry).sort().map(key => {
        const descriptor = Object.getOwnPropertyDescriptor(entry, key)!;
        if (!('value' in descriptor)) throw new TypeError('Usage content must not contain accessors.');
        return `${JSON.stringify(key)}:${encode(descriptor.value)}`;
      }).join(',')}}`;
    ancestors.delete(entry);
    return text;
  }
  return encode(value);
}

export async function createWorkspaceUsageBundle(input: {
  source: WorkspacePresetArtifact;
  context: WorkspaceUsageContext;
  fragments: WorkspaceUsageFragments;
  parentSnapshotId: string | null;
}, content: WorkspaceUsageContentPort): Promise<WorkspaceUsageResult> {
  try {
    const frozen = JSON.parse(serializeWorkspaceUsageContent(input)) as typeof input;
    const references: Record<string, string> = {};
    for (const name of Object.keys(frozen.fragments).sort()) {
      Object.defineProperty(references, name, { value: await content.sha256(serializeWorkspaceUsageContent(frozen.fragments[name])), enumerable: true });
    }
    const snapshot: WorkspaceUsageSnapshot = {
      schema: 'konitif.workspace-usage', schemaVersion: 1,
      source: { presetId: frozen.source.id, revision: frozen.source.version, contentId: await content.sha256(serializeWorkspaceUsageContent(frozen.source)) },
      context: frozen.context, fragments: references, parentSnapshotId: frozen.parentSnapshotId
    };
    return admitWorkspaceUsageBundle({ snapshotId: await content.sha256(serializeWorkspaceUsageContent(snapshot)), snapshot, source: frozen.source, fragments: frozen.fragments }, frozen.context, content);
  } catch (error) {
    return refused('usage.invalid-content', '$', String(error));
  }
}

export async function admitWorkspaceUsageBundle(value: unknown, context: WorkspaceUsageContext, content: WorkspaceUsageContentPort): Promise<WorkspaceUsageResult> {
  try {
    const bundle = JSON.parse(serializeWorkspaceUsageContent(value)) as WorkspaceUsageBundle;
    const snapshot = bundle?.snapshot;
    if (!snapshot || snapshot.schema !== 'konitif.workspace-usage' || snapshot.schemaVersion !== 1 ||
      !isContentId(bundle.snapshotId) || !snapshot.source || !isContentId(snapshot.source.contentId) ||
      !isRecord(snapshot.context) || !isRecord(snapshot.fragments) || !isRecord(bundle.fragments) ||
      !(snapshot.parentSnapshotId === null || isContentId(snapshot.parentSnapshotId))) return refused('usage.invalid-shape', '$', 'Invalid usage snapshot or content reference.');
    if (Object.keys(snapshot.context).sort().join(',') !== 'fixtureSchemaVersion,hostContract,projectSchemaVersion' ||
      Object.values(snapshot.context).some(entry => typeof entry !== 'string' || !entry) ||
      serializeWorkspaceUsageContent(snapshot.context) !== serializeWorkspaceUsageContent(context)) return refused('usage.incompatible-context', '$.snapshot.context', 'Usage context does not match this host.');
    if (Object.keys(snapshot.fragments).sort().join('\n') !== Object.keys(bundle.fragments).sort().join('\n') ||
      ['workspace', 'shell', 'focus'].some(name => !Object.prototype.hasOwnProperty.call(bundle.fragments, name)) ||
      Object.keys(snapshot.fragments).some(name => !/^[a-zA-Z][a-zA-Z0-9.-]*$/.test(name) || !isContentId(snapshot.fragments[name]))) return refused('usage.incomplete-fragments', '$.fragments', 'All declared fragments, including workspace, shell and focus, are required.');
    if (await content.sha256(serializeWorkspaceUsageContent(snapshot)) !== bundle.snapshotId) return refused('usage.invalid-content', '$.snapshotId', 'Snapshot content identity mismatch.');
    if (await content.sha256(serializeWorkspaceUsageContent(bundle.source)) !== snapshot.source.contentId) return refused('usage.invalid-content', '$.source', 'Source content identity mismatch.');
    if (bundle.source.id !== snapshot.source.presetId || bundle.source.version !== snapshot.source.revision) return refused('usage.source-conflict', '$.snapshot.source', 'Source authored identity and revision must match their immutable reference.');
    const sourceIssues = validateWorkspacePresetArtifact(bundle.source);
    if (sourceIssues.length || evaluateWorkspacePresetCompatibility(bundle.source, context).length) return refused('usage.invalid-state', '$.source', 'Invalid or incompatible authored preset.');
    for (const name of Object.keys(snapshot.fragments)) {
      if (await content.sha256(serializeWorkspaceUsageContent(bundle.fragments[name])) !== snapshot.fragments[name]) return refused('usage.invalid-content', `$.fragments.${name}`, 'Fragment content identity mismatch.');
    }
    const stateIssues = validateWorkspacePresetArtifact({ ...bundle.source, workspaceSession: { workspace: bundle.fragments.workspace, focus: bundle.fragments.focus }, shellState: bundle.fragments.shell });
    if (stateIssues.length) return refused('usage.invalid-state', '$.fragments', stateIssues.map(issue => `${issue.path}: ${issue.message}`).join('; '));
    return { ok: true, bundle, diagnostics: [] };
  } catch (error) {
    return refused('usage.invalid-content', '$', String(error));
  }
}

export function compareWorkspaceUsageSource(previous: WorkspaceUsageSnapshot, next: WorkspaceUsageSnapshot): WorkspaceUsageDiagnostic[] {
  return previous.source.presetId === next.source.presetId && previous.source.revision === next.source.revision && previous.source.contentId !== next.source.contentId
    ? [{ code: 'usage.source-conflict', path: '$.source', message: 'An authored identity/revision must not be rebound to different content.' }]
    : [];
}

function isContentId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function refused(code: WorkspaceUsageDiagnostic['code'], path: string, message: string): WorkspaceUsageResult {
  return { ok: false, diagnostics: [{ code, path, message }] };
}
