export type WorkbenchRoute =
  | { kind: 'workspace' }
  | { kind: 'docs'; tab?: string | null }
  | { kind: 'lab' }
  | { kind: 'tool'; toolId: string }
  | { kind: 'shell'; region: string };

const ROUTE_SEARCH_PARAMS = ['view', 'docsTab', 'page', 'tool'];
const WORKBENCH_ROUTE_BASE_SEGMENTS = new Set(['__workbench_dev__']);

export function parseWorkbenchRoute(href: string): WorkbenchRoute {
  const url = new URL(href, 'http://workbench.local');
  const parts = getWorkbenchRouteParts(url.pathname);

  if (parts[0] === 'docs') {
    return { kind: 'docs', tab: parts[1] ?? null };
  }

  if (parts[0] === 'shortcuts') {
    return { kind: 'docs', tab: 'shortcuts' };
  }

  if (parts[0] === 'forge' || parts[0] === 'lab') {
    return { kind: 'lab' };
  }

  if (parts[0] === 'tools' && parts[1]) {
    return { kind: 'tool', toolId: parts[1] };
  }

  if (parts[0] === 'shell' && parts[1]) {
    return { kind: 'shell', region: parts.slice(1).join('/') };
  }

  return { kind: 'workspace' };
}

export function createWorkbenchRouteHref(currentHref: string, route: WorkbenchRoute): string {
  const url = new URL(currentHref, 'http://workbench.local');
  url.pathname = joinWorkbenchRoutePath(getWorkbenchRouteBasePath(url.pathname), createWorkbenchRoutePath(route));

  for (const param of ROUTE_SEARCH_PARAMS) {
    url.searchParams.delete(param);
  }

  return url.toString();
}

export function createWorkbenchRoutePath(route: WorkbenchRoute): string {
  switch (route.kind) {
    case 'docs':
      return route.tab ? `/docs/${encodeURIComponent(route.tab)}` : '/docs';
    case 'lab':
      return '/forge';
    case 'tool':
      return `/tools/${encodeURIComponent(route.toolId)}`;
    case 'shell':
      return `/shell/${route.region.split('/').filter(Boolean).map(encodeURIComponent).join('/')}`;
    case 'workspace':
    default:
      return '/';
  }
}

function normalizeWorkbenchPath(path: string): string {
  if (!path || path === '/') {
    return '/';
  }

  return path.replace(/\/+$/, '') || '/';
}

function getWorkbenchRouteParts(pathname: string): string[] {
  const parts = normalizeWorkbenchPath(pathname).split('/').filter(Boolean).map(decodeURIComponent);

  return WORKBENCH_ROUTE_BASE_SEGMENTS.has(parts[0] ?? '') ? parts.slice(1) : parts;
}

function getWorkbenchRouteBasePath(pathname: string): string {
  const firstPart = normalizeWorkbenchPath(pathname).split('/').filter(Boolean)[0];

  if (!firstPart) {
    return '';
  }

  const decodedFirstPart = decodeURIComponent(firstPart);

  return WORKBENCH_ROUTE_BASE_SEGMENTS.has(decodedFirstPart) ? `/${encodeURIComponent(decodedFirstPart)}` : '';
}

function joinWorkbenchRoutePath(basePath: string, routePath: string): string {
  if (!basePath) {
    return routePath;
  }

  if (routePath === '/') {
    return `${basePath}/`;
  }

  return `${basePath}${routePath}`;
}
