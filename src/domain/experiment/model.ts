import type { JsonObject, JsonValue } from '../shared/json';

export type ControlledExperimentMetricDirection = 'higher' | 'lower' | 'neutral';
export type ControlledExperimentRunStatus = 'completed' | 'invalid' | 'cancelled';

export interface ControlledExperimentConditionDefinition {
  id: string;
  label: string;
  parameters: JsonObject;
}

export interface ControlledExperimentMetricDefinition {
  id: string;
  label: string;
  unit: string;
  direction: ControlledExperimentMetricDirection;
}

export interface ControlledExperimentPhaseDefinition {
  id: string;
  label: string;
}

export interface ControlledExperimentDefinition {
  id: string;
  version: number;
  title: string;
  hypothesis: string;
  independentVariable: string;
  conditions: readonly ControlledExperimentConditionDefinition[];
  metrics: readonly ControlledExperimentMetricDefinition[];
  phases: readonly ControlledExperimentPhaseDefinition[];
  controlledVariables: readonly string[];
  maxObservations: number;
}

export interface ControlledExperimentObservationInput {
  observedAtMs: number;
  metrics: Readonly<Record<string, number | null | undefined>>;
  provenance?: JsonObject;
}

export interface ControlledExperimentObservation {
  sequence: number;
  observedAtMs: number;
  phaseId: string | null;
  metrics: Record<string, number | null>;
  provenance: JsonObject;
}

export interface ControlledExperimentPhaseMarker {
  sequence: number;
  phaseId: string;
  observedAtMs: number;
  provenance: JsonObject;
}

export interface ControlledExperimentMetricSummary {
  count: number;
  minimum: number | null;
  maximum: number | null;
  mean: number | null;
  p01: number | null;
  p50: number | null;
  p95: number | null;
  p99: number | null;
}

export interface ControlledExperimentRunStart {
  runId: string;
  conditionId: string;
  startedAtMs: number;
  environment: JsonObject;
}

export interface ControlledExperimentRunStop {
  endedAtMs: number;
  status?: ControlledExperimentRunStatus;
  reason?: string | null;
}

export interface ControlledExperimentRunArtifact {
  schemaVersion: 1;
  experiment: {
    id: string;
    version: number;
    title: string;
    hypothesis: string;
    independentVariable: string;
    conditions: readonly ControlledExperimentConditionDefinition[];
    condition: ControlledExperimentConditionDefinition;
    metrics: readonly ControlledExperimentMetricDefinition[];
    phases: readonly ControlledExperimentPhaseDefinition[];
    controlledVariables: readonly string[];
  };
  run: {
    id: string;
    status: ControlledExperimentRunStatus;
    reason: string | null;
    startedAtMs: number;
    endedAtMs: number;
    durationMs: number;
    environment: JsonObject;
  };
  observations: readonly ControlledExperimentObservation[];
  phaseMarkers: readonly ControlledExperimentPhaseMarker[];
  metricSummaries: Readonly<Record<string, ControlledExperimentMetricSummary>>;
  retention: {
    maxObservations: number;
    recordedObservations: number;
    droppedObservations: number;
    truncated: boolean;
  };
}

export interface ControlledExperimentRecorderSnapshot {
  recording: boolean;
  runId: string | null;
  conditionId: string | null;
  phaseId: string | null;
  observationCount: number;
  droppedObservationCount: number;
}

export interface ControlledExperimentCampaignRunDefinition {
  runId: string;
  blindId: string;
  conditionId: string;
}

export interface ControlledExperimentEnvironmentRequirement {
  path: readonly string[];
  value: JsonValue;
}

export interface ControlledExperimentCampaignDefinition {
  id: string;
  version: number;
  experimentId: string;
  experimentVersion: number;
  expectedDurationMs: number;
  durationToleranceMs: number;
  validRunsRequiredPerCondition: number;
  requiredPhaseIds: readonly string[];
  requiredMetricIds: readonly string[];
  environmentRequirements: readonly ControlledExperimentEnvironmentRequirement[];
  runs: readonly ControlledExperimentCampaignRunDefinition[];
}

export type ControlledExperimentCampaignRunDisposition = 'pending' | 'accepted' | 'rejected';

export interface ControlledExperimentCampaignRunAssessment {
  runId: string;
  blindId: string;
  conditionId: string;
  disposition: ControlledExperimentCampaignRunDisposition;
  reasons: readonly string[];
  artifactStatus: ControlledExperimentRunStatus | null;
}

export interface ControlledExperimentCampaignSnapshot {
  campaignId: string;
  campaignVersion: number;
  readyForReview: boolean;
  acceptedRunCounts: Readonly<Record<string, number>>;
  runs: readonly ControlledExperimentCampaignRunAssessment[];
  nextRun: ControlledExperimentCampaignRunDefinition | null;
}
