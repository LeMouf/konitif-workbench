import type { TemporalTransport } from './temporalTransport';

export interface TimelineLabel {
  id: string;
  seconds: number;
}

export interface TimelineCallback {
  id: string;
  seconds: number;
  once?: boolean;
  fired?: boolean;
  call: () => void;
}

export interface TransportTimeline {
  label(id: string, seconds: number): TransportTimeline;
  call(id: string, seconds: number, callback: () => void, options?: { once?: boolean }): TransportTimeline;
  seekLabel(id: string): void;
  tick(): void;
  labels(): TimelineLabel[];
}

export function createTransportTimeline(transport: TemporalTransport): TransportTimeline {
  const labelsMap = new Map<string, TimelineLabel>();
  const callbacks: TimelineCallback[] = [];

  return {
    label(id, seconds) {
      labelsMap.set(id, { id, seconds });
      return this;
    },
    call(id, seconds, callback, options) {
      callbacks.push({ id, seconds, call: callback, once: options?.once ?? true });
      return this;
    },
    seekLabel(id) {
      const label = labelsMap.get(id);
      if (!label) throw new Error(`[TransportTimeline] Unknown label "${id}"`);
      transport.seek({ value: label.seconds, unit: 'seconds' });
    },
    tick() {
      const snapshot = transport.tick();
      const clock = transport.clockGraph.get(snapshot.position.clockId);
      const seconds = clock?.toSeconds(snapshot.position) ?? snapshot.position.value;

      for (const callback of callbacks) {
        if (callback.once && callback.fired) continue;
        if (seconds >= callback.seconds) {
          callback.fired = true;
          callback.call();
        }
      }
    },
    labels() {
      return [...labelsMap.values()].sort((a, b) => a.seconds - b.seconds);
    },
  };
}
