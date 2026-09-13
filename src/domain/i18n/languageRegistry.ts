import type { TranslationLayer, WorkbenchLocale } from './model';

export type LanguageRegistryStatus = 'covered' | 'partial' | 'missing';

export interface LanguageRegistryLocaleCoverage {
  locale: WorkbenchLocale;
  totalKeys: number;
  translatedKeys: number;
  missingKeys: number;
  coverage: number;
  status: LanguageRegistryStatus;
}

export interface LanguageRegistryNamespaceCoverage {
  namespace: string;
  layer: TranslationLayer | 'unknown';
  source: string;
  totalKeys: number;
  locales: Record<WorkbenchLocale, LanguageRegistryLocaleCoverage>;
}

export interface LanguageRegistryTranslationValue {
  status: LanguageRegistryStatus;
  value?: string;
  source?: string;
}

export interface LanguageRegistryTranslationEntry {
  id: string;
  namespace: string;
  key: string;
  layer: TranslationLayer | 'unknown';
  source: string;
  locales: Record<WorkbenchLocale, LanguageRegistryTranslationValue>;
}

export interface LanguageRegistryHistorySnapshot {
  step: number;
  generatedAt: 'deterministic';
  totals: {
    bundles: number;
    namespaces: number;
    keys: number;
    sources: number;
  };
  coverage: Record<WorkbenchLocale, LanguageRegistryLocaleCoverage>;
}

export interface LanguageRegistryEvaluation {
  schemaVersion: 'language-registry.v1';
  generatedAt: 'deterministic';
  fallbackLocale: WorkbenchLocale;
  locales: WorkbenchLocale[];
  totals: {
    bundles: number;
    namespaces: number;
    keys: number;
    sources: number;
  };
  coverage: LanguageRegistryLocaleCoverage[];
  namespaces: LanguageRegistryNamespaceCoverage[];
  entries: LanguageRegistryTranslationEntry[];
  history: LanguageRegistryHistorySnapshot[];
}
