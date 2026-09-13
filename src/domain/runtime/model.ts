import type { JsonValue } from '../shared/json';
import type { LaunchPhase, LaunchPreflightSummary, LaunchState, LaunchTarget } from '../launch/model';
import type { RepositoryCoverageSnapshot, RepositoryInspectionInput } from '../repository/model';
import type { RuntimeLifecycleSnapshot } from './lifecycle';
import type { RuntimeObservabilitySnapshot } from './observability';

export type WorkbenchRuntimeConnectionStatus = 'idle' | 'connecting' | 'online' | 'offline' | 'error';
export type WorkbenchRuntimeProjectionCacheStatus = 'hit' | 'miss' | 'refreshed' | 'bypass' | 'local';
export type WorkbenchRuntimeDiagnosticSeverity = 'info' | 'warning' | 'error';
export type WorkbenchRuntimeProjectionSessionStatus = 'opening' | 'open' | 'refreshing' | 'stale' | 'error';
export type RuntimeProjectionMode = 'self' | 'repository';
export type RuntimeInspectableStatus = 'active' | 'idle' | 'degraded' | 'error' | 'unknown';
export type RuntimeDebugEventLevel = 'debug' | 'info' | 'warning' | 'error';
export type WorkbenchRuntimeEventType =
  | 'runtime.ready'
  | 'runtime.heartbeat'
  | 'source.changed'
  | 'source.watch-error'
  | 'workspace.project-loaded'
  | 'projection.catalog'
  | 'projection.loaded'
  | 'projection.invalidated'
  | 'projection.error'
  | 'shared-state.updated'
  | 'message';

export const WORKBENCH_RUNTIME_EVENT_TYPES: WorkbenchRuntimeEventType[] = [
  'runtime.ready',
  'runtime.heartbeat',
  'source.changed',
  'source.watch-error',
  'workspace.project-loaded',
  'projection.catalog',
  'projection.loaded',
  'projection.invalidated',
  'projection.error',
  'shared-state.updated',
  'message'
];

export interface WorkbenchRuntimeBackendHealth {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  mode: string;
}

export interface WorkbenchRuntimeWorkspaceDescriptor {
  name: string;
  mode: string;
  workspaceRoot: string;
  project?: WorkbenchRuntimeProjectDescriptor | null;
  repositoryInspection?: RepositoryInspectionInput | null;
  repositoryCoverage?: RepositoryCoverageSnapshot | null;
  capabilities: string[];
  projections: Record<string, string[]>;
}

export interface WorkbenchRuntimeAppPreviewDescriptor {
  status: 'ready';
  origin: string;
  url: string;
  proxyUrl?: string;
  generatedAt: string;
  logs?: WorkbenchRuntimeAppPreviewLogEntry[];
  project: {
    id: string;
    label: string;
    root: string;
  };
}

export interface WorkbenchRuntimeAppPreviewLogEntry {
  id: string;
  level: 'debug' | 'info' | 'warning' | 'error';
  message: string;
  timestamp: string;
}

export interface WorkbenchRuntimeProjectDescriptor {
  id: string;
  label: string;
  root: string;
  workspaceRoot: string;
  isWorkspaceProject: boolean;
  faviconDataUrl?: string | null;
  primaryLocale?: string | null;
  locales?: string[];
  i18n?: {
    primaryLocale?: string | null;
    locales?: string[];
  } | null;
  componentSources: string[];
  componentSourceCount: number;
}

export interface WorkbenchRuntimeDiagnostic {
  id: string;
  severity: WorkbenchRuntimeDiagnosticSeverity;
  title: string;
  message: string;
  sourceFile?: string;
  recommendation?: string;
}

export interface WorkbenchRuntimeProjectionEnvelope<TPayload = unknown> {
  projectionKind: string;
  sourceFile: string;
  version: string;
  generatedAt: string;
  cacheStatus: WorkbenchRuntimeProjectionCacheStatus;
  diagnostics: WorkbenchRuntimeDiagnostic[];
  payload: TPayload;
}

export interface WorkbenchRuntimeProjectionTarget {
  projectionKind: string;
  sourceFile: string;
}

export interface WorkbenchRuntimeProjectionSessionPatch {
  target: WorkbenchRuntimeProjectionTarget;
  status?: WorkbenchRuntimeProjectionSessionStatus;
  selectedEntityId?: string | null;
  focusedEntityId?: string | null;
  lastError?: string | null;
}

export interface WorkbenchRuntimeProjectionCatalogEntry {
  projectionKind: string;
  version: string;
  sources: string[];
}

export interface RuntimeProjectionMetadata {
  mode: RuntimeProjectionMode;
  generatedAt: string;
  source: string;
  version: string;
  repo?: {
    label: string;
    root: string;
    branch?: string | null;
    commit?: string | null;
  } | null;
  build?: {
    version?: string | null;
    environment?: string | null;
    generatedAt?: string | null;
  } | null;
}

export interface RuntimeStoreSnapshot {
  id: string;
  label: string;
  scope: string;
  status: RuntimeInspectableStatus;
  value: JsonValue;
  updatedAt: string;
  metadata: JsonValue;
}

export interface RuntimeServiceSnapshot {
  id: string;
  label: string;
  status: RuntimeInspectableStatus;
  capabilities: string[];
  endpoint?: string | null;
  lastError?: string | null;
  updatedAt: string;
  metadata: JsonValue;
}

export interface RuntimeManagerSnapshot {
  id: string;
  label: string;
  status: RuntimeInspectableStatus;
  responsibilities: string[];
  lastError?: string | null;
  updatedAt: string;
  metadata: JsonValue;
}

export interface RuntimeDebugEvent {
  id: string;
  level: RuntimeDebugEventLevel;
  type: string;
  message: string;
  scope?: string | null;
  timestamp: string;
  payload?: JsonValue;
}

export interface RuntimeStackTrace {
  id: string;
  message: string;
  scope?: string | null;
  timestamp: string;
  frames: string[];
  cause?: string | null;
}

export interface RuntimeLaunchTransition {
  id: string;
  phase: LaunchPhase;
  previousPhase?: LaunchPhase | null;
  target: LaunchTarget | null;
  timestamp: string;
  message: string;
}

export interface RuntimeLaunchProgressSnapshot {
  phase: LaunchPhase;
  status: string;
  progress: number;
  activeStepId: string | null;
  completedSteps: number;
  totalSteps: number;
  readyChecks: number;
  warningChecks: number;
  blockedChecks: number;
}

export interface RuntimeLaunchSnapshot {
  phase: LaunchPhase;
  target: LaunchTarget | null;
  preflight: LaunchPreflightSummary | null;
  plan: LaunchState['plan'];
  initialization: LaunchState['initialization'];
  hydration: LaunchState['hydration'];
  progress: RuntimeLaunchProgressSnapshot;
  state: LaunchState;
  transitions: RuntimeLaunchTransition[];
  updatedAt: string;
}

export interface WorkbenchRuntimeProjectionInvalidationResult {
  projectionKind: string;
  sourceFile: string;
  invalidated: boolean;
  requestedAt: string;
}

export type WorkbenchRuntimeSharedStateScope = 'product' | 'session' | 'gesture';

export interface WorkbenchRuntimeSharedStateEntry {
  key: string;
  scope: WorkbenchRuntimeSharedStateScope;
  value: JsonValue;
  version: number;
  revision: string;
  updatedAt: string;
  originClientId: string | null;
}

export interface WorkbenchRuntimeSharedStatePatch {
  scope?: WorkbenchRuntimeSharedStateScope;
  value: JsonValue;
  expectedVersion?: number;
  originClientId?: string | null;
}

export interface WorkbenchRuntimeObservationEvent {
  type: WorkbenchRuntimeEventType;
  payload: unknown;
  receivedAt: string;
}

export interface WorkbenchRuntimeSnapshot {
  status: WorkbenchRuntimeConnectionStatus;
  backendUrl: string;
  projectionMode?: RuntimeProjectionMode;
  metadata?: RuntimeProjectionMetadata;
  health: WorkbenchRuntimeBackendHealth | null;
  workspace: WorkbenchRuntimeWorkspaceDescriptor | null;
  projectionCatalog: WorkbenchRuntimeProjectionCatalogEntry[];
  stores?: RuntimeStoreSnapshot[];
  services?: RuntimeServiceSnapshot[];
  managers?: RuntimeManagerSnapshot[];
  debugEvents?: RuntimeDebugEvent[];
  stackTraces?: RuntimeStackTrace[];
  launch?: RuntimeLaunchSnapshot | null;
  lifecycle?: RuntimeLifecycleSnapshot | null;
  observability?: RuntimeObservabilitySnapshot | null;
  sharedState: WorkbenchRuntimeSharedStateEntry[];
  events: WorkbenchRuntimeObservationEvent[];
  lastError: string | null;
}

export interface WorkbenchRuntimeSubscription {
  dispose(): void;
}

export interface WorkbenchRuntimeBackendPort {
  readonly baseUrl: string;
  getHealth(): Promise<WorkbenchRuntimeBackendHealth>;
  getWorkspace(): Promise<WorkbenchRuntimeWorkspaceDescriptor>;
  getProjection<TProjection = unknown>(
    kind: string,
    params?: Record<string, string>
  ): Promise<TProjection>;
  invalidateProjection(
    kind: string,
    params?: Record<string, string>
  ): Promise<WorkbenchRuntimeProjectionInvalidationResult>;
  loadProject?(root: string): Promise<WorkbenchRuntimeWorkspaceDescriptor>;
  startAppPreview?(root?: string): Promise<WorkbenchRuntimeAppPreviewDescriptor>;
  listSharedState?(): Promise<WorkbenchRuntimeSharedStateEntry[]>;
  patchSharedState?(
    key: string,
    patch: WorkbenchRuntimeSharedStatePatch
  ): Promise<WorkbenchRuntimeSharedStateEntry>;
  subscribeToEvents(
    onEvent: (event: WorkbenchRuntimeObservationEvent) => void,
    onError: (error: Error) => void
  ): WorkbenchRuntimeSubscription;
}
