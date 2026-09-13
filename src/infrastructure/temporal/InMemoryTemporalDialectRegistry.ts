import type {
  TemporalDialectCatalog,
  TemporalDialectCompatibilityInput,
  TemporalDialectDefinition
} from '../../domain/temporal/model';

export class InMemoryTemporalDialectRegistry implements TemporalDialectCatalog {
  private readonly entries = new Map<string, TemporalDialectDefinition>();

  register(definition: TemporalDialectDefinition): void {
    this.entries.set(definition.id, cloneTemporalDialectDefinition(definition));
  }

  getDefinition(dialectId: string): TemporalDialectDefinition | undefined {
    const definition = this.entries.get(dialectId);

    return definition ? cloneTemporalDialectDefinition(definition) : undefined;
  }

  list(): TemporalDialectDefinition[] {
    return [...this.entries.values()]
      .map(cloneTemporalDialectDefinition)
      .sort(compareTemporalDialects);
  }

  listCompatible(input: TemporalDialectCompatibilityInput): TemporalDialectDefinition[] {
    return this.list().filter((definition) => isCompatibleTemporalDialect(definition, input));
  }
}

function isCompatibleTemporalDialect(
  definition: TemporalDialectDefinition,
  input: TemporalDialectCompatibilityInput
): boolean {
  const requiredCapabilities = input.requiredCapabilities ?? [];
  const projectionKinds = definition.projectionKinds ?? [];

  return (
    (!input.dialect || definition.id === input.dialect) &&
    (!input.unit || definition.unit === input.unit) &&
    (!input.projectionKind || projectionKinds.includes(input.projectionKind)) &&
    requiredCapabilities.every((capability) => definition.capabilities.includes(capability))
  );
}

function compareTemporalDialects(
  left: TemporalDialectDefinition,
  right: TemporalDialectDefinition
): number {
  const titleDelta = left.title.localeCompare(right.title);

  return titleDelta !== 0 ? titleDelta : left.id.localeCompare(right.id);
}

function cloneTemporalDialectDefinition(
  definition: TemporalDialectDefinition
): TemporalDialectDefinition {
  return {
    ...definition,
    itemKinds: [...definition.itemKinds],
    capabilities: [...definition.capabilities],
    projectionKinds: definition.projectionKinds ? [...definition.projectionKinds] : undefined
  };
}
