export type RepoQualityDimensionId = 'tests' | 'docs' | 'decoupling';

export type RepoQualityGranularity = 'repo' | 'workspace' | 'file';

export type RepoQualityStatus = 'covered' | 'partial' | 'missing' | 'risk';

export interface RepoQualityDimensionScore {
  id: RepoQualityDimensionId;
  label: string;
  score: number;
  status: RepoQualityStatus;
  total: number;
  covered: number;
  partial: number;
  missing: number;
  risk: number;
}

export interface RepoQualityRule {
  id: string;
  dimension: RepoQualityDimensionId;
  label: string;
  summary: string;
  targetScore: number;
  severity: 'info' | 'warning' | 'error';
}

export interface RepoQualityEvidence {
  kind: 'test' | 'doc' | 'source';
  path: string;
  confidence: 'direct' | 'related' | 'inferred';
}

export interface RepoQualityFileEvaluation {
  id: string;
  granularity: 'file';
  path: string;
  owner: string;
  layer: string;
  kind: string;
  lineCount: number;
  importCount: number;
  exportedSymbolCount: number;
  scores: Record<RepoQualityDimensionId, number>;
  statuses: Record<RepoQualityDimensionId, RepoQualityStatus>;
  evidences: RepoQualityEvidence[];
  findings: string[];
}

export interface RepoQualityCoverageSummary {
  sourceFiles: number;
  testEvidenceFiles: number;
  docEvidenceFiles: number;
  fullyCoveredFiles: number;
  score: number;
  status: RepoQualityStatus;
}

export interface RepoQualityWorkspaceEvaluation {
  id: string;
  granularity: 'workspace';
  path: string;
  fileCount: number;
  lineCount: number;
  coverage: RepoQualityCoverageSummary;
  scores: Record<RepoQualityDimensionId, number>;
  statuses: Record<RepoQualityDimensionId, RepoQualityStatus>;
  riskCount: number;
  missingCount: number;
  findings: string[];
}

export interface RepoQualityEntryRootEvaluation {
  id: string;
  path: string;
  kind: 'app' | 'package' | 'tooling';
  sourceFileCount: number;
  lineCount: number;
  coverage: RepoQualityCoverageSummary;
  status: RepoQualityStatus;
  findings: string[];
}

export interface RepoQualityHistorySnapshot {
  step: number;
  generatedAt: string;
  totals: {
    sourceFiles: number;
    sourceLines: number;
    workspaces: number;
    entryRoots: number;
  };
  dimensions: Record<
    RepoQualityDimensionId,
    {
      score: number;
      status: RepoQualityStatus;
      total: number;
      covered: number;
      partial: number;
      missing: number;
      risk: number;
    }
  >;
}

export interface RepoQualityEvaluation {
  schemaVersion: 'repo-quality-evaluation.v1';
  generatedAt: string;
  repoRoot: string;
  rules: RepoQualityRule[];
  totals: {
    sourceFiles: number;
    testFiles: number;
    docFiles: number;
    workspaces: number;
    entryRoots: number;
    sourceLines: number;
  };
  dimensions: RepoQualityDimensionScore[];
  entryRoots: RepoQualityEntryRootEvaluation[];
  workspaces: RepoQualityWorkspaceEvaluation[];
  files: RepoQualityFileEvaluation[];
  history: RepoQualityHistorySnapshot[];
}
