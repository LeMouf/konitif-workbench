import type { RuntimeHistoryRecorder } from './history/runtimeHistory';

/** Yield a task, not a microtask, so input and painting can progress between bounded lots. */
export function yieldBufferTask(): Promise<void> {
  const scheduler = (globalThis as typeof globalThis & { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  return scheduler?.yield ? scheduler.yield() : new Promise(resolve => setTimeout(resolve, 0));
}

export interface AuthoredBufferPrefillOptions {
  durationSeconds: number;
  fps: number;
  createSample(timeSeconds: number): Parameters<RuntimeHistoryRecorder['recordSample']>[0];
  isCurrent(): boolean;
  batch(operation: () => void): void;
  yieldTask?: () => Promise<void>;
  now?: () => number;
  maximumSamplesPerLot?: number;
  maximumLotMilliseconds?: number;
}

/** One admitted clip occurrence at a time. No composition ownership or new sampler/executor. */
export async function prefillAuthoredClipBuffer(
  recorder: RuntimeHistoryRecorder, options: AuthoredBufferPrefillOptions
): Promise<boolean> {
  const yieldTask = options.yieldTask ?? yieldBufferTask;
  const now = options.now ?? (() => performance.now());
  const fps = Math.max(1, options.fps || 30);
  const frameCount = Math.max(1, Math.ceil(options.durationSeconds * fps));
  const maximumSamples = Math.max(1, options.maximumSamplesPerLot ?? 64);
  const maximumMilliseconds = Math.max(0.1, options.maximumLotMilliseconds ?? 4);
  let frame = 0;
  while (frame <= frameCount) {
    await yieldTask();
    if (!options.isCurrent()) return false;
    const started = now();
    let count = 0;
    options.batch(() => {
      while (frame <= frameCount && options.isCurrent()) {
        const time = frame === frameCount ? options.durationSeconds : Math.min(options.durationSeconds, frame / fps);
        recorder.recordSample(options.createSample(time));
        frame++; count++;
        if (count >= maximumSamples || now() - started >= maximumMilliseconds) break;
      }
    });
    if (!options.isCurrent()) return false;
  }
  return true;
}
