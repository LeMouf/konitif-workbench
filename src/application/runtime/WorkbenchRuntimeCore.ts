import type {
  RuntimeLaunchSnapshot,
  RuntimeLaunchTransition,
  RuntimeDebugEvent,
  RuntimeDebugEventLevel,
  RuntimeProjectionMetadata,
  RuntimeProjectionMode,
  RuntimeStackTrace,
  WorkbenchRuntimeBackendPort,
  WorkbenchRuntimeAppPreviewDescriptor,
  WorkbenchRuntimeObservationEvent,
  WorkbenchRuntimeProjectionInvalidationResult,
  WorkbenchRuntimeSharedStateEntry,
  WorkbenchRuntimeSharedStatePatch,
  WorkbenchRuntimeWorkspaceDescriptor,
  WorkbenchRuntimeSnapshot,
  WorkbenchRuntimeSubscription
} from '../../domain/runtime/model';
import type { LaunchState } from '../../domain/launch/model';
import {
  createRuntimeLifecycleSnapshot,
  transitionRuntimeLifecycleSnapshot,
  type RuntimeLifecycleSnapshot,
  type RuntimeLifecycleState
} from '../../domain/runtime/lifecycle';
import type {
  RuntimeCrashReportInput,
  RuntimeEntityLifecycleInput,
  RuntimeHealthCheckInput,
  RuntimePerformanceMarkerInput,
  RuntimeStoreMutationInput,
  RuntimeStructuredLogInput,
  RuntimeTelemetryTraceInput
} from '../../domain/runtime/observability';
import {
  createRuntimeBackendConnection,
  type RuntimeBackendConnection
} from './RuntimeBackendConnection';
import { createRuntimeBackendSubscriptionOwner } from './RuntimeBackendSubscription';
import {
  createRuntimeLaunchPhaseDebugEventInput,
  createRuntimeLaunchSnapshotFromState,
  createRuntimeLaunchStoreMutationInput,
  createRuntimeLaunchTransitionRecord
} from './RuntimeLaunchStateSnapshot';
import { applyRuntimeObservationEvent } from './RuntimeObservationEvents';
import {
  normalizeProjectionCatalogFromWorkspace
} from './RuntimeProjectionCatalog';
import {
  safeReadRuntimeValue
} from './RuntimeRegistrySnapshots';
import {
  createRuntimeRegistryOwner,
  type RuntimeRegistryOwner
} from './RuntimeRegistryOwner';
import type {
  RuntimeManagerRegistration,
  RuntimeServiceRegistration,
  RuntimeStoreRegistration
} from './RuntimeRegistryTypes';
import {
  compareSharedStateEntries,
  normalizeSharedStateEntry,
  upsertSharedStateEntry
} from './RuntimeSharedState';
import { RuntimeObservabilityHub } from './RuntimeObservabilityHub';
import {
  sanitizeRuntimeJson,
  sanitizeRuntimeText
} from './WorkbenchRuntimeSanitizers';

export interface WorkbenchRuntimeCoreOptions {
  backend?: WorkbenchRuntimeBackendPort;
  maxEvents?: number;
  maxDebugEvents?: number;
  maxStackTraces?: number;
  maxTelemetryEntries?: number;
  mode?: RuntimeProjectionMode;
  metadata?: Partial<RuntimeProjectionMetadata>;
}

export type WorkbenchRuntimeCoreListener = (snapshot: WorkbenchRuntimeSnapshot) => void;

export type {
  RuntimeManagerRegistration,
  RuntimeServiceRegistration,
  RuntimeStoreRegistration
} from './RuntimeRegistryTypes';

export interface RuntimeDebugEventInput {
  id?: string;
  level?: RuntimeDebugEventLevel;
  type: string;
  message?: string;
  scope?: string | null;
  payload?: unknown;
  timestamp?: string;
}

export class WorkbenchRuntimeCore {
  private readonly backend: WorkbenchRuntimeBackendPort | null;
  private readonly backendConnection: RuntimeBackendConnection;
  private readonly maxEvents: number;
  private readonly maxDebugEvents: number;
  private readonly maxStackTraces: number;
  private readonly listeners = new Set<WorkbenchRuntimeCoreListener>();
  private readonly observability: RuntimeObservabilityHub;
  private readonly backendSubscription = createRuntimeBackendSubscriptionOwner();
  private readonly registryOwner: RuntimeRegistryOwner;
  private snapshot: WorkbenchRuntimeSnapshot;
  private launchTransitions: RuntimeLaunchTransition[] = [];
  private lifecycleSnapshot: RuntimeLifecycleSnapshot;
  private sequence = 0;

  constructor(options: WorkbenchRuntimeCoreOptions) {
    this.backend = options.backend ?? null;
    this.backendConnection = createRuntimeBackendConnection(this.backend);
    this.maxEvents = options.maxEvents ?? 50;
    this.maxDebugEvents = options.maxDebugEvents ?? 100;
    this.maxStackTraces = options.maxStackTraces ?? 25;
    this.observability = new RuntimeObservabilityHub({
      maxEntries: options.maxTelemetryEntries ?? Math.max(this.maxEvents, this.maxDebugEvents, this.maxStackTraces)
    });
    this.registryOwner = createRuntimeRegistryOwner({
      onChanged: () => {
        this.createSnapshot();
      },
      onManagerDisposed: (registration) => {
        this.observability.recordEntityLifecycle({
          entityId: registration.id,
          entityType: 'manager',
          kind: 'dispose',
          status: 'idle'
        });
      },
      onManagerRegistered: (registration) => {
        this.observability.recordEntityLifecycle({
          entityId: registration.id,
          entityType: 'manager',
          kind: 'register',
          status: registration.status ?? 'unknown',
          payload: {
            responsibilities: registration.responsibilities ?? []
          }
        });
      },
      onServiceDisposed: (registration) => {
        this.observability.recordEntityLifecycle({
          entityId: registration.id,
          entityType: 'service',
          kind: 'dispose',
          status: 'idle'
        });
      },
      onServiceRegistered: (registration) => {
        this.observability.recordEntityLifecycle({
          entityId: registration.id,
          entityType: 'service',
          kind: 'register',
          status: registration.status ?? 'unknown',
          payload: {
            capabilities: registration.capabilities ?? [],
            endpoint: registration.endpoint ?? null
          }
        });
      },
      onStoreDisposed: (registration) => {
        this.observability.recordStoreMutation({
          storeId: registration.id,
          kind: 'dispose'
        });
      },
      onStoreRegistered: (registration) => {
        this.observability.recordStoreMutation({
          storeId: registration.id,
          kind: 'register',
          value: safeReadRuntimeValue(registration.getSnapshot, registration.value)
        });
      }
    });
    this.lifecycleSnapshot = createRuntimeLifecycleSnapshot();
    this.snapshot = {
      status: 'idle',
      backendUrl: this.backend?.baseUrl ?? '',
      projectionMode: options.mode ?? 'self',
      metadata: createRuntimeProjectionMetadata(options.mode ?? 'self', options.metadata),
      health: null,
      workspace: null,
      projectionCatalog: [],
      stores: [],
      services: [],
      managers: [],
      debugEvents: [],
      stackTraces: [],
      launch: null,
      lifecycle: this.lifecycleSnapshot,
      observability: this.observability.createSnapshot(),
      sharedState: [],
      events: [],
      lastError: null
    };
  }

  getSnapshot(): WorkbenchRuntimeSnapshot {
    return this.snapshot;
  }

  createSnapshot(metadataPatch: Partial<RuntimeProjectionMetadata> = {}): WorkbenchRuntimeSnapshot {
    const previousMetadata = this.snapshot.metadata ?? createRuntimeProjectionMetadata(this.snapshot.projectionMode ?? 'self');

    this.setSnapshot({
      metadata: {
        ...previousMetadata,
        ...metadataPatch,
        mode: metadataPatch.mode ?? previousMetadata.mode,
        source: metadataPatch.source ?? previousMetadata.source,
        version: metadataPatch.version ?? previousMetadata.version,
        generatedAt: metadataPatch.generatedAt ?? new Date().toISOString()
      },
      stores: this.registryOwner.getStoreSnapshots(),
      services: this.registryOwner.getServiceSnapshots(),
      managers: this.registryOwner.getManagerSnapshots(),
      observability: this.observability.createSnapshot()
    });

    return this.snapshot;
  }

  activateSelfProjection(metadataPatch: Partial<RuntimeProjectionMetadata> = {}): WorkbenchRuntimeSnapshot {
    this.backendSubscription.disconnect();
    this.setSnapshot({
      status: 'online',
      projectionMode: 'self',
      metadata: createRuntimeProjectionMetadata('self', {
        ...metadataPatch,
        mode: 'self',
        source: metadataPatch.source ?? 'self'
      }),
      workspace: null,
      projectionCatalog: [],
      sharedState: [],
      events: [],
      lastError: null
    });

    return this.createSnapshot({
      ...metadataPatch,
      mode: 'self',
      source: metadataPatch.source ?? 'self'
    });
  }

  subscribe(listener: WorkbenchRuntimeCoreListener): WorkbenchRuntimeSubscription {
    this.listeners.add(listener);
    listener(this.snapshot);

    return {
      dispose: () => {
        this.listeners.delete(listener);
      }
    };
  }

  async connect(): Promise<WorkbenchRuntimeSnapshot> {
    const backend = this.backend;
    if (!backend) {
      return this.createSnapshot({
        mode: this.snapshot.projectionMode ?? 'self',
        source: this.snapshot.metadata?.source || 'self'
      });
    }

    this.setSnapshot({
      status: 'connecting',
      backendUrl: backend.baseUrl,
      lastError: null
    });

    try {
      const [health, workspace, sharedState] = await Promise.all([
        backend.getHealth(),
        backend.getWorkspace(),
        this.loadSharedStateFromBackend().catch(() => [])
      ]);

      this.backendSubscription.replaceWith(
        () => backend.subscribeToEvents(
          (event) => this.pushEvent(event),
          (error) => {
            this.setSnapshot({
              status: 'error',
              lastError: error.message
            });
          }
        )
      );

      this.setSnapshot({
        status: 'online',
        health,
        workspace,
        projectionCatalog: normalizeProjectionCatalogFromWorkspace(workspace),
        sharedState,
        lastError: null
      });
    } catch (error) {
      this.setSnapshot({
        status: 'offline',
        lastError: error instanceof Error ? error.message : String(error)
      });
    }

    return this.snapshot;
  }

  disconnect(): void {
    this.backendSubscription.disconnect();
    this.setSnapshot({
      status: 'idle'
    });
  }

  async loadProjection<TProjection = unknown>(
    kind: string,
    params?: Record<string, string>
  ): Promise<TProjection> {
    return this.backendConnection.loadProjection<TProjection>(kind, params);
  }

  async invalidateProjection(
    kind: string,
    params?: Record<string, string>
  ): Promise<WorkbenchRuntimeProjectionInvalidationResult> {
    return this.backendConnection.invalidateProjection(kind, params);
  }

  async loadProject(root: string): Promise<WorkbenchRuntimeWorkspaceDescriptor> {
    if (!this.backend?.loadProject) {
      throw new Error('Backend project loading is unavailable.');
    }

    this.setSnapshot({
      status: 'connecting',
      lastError: null
    });

    try {
      const workspace = await this.backend.loadProject(root);
      const sharedState = await this.loadSharedStateFromBackend().catch(() => this.snapshot.sharedState);

      this.setSnapshot({
        status: 'online',
        workspace,
        projectionCatalog: normalizeProjectionCatalogFromWorkspace(workspace),
        sharedState,
        lastError: null
      });

      return workspace;
    } catch (error) {
      this.setSnapshot({
        status: 'error',
        lastError: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async startAppPreview(root?: string): Promise<WorkbenchRuntimeAppPreviewDescriptor> {
    return this.backendConnection.startAppPreview(root);
  }

  async listSharedState(): Promise<WorkbenchRuntimeSharedStateEntry[]> {
    const sharedState = await this.loadSharedStateFromBackend();

    this.setSnapshot({ sharedState });

    return sharedState;
  }

  recordTelemetryTrace(input: RuntimeTelemetryTraceInput): void {
    this.observability.recordTrace(input);
    this.refreshObservabilitySnapshot();
  }

  recordStructuredLog(input: RuntimeStructuredLogInput): void {
    this.observability.recordLog(input);
    this.refreshObservabilitySnapshot();
  }

  recordPerformanceMarker(input: RuntimePerformanceMarkerInput): void {
    this.observability.recordPerformanceMarker(input);
    this.refreshObservabilitySnapshot();
  }

  recordHealthCheck(input: RuntimeHealthCheckInput): void {
    this.observability.recordHealthCheck(input);
    this.refreshObservabilitySnapshot();
  }

  recordStoreMutation(input: RuntimeStoreMutationInput): void {
    this.observability.recordStoreMutation(input);
    this.refreshObservabilitySnapshot();
  }

  recordEntityLifecycle(input: RuntimeEntityLifecycleInput): void {
    this.observability.recordEntityLifecycle(input);
    this.refreshObservabilitySnapshot();
  }

  captureCrashReport(error: Error | string, input: RuntimeCrashReportInput = {}): void {
    const report = this.observability.captureCrashReport(error, input);
    this.setSnapshot({
      status: 'error',
      lastError: report.message,
      observability: this.observability.createSnapshot()
    });
  }

  registerStore(registration: RuntimeStoreRegistration): WorkbenchRuntimeSubscription {
    return this.registryOwner.registerStore(registration);
  }

  registerService(registration: RuntimeServiceRegistration): WorkbenchRuntimeSubscription {
    return this.registryOwner.registerService(registration);
  }

  registerManager(registration: RuntimeManagerRegistration): WorkbenchRuntimeSubscription {
    return this.registryOwner.registerManager(registration);
  }

  pushDebugEvent(input: RuntimeDebugEventInput): RuntimeDebugEvent {
    const event: RuntimeDebugEvent = {
      id: input.id ?? this.createRuntimeRecordId('debug'),
      level: input.level ?? 'info',
      type: sanitizeRuntimeText(input.type, 160),
      message: sanitizeRuntimeText(input.message ?? input.type, 500),
      scope: input.scope ? sanitizeRuntimeText(input.scope, 160) : null,
      timestamp: input.timestamp ?? new Date().toISOString(),
      payload: input.payload === undefined ? undefined : sanitizeRuntimeJson(input.payload)
    };

    this.observability.recordDebugEvent(event);
    this.setSnapshot({
      debugEvents: [event, ...(this.snapshot.debugEvents ?? [])].slice(0, this.maxDebugEvents),
      observability: this.observability.createSnapshot()
    });

    return event;
  }

  captureStackTrace(error?: Error | string, input: { id?: string; message?: string; scope?: string | null } = {}): RuntimeStackTrace {
    const resolvedError = error instanceof Error ? error : null;
    const stackSource = resolvedError?.stack ?? (typeof error === 'string' ? error : new Error(input.message ?? 'Runtime stack trace').stack ?? '');
    const cause = resolvedError && 'cause' in resolvedError ? (resolvedError as Error & { cause?: unknown }).cause : null;
    const stackTrace: RuntimeStackTrace = {
      id: input.id ?? this.createRuntimeRecordId('stack'),
      message: sanitizeRuntimeText(input.message ?? resolvedError?.message ?? (typeof error === 'string' ? error : 'Runtime stack trace'), 500),
      scope: input.scope ? sanitizeRuntimeText(input.scope, 160) : null,
      timestamp: new Date().toISOString(),
      frames: stackSource
        .split('\n')
        .map((frame) => sanitizeRuntimeText(frame.trim(), 500))
        .filter(Boolean)
        .slice(0, 24),
      cause: cause instanceof Error ? sanitizeRuntimeText(cause.message, 500) : null
    };

    this.observability.recordStackTrace(stackTrace);
    this.setSnapshot({
      stackTraces: [stackTrace, ...(this.snapshot.stackTraces ?? [])].slice(0, this.maxStackTraces),
      observability: this.observability.createSnapshot()
    });

    return stackTrace;
  }

  recordLaunchState(state: LaunchState, input: { message?: string; timestamp?: string } = {}): RuntimeLaunchSnapshot {
    const timestamp = input.timestamp ?? new Date().toISOString();
    const previousPhase = this.snapshot.launch?.phase ?? null;
    const phaseChanged = previousPhase !== state.phase;
    const message = sanitizeRuntimeText(input.message ?? `Launch phase ${state.phase}`, 500);
    let transition: RuntimeLaunchTransition | null = null;

    if (phaseChanged) {
      this.transitionLifecycle(state.phase, {
        timestamp,
        message
      });
      transition = createRuntimeLaunchTransitionRecord({
        id: this.createRuntimeRecordId('launch'),
        state,
        previousPhase,
        timestamp,
        message
      });

      this.launchTransitions = [transition, ...this.launchTransitions].slice(0, this.maxDebugEvents);
    }

    const launchSnapshot = createRuntimeLaunchSnapshotFromState({
      state,
      transitions: this.launchTransitions,
      timestamp
    });

    this.observability.recordStoreMutation(createRuntimeLaunchStoreMutationInput({
      id: this.createRuntimeRecordId('launch-state'),
      state,
      previousPhase,
      progress: launchSnapshot.progress,
      timestamp
    }));
    this.setSnapshot({
      launch: launchSnapshot,
      observability: this.observability.createSnapshot()
    });

    if (phaseChanged && transition) {
      this.pushDebugEvent(createRuntimeLaunchPhaseDebugEventInput({
        state,
        previousPhase,
        launchSnapshot,
        timestamp,
        transition
      }));
    }

    return launchSnapshot;
  }

  transitionLifecycle(
    state: RuntimeLifecycleState,
    input: { message?: string; timestamp?: string } = {}
  ): RuntimeLifecycleSnapshot {
    const timestamp = input.timestamp ?? new Date().toISOString();

    this.lifecycleSnapshot = transitionRuntimeLifecycleSnapshot(this.lifecycleSnapshot, state, {
      id: this.createRuntimeRecordId('lifecycle'),
      timestamp,
      message: input.message,
      maxTransitions: this.maxDebugEvents,
      maxErrors: Math.max(10, Math.min(this.maxDebugEvents, 25))
    });
    const currentTransition = this.lifecycleSnapshot.transitions[0];
    this.observability.recordTrace({
      id: currentTransition?.id,
      type: 'lifecycle',
      level: currentTransition && !currentTransition.accepted ? 'warning' : 'info',
      scope: 'runtime.lifecycle',
      label: state,
      message: currentTransition?.message ?? input.message ?? `Runtime lifecycle ${state}`,
      timestamp
    });
    this.setSnapshot({
      lifecycle: this.lifecycleSnapshot,
      observability: this.observability.createSnapshot()
    });

    return this.lifecycleSnapshot;
  }

  async patchSharedState(
    key: string,
    patch: WorkbenchRuntimeSharedStatePatch
  ): Promise<WorkbenchRuntimeSharedStateEntry> {
    const entry = await this.backendConnection.patchSharedState(key, patch);
    const sharedStateEntry = normalizeSharedStateEntry(entry);

    if (!sharedStateEntry) {
      throw new Error(`Backend returned invalid shared state entry for "${key}".`);
    }

    this.setSnapshot({
      sharedState: upsertSharedStateEntry(this.snapshot.sharedState, sharedStateEntry)
    });

    return sharedStateEntry;
  }

  private pushEvent(event: WorkbenchRuntimeObservationEvent): void {
    this.setSnapshot(applyRuntimeObservationEvent({
      projectionCatalog: this.snapshot.projectionCatalog,
      sharedState: this.snapshot.sharedState,
      events: this.snapshot.events,
      event,
      maxEvents: this.maxEvents
    }));
  }

  private async loadSharedStateFromBackend(): Promise<WorkbenchRuntimeSharedStateEntry[]> {
    return (await this.backendConnection.listSharedState())
      .map(normalizeSharedStateEntry)
      .filter((entry): entry is WorkbenchRuntimeSharedStateEntry => Boolean(entry))
      .sort(compareSharedStateEntries);
  }

  private setSnapshot(patch: Partial<WorkbenchRuntimeSnapshot>): void {
    this.snapshot = {
      ...this.snapshot,
      ...patch
    };

    for (const listener of this.listeners) {
      listener(this.snapshot);
    }
  }

  private createRuntimeRecordId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}:${this.sequence}`;
  }

  private refreshObservabilitySnapshot(): void {
    this.setSnapshot({
      observability: this.observability.createSnapshot()
    });
  }
}

function createRuntimeProjectionMetadata(
  mode: RuntimeProjectionMode,
  metadata: Partial<RuntimeProjectionMetadata> = {}
): RuntimeProjectionMetadata {
  return {
    mode,
    generatedAt: metadata.generatedAt ?? new Date().toISOString(),
    source: metadata.source ?? mode,
    version: metadata.version ?? 'runtime-inspector.v1',
    repo: metadata.repo ?? null,
    build: metadata.build ?? null
  };
}
