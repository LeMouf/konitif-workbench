import { cloneJsonObject, type JsonObject } from '../../domain/shared/json';
import type {
  ControlledExperimentDefinition,
  ControlledExperimentMetricSummary,
  ControlledExperimentObservation,
  ControlledExperimentObservationInput,
  ControlledExperimentPhaseMarker,
  ControlledExperimentRecorderSnapshot,
  ControlledExperimentRunArtifact,
  ControlledExperimentRunStart,
  ControlledExperimentRunStop
} from '../../domain/experiment/model';

interface ActiveRun {
  input: ControlledExperimentRunStart;
  phaseId: string | null;
  sequence: number;
  observations: ControlledExperimentObservation[];
  phaseMarkers: ControlledExperimentPhaseMarker[];
  droppedObservationCount: number;
}

export class ControlledExperimentRecorder {
  private readonly conditionIds: ReadonlySet<string>;
  private readonly metricIds: readonly string[];
  private readonly metricIdSet: ReadonlySet<string>;
  private readonly phaseIds: ReadonlySet<string>;
  private activeRun: ActiveRun | null = null;

  constructor(readonly definition: ControlledExperimentDefinition) {
    assertDefinition(definition);
    this.conditionIds = new Set(definition.conditions.map((condition) => condition.id));
    this.metricIds = definition.metrics.map((metric) => metric.id);
    this.metricIdSet = new Set(this.metricIds);
    this.phaseIds = new Set(definition.phases.map((phase) => phase.id));
  }

  start(input: ControlledExperimentRunStart): void {
    if (this.activeRun) {
      throw new Error(`Experiment ${this.definition.id} is already recording ${this.activeRun.input.runId}.`);
    }

    if (!this.conditionIds.has(input.conditionId)) {
      throw new Error(`Unknown experiment condition: ${input.conditionId}`);
    }

    if (!input.runId.trim() || !Number.isFinite(input.startedAtMs)) {
      throw new Error('A controlled experiment run requires a stable id and finite start timestamp.');
    }

    this.activeRun = {
      input: {
        ...input,
        runId: input.runId.trim(),
        environment: cloneJsonObject(input.environment)
      },
      phaseId: null,
      sequence: 0,
      observations: [],
      phaseMarkers: [],
      droppedObservationCount: 0
    };
  }

  markPhase(phaseId: string, observedAtMs: number, provenance: JsonObject = {}): boolean {
    const run = this.activeRun;

    if (!run || !this.phaseIds.has(phaseId) || !Number.isFinite(observedAtMs)) {
      return false;
    }

    run.phaseId = phaseId;
    run.phaseMarkers.push({
      sequence: run.sequence++,
      phaseId,
      observedAtMs,
      provenance: cloneJsonObject(provenance)
    });
    return true;
  }

  record(input: ControlledExperimentObservationInput): boolean {
    const run = this.activeRun;

    if (!run || !Number.isFinite(input.observedAtMs)) {
      return false;
    }

    if (run.observations.length >= this.definition.maxObservations) {
      run.droppedObservationCount += 1;
      return false;
    }

    run.observations.push({
      sequence: run.sequence++,
      observedAtMs: input.observedAtMs,
      phaseId: run.phaseId,
      metrics: Object.fromEntries(
        Object.entries(input.metrics)
          .filter(([metricId]) => this.metricIdSet.has(metricId))
          .map(([metricId, value]) => [metricId, normalizeMetricValue(value)])
      ),
      provenance: cloneJsonObject(input.provenance ?? {})
    });
    return true;
  }

  stop(input: ControlledExperimentRunStop): ControlledExperimentRunArtifact {
    const run = this.activeRun;

    if (!run) {
      throw new Error(`Experiment ${this.definition.id} is not recording.`);
    }

    if (!Number.isFinite(input.endedAtMs)) {
      throw new Error('A controlled experiment run requires a finite end timestamp.');
    }

    const condition = this.definition.conditions.find((candidate) => candidate.id === run.input.conditionId);

    if (!condition) {
      throw new Error(`Unknown experiment condition: ${run.input.conditionId}`);
    }

    const observations = run.observations.map(cloneObservation);
    const retentionInvalid = run.droppedObservationCount > 0;
    const status = input.status === 'cancelled'
      ? 'cancelled'
      : retentionInvalid
        ? 'invalid'
        : input.status ?? 'completed';
    const artifact: ControlledExperimentRunArtifact = {
      schemaVersion: 1,
      experiment: {
        id: this.definition.id,
        version: this.definition.version,
        title: this.definition.title,
        hypothesis: this.definition.hypothesis,
        independentVariable: this.definition.independentVariable,
        conditions: this.definition.conditions.map(cloneCondition),
        condition: {
          ...condition,
          parameters: cloneJsonObject(condition.parameters)
        },
        metrics: this.definition.metrics.map((metric) => ({ ...metric })),
        phases: this.definition.phases.map((phase) => ({ ...phase })),
        controlledVariables: [...this.definition.controlledVariables]
      },
      run: {
        id: run.input.runId,
        status,
        reason: input.reason?.trim() || (retentionInvalid ? 'observation_limit_reached' : null),
        startedAtMs: run.input.startedAtMs,
        endedAtMs: input.endedAtMs,
        durationMs: Math.max(0, input.endedAtMs - run.input.startedAtMs),
        environment: cloneJsonObject(run.input.environment)
      },
      observations,
      phaseMarkers: run.phaseMarkers.map((marker) => ({
        ...marker,
        provenance: cloneJsonObject(marker.provenance)
      })),
      metricSummaries: summarizeMetrics(this.metricIds, observations),
      retention: {
        maxObservations: this.definition.maxObservations,
        recordedObservations: observations.length,
        droppedObservations: run.droppedObservationCount,
        truncated: run.droppedObservationCount > 0
      }
    };

    this.activeRun = null;
    return artifact;
  }

  isRecording(): boolean {
    return this.activeRun !== null;
  }

  snapshot(): ControlledExperimentRecorderSnapshot {
    const run = this.activeRun;

    return {
      recording: run !== null,
      runId: run?.input.runId ?? null,
      conditionId: run?.input.conditionId ?? null,
      phaseId: run?.phaseId ?? null,
      observationCount: run?.observations.length ?? 0,
      droppedObservationCount: run?.droppedObservationCount ?? 0
    };
  }
}

function cloneCondition(
  condition: ControlledExperimentDefinition['conditions'][number]
): ControlledExperimentDefinition['conditions'][number] {
  return {
    ...condition,
    parameters: cloneJsonObject(condition.parameters)
  };
}

function assertDefinition(definition: ControlledExperimentDefinition): void {
  if (!definition.id.trim() || !Number.isInteger(definition.version) || definition.version < 1) {
    throw new Error('A controlled experiment definition requires a stable id and positive integer version.');
  }

  assertUniqueIds('condition', definition.conditions.map((condition) => condition.id));
  assertUniqueIds('metric', definition.metrics.map((metric) => metric.id));
  assertUniqueIds('phase', definition.phases.map((phase) => phase.id));

  if (definition.conditions.length < 2) {
    throw new Error('A controlled comparison requires at least two conditions.');
  }

  if (!Number.isInteger(definition.maxObservations) || definition.maxObservations < 1) {
    throw new Error('A controlled experiment requires a positive observation retention bound.');
  }
}

function assertUniqueIds(kind: string, ids: readonly string[]): void {
  if (ids.some((id) => !id.trim()) || new Set(ids).size !== ids.length) {
    throw new Error(`Controlled experiment ${kind} ids must be non-empty and unique.`);
  }
}

function normalizeMetricValue(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function cloneObservation(observation: ControlledExperimentObservation): ControlledExperimentObservation {
  return {
    ...observation,
    metrics: { ...observation.metrics },
    provenance: cloneJsonObject(observation.provenance)
  };
}

function summarizeMetrics(
  metricIds: readonly string[],
  observations: readonly ControlledExperimentObservation[]
): Record<string, ControlledExperimentMetricSummary> {
  return Object.fromEntries(
    metricIds.map((metricId) => {
      const values = observations
        .map((observation) => observation.metrics[metricId])
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

      return [metricId, summarizeMetric(values)];
    })
  );
}

function summarizeMetric(values: readonly number[]): ControlledExperimentMetricSummary {
  if (values.length === 0) {
    return { count: 0, minimum: null, maximum: null, mean: null, p01: null, p50: null, p95: null, p99: null };
  }

  const sorted = [...values].sort((left, right) => left - right);

  return {
    count: sorted.length,
    minimum: sorted[0] ?? null,
    maximum: sorted[sorted.length - 1] ?? null,
    mean: sorted.reduce((total, value) => total + value, 0) / sorted.length,
    p01: percentile(sorted, 0.01),
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99)
  };
}

function percentile(sorted: readonly number[], quantile: number): number | null {
  if (sorted.length === 0) {
    return null;
  }

  const index = Math.ceil(Math.min(1, Math.max(0, quantile)) * sorted.length) - 1;
  return sorted[Math.max(0, index)] ?? null;
}
