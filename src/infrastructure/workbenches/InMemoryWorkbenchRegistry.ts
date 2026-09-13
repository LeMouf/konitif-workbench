import type { WorkbenchCatalog, WorkbenchDefinition } from '../../domain/workbench/model';

export class InMemoryWorkbenchRegistry implements WorkbenchCatalog {
  private readonly entries = new Map<string, WorkbenchDefinition>();

  register(definition: WorkbenchDefinition): void {
    this.entries.set(definition.id, {
      ...definition,
      toolIds: [...definition.toolIds],
      shellWidgetIds: definition.shellWidgetIds ? [...definition.shellWidgetIds] : undefined
    });
  }

  getDefinition(workbenchId: string): WorkbenchDefinition | undefined {
    const entry = this.entries.get(workbenchId);

    if (!entry) {
      return undefined;
    }

    return {
      ...entry,
      toolIds: [...entry.toolIds],
      shellWidgetIds: entry.shellWidgetIds ? [...entry.shellWidgetIds] : undefined
    };
  }

  list(): WorkbenchDefinition[] {
    return [...this.entries.values()].map((entry) => ({
      ...entry,
      toolIds: [...entry.toolIds],
      shellWidgetIds: entry.shellWidgetIds ? [...entry.shellWidgetIds] : undefined
    }));
  }
}
