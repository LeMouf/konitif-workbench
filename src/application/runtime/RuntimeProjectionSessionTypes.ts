import type {
  WorkbenchRuntimeProjectionSessionPatch,
  WorkbenchRuntimeProjectionSessionStatus,
  WorkbenchRuntimeProjectionTarget
} from '../../domain/runtime/model';

export type RuntimeProjectionSessionStatus = WorkbenchRuntimeProjectionSessionStatus;

export interface RuntimeProjectionSessionEntry {
  key: string;
  target: WorkbenchRuntimeProjectionTarget;
  viewerId: string;
  viewerTitle: string;
  toolInstanceIds: string[];
  status: RuntimeProjectionSessionStatus;
  selectedEntityId: string | null;
  focusedEntityId: string | null;
  openedAt: string;
  updatedAt: string;
  lastError: string | null;
}

export interface RuntimeProjectionSessionState {
  activeKey: string | null;
  entries: Record<string, RuntimeProjectionSessionEntry>;
}

export interface RuntimeProjectionSessionOpenInput {
  target: WorkbenchRuntimeProjectionTarget;
  viewerId: string;
  viewerTitle?: string;
  toolInstanceId?: string | null;
  status?: RuntimeProjectionSessionStatus;
  now?: string;
}

export interface RuntimeProjectionSessionPatch extends WorkbenchRuntimeProjectionSessionPatch {
  viewerId?: string | null;
  toolInstanceId?: string | null;
  now?: string;
}

export interface RuntimeProjectionSessionSharedStateMergeResult {
  state: RuntimeProjectionSessionState;
  signatures: Record<string, string>;
  changedEntries: RuntimeProjectionSessionEntry[];
  changed: boolean;
}
