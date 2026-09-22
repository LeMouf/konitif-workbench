import { InMemoryToolRegistry, type RegisteredTool } from '../../infrastructure/tools/InMemoryToolRegistry';
import type { ToolDefinition } from '../../domain/tool/model';

export class WorkbenchExperienceToolSelection {
  readonly registry = new InMemoryToolRegistry();

  constructor(
    private readonly availableRegistry: InMemoryToolRegistry,
    initialToolIds: readonly string[] = []
  ) {
    for (const toolId of initialToolIds) this.select(toolId);
  }

  listAvailable(): ToolDefinition[] {
    return this.availableRegistry.list().map(entry => entry.definition);
  }

  listSelected(): ToolDefinition[] {
    return this.registry.list().map(entry => entry.definition);
  }

  isSelected(toolId: string): boolean {
    return Boolean(this.registry.get(toolId));
  }

  select(toolId: string): boolean {
    if (this.registry.get(toolId)) return true;
    const entry = this.availableRegistry.get(toolId);
    if (!entry) return false;
    this.registry.register(cloneRegistration(entry));
    return true;
  }

  selectAll(toolIds: readonly string[]): boolean {
    const uniqueToolIds = [...new Set(toolIds)];
    if (uniqueToolIds.some(toolId => !this.registry.get(toolId) && !this.availableRegistry.get(toolId))) {
      return false;
    }
    for (const toolId of uniqueToolIds) this.select(toolId);
    return true;
  }

  replaceWith(toolIds: readonly string[]): boolean {
    const uniqueToolIds = [...new Set(toolIds)];
    if (uniqueToolIds.some(toolId => !this.availableRegistry.get(toolId))) return false;
    const requested = new Set(uniqueToolIds);
    for (const tool of this.listSelected()) {
      if (!requested.has(tool.id)) this.registry.unregister(tool.id);
    }
    for (const toolId of uniqueToolIds) this.select(toolId);
    return true;
  }

  deselect(toolId: string): boolean {
    return this.registry.unregister(toolId);
  }
}

export function createWorkbenchExperienceToolSelection(
  availableRegistry: InMemoryToolRegistry,
  initialToolIds: readonly string[] = []
): WorkbenchExperienceToolSelection {
  return new WorkbenchExperienceToolSelection(availableRegistry, initialToolIds);
}

function cloneRegistration(entry: RegisteredTool): RegisteredTool {
  return { ...entry };
}
