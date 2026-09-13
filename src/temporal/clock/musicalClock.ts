import type { ClockAdapter, ClockDescriptor, TemporalClockUnit, TemporalValue } from './clockTypes';

export interface MusicalClockOptions {
  id?: string;
  bpm: number;
  ticksPerBeat?: number;
}

export function createMusicalClock(options: MusicalClockOptions): ClockAdapter {
  const ticksPerBeat = options.ticksPerBeat ?? 960;
  const secondsPerBeat = 60 / options.bpm;

  const descriptor: ClockDescriptor = {
    id: options.id ?? 'musical',
    kind: 'musical',
    unit: 'beats',
    rate: 1,
    bpm: options.bpm,
    ticksPerBeat,
  };

  return {
    descriptor,
    now(): TemporalValue {
      return { clockId: descriptor.id, unit: 'beats', value: 0 };
    },
    toSeconds(value: TemporalValue): number {
      if (value.unit === 'ticks') return (value.value / ticksPerBeat) * secondsPerBeat;
      if (value.unit === 'beats') return value.value * secondsPerBeat;
      if (value.unit === 'milliseconds') return value.value / 1000;
      return value.value;
    },
    fromSeconds(seconds: number, unit: TemporalClockUnit = 'beats'): TemporalValue {
      const beats = seconds / secondsPerBeat;
      const value =
        unit === 'ticks' ? beats * ticksPerBeat :
        unit === 'milliseconds' ? seconds * 1000 :
        unit === 'seconds' ? seconds :
        beats;
      return { clockId: descriptor.id, unit, value };
    },
  };
}
