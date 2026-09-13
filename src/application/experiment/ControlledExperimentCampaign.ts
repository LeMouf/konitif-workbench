import type {
  ControlledExperimentCampaignDefinition,
  ControlledExperimentCampaignRunAssessment,
  ControlledExperimentCampaignRunDefinition,
  ControlledExperimentCampaignSnapshot,
  ControlledExperimentDefinition,
  ControlledExperimentRunArtifact
} from '../../domain/experiment/model';
import type { JsonObject, JsonValue } from '../../domain/shared/json';

export class ControlledExperimentCampaign {
  private readonly plannedRuns: ReadonlyMap<string, ControlledExperimentCampaignRunDefinition>;
  private readonly conditionIds: readonly string[];
  private readonly assessments = new Map<string, ControlledExperimentCampaignRunAssessment>();

  constructor(
    readonly definition: ControlledExperimentCampaignDefinition,
    readonly experiment: ControlledExperimentDefinition
  ) {
    assertCampaignDefinition(definition, experiment);
    this.plannedRuns = new Map(definition.runs.map((run) => [run.runId, { ...run }]));
    this.conditionIds = experiment.conditions.map(({ id }) => id);
  }

  assessArtifact(artifact: ControlledExperimentRunArtifact): ControlledExperimentCampaignRunAssessment {
    const planned = this.plannedRuns.get(artifact.run.id);

    if (!planned) {
      throw new Error(`Run ${artifact.run.id} is not part of campaign ${this.definition.id}.`);
    }

    const reasons: string[] = [];

    if (
      artifact.experiment.id !== this.definition.experimentId ||
      artifact.experiment.version !== this.definition.experimentVersion
    ) {
      reasons.push('experiment_identity_mismatch');
    }
    if (artifact.experiment.condition.id !== planned.conditionId) {
      reasons.push('condition_mismatch');
    }
    if (artifact.run.status !== 'completed') {
      reasons.push(`artifact_status_${artifact.run.status}`);
    }
    if (
      Math.abs(artifact.run.durationMs - this.definition.expectedDurationMs) >
      this.definition.durationToleranceMs
    ) {
      reasons.push('duration_out_of_tolerance');
    }
    if (artifact.retention.truncated || artifact.retention.droppedObservations > 0) {
      reasons.push('observation_retention_incomplete');
    }

    const observedPhaseIds = new Set(artifact.phaseMarkers.map(({ phaseId }) => phaseId));
    for (const phaseId of this.definition.requiredPhaseIds) {
      if (!observedPhaseIds.has(phaseId)) {
        reasons.push(`missing_phase:${phaseId}`);
      }
    }

    for (const metricId of this.definition.requiredMetricIds) {
      if (!artifact.metricSummaries[metricId] || artifact.metricSummaries[metricId].count < 1) {
        reasons.push(`missing_metric:${metricId}`);
      }
    }

    for (const requirement of this.definition.environmentRequirements) {
      const actual = readJsonPath(artifact.run.environment, requirement.path);
      if (!jsonValuesEqual(actual, requirement.value)) {
        reasons.push(`environment_mismatch:${requirement.path.join('.')}`);
      }
    }

    return {
      runId: planned.runId,
      blindId: planned.blindId,
      conditionId: planned.conditionId,
      disposition: reasons.length === 0 ? 'accepted' : 'rejected',
      reasons,
      artifactStatus: artifact.run.status
    };
  }

  registerArtifact(artifact: ControlledExperimentRunArtifact): ControlledExperimentCampaignRunAssessment {
    if (this.assessments.has(artifact.run.id)) {
      throw new Error(`Run ${artifact.run.id} already has a registered artifact.`);
    }

    const assessment = this.assessArtifact(artifact);
    this.assessments.set(assessment.runId, assessment);
    return cloneAssessment(assessment);
  }

  snapshot(): ControlledExperimentCampaignSnapshot {
    const acceptedRunCounts = Object.fromEntries(this.conditionIds.map((conditionId) => [conditionId, 0]));
    const runs = this.definition.runs.map((run) => {
      const assessment = this.assessments.get(run.runId) ?? pendingAssessment(run);
      if (assessment.disposition === 'accepted') {
        acceptedRunCounts[assessment.conditionId] = (acceptedRunCounts[assessment.conditionId] ?? 0) + 1;
      }
      return cloneAssessment(assessment);
    });
    const readyForReview = this.conditionIds.every(
      (conditionId) =>
        (acceptedRunCounts[conditionId] ?? 0) >= this.definition.validRunsRequiredPerCondition
    );
    const next = runs.find(({ disposition }) => disposition === 'pending');

    return {
      campaignId: this.definition.id,
      campaignVersion: this.definition.version,
      readyForReview,
      acceptedRunCounts,
      runs,
      nextRun: next ? { ...this.plannedRuns.get(next.runId)! } : null
    };
  }
}

function assertCampaignDefinition(
  campaign: ControlledExperimentCampaignDefinition,
  experiment: ControlledExperimentDefinition
): void {
  if (!campaign.id.trim() || !Number.isInteger(campaign.version) || campaign.version < 1) {
    throw new Error('A controlled experiment campaign requires a stable id and positive integer version.');
  }
  if (campaign.experimentId !== experiment.id || campaign.experimentVersion !== experiment.version) {
    throw new Error('Campaign and experiment identities must match.');
  }
  if (!Number.isFinite(campaign.expectedDurationMs) || campaign.expectedDurationMs <= 0) {
    throw new Error('A campaign requires a positive expected run duration.');
  }
  if (!Number.isFinite(campaign.durationToleranceMs) || campaign.durationToleranceMs < 0) {
    throw new Error('A campaign duration tolerance cannot be negative.');
  }
  if (!Number.isInteger(campaign.validRunsRequiredPerCondition) || campaign.validRunsRequiredPerCondition < 1) {
    throw new Error('A campaign requires at least one valid run per condition.');
  }

  assertUniqueValues('run id', campaign.runs.map(({ runId }) => runId));
  assertUniqueValues('blind id', campaign.runs.map(({ blindId }) => blindId));
  assertUniqueValues('required phase id', campaign.requiredPhaseIds);
  assertUniqueValues('required metric id', campaign.requiredMetricIds);

  const conditionIds = new Set(experiment.conditions.map(({ id }) => id));
  const phaseIds = new Set(experiment.phases.map(({ id }) => id));
  const metricIds = new Set(experiment.metrics.map(({ id }) => id));

  if (campaign.runs.some(({ conditionId }) => !conditionIds.has(conditionId))) {
    throw new Error('Every campaign run must reference a declared experiment condition.');
  }
  if (campaign.requiredPhaseIds.some((phaseId) => !phaseIds.has(phaseId))) {
    throw new Error('Every required campaign phase must exist in the experiment definition.');
  }
  if (campaign.requiredMetricIds.some((metricId) => !metricIds.has(metricId))) {
    throw new Error('Every required campaign metric must exist in the experiment definition.');
  }

  for (const conditionId of conditionIds) {
    const plannedCount = campaign.runs.filter((run) => run.conditionId === conditionId).length;
    if (plannedCount < campaign.validRunsRequiredPerCondition) {
      throw new Error(`Campaign condition ${conditionId} does not have enough planned runs.`);
    }
  }
}

function assertUniqueValues(kind: string, values: readonly string[]): void {
  if (values.some((value) => !value.trim()) || new Set(values).size !== values.length) {
    throw new Error(`Campaign ${kind}s must be non-empty and unique.`);
  }
}

function pendingAssessment(
  run: ControlledExperimentCampaignRunDefinition
): ControlledExperimentCampaignRunAssessment {
  return {
    ...run,
    disposition: 'pending',
    reasons: [],
    artifactStatus: null
  };
}

function cloneAssessment(
  assessment: ControlledExperimentCampaignRunAssessment
): ControlledExperimentCampaignRunAssessment {
  return { ...assessment, reasons: [...assessment.reasons] };
}

function readJsonPath(root: JsonObject, path: readonly string[]): JsonValue | undefined {
  let current: JsonValue | undefined = root;
  for (const segment of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function jsonValuesEqual(left: JsonValue | undefined, right: JsonValue): boolean {
  return left !== undefined && JSON.stringify(left) === JSON.stringify(right);
}
