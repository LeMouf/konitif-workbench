import type { RuntimeHistorySnapshot } from './history/runtimeHistory';

export interface TemporalBufferCoverage {
  sourceId: string;
  animationId: string;
  stage: 'authored' | 'simulated';
  ranges: { startSeconds: number; endSeconds: number }[];
  falls?: { startSeconds: number; endSeconds: number; settled: boolean }[];
}

/** Display evidence only: no poses, joints, physics frames or replay authority. */
export function projectTemporalBufferCoverage(snapshot: Pick<RuntimeHistorySnapshot, 'samples'>): TemporalBufferCoverage[] {
  const groups = new Map<string, { entry: TemporalBufferCoverage; times: number[] }>();
  for (const sample of snapshot.samples) {
    const playback = sample.viewer?.playback;
    const stage = sample.metadata?.projectionStage;
    if (!playback?.sourceId || !Number.isFinite(playback.currentTime) ||
      (stage !== 'authored' && stage !== 'simulated')) continue;
    const animationId = typeof sample.metadata?.subjectId === 'string' ? sample.metadata.subjectId : playback.sourceId;
    const key = JSON.stringify([playback.sourceId, animationId, stage]);
    let group = groups.get(key);
    if (!group) {
      group = { entry: { sourceId: playback.sourceId, animationId, stage, ranges: [] }, times: [] };
      groups.set(key, group);
    }
    group.times.push(playback.currentTime);
  }
  for (const { entry, times } of groups.values()) {
    for (const time of times.sort((a, b) => a - b)) {
      const last = entry.ranges[entry.ranges.length - 1];
      if (!last || time - last.endSeconds > 0.2) entry.ranges.push({ startSeconds: time, endSeconds: time });
      else last.endSeconds = time;
    }
  }
  return [...groups.values()].map(group => group.entry);
}

export function resolveTemporalBufferCoverageRanges(entries: readonly TemporalBufferCoverage[], animationId: string | null,
  stage: TemporalBufferCoverage['stage'], sourceId: string | null, duration?: number) {
  if (!animationId) return [];
  const ranges = entries.filter(entry => entry.stage === stage &&
    (sourceId ? entry.sourceId === sourceId : entry.animationId === animationId || entry.sourceId === animationId))
    .flatMap(entry => entry.ranges.map(range => ({ ...range })));
  ranges.sort((a, b) => a.startSeconds - b.startSeconds);
  if (ranges[0] && ranges[0].startSeconds >= 0 && ranges[0].startSeconds <= 0.2) ranges[0].startSeconds = 0;
  const last = ranges[ranges.length - 1];
  if (last && duration !== undefined && last.endSeconds <= duration && duration - last.endSeconds <= 0.2) last.endSeconds = duration;
  return ranges;
}
