import {
  InMemoryToolRegistry,
  admitWorkspaceUsageBundle,
  createWorkspace,
  type ToolDefinition,
  type Workspace,
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

export function exercise(): Workspace {
  const workspace = createWorkspace();
  validateWorkspace(workspace);
  const registry = new InMemoryToolRegistry();
  const definition = null as unknown as ToolDefinition;
  void registry; void definition; void createHostedWorkspace; void createWorkspaceFromContracts;
  void admitWorkspaceUsageBundle;
  const subject = null as unknown as PhysicsSubjectSource;
  const loadSubject = null as unknown as PhysicsServicePort['loadSubject'];
  void NoopPhysicsBackend; void PhysicsService; void subject; void loadSubject;
  return workspace;
}
