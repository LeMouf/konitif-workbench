export type WorkbenchLocale = string;

export type TranslationLayer = 'core' | 'domain' | 'ui' | 'app' | 'docs' | 'tests' | 'infra' | 'tool' | 'widget';

export type TranslationValues = Record<string, string | number | boolean | null | undefined>;

export interface TranslationBundle {
  locale: WorkbenchLocale;
  namespace: string;
  messages: Record<string, string>;
  layer?: TranslationLayer;
  source?: string;
  /**
   * Higher priority bundles override lower priority bundles for the same locale/key.
   * Suggested bands: core/ui=0, tool/widget=20, app=40, runtime/session=80.
   */
  priority?: number;
}

export interface TranslationLookupOptions {
  locale?: WorkbenchLocale | null;
  default?: string;
  values?: TranslationValues;
}

export interface TranslationRegistryOptions {
  fallbackLocale?: WorkbenchLocale;
}

export interface TranslationMatch {
  key: string;
  locale: WorkbenchLocale;
  namespace: string;
  messageKey: string;
  value: string;
  source?: string;
}
