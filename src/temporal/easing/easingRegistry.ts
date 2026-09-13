import type { EasingDefinition, EasingFunction } from './easingTypes';
import { easingDefinitions } from './easingFunctions';

export interface EasingRegistry {
  register(definition: EasingDefinition): void;
  get(id: string): EasingDefinition | undefined;
  evaluate(id: string, t: number): number;
  list(): EasingDefinition[];
}

export function createEasingRegistry(definitions: EasingDefinition[] = easingDefinitions): EasingRegistry {
  const map = new Map<string, EasingDefinition>();
  for (const definition of definitions) map.set(definition.id, definition);

  return {
    register(definition) {
      map.set(definition.id, definition);
    },
    get(id) {
      return map.get(id);
    },
    evaluate(id, t) {
      const definition = map.get(id);
      if (!definition) throw new Error(`[EasingRegistry] Unknown easing "${id}"`);
      return definition.fn(t);
    },
    list() {
      return [...map.values()];
    },
  };
}

export const easingRegistry = createEasingRegistry();

export function resolveEasing(easing: string | EasingFunction): EasingFunction {
  if (typeof easing === 'function') return easing;
  const definition = easingRegistry.get(easing);
  if (!definition) throw new Error(`[EasingRegistry] Unknown easing "${easing}"`);
  return definition.fn;
}
