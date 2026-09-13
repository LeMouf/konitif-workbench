import type { LaunchPreflightCheck, LaunchPreflightSummary, LaunchTarget } from '../../domain/launch/model';
import type {
  RepositoryInspectionFinding,
  RepositoryBuildTool,
  RepositoryFramework,
  RepositoryInspectionInput,
  RepositoryInspectionSnapshot,
  RepositoryPackageManager,
  RepositoryScriptKind,
  RepositoryScriptSnapshot
} from '../../domain/repository/model';

const CONFIG_FILES = [
  'package.json',
  'pnpm-workspace.yaml',
  'vite.config.ts',
  'vite.config.js',
  'svelte.config.js',
  'svelte.config.ts',
  'tsconfig.json',
  'eslint.config.js',
  'playwright.config.ts',
  'vitest.config.ts'
];

export class RepositoryPreflightEngine {
  inspect(input: RepositoryInspectionInput, now = new Date().toISOString()): RepositoryInspectionSnapshot {
    const root = input.root.trim();
    const files = new Set((input.files ?? []).map(normalizeRepoPath));
    const packageManager = detectPackageManager(files);
    const dependencies = normalizeDependencies(input.packageJson);
    const frameworks = detectFrameworks(files, dependencies);
    const buildTools = detectBuildTools(files, dependencies, input.packageJson?.scripts);
    const scripts = normalizeScripts(input.packageJson?.scripts);
    const workspaces = normalizeWorkspaces(input.packageJson?.workspaces);
    const configs = CONFIG_FILES.filter((file) => files.has(file));
    const summary = createRepositoryInspectionSummary({
      frameworks,
      buildTools,
      scripts,
      configs,
      workspaces
    });
    const inspectOnly = input.inspectOnly ?? false;
    const findings = createRepositoryFindings({
      root,
      packageManager,
      hasPackageJson: Boolean(input.packageJson) || files.has('package.json'),
      scripts,
      gitDirty: input.git?.dirty ?? false
    });
    const hasBlockedFinding = findings.some((finding) => finding.severity === 'blocked');

    return {
      id: `repository:${root || 'unresolved'}`,
      label: input.label?.trim() || deriveRepositoryLabel(root),
      root,
      generatedAt: now,
      packageName: normalizeNullableString(input.packageJson?.name),
      packageVersion: normalizeNullableString(input.packageJson?.version),
      packageManager,
      frameworks,
      buildTools,
      scripts,
      workspaces: workspaces.length > 0 ? { patterns: workspaces } : null,
      git: input.git
        ? {
            branch: normalizeNullableString(input.git.branch),
            commit: normalizeNullableString(input.git.commit),
            dirty: input.git.dirty ?? false
          }
        : null,
      configs,
      summary,
      findings,
      inspectOnly,
      canLaunch: !hasBlockedFinding && !inspectOnly
    };
  }
}

export function createRepositoryLaunchPreflightSummary(
  target: LaunchTarget,
  report: RepositoryInspectionSnapshot,
  now = new Date().toISOString()
): LaunchPreflightSummary {
  const checks: LaunchPreflightCheck[] = [
    {
      id: 'launch.project.target',
      label: 'Project target',
      status: report.root ? 'ready' : 'blocked',
      message: report.root || 'No project root selected.'
    },
    {
      id: 'launch.repository.package-manager',
      label: 'Package manager',
      status: report.packageManager === 'unknown' ? 'warning' : 'ready',
      message: report.packageManager === 'unknown'
        ? 'No lockfile was detected in the repository projection.'
        : `${report.packageManager} lockfile detected.`
    },
    {
      id: 'launch.repository.scripts',
      label: 'Scripts',
      status: report.scripts.length > 0 ? 'ready' : 'warning',
      message: report.scripts.length > 0
        ? `${report.scripts.length} package script(s) available.`
        : 'No package scripts were provided in the repository projection.'
    },
    {
      id: 'launch.repository.git',
      label: 'Git state',
      status: report.git?.dirty ? 'warning' : 'ready',
      message: report.git
        ? `${report.git.branch ?? 'detached'}${report.git.dirty ? ' has local changes.' : ' is clean.'}`
        : 'No git metadata provided.'
    },
    {
      id: 'launch.repository.mode',
      label: 'Launch mode',
      status: report.canLaunch ? 'ready' : report.inspectOnly ? 'warning' : 'blocked',
      message: report.inspectOnly
        ? 'Repository is configured for inspect-only preflight.'
        : report.canLaunch
          ? 'Repository can enter workspace initialization.'
          : 'Repository cannot launch until blocked findings are resolved.'
    }
  ];

  return {
    target,
    checks,
    generatedAt: now,
    repository: report
  };
}

function detectPackageManager(files: Set<string>): RepositoryPackageManager {
  if (files.has('pnpm-lock.yaml')) {
    return 'pnpm';
  }

  if (files.has('package-lock.json')) {
    return 'npm';
  }

  if (files.has('yarn.lock')) {
    return 'yarn';
  }

  if (files.has('bun.lockb') || files.has('bun.lock')) {
    return 'bun';
  }

  return 'unknown';
}

function normalizeScripts(scripts: Record<string, string> | undefined): RepositoryScriptSnapshot[] {
  return Object.entries(scripts ?? {})
    .filter((entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string')
    .map(([name, command]) => ({
      name,
      command,
      kind: classifyScript(name, command)
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function classifyScript(name: string, command: string): RepositoryScriptKind {
  const normalizedName = name.toLowerCase();
  const normalizedCommand = command.toLowerCase();

  if (normalizedName.includes('dev') || normalizedCommand.includes(' dev')) {
    return 'dev';
  }

  if (normalizedName.includes('build') || normalizedCommand.includes(' build')) {
    return 'build';
  }

  if (normalizedName.includes('test') || normalizedCommand.includes('vitest') || normalizedCommand.includes('playwright')) {
    return 'test';
  }

  if (normalizedName.includes('lint') || normalizedCommand.includes('eslint')) {
    return 'lint';
  }

  if (normalizedName.includes('format') || normalizedCommand.includes('prettier')) {
    return 'format';
  }

  if (normalizedName.includes('preview') || normalizedCommand.includes(' preview')) {
    return 'preview';
  }

  if (normalizedName.includes('check') || normalizedCommand.includes('svelte-check') || normalizedCommand.includes('tsc')) {
    return 'check';
  }

  return 'other';
}

function createRepositoryInspectionSummary(input: {
  frameworks: RepositoryFramework[];
  buildTools: RepositoryBuildTool[];
  scripts: RepositoryScriptSnapshot[];
  configs: string[];
  workspaces: string[];
}): RepositoryInspectionSnapshot['summary'] {
  return {
    primaryFramework: input.frameworks.find((framework) => framework !== 'unknown') ?? 'unknown',
    primaryBuildTool: input.buildTools.find((tool) => tool !== 'unknown') ?? 'unknown',
    launchCommand: input.scripts.find((script) => script.kind === 'dev')?.command ??
      input.scripts.find((script) => script.kind === 'preview')?.command ??
      input.scripts.find((script) => script.kind === 'build')?.command ??
      null,
    testCommand: input.scripts.find((script) => script.kind === 'test')?.command ??
      input.scripts.find((script) => script.kind === 'check')?.command ??
      null,
    scriptKinds: [...new Set(input.scripts.map((script) => script.kind))].sort((left, right) => left.localeCompare(right)),
    configCount: input.configs.length,
    workspacePackageCount: input.workspaces.length
  };
}

function normalizeDependencies(packageJson: RepositoryInspectionInput['packageJson']): Set<string> {
  return new Set([
    ...Object.keys(packageJson?.dependencies ?? {}),
    ...Object.keys(packageJson?.devDependencies ?? {})
  ]);
}

function detectFrameworks(files: Set<string>, dependencies: Set<string>): RepositoryFramework[] {
  const frameworks: RepositoryFramework[] = [];

  if (files.has('svelte.config.js') || files.has('svelte.config.ts') || dependencies.has('svelte') || dependencies.has('@sveltejs/kit')) {
    frameworks.push('svelte');
  }

  if (dependencies.has('react') || dependencies.has('react-dom') || dependencies.has('next')) {
    frameworks.push('react');
  }

  if (dependencies.has('vue') || dependencies.has('nuxt')) {
    frameworks.push('vue');
  }

  if (dependencies.has('solid-js')) {
    frameworks.push('solid');
  }

  return frameworks.length > 0 ? frameworks : ['unknown'];
}

function detectBuildTools(
  files: Set<string>,
  dependencies: Set<string>,
  scripts: Record<string, string> | undefined
): RepositoryBuildTool[] {
  const tools = new Set<RepositoryBuildTool>();
  const scriptText = Object.values(scripts ?? {}).join(' ').toLowerCase();

  if (files.has('vite.config.ts') || files.has('vite.config.js') || dependencies.has('vite') || scriptText.includes('vite')) {
    tools.add('vite');
  }

  if (dependencies.has('@sveltejs/kit') || scriptText.includes('svelte-kit')) {
    tools.add('sveltekit');
  }

  if (dependencies.has('next') || scriptText.includes('next ')) {
    tools.add('next');
  }

  if (dependencies.has('nuxt') || scriptText.includes('nuxt')) {
    tools.add('nuxt');
  }

  if (files.has('vitest.config.ts') || dependencies.has('vitest') || scriptText.includes('vitest')) {
    tools.add('vitest');
  }

  if (files.has('playwright.config.ts') || dependencies.has('@playwright/test') || scriptText.includes('playwright')) {
    tools.add('playwright');
  }

  if (files.has('tsconfig.json') || dependencies.has('typescript') || scriptText.includes('tsc')) {
    tools.add('typescript');
  }

  return tools.size > 0 ? [...tools] : ['unknown'];
}

function normalizeWorkspaces(workspaces: string[] | { packages?: string[] } | undefined): string[] {
  const patterns = Array.isArray(workspaces) ? workspaces : workspaces?.packages ?? [];

  return patterns
    .filter((pattern): pattern is string => typeof pattern === 'string' && pattern.trim().length > 0)
    .map((pattern) => normalizeRepoPath(pattern))
    .sort((left, right) => left.localeCompare(right));
}

function createRepositoryFindings(input: {
  root: string;
  packageManager: RepositoryPackageManager;
  hasPackageJson: boolean;
  scripts: RepositoryScriptSnapshot[];
  gitDirty: boolean;
}): RepositoryInspectionFinding[] {
  const findings: RepositoryInspectionFinding[] = [];

  if (!input.root) {
    findings.push({
      id: 'repo.root.missing',
      severity: 'blocked',
      title: 'Repository root missing',
      message: 'Select a repository root before running preflight.'
    });
  }

  if (!input.hasPackageJson) {
    findings.push({
      id: 'repo.package.missing',
      severity: 'warning',
      title: 'Package manifest missing',
      message: 'No package.json was provided in the repository projection.'
    });
  }

  if (input.packageManager === 'unknown') {
    findings.push({
      id: 'repo.package-manager.unknown',
      severity: 'warning',
      title: 'Package manager unknown',
      message: 'No known lockfile was detected.'
    });
  }

  if (input.scripts.length === 0) {
    findings.push({
      id: 'repo.scripts.empty',
      severity: 'warning',
      title: 'No scripts detected',
      message: 'Preflight cannot infer build or test commands from package scripts.'
    });
  }

  if (input.gitDirty) {
    findings.push({
      id: 'repo.git.dirty',
      severity: 'warning',
      title: 'Local changes detected',
      message: 'The repository projection reports uncommitted local changes.'
    });
  }

  if (findings.length === 0) {
    findings.push({
      id: 'repo.preflight.ready',
      severity: 'info',
      title: 'Repository ready',
      message: 'Repository projection contains enough metadata for launch planning.'
    });
  }

  return findings;
}

function normalizeRepoPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\/+/, '').trim();
}

function normalizeNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function deriveRepositoryLabel(root: string): string {
  const normalized = normalizeRepoPath(root);
  const segments = normalized.split('/').filter(Boolean);

  return segments[segments.length - 1] ?? 'Repository';
}
