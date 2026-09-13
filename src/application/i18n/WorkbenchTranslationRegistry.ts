import type {
  TranslationBundle,
  TranslationLookupOptions,
  TranslationMatch,
  TranslationRegistryOptions,
  WorkbenchLocale
} from '../../domain/i18n/model';

type RegisteredTranslationBundle = TranslationBundle & {
  order: number;
  priority: number;
};

function normalizeLocale(locale: WorkbenchLocale | null | undefined): WorkbenchLocale {
  return (locale?.trim() || 'en').toLowerCase();
}

function buildLocaleFallbacks(
  locale: WorkbenchLocale | null | undefined,
  fallbackLocale: WorkbenchLocale
): WorkbenchLocale[] {
  const normalizedLocale = normalizeLocale(locale);
  const normalizedFallback = normalizeLocale(fallbackLocale);
  const baseLocale = normalizedLocale.split('-')[0] ?? normalizedLocale;
  const fallbacks = [normalizedLocale];

  if (baseLocale && baseLocale !== normalizedLocale) {
    fallbacks.push(baseLocale);
  }

  if (!fallbacks.includes(normalizedFallback)) {
    fallbacks.push(normalizedFallback);
  }

  return fallbacks;
}

function interpolateMessage(message: string, values: TranslationLookupOptions['values']): string {
  if (!values) {
    return message;
  }

  return message.replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (placeholder, name: string) => {
    const value = values[name];
    return value === null || value === undefined ? placeholder : String(value);
  });
}

export class WorkbenchTranslationRegistry {
  readonly fallbackLocale: WorkbenchLocale;
  private bundles: RegisteredTranslationBundle[] = [];
  private bundleIndexes = new Map<string, number>();
  private messageIndexes = new Map<WorkbenchLocale, Map<string, TranslationMatch>>();
  private resolutionCache = new Map<string, TranslationMatch | null>();
  private nextOrder = 0;

  constructor(options: TranslationRegistryOptions = {}) {
    this.fallbackLocale = normalizeLocale(options.fallbackLocale);
  }

  registerBundle(bundle: TranslationBundle): boolean {
    const changedLocale = this.upsertBundle(bundle);

    if (!changedLocale) {
      return false;
    }

    this.rebuildMessageIndex(changedLocale);
    this.resolutionCache.clear();
    return true;
  }

  registerBundles(bundles: TranslationBundle[]): boolean {
    const changedLocales = new Set<WorkbenchLocale>();

    for (const bundle of bundles) {
      const changedLocale = this.upsertBundle(bundle);
      if (changedLocale) {
        changedLocales.add(changedLocale);
      }
    }

    if (changedLocales.size === 0) {
      return false;
    }

    for (const locale of changedLocales) {
      this.rebuildMessageIndex(locale);
    }
    this.resolutionCache.clear();
    return true;
  }

  private upsertBundle(bundle: TranslationBundle): WorkbenchLocale | null {
    const normalizedBundle: RegisteredTranslationBundle = {
      ...bundle,
      locale: normalizeLocale(bundle.locale),
      namespace: bundle.namespace.trim(),
      priority: bundle.priority ?? 0,
      order: this.nextOrder++
    };
    const identity = translationBundleIdentity(normalizedBundle);
    const existingIndex = this.bundleIndexes.get(identity);

    if (existingIndex !== undefined) {
      const existing = this.bundles[existingIndex];
      if (sameTranslationBundle(existing, normalizedBundle)) {
        return null;
      }
      this.bundles[existingIndex] = normalizedBundle;
    } else {
      this.bundleIndexes.set(identity, this.bundles.length);
      this.bundles.push(normalizedBundle);
    }
    return normalizedBundle.locale;
  }

  listBundles(): TranslationBundle[] {
    return this.bundles.map(({ order: _order, ...bundle }) => bundle);
  }

  resolve(key: string, options: TranslationLookupOptions = {}): TranslationMatch | null {
    const trimmedKey = key.trim();

    if (!trimmedKey) {
      return null;
    }

    for (const locale of buildLocaleFallbacks(options.locale, this.fallbackLocale)) {
      const match = this.resolveForLocale(trimmedKey, locale);

      if (match) {
        return match;
      }
    }

    return null;
  }

  translate(key: string, options: TranslationLookupOptions = {}): string {
    const match = this.resolve(key, options);
    const message = match?.value ?? options.default ?? key;
    return interpolateMessage(message, options.values);
  }

  private resolveForLocale(key: string, locale: WorkbenchLocale): TranslationMatch | null {
    const cacheKey = `${locale}\u0000${key}`;

    if (this.resolutionCache.has(cacheKey)) {
      return this.resolutionCache.get(cacheKey) ?? null;
    }

    const match = this.messageIndexes.get(locale)?.get(key) ?? null;

    this.resolutionCache.set(cacheKey, match);
    return match;
  }

  private rebuildMessageIndex(locale: WorkbenchLocale): void {
    const candidates = new Map<
      string,
      { bundle: RegisteredTranslationBundle; messageKey: string }
    >();

    for (const bundle of this.bundles) {
      if (bundle.locale !== locale) {
        continue;
      }

      for (const messageKey of Object.keys(bundle.messages)) {
        const key = bundle.namespace
          ? messageKey
            ? `${bundle.namespace}.${messageKey}`
            : bundle.namespace
          : messageKey;
        const current = candidates.get(key);

        if (!current || isHigherPriorityBundle(bundle, current.bundle)) {
          candidates.set(key, { bundle, messageKey });
        }
      }
    }

    const index = new Map<string, TranslationMatch>();
    for (const [key, candidate] of candidates) {
      index.set(key, {
        key,
        locale,
        namespace: candidate.bundle.namespace,
        messageKey: candidate.messageKey,
        value: candidate.bundle.messages[candidate.messageKey] ?? key,
        source: candidate.bundle.source
      });
    }
    this.messageIndexes.set(locale, index);
  }
}

function isHigherPriorityBundle(
  candidate: RegisteredTranslationBundle,
  current: RegisteredTranslationBundle
): boolean {
  return (
    candidate.priority > current.priority ||
    (candidate.priority === current.priority &&
      candidate.namespace.length > current.namespace.length) ||
    (candidate.priority === current.priority &&
      candidate.namespace.length === current.namespace.length &&
      candidate.order > current.order)
  );
}

function translationBundleIdentity(bundle: RegisteredTranslationBundle): string {
  return [
    bundle.locale,
    bundle.namespace,
    String(bundle.priority),
    bundle.layer ?? '',
    bundle.source ?? ''
  ].join('\u0000');
}

function sameTranslationBundle(
  left: RegisteredTranslationBundle,
  right: RegisteredTranslationBundle
): boolean {
  if (
    left.locale !== right.locale ||
    left.namespace !== right.namespace ||
    left.priority !== right.priority ||
    left.layer !== right.layer ||
    left.source !== right.source
  ) {
    return false;
  }

  const leftEntries = Object.entries(left.messages);
  const rightEntries = Object.entries(right.messages);
  return (
    leftEntries.length === rightEntries.length &&
    leftEntries.every(([key, value]) => right.messages[key] === value)
  );
}

export function createWorkbenchTranslationRegistry(
  options?: TranslationRegistryOptions
): WorkbenchTranslationRegistry {
  return new WorkbenchTranslationRegistry(options);
}
