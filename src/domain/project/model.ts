export type WorkbenchProjectTargetKind = 'app' | 'repository';
export type WorkbenchProjectLaunchProfileKind =
  | 'core-only'
  | 'repo-inspect-only'
  | 'app-safe-mode'
  | 'app-full-runtime'
  | 'sandbox-runtime'
  | 'recovery-mode';

export interface WorkbenchProjectRepository {
  id: string;
  label: string;
  root: string;
  defaultLaunchProfileId?: string | null;
}

export interface WorkbenchProjectApp {
  id: string;
  label: string;
  root: string;
  repositoryId?: string | null;
  defaultLaunchProfileId?: string | null;
  faviconDataUrl?: string | null;
}

export interface WorkbenchProjectLaunchProfile {
  id: string;
  label: string;
  kind: WorkbenchProjectLaunchProfileKind;
  targetKind: WorkbenchProjectTargetKind | 'self';
  defaultFor?: WorkbenchProjectTargetKind | 'self' | null;
  inspectOnly: boolean;
  safeMode: boolean;
}

export interface WorkbenchProjectPolicies {
  allowLocalRepositories: boolean;
  allowSandboxRepositories: boolean;
  requirePreflight: boolean;
}

export interface WorkbenchProjectObservabilityPreferences {
  quality: 'off' | 'low' | 'medium' | 'high';
  persistSnapshots: boolean;
  captureStackTraces: boolean;
}

export interface WorkbenchProjectRecentSession {
  id: string;
  targetId: string;
  targetKind: WorkbenchProjectTargetKind | 'self';
  profileId: string;
  updatedAt: string;
}

export interface WorkbenchProjectManifest {
  id: string;
  label: string;
  version: 1;
  apps: WorkbenchProjectApp[];
  repositories: WorkbenchProjectRepository[];
  launchProfiles: WorkbenchProjectLaunchProfile[];
  policies: WorkbenchProjectPolicies;
  recentSessions: WorkbenchProjectRecentSession[];
  observability: WorkbenchProjectObservabilityPreferences;
  createdAt: string;
  updatedAt: string;
}
