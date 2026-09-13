import type {
  WorkbenchProjectApp,
  WorkbenchProjectLaunchProfile,
  WorkbenchProjectManifest,
  WorkbenchProjectRepository,
  WorkbenchProjectTargetKind
} from '../../domain/project/model';

export interface CreateWorkbenchProjectManifestInput {
  id: string;
  label: string;
  apps?: WorkbenchProjectApp[];
  repositories?: WorkbenchProjectRepository[];
  launchProfiles?: WorkbenchProjectLaunchProfile[];
  createdAt?: string;
  updatedAt?: string;
}

export function createWorkbenchProjectManifest(
  input: CreateWorkbenchProjectManifestInput,
  now = new Date().toISOString()
): WorkbenchProjectManifest {
  return {
    id: input.id,
    label: input.label,
    version: 1,
    apps: dedupeById(input.apps ?? []),
    repositories: dedupeById(input.repositories ?? []),
    launchProfiles: dedupeById(input.launchProfiles ?? createDefaultProjectLaunchProfiles()),
    policies: {
      allowLocalRepositories: true,
      allowSandboxRepositories: true,
      requirePreflight: true
    },
    recentSessions: [],
    observability: {
      quality: 'medium',
      persistSnapshots: false,
      captureStackTraces: true
    },
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now
  };
}

export function createDefaultProjectLaunchProfiles(): WorkbenchProjectLaunchProfile[] {
  return [
    {
      id: 'profile.core-only',
      label: 'Core-only',
      kind: 'core-only',
      targetKind: 'self',
      defaultFor: 'self',
      inspectOnly: true,
      safeMode: true
    },
    {
      id: 'profile.repo-inspect-only',
      label: 'Repo inspect-only',
      kind: 'repo-inspect-only',
      targetKind: 'repository',
      defaultFor: null,
      inspectOnly: true,
      safeMode: true
    },
    {
      id: 'profile.app-safe-mode',
      label: 'App safe mode',
      kind: 'app-safe-mode',
      targetKind: 'app',
      defaultFor: null,
      inspectOnly: false,
      safeMode: true
    },
    {
      id: 'profile.app-full-runtime',
      label: 'App full runtime',
      kind: 'app-full-runtime',
      targetKind: 'app',
      defaultFor: 'app',
      inspectOnly: false,
      safeMode: false
    },
    {
      id: 'profile.sandbox-runtime',
      label: 'Sandbox runtime',
      kind: 'sandbox-runtime',
      targetKind: 'repository',
      defaultFor: 'repository',
      inspectOnly: false,
      safeMode: false
    },
    {
      id: 'profile.recovery-mode',
      label: 'Recovery mode',
      kind: 'recovery-mode',
      targetKind: 'self',
      defaultFor: null,
      inspectOnly: true,
      safeMode: true
    }
  ];
}

export function addProjectRepository(
  manifest: WorkbenchProjectManifest,
  repository: WorkbenchProjectRepository,
  now = new Date().toISOString()
): WorkbenchProjectManifest {
  return {
    ...manifest,
    repositories: upsertById(manifest.repositories, repository),
    updatedAt: now
  };
}

export function addProjectApp(
  manifest: WorkbenchProjectManifest,
  app: WorkbenchProjectApp,
  now = new Date().toISOString()
): WorkbenchProjectManifest {
  return {
    ...manifest,
    apps: upsertById(manifest.apps, app),
    updatedAt: now
  };
}

export function resolveProjectDefaultLaunchProfile(
  manifest: WorkbenchProjectManifest,
  targetKind: WorkbenchProjectTargetKind | 'self',
  targetProfileId?: string | null
): WorkbenchProjectLaunchProfile | null {
  return (
    manifest.launchProfiles.find((profile) => profile.id === targetProfileId) ??
    manifest.launchProfiles.find((profile) => profile.defaultFor === targetKind) ??
    null
  );
}

function dedupeById<TItem extends { id: string }>(items: TItem[]): TItem[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function upsertById<TItem extends { id: string }>(items: TItem[], nextItem: TItem): TItem[] {
  const nextItems = items.filter((item) => item.id !== nextItem.id);

  return [...nextItems, nextItem];
}
