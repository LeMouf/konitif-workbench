export interface WorkbenchDefinition {
  id: string;
  title: string;
  summary: string;
  /**
   * Ordered list of tools exposed inside this contextualized workbench.
   * The first entry can be used as a sensible launcher fallback.
   */
  toolIds: string[];
  /**
   * Optional preferred tool opened when the workbench boots.
   * Must belong to `toolIds` when provided.
   */
  defaultToolId?: string | null;
  /**
   * Optional workspace preset reference resolved by the app layer.
   * Kept as a string on purpose so `core` does not depend on product-specific preset ids yet.
   */
  layoutPresetId?: string | null;
  /**
   * Optional shell widget subset exposed by this workbench.
   */
  shellWidgetIds?: string[];
  /**
   * Optional route handle used by the app layer to bind URLs to a contextual workbench.
   */
  route?: {
    page?: string | null;
    workbench?: string | null;
  };
}

export interface WorkbenchCatalog {
  getDefinition(workbenchId: string): WorkbenchDefinition | undefined;
  list(): WorkbenchDefinition[];
}
