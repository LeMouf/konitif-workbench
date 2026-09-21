export type WorkbenchLaunchMode = 'direct' | 'dashboard';

export type WorkbenchLaunchModeResolution =
  | { ok: true; mode: WorkbenchLaunchMode }
  | { ok: false; code: 'workbench-launch.invalid-mode'; message: string };

export interface WorkbenchDashboardPreview {
  kind: 'layout' | 'image';
  label: string;
  src?: string;
  alt?: string;
}

export interface WorkbenchDashboardEntry<Selection = unknown> {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  actionLabel: string;
  selection: Selection;
  detail?: string;
  preview?: WorkbenchDashboardPreview;
}

export interface WorkbenchLibrarySourceDescriptor {
  id: string;
  label: string;
  kind: 'local' | 'remote';
  status: 'available' | 'not-configured';
}

export interface WorkbenchLibraryItem {
  id: string;
  sourceId: string;
  kind: 'tool' | 'widget' | 'resource';
  title: string;
  description: string;
  versions?: {
    local?: string | null;
    localProvenance?: string | null;
    published?: {
      status: 'verified' | 'not-configured' | 'unavailable';
      version?: string | null;
      channel?: 'npm' | 'github' | 'repository' | 'other';
      publisher?: string | null;
      sourceUrl?: string | null;
      reason?: string | null;
      acquisition: {
        status: 'available' | 'unavailable';
        reason?: string | null;
      };
    };
    hostApplication?: {
      label: string;
      version: string;
    };
  };
  icon?: {
    src: string;
    alt: string;
  };
  illustration?: {
    src: string;
    alt: string;
  };
  metadata?: Readonly<Record<string, string>>;
  details?: {
    description?: string;
    dependencies?: readonly import('../../domain/catalog/presentation').WorkbenchCatalogDependency[];
    diagram?: import('../../domain/catalog/presentation').WorkbenchCatalogDiagram;
  };
  share?: {
    kind: 'catalog-reference';
    reference: string;
    publisherUrl?: string | null;
    limitation: string;
    privateSource: boolean;
  };
}

export interface WorkbenchLaunchAdmissionIssue {
  id: string;
  title: string;
  description: string;
  requiredVersion?: string;
  availableVersions?: string[];
  acquisition: {
    status: 'available' | 'unavailable';
    actionLabel?: string;
    reason?: string;
  };
}

export interface WorkbenchLaunchAdmissionBlocker {
  title: string;
  description: string;
  issues: WorkbenchLaunchAdmissionIssue[];
}

export function resolveWorkbenchLaunchMode(input: {
  requestedMode?: string | readonly string[] | null;
  configuredDefault?: WorkbenchLaunchMode;
}): WorkbenchLaunchModeResolution {
  const requestedMode = input.requestedMode;
  if (requestedMode === null || requestedMode === undefined) {
    return { ok: true, mode: input.configuredDefault ?? 'direct' };
  }
  if (typeof requestedMode !== 'string' || requestedMode !== requestedMode.trim() || requestedMode.length === 0) {
    return invalidMode();
  }
  if (requestedMode !== 'direct' && requestedMode !== 'dashboard') {
    return invalidMode();
  }
  return { ok: true, mode: requestedMode };
}

function invalidMode(): WorkbenchLaunchModeResolution {
  return {
    ok: false,
    code: 'workbench-launch.invalid-mode',
    message: 'Workbench launch mode must be either "direct" or "dashboard".'
  };
}
