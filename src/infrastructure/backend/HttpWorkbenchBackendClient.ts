import { WORKBENCH_RUNTIME_EVENT_TYPES } from '../../domain/runtime/model';
import type { RepositoryCoverageSnapshot, RepositoryInspectionInput } from '../../domain/repository/model';
import type {
  WorkbenchRuntimeBackendHealth,
  WorkbenchRuntimeAppPreviewDescriptor,
  WorkbenchRuntimeBackendPort,
  WorkbenchRuntimeObservationEvent,
  WorkbenchRuntimeProjectDescriptor,
  WorkbenchRuntimeProjectionInvalidationResult,
  WorkbenchRuntimeSharedStateEntry,
  WorkbenchRuntimeSharedStatePatch,
  WorkbenchRuntimeSubscription,
  WorkbenchRuntimeWorkspaceDescriptor
} from '../../domain/runtime/model';

export interface HttpWorkbenchBackendClientOptions {
  baseUrl?: string;
  resolveBaseUrl?: () => string;
  fetcher?: typeof fetch;
  eventSourceFactory?: (url: string) => EventSource;
  lifecycleEventTarget?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  now?: () => string;
}

interface BackendWorkspaceResponse {
  name?: string;
  mode?: string;
  workspaceRoot?: string;
  project?: unknown;
  repositoryInspection?: unknown;
  repositoryCoverage?: unknown;
  capabilities?: string[];
  projections?: Record<string, unknown>;
}

export class HttpWorkbenchBackendClient implements WorkbenchRuntimeBackendPort {
  private readonly configuredBaseUrl: string;
  private readonly baseUrlResolver?: () => string;
  private readonly fetcher: typeof fetch;
  private readonly eventSourceFactory?: (url: string) => EventSource;
  private readonly lifecycleEventTarget?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  private readonly now: () => string;

  constructor(options: HttpWorkbenchBackendClientOptions = {}) {
    this.configuredBaseUrl = normalizeBaseUrl(options.baseUrl ?? 'http://127.0.0.1:5179');
    this.baseUrlResolver = options.resolveBaseUrl;
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
    this.eventSourceFactory = options.eventSourceFactory;
    this.lifecycleEventTarget = options.lifecycleEventTarget;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  get baseUrl(): string {
    return normalizeBaseUrl(this.baseUrlResolver?.() ?? this.configuredBaseUrl);
  }

  async getHealth(): Promise<WorkbenchRuntimeBackendHealth> {
    const payload = await this.getJson<WorkbenchRuntimeBackendHealth>('/health');

    return {
      status: payload.status,
      service: payload.service,
      mode: payload.mode
    };
  }

  async getWorkspace(): Promise<WorkbenchRuntimeWorkspaceDescriptor> {
    const payload = await this.getJson<BackendWorkspaceResponse>('/api/workspace');

    return normalizeWorkspaceDescriptor(payload);
  }

  async getProjection<TProjection = unknown>(
    kind: string,
    params: Record<string, string> = {}
  ): Promise<TProjection> {
    const searchParams = new URLSearchParams(params);
    const query = searchParams.size > 0 ? `?${searchParams.toString()}` : '';

    return this.getJson<TProjection>(`/api/projections/${encodeURIComponent(kind)}${query}`);
  }

  async invalidateProjection(
    kind: string,
    params: Record<string, string> = {}
  ): Promise<WorkbenchRuntimeProjectionInvalidationResult> {
    const searchParams = new URLSearchParams(params);
    const query = searchParams.size > 0 ? `?${searchParams.toString()}` : '';

    return this.postJson<WorkbenchRuntimeProjectionInvalidationResult>(
      `/api/projections/${encodeURIComponent(kind)}/invalidate${query}`
    );
  }

  async loadProject(root: string): Promise<WorkbenchRuntimeWorkspaceDescriptor> {
    const payload = await this.postJson<BackendWorkspaceResponse>('/api/workspace/project', { root });

    return normalizeWorkspaceDescriptor(payload);
  }

  async startAppPreview(root?: string): Promise<WorkbenchRuntimeAppPreviewDescriptor> {
    const searchParams = new URLSearchParams();

    if (root) {
      searchParams.set('root', root);
    }

    const query = searchParams.size > 0 ? `?${searchParams.toString()}` : '';

    return this.getJson<WorkbenchRuntimeAppPreviewDescriptor>(`/api/app-preview${query}`);
  }

  async listSharedState(): Promise<WorkbenchRuntimeSharedStateEntry[]> {
    return this.getJson<WorkbenchRuntimeSharedStateEntry[]>('/api/shared-state');
  }

  async patchSharedState(
    key: string,
    patch: WorkbenchRuntimeSharedStatePatch
  ): Promise<WorkbenchRuntimeSharedStateEntry> {
    return this.postJson<WorkbenchRuntimeSharedStateEntry>(
      `/api/shared-state/${encodeURIComponent(key)}`,
      patch
    );
  }

  subscribeToEvents(
    onEvent: (event: WorkbenchRuntimeObservationEvent) => void,
    onError: (error: Error) => void
  ): WorkbenchRuntimeSubscription {
    const factory = this.eventSourceFactory ?? resolveEventSourceFactory();

    if (!factory) {
      onError(new Error('EventSource is not available in this runtime.'));
      return { dispose: () => {} };
    }

    const eventSource = factory(`${this.baseUrl}/events`);
    const lifecycleEventTarget = this.lifecycleEventTarget ?? resolveLifecycleEventTarget();
    let closedByClient = false;
    let cleanupCompleted = false;
    const listeners = WORKBENCH_RUNTIME_EVENT_TYPES.map((eventType) => {
      const listener = (event: MessageEvent) => {
        if (closedByClient) {
          return;
        }

        onEvent({
          type: eventType,
          payload: parseEventPayload(event.data),
          receivedAt: this.now()
        });
      };

      eventSource.addEventListener(eventType, listener);

      return { eventType, listener };
    });
    const closeEventSource = () => {
      if (cleanupCompleted) {
        return;
      }

      closedByClient = true;

      for (const { eventType, listener } of listeners) {
        eventSource.removeEventListener(eventType, listener);
      }

      lifecycleEventTarget?.removeEventListener('pagehide', closeEventSource);
      lifecycleEventTarget?.removeEventListener('beforeunload', closeEventSource);
      eventSource.close();
      // Suppress events from the first attempt, but only acknowledge cleanup
      // after it succeeds. A throwing close remains explicitly retryable.
      cleanupCompleted = true;
    };

    lifecycleEventTarget?.addEventListener('pagehide', closeEventSource);
    lifecycleEventTarget?.addEventListener('beforeunload', closeEventSource);

    eventSource.onerror = () => {
      if (closedByClient || eventSource.readyState === 2) {
        return;
      }

      onError(new Error(`Lost connection to ${this.baseUrl}/events`));
    };

    return {
      dispose: () => {
        closeEventSource();
      }
    };
  }

  private async getJson<T>(path: string): Promise<T> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      headers: {
        accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(await createBackendRequestErrorMessage(response));
    }

    return (await response.json()) as T;
  }

  private async postJson<T>(path: string, body?: unknown): Promise<T> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        ...(body === undefined ? {} : { 'content-type': 'application/json' })
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });

    if (!response.ok) {
      throw new Error(await createBackendRequestErrorMessage(response));
    }

    return (await response.json()) as T;
  }
}

function normalizeWorkspaceDescriptor(payload: BackendWorkspaceResponse): WorkbenchRuntimeWorkspaceDescriptor {
  return {
    name: payload.name ?? 'workbench-backend',
    mode: payload.mode ?? 'development',
    workspaceRoot: payload.workspaceRoot ?? '',
    project: normalizeWorkspaceProject(payload.project),
    repositoryInspection: normalizeRepositoryInspectionInput(payload.repositoryInspection),
    repositoryCoverage: normalizeRepositoryCoverageSnapshot(payload.repositoryCoverage),
    capabilities: Array.isArray(payload.capabilities) ? payload.capabilities : [],
    projections: normalizeWorkspaceProjections(payload.projections)
  };
}

async function createBackendRequestErrorMessage(response: Response): Promise<string> {
  let message = `${response.status} ${response.statusText}`;

  try {
    const payload = await response.clone().json() as { message?: unknown; error?: unknown };
    const payloadMessage = typeof payload.message === 'string' ? payload.message : null;
    const payloadError = typeof payload.error === 'string' ? payload.error : null;
    message = payloadMessage ?? payloadError ?? message;
  } catch {
    // Fall back to the status line when the backend does not return JSON.
  }

  return `Backend request failed: ${message}`;
}

function normalizeWorkspaceProjections(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const projections: Record<string, string[]> = {};

  for (const [projectionKind, sources] of Object.entries(value)) {
    projections[projectionKind] = Array.isArray(sources)
      ? sources.filter((source): source is string => typeof source === 'string')
      : [];
  }

  return projections;
}

function normalizeWorkspaceProject(value: unknown): WorkbenchRuntimeProjectDescriptor | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const id = typeof payload.id === 'string' ? payload.id : null;
  const label = typeof payload.label === 'string' ? payload.label : null;
  const root = typeof payload.root === 'string' ? payload.root : null;
  const workspaceRoot = typeof payload.workspaceRoot === 'string' ? payload.workspaceRoot : '';
  const faviconDataUrl = typeof payload.faviconDataUrl === 'string' ? payload.faviconDataUrl : null;
  const i18n = payload.i18n && typeof payload.i18n === 'object' && !Array.isArray(payload.i18n)
    ? payload.i18n as Record<string, unknown>
    : null;
  const primaryLocale =
    typeof payload.primaryLocale === 'string'
      ? payload.primaryLocale
      : typeof i18n?.primaryLocale === 'string'
        ? i18n.primaryLocale
        : null;
  const payloadLocales = normalizeLocaleList(payload.locales);
  const i18nLocales = normalizeLocaleList(i18n?.locales);
  const locales = payloadLocales.length > 0 ? payloadLocales : i18nLocales;
  const componentSources = Array.isArray(payload.componentSources)
    ? payload.componentSources.filter((source): source is string => typeof source === 'string')
    : [];
  const componentSourceCount =
    typeof payload.componentSourceCount === 'number' && Number.isFinite(payload.componentSourceCount)
      ? payload.componentSourceCount
      : componentSources.length;

  return id && label && root
    ? {
        id,
        label,
        root,
        workspaceRoot,
        isWorkspaceProject: payload.isWorkspaceProject === true,
        faviconDataUrl,
        primaryLocale,
        locales,
        i18n: primaryLocale || locales.length > 0 ? { primaryLocale, locales } : null,
        componentSources,
        componentSourceCount
      }
    : null;
}

function normalizeLocaleList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .filter((locale): locale is string => typeof locale === 'string' && locale.trim().length > 0)
        .map((locale) => locale.trim())
    )
  ];
}

function normalizeRepositoryInspectionInput(value: unknown): RepositoryInspectionInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const root = typeof payload.root === 'string' ? payload.root : '';

  if (!root) {
    return null;
  }

  return {
    label: typeof payload.label === 'string' ? payload.label : null,
    root,
    files: Array.isArray(payload.files)
      ? payload.files.filter((file): file is string => typeof file === 'string')
      : [],
    packageJson: normalizeRepositoryPackageJson(payload.packageJson),
    git: null,
    inspectOnly: payload.inspectOnly === true
  };
}

function normalizeRepositoryCoverageSnapshot(value: unknown): RepositoryCoverageSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const payload = value as Partial<RepositoryCoverageSnapshot>;

  return typeof payload.projectRoot === 'string' && typeof payload.projectLabel === 'string'
    ? payload as RepositoryCoverageSnapshot
    : null;
}

function normalizeRepositoryPackageJson(value: unknown): RepositoryInspectionInput['packageJson'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const payload = value as Record<string, unknown>;

  return {
    name: typeof payload.name === 'string' ? payload.name : undefined,
    version: typeof payload.version === 'string' ? payload.version : undefined,
    scripts: normalizeStringRecord(payload.scripts),
    workspaces: normalizePackageWorkspaces(payload.workspaces),
    dependencies: normalizeStringRecord(payload.dependencies),
    devDependencies: normalizeStringRecord(payload.devDependencies)
  };
}

function normalizeStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string');

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function normalizePackageWorkspaces(value: unknown): string[] | { packages?: string[] } | undefined {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string');
  }

  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const packages = (value as { packages?: unknown }).packages;

  return Array.isArray(packages)
    ? { packages: packages.filter((entry): entry is string => typeof entry === 'string') }
    : undefined;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function parseEventPayload(data: string): unknown {
  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

function resolveEventSourceFactory(): ((url: string) => EventSource) | undefined {
  if (typeof EventSource === 'undefined') {
    return undefined;
  }

  return (url) => new EventSource(url);
}

function resolveLifecycleEventTarget(): Pick<EventTarget, 'addEventListener' | 'removeEventListener'> | undefined {
  return typeof window === 'undefined' ? undefined : window;
}
