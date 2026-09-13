import type { EasingDefinition } from './easingTypes';

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

export const easingDefinitions: EasingDefinition[] = [
  { id: 'linear', label: 'Linear', fn: t => clamp01(t) },
  { id: 'quad.in', label: 'Quad In', fn: t => { t = clamp01(t); return t * t; } },
  { id: 'quad.out', label: 'Quad Out', fn: t => { t = clamp01(t); return 1 - (1 - t) * (1 - t); } },
  { id: 'quad.inOut', label: 'Quad In Out', fn: t => { t = clamp01(t); return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; } },
  { id: 'cubic.in', label: 'Cubic In', fn: t => { t = clamp01(t); return t * t * t; } },
  { id: 'cubic.out', label: 'Cubic Out', fn: t => { t = clamp01(t); return 1 - Math.pow(1 - t, 3); } },
  { id: 'cubic.inOut', label: 'Cubic In Out', fn: t => { t = clamp01(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; } },
  { id: 'quart.in', label: 'Quart In', fn: t => { t = clamp01(t); return t * t * t * t; } },
  { id: 'quart.out', label: 'Quart Out', fn: t => { t = clamp01(t); return 1 - Math.pow(1 - t, 4); } },
  { id: 'quart.inOut', label: 'Quart In Out', fn: t => { t = clamp01(t); return t < .5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2; } },
  { id: 'expo.in', label: 'Expo In', fn: t => { t = clamp01(t); return t === 0 ? 0 : Math.pow(2, 10 * t - 10); } },
  { id: 'expo.out', label: 'Expo Out', fn: t => { t = clamp01(t); return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); } },
  { id: 'expo.inOut', label: 'Expo In Out', fn: t => { t = clamp01(t); return t === 0 ? 0 : t === 1 ? 1 : t < .5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2; } },
  { id: 'sine.in', label: 'Sine In', fn: t => { t = clamp01(t); return 1 - Math.cos((t * Math.PI) / 2); } },
  { id: 'sine.out', label: 'Sine Out', fn: t => { t = clamp01(t); return Math.sin((t * Math.PI) / 2); } },
  { id: 'sine.inOut', label: 'Sine In Out', fn: t => { t = clamp01(t); return -(Math.cos(Math.PI * t) - 1) / 2; } },
];
