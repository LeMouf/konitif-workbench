import type {RuntimeHistorySample,RuntimeHistorySnapshot} from './history/runtimeHistory';
export type CompositionTemporalProjectionStage='authored'|'simulated';
export interface CompositionTemporalProjectionCursor {
  animationId: string | null;
  /** Exact occurrence identity inside a composition. */
  sourceId?: string | null;
  currentTimeSeconds: number;
  projectionStage?: CompositionTemporalProjectionStage;
  allowAuthoredFallback?: boolean;
}

export function resolveCompositionTemporalProjectionSample(
  snapshot: Pick<RuntimeHistorySnapshot, 'samples'>,
  cursor: CompositionTemporalProjectionCursor,
  maximumInterpolationGapSeconds = 0.2
): RuntimeHistorySample | null {
  return sharedTemporalProjectionReader(snapshot, cursor, maximumInterpolationGapSeconds);
}

/**
 * Reader-scoped projection index. Immutable recorder revisions normally append
 * samples or rotate the bounded window, so only their delta is indexed. An
 * unrelated or structurally replaced history still triggers a safe rebuild.
 * The canonical history remains owned by the recorder.
 */
export function createCompositionTemporalProjectionReader(options:{interpolateMetadata?:(before:RuntimeHistorySample,after:RuntimeHistorySample,ratio:number)=>RuntimeHistorySample['metadata']}={}) {
  let samplesRevision: RuntimeHistorySample[] | null = null;
  let candidatesBySubject = new Map<string, TemporalCandidateIndex>();

  return (
    snapshot: Pick<RuntimeHistorySnapshot, 'samples'>,
    cursor: CompositionTemporalProjectionCursor,
    maximumInterpolationGapSeconds = 0.2
  ): RuntimeHistorySample | null => {
    if (snapshot.samples !== samplesRevision) {
      const delta = samplesRevision
        ? resolveTemporalSamplesDelta(samplesRevision, snapshot.samples)
        : null;
      if (delta) {
        for (const index of candidatesBySubject.values()) {
          for (const sample of delta.removed) removeTemporalCandidate(index, sample);
          for (const sample of delta.added) addTemporalCandidate(index, sample);
        }
      } else {
        candidatesBySubject = new Map();
      }
      samplesRevision = snapshot.samples;
    }

    const key = JSON.stringify([cursor.animationId, cursor.sourceId ?? null]);
    let index = candidatesBySubject.get(key);
    if (!index) {
      index = buildTemporalCandidateIndex(snapshot.samples, cursor);
      candidatesBySubject.set(key, index);
    }

    return resolveTemporalProjectionSampleFromCandidates(
      index,
      cursor,
      maximumInterpolationGapSeconds
    );
  };
function resolveTemporalProjectionSampleFromCandidates(
  candidates: TemporalCandidates,
  cursor: CompositionTemporalProjectionCursor,
  maximumInterpolationGapSeconds: number
): RuntimeHistorySample | null {
  const simulatedSamples = candidates.simulated;
  if (cursor.projectionStage !== 'simulated') {
    const authoredSamples = candidates.authored;
    return resolveProjectionSampleFromCandidates(
      authoredSamples,
      cursor.currentTimeSeconds,
      maximumInterpolationGapSeconds,
      true
    );
  }

  const simulatedProjection = resolveProjectionSampleFromCandidates(
    simulatedSamples,
    cursor.currentTimeSeconds,
    maximumInterpolationGapSeconds,
    true
  );

  if (simulatedProjection) {
    return simulatedProjection;
  }

  if (cursor.allowAuthoredFallback === false) {
    return null;
  }

  const authoredSamples = candidates.authored;
  return resolveProjectionSampleFromCandidates(
    authoredSamples,
    cursor.currentTimeSeconds,
    maximumInterpolationGapSeconds,
    true
  );
}

type TemporalCandidates = {
  authored: RuntimeHistorySample[];
  simulated: RuntimeHistorySample[];
};

type TemporalCandidateIndex = TemporalCandidates & {
  cursor: Pick<CompositionTemporalProjectionCursor, 'animationId' | 'sourceId'>;
  authoredByTime: Map<number, RuntimeHistorySample[]>;
  simulatedByTime: Map<number, RuntimeHistorySample[]>;
};

function buildTemporalCandidateIndex(
  samples: RuntimeHistorySample[],
  cursor: CompositionTemporalProjectionCursor
): TemporalCandidateIndex {
  const index: TemporalCandidateIndex = {
    cursor: { animationId: cursor.animationId, sourceId: cursor.sourceId ?? null },
    authored: [],
    simulated: [],
    authoredByTime: new Map(),
    simulatedByTime: new Map()
  };
  for (const sample of samples) addTemporalCandidate(index, sample);
  return index;
}

function addTemporalCandidate(index: TemporalCandidateIndex, sample: RuntimeHistorySample): void {
  const playback = sample.viewer?.playback;
  if (!playback || !matchesTemporalProjectionSubject(
    sample,
    index.cursor.animationId,
    index.cursor.sourceId
  )) return;

  const simulated = sample.metadata?.projectionStage === 'simulated';
  if (simulated && (sample.viewer?.physics?.bodyTransforms?.length ?? 0) === 0) return;
  const candidates = simulated ? index.simulated : index.authored;
  const buckets = simulated ? index.simulatedByTime : index.authoredByTime;
  const time = playback.currentTime;
  const bucket = buckets.get(time);
  if (bucket) {
    bucket.push(sample);
    const candidateIndex = findTemporalCandidateIndex(candidates, time);
    if (candidateIndex < candidates.length && candidates[candidateIndex]?.viewer?.playback?.currentTime === time) {
      if (sample.id > candidates[candidateIndex]!.id) candidates[candidateIndex] = sample;
    }
    return;
  }

  buckets.set(time, [sample]);
  candidates.splice(findTemporalCandidateIndex(candidates, time), 0, sample);
}

function removeTemporalCandidate(index: TemporalCandidateIndex, sample: RuntimeHistorySample): void {
  const playback = sample.viewer?.playback;
  if (!playback || !matchesTemporalProjectionSubject(
    sample,
    index.cursor.animationId,
    index.cursor.sourceId
  )) return;

  const simulated = sample.metadata?.projectionStage === 'simulated';
  if (simulated && (sample.viewer?.physics?.bodyTransforms?.length ?? 0) === 0) return;
  const candidates = simulated ? index.simulated : index.authored;
  const buckets = simulated ? index.simulatedByTime : index.authoredByTime;
  const time = playback.currentTime;
  const bucket = buckets.get(time);
  if (!bucket) return;
  const remaining = bucket.filter((candidate) => candidate !== sample);
  const candidateIndex = findTemporalCandidateIndex(candidates, time);
  if (remaining.length === 0) {
    buckets.delete(time);
    if (candidates[candidateIndex]?.viewer?.playback?.currentTime === time) {
      candidates.splice(candidateIndex, 1);
    }
    return;
  }

  buckets.set(time, remaining);
  if (candidates[candidateIndex] === sample) {
    candidates[candidateIndex] = remaining.reduce((latest, candidate) =>
      candidate.id > latest.id ? candidate : latest
    );
  }
}

function findTemporalCandidateIndex(samples: RuntimeHistorySample[], time: number): number {
  let low = 0;
  let high = samples.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if ((samples[middle]?.viewer?.playback?.currentTime ?? Number.POSITIVE_INFINITY) < time) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

function resolveTemporalSamplesDelta(
  previous: RuntimeHistorySample[],
  next: RuntimeHistorySample[]
): { removed: RuntimeHistorySample[]; added: RuntimeHistorySample[] } | null {
  if (previous === next) return { removed: [], added: [] };
  if (previous.length === 0) return { removed: [], added: next };
  if (next.length === 0) return { removed: previous, added: [] };

  const overlapStart = previous.indexOf(next[0]!);
  if (overlapStart < 0) return null;
  const overlapLength = Math.min(previous.length - overlapStart, next.length);
  if (overlapLength > 0 && (
    previous[overlapStart + overlapLength - 1] !== next[overlapLength - 1] ||
    previous[overlapStart + (overlapLength >>> 1)] !== next[overlapLength >>> 1]
  )) return null;

  // Recorder revisions are immutable append/rotation snapshots. A same-size
  // clone can still represent an in-place replacement, so verify it fully.
  if (overlapStart === 0 && previous.length === next.length) {
    for (let index = 0; index < previous.length; index += 1) {
      if (previous[index] !== next[index]) return null;
    }
  }

  return {
    removed: previous.slice(0, overlapStart),
    added: next.slice(overlapLength)
  };
}

function matchesTemporalProjectionSubject(
  sample: RuntimeHistorySample,
  animationId: string | null,
  sourceId?: string | null
): boolean {
  const playbackSourceId = sample.viewer?.playback?.sourceId ?? null;

  if (sourceId) {
    return playbackSourceId === sourceId;
  }

  if (!animationId) {
    return true;
  }

  const metadataSubjectId = sample.metadata?.subjectId;
  return metadataSubjectId === animationId || playbackSourceId === animationId;
}

function resolveProjectionSampleFromCandidates(
  samples: RuntimeHistorySample[],
  currentTimeSeconds: number,
  maximumInterpolationGapSeconds: number,
  allowBoundaryFallback: boolean
): RuntimeHistorySample | null {
  let before: RuntimeHistorySample | null = null;
  let after: RuntimeHistorySample | null = null;

  // Candidates are unique and sorted. Find the two neighbours without scanning.
  let low=0, high=samples.length;
  while(low<high){
    const mid=(low+high)>>>1;
    if(samples[mid].viewer!.playback!.currentTime<currentTimeSeconds) low=mid+1;
    else high=mid;
  }
  after=samples[low]??null;
  before=after?.viewer!.playback!.currentTime===currentTimeSeconds ? after : samples[low-1]??null;

  if (!before || !after) {
    if (!allowBoundaryFallback) return null;
    const boundary = before ?? after;
    if (!boundary) return null;
    const distance = Math.abs(boundary.viewer!.playback!.currentTime - currentTimeSeconds);
    return distance <= maximumInterpolationGapSeconds ? boundary : null;
  }

  const beforeTime = before.viewer!.playback!.currentTime;
  const afterTime = after.viewer!.playback!.currentTime;
  const gap = afterTime - beforeTime;

  if (gap <= 0) return before.id >= after.id ? before : after;
  if (gap > maximumInterpolationGapSeconds) return null;

  return interpolateRuntimeHistorySample(before, after, (currentTimeSeconds - beforeTime) / gap);
}

function interpolateRuntimeHistorySample(
  before: RuntimeHistorySample,
  after: RuntimeHistorySample,
  ratio: number
): RuntimeHistorySample {
  const mix = (left: number, right: number) => left + (right - left) * ratio;
  const mixRecord = (left: Record<string, number> = {}, right: Record<string, number> = {}) =>
    Object.fromEntries(
      Object.keys(left)
        .filter((key) => Number.isFinite(right[key]))
        .map((key) => [key, mix(left[key]!, right[key]!)])
    );
  const beforePhysics = before.viewer?.physics;
  const afterPhysics = after.viewer?.physics;
  const afterBodies = new Map((afterPhysics?.bodyTransforms ?? []).map((body) => [body.id, body]));
  const bodyTransforms = (beforePhysics?.bodyTransforms ?? []).flatMap((body) => {
    const next = afterBodies.get(body.id);
    if (!next) return [];
    const quaternionSign =
      body.rotation &&
      next.rotation &&
      body.rotation.x * next.rotation.x +
        body.rotation.y * next.rotation.y +
        body.rotation.z * next.rotation.z +
        body.rotation.w * next.rotation.w <
        0
        ? -1
        : 1;
    const rotation =
      body.rotation && next.rotation
        ? normalizeQuaternion({
            x: mix(body.rotation.x, next.rotation.x * quaternionSign),
            y: mix(body.rotation.y, next.rotation.y * quaternionSign),
            z: mix(body.rotation.z, next.rotation.z * quaternionSign),
            w: mix(body.rotation.w, next.rotation.w * quaternionSign)
          })
        : body.rotation;
    return [
      {
        ...body,
        position: {
          x: mix(body.position.x, next.position.x),
          y: mix(body.position.y, next.position.y),
          z: mix(body.position.z, next.position.z)
        },
        rotation
      }
    ];
  });

  return {
    id: after.id,
    timeSeconds: mix(before.timeSeconds, after.timeSeconds),
    recordedAt: after.recordedAt,
    metadata: options.interpolateMetadata?.(before,after,ratio) ?? before.metadata,
    viewer: {
      ...before.viewer,
      joints: mixRecord(before.viewer?.joints, after.viewer?.joints),
      playback:
        before.viewer?.playback && after.viewer?.playback
          ? {
              ...before.viewer.playback,
              currentTime: mix(before.viewer.playback.currentTime, after.viewer.playback.currentTime),
              isPlaying: false
            }
          : before.viewer?.playback,
      physics:
        beforePhysics && afterPhysics
          ? {
              ...beforePhysics,
              centerOfMass:
                beforePhysics.centerOfMass && afterPhysics.centerOfMass
                  ? {
                      x: mix(beforePhysics.centerOfMass.x, afterPhysics.centerOfMass.x),
                      y: mix(beforePhysics.centerOfMass.y, afterPhysics.centerOfMass.y),
                      z: mix(beforePhysics.centerOfMass.z, afterPhysics.centerOfMass.z)
                    }
                  : beforePhysics.centerOfMass,
              bodyTransforms,
              jointStates: mixRecord(beforePhysics.jointStates, afterPhysics.jointStates)
            }
          : beforePhysics
    }
  };
}

function normalizeQuaternion<T extends { x: number; y: number; z: number; w: number }>(quaternion: T): T {
  const length = Math.hypot(quaternion.x, quaternion.y, quaternion.z, quaternion.w) || 1;
  return {
    ...quaternion,
    x: quaternion.x / length,
    y: quaternion.y / length,
    z: quaternion.z / length,
    w: quaternion.w / length
  };
}

}
const sharedTemporalProjectionReader=createCompositionTemporalProjectionReader();
