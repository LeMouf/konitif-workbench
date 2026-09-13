export type RepositoryPackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun' | 'unknown';
export type RepositoryInspectionSeverity = 'info' | 'warning' | 'blocked';
export type RepositoryFramework = 'svelte' | 'react' | 'vue' | 'solid' | 'unknown';
export type RepositoryBuildTool = 'vite' | 'sveltekit' | 'next' | 'nuxt' | 'vitest' | 'playwright' | 'typescript' | 'unknown';
export type RepositoryScriptKind = 'dev' | 'build' | 'test' | 'lint' | 'format' | 'preview' | 'check' | 'other';

export interface RepositoryInspectionFinding {
  id: string;
  severity: RepositoryInspectionSeverity;
  title: string;
  message: string;
}

export interface RepositoryScriptSnapshot {
  name: string;
  command: string;
  kind: RepositoryScriptKind;
}

export interface RepositoryWorkspaceSnapshot {
  patterns: string[];
}

export interface RepositoryGitSnapshot {
  branch: string | null;
  commit: string | null;
  dirty: boolean;
}

export interface RepositoryInspectionSummary {
  primaryFramework: RepositoryFramework;
  primaryBuildTool: RepositoryBuildTool;
  launchCommand: string | null;
  testCommand: string | null;
  scriptKinds: RepositoryScriptKind[];
  configCount: number;
  workspacePackageCount: number;
}

export interface RepositoryInspectionSnapshot {
  id: string;
  label: string;
  root: string;
  generatedAt: string;
  packageName: string | null;
  packageVersion: string | null;
  packageManager: RepositoryPackageManager;
  frameworks: RepositoryFramework[];
  buildTools: RepositoryBuildTool[];
  scripts: RepositoryScriptSnapshot[];
  workspaces: RepositoryWorkspaceSnapshot | null;
  git: RepositoryGitSnapshot | null;
  configs: string[];
  summary: RepositoryInspectionSummary;
  findings: RepositoryInspectionFinding[];
  inspectOnly: boolean;
  canLaunch: boolean;
}

export interface RepositoryInspectionInput {
  label?: string | null;
  root: string;
  files?: string[];
  packageJson?: {
    name?: string;
    version?: string;
    scripts?: Record<string, string>;
    workspaces?: string[] | { packages?: string[] };
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  } | null;
  git?: Partial<RepositoryGitSnapshot> | null;
  inspectOnly?: boolean;
}

export type RepositoryCoverageEntityKind =
  | 'route'
  | 'design-system'
  | 'test'
  | 'doc'
  | 'language'
  | 'usecase'
  | 'infrastructure'
  | 'decoupling';

export interface RepositoryCoverageEntity {
  id: string;
  kind: RepositoryCoverageEntityKind;
  label: string;
  sourceFile: string;
  detail: string;
  meta?: string | null;
}

export interface RepositoryCoverageSection {
  id: RepositoryCoverageEntityKind;
  label: string;
  count: number;
  items: RepositoryCoverageEntity[];
}

export interface RepositoryCoverageDiagnostic {
  id: string;
  severity: RepositoryInspectionSeverity;
  message: string;
}

export interface RepositoryCoverageSnapshot {
  id: string;
  projectRoot: string;
  projectLabel: string;
  generatedAt: string;
  source: 'runtime' | 'script';
  routes: RepositoryCoverageSection;
  designSystem: RepositoryCoverageSection;
  tests: RepositoryCoverageSection;
  docs: RepositoryCoverageSection;
  languages: RepositoryCoverageSection;
  usecases: RepositoryCoverageSection;
  infrastructure: RepositoryCoverageSection;
  decoupling: RepositoryCoverageSection;
  diagnostics: RepositoryCoverageDiagnostic[];
  totals: {
    files: number;
    sections: number;
    entities: number;
  };
}
