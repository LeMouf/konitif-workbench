export type ToolSurfaceKind = 'dom' | 'canvas-2d' | 'scene-3d';
export type EmbeddableSurfacePlacement = 'tool' | 'widget' | 'sideDock';
export type EmbeddableSurfaceCapability =
  | 'compact'
  | 'richList'
  | 'grid'
  | 'previewFooter'
  | 'dragSource'
  | 'dropTarget'
  | 'import'
  | 'multiSelect'
  | (string & {});

export interface EmbeddableSurfaceContribution {
  id: string;
  ownerToolId?: string;
  supportedPlacements: EmbeddableSurfacePlacement[];
  capabilities: EmbeddableSurfaceCapability[];
}

export interface EmbeddableSurfaceHostRequest {
  placement: EmbeddableSurfacePlacement;
  requiredCapabilities?: EmbeddableSurfaceCapability[];
}

export type ToolSurfaceCapability =
  | 'inspect.selection'
  | 'inspect.diagnostics'
  | 'inspect.bounds'
  | 'viewport.pan'
  | 'viewport.zoom'
  | 'viewport.fit'
  | 'viewport.orbit'
  | 'render.static'
  | 'render.interactive'
  | (string & {});

export type ToolSurfaceViewerCapability = ToolSurfaceCapability;

export interface ToolSurfaceDefinition {
  id: string;
  toolId: string;
  kind: ToolSurfaceKind;
  title: string;
  summary: string;
  capabilities: ToolSurfaceCapability[];
  projectionKinds: string[];
}

export function canHostEmbeddableSurface(
  contribution: EmbeddableSurfaceContribution,
  request: EmbeddableSurfaceHostRequest
): boolean {
  if (!contribution.supportedPlacements.includes(request.placement)) {
    return false;
  }

  const availableCapabilities = new Set(contribution.capabilities);
  return (request.requiredCapabilities ?? []).every((capability) => availableCapabilities.has(capability));
}

export function resolveEmbeddableSurfaceCapabilities(
  contribution: EmbeddableSurfaceContribution,
  requestedCapabilities: readonly EmbeddableSurfaceCapability[]
): EmbeddableSurfaceCapability[] {
  const availableCapabilities = new Set(contribution.capabilities);
  return requestedCapabilities.filter((capability) => availableCapabilities.has(capability));
}

export interface ToolSurfaceViewerDefinition {
  id: string;
  title: string;
  version: string;
  summary: string;
  surfaceKinds: ToolSurfaceKind[];
  projectionKinds: string[];
  capabilities: ToolSurfaceCapability[];
  priority?: number;
}

export interface ToolSurfaceViewerCompatibilityInput {
  surfaceKind: ToolSurfaceKind;
  projectionKind: string;
  requiredCapabilities?: ToolSurfaceCapability[];
}

export interface ToolSurfaceViewerCatalogPort {
  getDefinition(viewerId: string): ToolSurfaceViewerDefinition | undefined;
  list(): ToolSurfaceViewerDefinition[];
  listCompatible(input: ToolSurfaceViewerCompatibilityInput): ToolSurfaceViewerDefinition[];
}

export type SurfaceViewerCatalogPort = ToolSurfaceViewerCatalogPort;

export type ToolSurfaceViewerCatalog = ToolSurfaceViewerCatalogPort;

export type ProjectionSurfaceKind =
  | 'web_development'
  | 'tauri_development'
  | 'tauri_release'
  | 'tauri_installed'
  | 'desktop_internal_qa'
  | 'unknown';

export type ProjectionSurfaceHostKind = 'browser' | 'tauri' | 'unknown';
export type ProjectionSurfaceDiagnosticProfile = 'none' | 'desktop_internal_qa';
export type ProjectionSurfaceSupportStatus =
  | 'supported'
  | 'supported_with_warnings'
  | 'blocked'
  | 'failed'
  | 'not_applicable'
  | 'unknown';

export interface ProjectionSurfaceCapabilities {
  pointer: ProjectionSurfaceSupportStatus;
  keyboard: ProjectionSurfaceSupportStatus;
  contextMenu: ProjectionSurfaceSupportStatus;
  portalRoot: ProjectionSurfaceSupportStatus;
  nativeWindow: ProjectionSurfaceSupportStatus;
}

export interface ProjectionSurfaceDiagnostic {
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
}

export interface ProjectionSurfaceDescriptor {
  kind: ProjectionSurfaceKind;
  hostKind: ProjectionSurfaceHostKind;
  webviewKind: 'browser' | 'webview2' | 'unknown';
  inputCapabilities: ProjectionSurfaceCapabilities;
  nativeWindowCapabilities: ProjectionSurfaceCapabilities;
  portalRootId: string;
  applicationRootId: string;
  bootRootId: string;
  diagnosticProfile: ProjectionSurfaceDiagnosticProfile;
  viewport: {
    width: number;
    height: number;
    devicePixelRatio: number;
    zoomFactor: number | null;
  };
  focusState: 'focused' | 'blurred' | 'unknown';
  diagnostics: ProjectionSurfaceDiagnostic[];
}

export const WORKBENCH_PORTAL_ROOT_ID = 'workbench-portal-root';

export function createProjectionSurfaceDescriptor(input: {
  kind?: ProjectionSurfaceKind | null;
  hostKind?: ProjectionSurfaceHostKind | null;
  webviewKind?: ProjectionSurfaceDescriptor['webviewKind'] | null;
  diagnosticProfile?: ProjectionSurfaceDiagnosticProfile | null;
  applicationRootId?: string | null;
  bootRootId?: string | null;
  viewport?: Partial<ProjectionSurfaceDescriptor['viewport']> | null;
  focusState?: ProjectionSurfaceDescriptor['focusState'] | null;
  hasPortalRoot?: boolean;
  diagnostics?: ProjectionSurfaceDiagnostic[];
} = {}): ProjectionSurfaceDescriptor {
  const hostKind = input.hostKind ?? 'unknown';
  const kind = input.kind ?? resolveProjectionSurfaceKind(hostKind, false, false);
  const hasPortalRoot = input.hasPortalRoot ?? false;
  const portalStatus: ProjectionSurfaceSupportStatus = hasPortalRoot ? 'supported' : 'supported_with_warnings';
  const diagnostics = [...(input.diagnostics ?? [])];

  if (!hasPortalRoot) {
    diagnostics.push({
      severity: 'warning',
      code: 'projection-surface.portal-root-unobserved',
      message: 'Workbench portal root was not observed for this surface.'
    });
  }

  return {
    kind,
    hostKind,
    webviewKind: input.webviewKind ?? 'unknown',
    inputCapabilities: {
      pointer: 'supported',
      keyboard: 'supported',
      contextMenu: 'supported_with_warnings',
      portalRoot: portalStatus,
      nativeWindow: hostKind === 'tauri' ? 'supported' : 'not_applicable'
    },
    nativeWindowCapabilities: {
      pointer: hostKind === 'tauri' ? 'supported' : 'not_applicable',
      keyboard: hostKind === 'tauri' ? 'supported' : 'not_applicable',
      contextMenu: hostKind === 'tauri' ? 'supported_with_warnings' : 'not_applicable',
      portalRoot: portalStatus,
      nativeWindow: hostKind === 'tauri' ? 'supported' : 'not_applicable'
    },
    portalRootId: WORKBENCH_PORTAL_ROOT_ID,
    applicationRootId: input.applicationRootId ?? 'app',
    bootRootId: input.bootRootId ?? 'workbench-boot-surface',
    diagnosticProfile: input.diagnosticProfile ?? 'none',
    viewport: {
      width: Math.max(0, input.viewport?.width ?? 0),
      height: Math.max(0, input.viewport?.height ?? 0),
      devicePixelRatio: Math.max(0, input.viewport?.devicePixelRatio ?? 1),
      zoomFactor: typeof input.viewport?.zoomFactor === 'number'
        ? Math.max(0, input.viewport.zoomFactor)
        : null
    },
    focusState: input.focusState ?? 'unknown',
    diagnostics
  };
}

export function resolveProjectionSurfaceKind(
  hostKind: ProjectionSurfaceHostKind,
  isDevelopment: boolean,
  isInstalled: boolean
): ProjectionSurfaceKind {
  if (hostKind === 'browser') {
    return 'web_development';
  }

  if (hostKind === 'tauri') {
    if (isDevelopment) {
      return 'tauri_development';
    }

    return isInstalled ? 'tauri_installed' : 'tauri_release';
  }

  return 'unknown';
}
