import {
  InMemoryToolRegistry,
  createWorkspace,
  type ToolDefinition,
  type Workspace,
} from '@konitif/workbench';
import { createWorkspace as createHostedWorkspace } from '@konitif/workbench/hosting';
import {
  createWorkspace as createWorkspaceFromContracts,
  validateWorkspace,
} from '@konitif/workbench/workspace-contracts';
import { NoopPhysicsBackend, PhysicsService } from '@konitif/workbench/physics-runtime';

export function exercise(): Workspace {
  const workspace = createWorkspace();
  validateWorkspace(workspace);
  const registry = new InMemoryToolRegistry();
  const definition = null as unknown as ToolDefinition;
  void registry; void definition; void createHostedWorkspace; void createWorkspaceFromContracts;
  void NoopPhysicsBackend; void PhysicsService;
  return workspace;
}
