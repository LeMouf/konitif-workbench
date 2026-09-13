import type {
  WorkbenchRuntimeAppPreviewDescriptor,
  WorkbenchRuntimeBackendPort,
  WorkbenchRuntimeProjectionInvalidationResult,
  WorkbenchRuntimeSharedStatePatch
} from '../../domain/runtime/model';

export type RuntimeBackendConnection = {
  loadProjection<TProjection = unknown>(
    kind: string,
    params?: Record<string, string>
  ): Promise<TProjection>;
  invalidateProjection(
    kind: string,
    params?: Record<string, string>
  ): Promise<WorkbenchRuntimeProjectionInvalidationResult>;
  startAppPreview(root?: string): Promise<WorkbenchRuntimeAppPreviewDescriptor>;
  listSharedState(): Promise<unknown[]>;
  patchSharedState(key: string, patch: WorkbenchRuntimeSharedStatePatch): Promise<unknown>;
};

export function createRuntimeBackendConnection(
  backend: WorkbenchRuntimeBackendPort | null
): RuntimeBackendConnection {
  return {
    async loadProjection<TProjection = unknown>(
      kind: string,
      params?: Record<string, string>
    ): Promise<TProjection> {
      if (!backend) {
        throw new Error('Runtime backend is unavailable.');
      }

      return backend.getProjection<TProjection>(kind, params);
    },
    async invalidateProjection(
      kind: string,
      params?: Record<string, string>
    ): Promise<WorkbenchRuntimeProjectionInvalidationResult> {
      if (!backend) {
        throw new Error('Runtime backend is unavailable.');
      }

      return backend.invalidateProjection(kind, params);
    },
    async startAppPreview(root?: string): Promise<WorkbenchRuntimeAppPreviewDescriptor> {
      if (!backend?.startAppPreview) {
        throw new Error('Backend app preview is unavailable.');
      }

      return backend.startAppPreview(root);
    },
    async listSharedState(): Promise<unknown[]> {
      if (!backend?.listSharedState) {
        return [];
      }

      return backend.listSharedState();
    },
    async patchSharedState(key: string, patch: WorkbenchRuntimeSharedStatePatch): Promise<unknown> {
      if (!backend?.patchSharedState) {
        throw new Error('Backend shared state is unavailable.');
      }

      return backend.patchSharedState(key, patch);
    }
  };
}
