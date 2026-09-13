export type BootPhase = 'plan' | 'initialize' | 'hydrate' | 'run';

export const BOOT_PHASES: readonly BootPhase[] = ['plan', 'initialize', 'hydrate', 'run'] as const;

export type BootStepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'blocked';

export type BootStepCriticality = 'critical' | 'optional';

export type BootMode = 'normal' | 'safe' | 'recovery' | 'readonly' | 'diagnostic';

export interface BootContext {
  mode: BootMode;
  services: Map<string, unknown>;
  capabilities: Map<string, unknown>;
  runtime: Map<string, unknown>;
  options: Map<string, unknown>;
}

export interface CreateBootContextOptions {
  mode?: BootMode;
  services?: Iterable<readonly [string, unknown]>;
  capabilities?: Iterable<readonly [string, unknown]>;
  runtime?: Iterable<readonly [string, unknown]>;
  options?: Iterable<readonly [string, unknown]>;
}

export function createBootContext(options: CreateBootContextOptions = {}): BootContext {
  return {
    mode: options.mode ?? 'normal',
    services: new Map(options.services),
    capabilities: new Map(options.capabilities),
    runtime: new Map(options.runtime),
    options: new Map(options.options),
  };
}

export function getService<T>(ctx: BootContext, key: string): T {
  if (!ctx.services.has(key)) {
    throw new Error(`Boot service "${key}" is not registered.`);
  }

  return ctx.services.get(key) as T;
}

export function setService(ctx: BootContext, key: string, value: unknown): void {
  ctx.services.set(key, value);
}

export function getCapability<T>(ctx: BootContext, key: string): T {
  if (!ctx.capabilities.has(key)) {
    throw new Error(`Boot capability "${key}" is not registered.`);
  }

  return ctx.capabilities.get(key) as T;
}

export function setCapability(ctx: BootContext, key: string, value: unknown): void {
  ctx.capabilities.set(key, value);
}

export function getRuntimeValue<T>(ctx: BootContext, key: string): T {
  if (!ctx.runtime.has(key)) {
    throw new Error(`Boot runtime value "${key}" is not registered.`);
  }

  return ctx.runtime.get(key) as T;
}

export function setRuntimeValue(ctx: BootContext, key: string, value: unknown): void {
  ctx.runtime.set(key, value);
}

export function getBootOption<T>(ctx: BootContext, key: string): T {
  if (!ctx.options.has(key)) {
    throw new Error(`Boot option "${key}" is not registered.`);
  }

  return ctx.options.get(key) as T;
}

export function setBootOption(ctx: BootContext, key: string, value: unknown): void {
  ctx.options.set(key, value);
}

export interface BootDependency {
  stepId: string;
  optional?: boolean;
}

export interface BootStepResult {
  warnings?: string[];
  metadata?: Record<string, unknown>;
}

export interface BootStep {
  id: string;
  label: string;
  phase: BootPhase;
  dependsOn?: BootDependency[];
  criticality?: BootStepCriticality;
  run(ctx: BootContext): Promise<BootStepResult | void> | BootStepResult | void;
  rollback?(ctx: BootContext): Promise<BootStepResult | void> | BootStepResult | void;
  teardown?(ctx: BootContext): Promise<BootStepResult | void> | BootStepResult | void;
}

export interface BootGraph {
  steps: BootStep[];
}

export interface BootStepState {
  id: string;
  label: string;
  phase: BootPhase;
  status: BootStepStatus;
  criticality: BootStepCriticality;
  dependencies: BootDependency[];
  startedAt?: number;
  endedAt?: number;
  error?: unknown;
}

export interface BootNodeRuntime {
  state: BootStepState;
  attempts: number;
  warnings: string[];
  metadata: Record<string, unknown>;
}

export interface BootExecutionError {
  stepId?: string;
  error: unknown;
}

export interface BootExecutionState {
  executionId: string;
  phase: BootPhase;
  steps: Record<string, BootStepState>;
  nodes: Record<string, BootNodeRuntime>;
  startedAt?: number;
  endedAt?: number;
  failed: boolean;
  errors: BootExecutionError[];
}
