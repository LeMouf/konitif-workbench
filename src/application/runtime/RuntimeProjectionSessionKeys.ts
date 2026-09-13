import type { WorkbenchRuntimeProjectionTarget } from '../../domain/runtime/model';

export const RUNTIME_PROJECTION_SESSION_SHARED_STATE_PREFIX = 'runtime.projection-session:';

export function createRuntimeProjectionSessionKey(target: WorkbenchRuntimeProjectionTarget): string {
  return `${target.projectionKind}:${target.sourceFile}`;
}

export function createRuntimeProjectionSessionSharedStateKey(
  target: WorkbenchRuntimeProjectionTarget
): string {
  return `${RUNTIME_PROJECTION_SESSION_SHARED_STATE_PREFIX}${createRuntimeProjectionSessionKey(target)}`;
}

export function isRuntimeProjectionSessionSharedStateKey(key: string): boolean {
  return key.startsWith(RUNTIME_PROJECTION_SESSION_SHARED_STATE_PREFIX);
}
