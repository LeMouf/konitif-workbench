import {
  InMemoryToolRegistry,
  admitShellWidgetPlacementPreservingRegionState,
  admitWorkspaceUsageBundle,
  createBrowserWorkbenchExperienceRepository,
  projectWorkbenchWidgetZone,
  normalizeGroupedWorkbenchToolDockVisibility,
  resolveTabbedShellRegionVisibilityIntent,
  createWorkspaceExperiencePresetBinding,
  createWorkspace,
  type WorkbenchExperienceRevision,
  type WorkbenchWidgetZoneProjection,
  type TabbedShellRegionVisibilityIntent,
  type ToolDefinition,
  type Workspace,
  type WorkbenchDashboardEntry,
  type ToolRuntimeHostActions,
} from '@konitif/workbench';
import type {
  WorkbenchExperienceRepository,
  WorkbenchExperienceRepositoryResult,
} from '@konitif/workbench';
import { createWorkspace as createHostedWorkspace } from '@konitif/workbench/hosting';
import {
  createWorkspace as createWorkspaceFromContracts,
  validateWorkspace,
} from '@konitif/workbench/workspace-contracts';
import {
  NoopPhysicsBackend,
  PhysicsService,
  type PhysicsServicePort,
  type PhysicsSubjectSource,
} from '@konitif/workbench/physics-runtime';

// Old hosts and entries remain valid while new projections can use optional metadata.
export function exerciseDashboardContract(
  legacyHost: Omit<ToolRuntimeHostActions, 'setToolDockVisibility'>,
  host: ToolRuntimeHostActions,
): WorkbenchDashboardEntry<{ revisionId: string }> {
  const compatibleHost: ToolRuntimeHostActions = legacyHost;
  const entry: WorkbenchDashboardEntry<{ revisionId: string }> = {
    id: 'experience.proof',
    title: 'Proof',
    eyebrow: 'Saved experience',
    description: 'Display metadata does not replace revision identity.',
    actionLabel: 'Open',
    selection: { revisionId: 'revision.proof' },
  };
  const withMetadata: typeof entry = {
    ...entry, version: '1.0.1', tags: ['proof'], canSave: false,
  };
  host.setToolDockVisibility?.('tool.proof', {
    dockId: 'controls', isVisible: false, legacyVisibleKey: null,
  });
  // @ts-expect-error Dock intents require an explicit target.
  host.setToolDockVisibility?.('tool.proof', { isVisible: false });
  // @ts-expect-error Revision labels must remain textual presentation metadata.
  const invalid: typeof entry = { ...entry, version: 42 };
  void compatibleHost; void invalid;
  return withMetadata;
}

export function exercise(): Workspace {
  const workspace = createWorkspace();
  validateWorkspace(workspace);
  const registry = new InMemoryToolRegistry();
  const definition = null as unknown as ToolDefinition;
  void registry; void definition; void createHostedWorkspace; void createWorkspaceFromContracts;
  void admitWorkspaceUsageBundle;
  void admitShellWidgetPlacementPreservingRegionState;
  void normalizeGroupedWorkbenchToolDockVisibility;
  void createWorkspaceExperiencePresetBinding;
  void createBrowserWorkbenchExperienceRepository;
  const widgetZoneProjection: WorkbenchWidgetZoneProjection = projectWorkbenchWidgetZone({
    containerOpen: true,
    visiblePlacementCount: 0,
    layoutEditingEnabled: true,
  });
  void widgetZoneProjection;
  const tabbedVisibilityIntent: TabbedShellRegionVisibilityIntent =
    resolveTabbedShellRegionVisibilityIntent({
      id: 'right',
      isVisible: true,
      isOpen: true,
      size: 320,
      activeWidgetId: 'alpha',
      widgetIds: ['alpha', 'beta'],
      presentation: 'tabs',
    }, 'alpha', true);
  void tabbedVisibilityIntent;
  const experienceRevision = null as unknown as WorkbenchExperienceRevision;
  const experienceRepository = null as unknown as WorkbenchExperienceRepository;
  const experienceRepositoryResult = null as unknown as WorkbenchExperienceRepositoryResult<unknown>;
  void experienceRevision; void experienceRepository; void experienceRepositoryResult;
  const subject = null as unknown as PhysicsSubjectSource;
  const loadSubject = null as unknown as PhysicsServicePort['loadSubject'];
  void NoopPhysicsBackend; void PhysicsService; void subject; void loadSubject;
  return workspace;
}

import {createCompositionTemporalProjectionReader} from '@konitif/workbench';
createCompositionTemporalProjectionReader();
