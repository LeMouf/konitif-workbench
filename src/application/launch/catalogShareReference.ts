export interface WorkbenchCatalogShareReference {
  schemaVersion: 1;
  kind: 'workbench.catalog-reference';
  element: {
    kind: 'tool' | 'widget' | 'resource';
    id: string;
  };
  package: {
    name: string;
    version: string;
  };
  source: {
    status: 'publisher-page' | 'reference-only';
    url?: string;
  };
  privateSource: boolean;
}

export function serializeWorkbenchCatalogShareReference(reference: WorkbenchCatalogShareReference): string {
  const validated = validateReference(reference);
  if (!validated.ok) throw new Error(validated.message);
  return JSON.stringify(reference);
}

export function parseWorkbenchCatalogShareReference(source: string):
  | { ok: true; reference: WorkbenchCatalogShareReference }
  | { ok: false; message: string } {
  try {
    return validateReference(JSON.parse(source) as unknown);
  } catch {
    return { ok: false, message: 'Catalog share reference is not valid JSON.' };
  }
}

function validateReference(value: unknown):
  | { ok: true; reference: WorkbenchCatalogShareReference }
  | { ok: false; message: string } {
  const candidate = value as Partial<WorkbenchCatalogShareReference> | null;
  if (!candidate || candidate.schemaVersion !== 1 || candidate.kind !== 'workbench.catalog-reference') {
    return { ok: false, message: 'Catalog share reference schema is unsupported.' };
  }
  if (!candidate.element || !isNonEmpty(candidate.element.id) || !['tool', 'widget', 'resource'].includes(candidate.element.kind)) {
    return { ok: false, message: 'Catalog share reference element is invalid.' };
  }
  if (!candidate.package || !isNonEmpty(candidate.package.name) || !isNonEmpty(candidate.package.version)) {
    return { ok: false, message: 'Catalog share reference package identity or version is missing.' };
  }
  if (!candidate.source || !['publisher-page', 'reference-only'].includes(candidate.source.status)) {
    return { ok: false, message: 'Catalog share reference origin is missing.' };
  }
  if (candidate.source.status === 'publisher-page') {
    if (!candidate.source.url || !isSafePublisherUrl(candidate.source.url)) {
      return { ok: false, message: 'Catalog publisher page must be an HTTPS URL without embedded credentials.' };
    }
  } else if (candidate.source.url !== undefined) {
    return { ok: false, message: 'Reference-only catalog shares cannot claim a publisher URL.' };
  }
  if (typeof candidate.privateSource !== 'boolean') {
    return { ok: false, message: 'Catalog share reference privacy is missing.' };
  }
  return { ok: true, reference: candidate as WorkbenchCatalogShareReference };
}

function isSafePublisherUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
