import { resolveBootExecutionOrder, validateBootGraph } from './graph';
import { createBootEventBus, type BootEventBus } from './events';
import type {
  BootContext,
  BootExecutionError,
  BootExecutionState,
  BootGraph,
  BootNodeRuntime,
  BootPhase,
  BootStep,
  BootStepResult,
  BootStepState,
} from './types';

export interface BootExecutor {
  run(graph: BootGraph, ctx: BootContext): Promise<BootExecutionState>;
  teardown(ctx: BootContext): Promise<BootExecutionState>;
  getState(): BootExecutionState;
}

export interface CreateBootExecutorOptions {
  eventBus?: BootEventBus;
  now?: () => number;
  createExecutionId?: () => string;
}

export function createBootExecutor(options: CreateBootExecutorOptions = {}): BootExecutor {
  const eventBus = options.eventBus ?? createBootEventBus();
  const now = options.now ?? (() => Date.now());
  const createExecutionId =
    options.createExecutionId ??
    (() => `boot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

  let state = createEmptyExecutionState('boot-idle');
  let completedSteps: BootStep[] = [];

  return {
    async run(graph, ctx) {
      const executionId = createExecutionId();
      state = createInitialExecutionState(graph, executionId, now());
      completedSteps = [];
      eventBus.emit({ type: 'boot:start', executionId, state });

      const validation = validateBootGraph(graph);

      if (!validation.valid) {
        state.failed = true;
        state.endedAt = now();
        state.errors = validation.issues.map((issue) => ({ error: issue }));
        eventBus.emit({
          type: 'boot:failed',
          executionId,
          state,
          error: validation.issues,
        });
        return state;
      }

      const order = resolveBootExecutionOrder(graph);
      let activePhase: BootPhase | null = null;

      for (const step of order) {
        if (activePhase !== step.phase) {
          activePhase = step.phase;
          state.phase = step.phase;
          eventBus.emit({ type: 'phase:start', executionId, phase: step.phase });
        }

        const blockedReason = getBlockedReason(step, state);

        if (blockedReason) {
          markStepBlocked(state, step, blockedReason, now());
          eventBus.emit({
            type: 'step:blocked',
            executionId,
            stepId: step.id,
            reason: blockedReason,
          });

          if ((step.criticality ?? 'critical') === 'critical') {
            state.failed = true;
            state.endedAt = now();
            state.errors.push({ stepId: step.id, error: blockedReason });
            eventBus.emit({
              type: 'boot:failed',
              executionId,
              state,
              error: blockedReason,
            });
            return state;
          }

          continue;
        }

        const node = state.nodes[step.id];
        node.attempts += 1;
        node.state.status = 'running';
        node.state.startedAt = now();
        delete node.state.endedAt;
        delete node.state.error;
        eventBus.emit({ type: 'step:start', executionId, stepId: step.id });

        try {
          const result = await step.run(ctx);
          mergeStepResult(node, result);
          node.state.status = 'success';
          node.state.endedAt = now();
          completedSteps.push(step);
          eventBus.emit({ type: 'step:success', executionId, stepId: step.id });
        } catch (error) {
          node.state.status = 'failed';
          node.state.endedAt = now();
          node.state.error = error;
          state.errors.push({ stepId: step.id, error });
          eventBus.emit({ type: 'step:failed', executionId, stepId: step.id, error });

          if ((step.criticality ?? 'critical') === 'optional') {
            continue;
          }

          await rollbackCompletedSteps(completedSteps, ctx, state, now);
          state.failed = true;
          state.endedAt = now();
          eventBus.emit({ type: 'boot:failed', executionId, state, error });
          return state;
        }
      }

      state.failed = false;
      state.endedAt = now();
      eventBus.emit({ type: 'boot:success', executionId, state });
      return state;
    },

    async teardown(ctx) {
      await teardownCompletedSteps(completedSteps, ctx, state, now);
      completedSteps = [];

      return state;
    },

    getState() {
      return state;
    },
  };
}

function createEmptyExecutionState(executionId: string): BootExecutionState {
  return {
    executionId,
    phase: 'plan',
    steps: {},
    nodes: {},
    failed: false,
    errors: [],
  };
}

function createInitialExecutionState(
  graph: BootGraph,
  executionId: string,
  startedAt: number,
): BootExecutionState {
  const steps: Record<string, BootStepState> = {};
  const nodes: Record<string, BootNodeRuntime> = {};

  for (const step of graph.steps) {
    if (steps[step.id]) {
      continue;
    }

    const state: BootStepState = {
      id: step.id,
      label: step.label,
      phase: step.phase,
      status: 'pending',
      criticality: step.criticality ?? 'critical',
      dependencies: step.dependsOn?.map((dependency) => ({ ...dependency })) ?? [],
    };

    steps[step.id] = state;
    nodes[step.id] = {
      state,
      attempts: 0,
      warnings: [],
      metadata: {},
    };
  }

  return {
    executionId,
    phase: 'plan',
    steps,
    nodes,
    startedAt,
    failed: false,
    errors: [],
  };
}

function getBlockedReason(step: BootStep, state: BootExecutionState): string | null {
  for (const dependency of step.dependsOn ?? []) {
    const dependencyState = state.steps[dependency.stepId];

    if (!dependencyState) {
      continue;
    }

    if (dependency.optional) {
      continue;
    }

    if (dependencyState.status === 'failed') {
      return `Dependency "${dependency.stepId}" failed.`;
    }

    if (dependencyState.status === 'blocked') {
      return `Dependency "${dependency.stepId}" is blocked.`;
    }
  }

  return null;
}

function markStepBlocked(
  state: BootExecutionState,
  step: BootStep,
  reason: string,
  endedAt: number,
): void {
  const node = state.nodes[step.id];
  node.state.status = 'blocked';
  node.state.startedAt = endedAt;
  node.state.endedAt = endedAt;
  node.state.error = reason;
}

function mergeStepResult(node: BootNodeRuntime, result: BootStepResult | void): void {
  if (!result) {
    return;
  }

  node.warnings.push(...(result.warnings ?? []));
  Object.assign(node.metadata, result.metadata ?? {});
}

async function rollbackCompletedSteps(
  completedSteps: BootStep[],
  ctx: BootContext,
  state: BootExecutionState,
  now: () => number,
): Promise<void> {
  for (const step of [...completedSteps].reverse()) {
    if (!step.rollback) {
      continue;
    }

    try {
      const result = await step.rollback(ctx);
      mergeStepResult(state.nodes[step.id], result);
    } catch (error) {
      state.errors.push({ stepId: step.id, error } satisfies BootExecutionError);
      state.nodes[step.id].warnings.push(`Rollback failed at ${now()}.`);
    }
  }
}

async function teardownCompletedSteps(
  completedSteps: BootStep[],
  ctx: BootContext,
  state: BootExecutionState,
  now: () => number,
): Promise<void> {
  for (const step of [...completedSteps].reverse()) {
    if (!step.teardown) {
      continue;
    }

    try {
      const result = await step.teardown(ctx);
      mergeStepResult(state.nodes[step.id], result);
    } catch (error) {
      state.errors.push({ stepId: step.id, error } satisfies BootExecutionError);
      state.nodes[step.id].warnings.push(`Teardown failed at ${now()}.`);
    }
  }
}
