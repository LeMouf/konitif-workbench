import type { TemporalSchedulerHost } from './temporalSchedulerCore';

export function documentIsVisible(): boolean {
  if (typeof document === 'undefined') return true;
  return document.visibilityState !== 'hidden';
}

export function createBrowserSchedulerHost(): TemporalSchedulerHost {
  return {
    isVisible: documentIsVisible,
    requestFrame(callback) {
      if (typeof requestAnimationFrame !== 'undefined') return requestAnimationFrame(callback);
      return undefined;
    },
    cancelFrame(handle) {
      if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(handle);
    },
  };
}
