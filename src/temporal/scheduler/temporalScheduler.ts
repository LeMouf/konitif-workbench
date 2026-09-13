import { createBrowserSchedulerHost } from './browserSchedulerHost';
import { createTemporalSchedulerCore, type TemporalSchedulerOptions, type TemporalScheduler } from './temporalSchedulerCore';

export type { TemporalSchedulerOptions, TemporalScheduler } from './temporalSchedulerCore';

/** Compatibility entry: browser integration stays outside the scheduler core. */
export function createTemporalScheduler(options: TemporalSchedulerOptions): TemporalScheduler {
  return createTemporalSchedulerCore(options, createBrowserSchedulerHost());
}
