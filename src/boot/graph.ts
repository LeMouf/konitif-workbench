import type { BootGraph, BootPhase, BootStep } from './types';

export type BootGraphValidationIssueType = 'duplicate-id' | 'missing-dependency' | 'cycle';

export interface BootGraphValidationIssue {
  type: BootGraphValidationIssueType;
  stepId?: string;
  dependencyId?: string;
  cycle?: string[];
  message: string;
}

export interface BootGraphValidationResult {
  valid: boolean;
  issues: BootGraphValidationIssue[];
}

export function validateBootGraph(graph: BootGraph): BootGraphValidationResult {
  const issues: BootGraphValidationIssue[] = [];
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  const stepsById = new Map<string, BootStep>();

  for (const step of graph.steps) {
    if (seen.has(step.id)) {
      duplicates.add(step.id);
      issues.push({
        type: 'duplicate-id',
        stepId: step.id,
        message: `Boot step id "${step.id}" is declared more than once.`,
      });
      continue;
    }

    seen.add(step.id);
    stepsById.set(step.id, step);
  }

  for (const step of graph.steps) {
    for (const dependency of step.dependsOn ?? []) {
      if (!stepsById.has(dependency.stepId)) {
        issues.push({
          type: 'missing-dependency',
          stepId: step.id,
          dependencyId: dependency.stepId,
          message: `Boot step "${step.id}" depends on missing step "${dependency.stepId}".`,
        });
      }
    }
  }

  if (duplicates.size === 0) {
    const cycle = findCycle(graph.steps, stepsById);

    if (cycle.length > 0) {
      issues.push({
        type: 'cycle',
        cycle,
        message: `Boot graph contains a dependency cycle: ${cycle.join(' -> ')}.`,
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function resolveBootExecutionOrder(graph: BootGraph): BootStep[] {
  const validation = validateBootGraph(graph);

  if (!validation.valid) {
    throw new Error(validation.issues.map((issue) => issue.message).join('\n'));
  }

  const stepsById = new Map(graph.steps.map((step) => [step.id, step]));
  const ordered: BootStep[] = [];
  const permanent = new Set<string>();
  const temporary = new Set<string>();

  const visit = (step: BootStep): void => {
    if (permanent.has(step.id)) {
      return;
    }

    if (temporary.has(step.id)) {
      throw new Error(`Boot graph contains a dependency cycle at "${step.id}".`);
    }

    temporary.add(step.id);

    for (const dependency of step.dependsOn ?? []) {
      const dependencyStep = stepsById.get(dependency.stepId);

      if (dependencyStep) {
        visit(dependencyStep);
      }
    }

    temporary.delete(step.id);
    permanent.add(step.id);
    ordered.push(step);
  };

  for (const step of graph.steps) {
    visit(step);
  }

  return ordered;
}

export function groupBootStepsByPhase(steps: readonly BootStep[]): Record<BootPhase, BootStep[]> {
  const grouped: Record<BootPhase, BootStep[]> = {
    plan: [],
    initialize: [],
    hydrate: [],
    run: [],
  };

  for (const step of steps) {
    grouped[step.phase].push(step);
  }

  return grouped;
}

function findCycle(steps: readonly BootStep[], stepsById: Map<string, BootStep>): string[] {
  const visited = new Set<string>();
  const stack = new Set<string>();
  const path: string[] = [];

  const visit = (step: BootStep): string[] => {
    if (stack.has(step.id)) {
      const cycleStart = path.indexOf(step.id);
      return [...path.slice(cycleStart), step.id];
    }

    if (visited.has(step.id)) {
      return [];
    }

    visited.add(step.id);
    stack.add(step.id);
    path.push(step.id);

    for (const dependency of step.dependsOn ?? []) {
      const dependencyStep = stepsById.get(dependency.stepId);

      if (!dependencyStep) {
        continue;
      }

      const cycle = visit(dependencyStep);

      if (cycle.length > 0) {
        return cycle;
      }
    }

    stack.delete(step.id);
    path.pop();
    return [];
  };

  for (const step of steps) {
    const cycle = visit(step);

    if (cycle.length > 0) {
      return cycle;
    }
  }

  return [];
}
