export type RuntimeQualityMode = 'off' | 'low' | 'medium' | 'high';
export type RuntimeQualityReason =
  | 'requested'
  | 'hidden-tab'
  | 'reduced-motion'
  | 'battery-saver'
  | 'low-fps'
  | 'busy-offload'
  | 'low-concurrency'
  | 'recovery';

export interface RuntimeQualityPolicyInput {
  requestedQuality?: RuntimeQualityMode;
  reducedMotion?: boolean;
  batterySaver?: boolean;
  hidden?: boolean;
  fps?: number | null;
  hardwareConcurrency?: number | null;
  activeOffloadTasks?: number;
  recovering?: boolean;
}

export interface RuntimeQualityPolicy {
  requestedQuality: RuntimeQualityMode;
  effectiveQuality: RuntimeQualityMode;
  shouldAnimate: boolean;
  reducedMotion: boolean;
  budgets: {
    particleCount: number;
    blurPx: number;
    ambientFps: number;
    maxConcurrentOffloadTasks: number;
    telemetrySampleRate: number;
  };
  reasons: RuntimeQualityReason[];
}

export function createRuntimeQualityPolicy(input: RuntimeQualityPolicyInput = {}): RuntimeQualityPolicy {
  const requestedQuality = input.requestedQuality ?? 'medium';
  const reasons: RuntimeQualityReason[] = ['requested'];
  let effectiveQuality = requestedQuality;

  if (input.hidden) {
    effectiveQuality = minQuality(effectiveQuality, 'low');
    reasons.push('hidden-tab');
  }

  if (input.reducedMotion) {
    effectiveQuality = minQuality(effectiveQuality, 'low');
    reasons.push('reduced-motion');
  }

  if (input.batterySaver) {
    effectiveQuality = minQuality(effectiveQuality, 'low');
    reasons.push('battery-saver');
  }

  if (typeof input.fps === 'number' && Number.isFinite(input.fps) && input.fps > 0 && input.fps < 28) {
    effectiveQuality = downshiftQuality(effectiveQuality);
    reasons.push('low-fps');
  }

  if ((input.activeOffloadTasks ?? 0) >= 3) {
    effectiveQuality = minQuality(effectiveQuality, 'medium');
    reasons.push('busy-offload');
  }

  if (typeof input.hardwareConcurrency === 'number' && Number.isFinite(input.hardwareConcurrency) && input.hardwareConcurrency > 0 && input.hardwareConcurrency <= 2) {
    effectiveQuality = minQuality(effectiveQuality, 'low');
    reasons.push('low-concurrency');
  }

  if (input.recovering) {
    effectiveQuality = minQuality(effectiveQuality, 'low');
    reasons.push('recovery');
  }

  const budgets = createBudgets(effectiveQuality);
  const shouldAnimate = effectiveQuality !== 'off' && !input.reducedMotion && !input.hidden;

  return {
    requestedQuality,
    effectiveQuality,
    shouldAnimate,
    reducedMotion: input.reducedMotion ?? false,
    budgets: {
      ...budgets,
      maxConcurrentOffloadTasks: Math.max(
        1,
        Math.min(budgets.maxConcurrentOffloadTasks, Math.max(1, Math.floor(input.hardwareConcurrency ?? budgets.maxConcurrentOffloadTasks)))
      )
    },
    reasons: uniqueReasons(reasons)
  };
}

export function shouldThrottleRuntimeQuality(policy: RuntimeQualityPolicy): boolean {
  return policy.effectiveQuality === 'off' || policy.effectiveQuality === 'low' || policy.reasons.some((reason) => reason !== 'requested');
}

const qualityOrder: RuntimeQualityMode[] = ['off', 'low', 'medium', 'high'];

function minQuality(current: RuntimeQualityMode, cap: RuntimeQualityMode): RuntimeQualityMode {
  return qualityOrder[Math.min(qualityOrder.indexOf(current), qualityOrder.indexOf(cap))] ?? 'medium';
}

function downshiftQuality(current: RuntimeQualityMode): RuntimeQualityMode {
  const index = qualityOrder.indexOf(current);

  return qualityOrder[Math.max(0, index - 1)] ?? 'low';
}

function createBudgets(quality: RuntimeQualityMode): RuntimeQualityPolicy['budgets'] {
  switch (quality) {
    case 'off':
      return {
        particleCount: 0,
        blurPx: 0,
        ambientFps: 0,
        maxConcurrentOffloadTasks: 1,
        telemetrySampleRate: 0.25
      };
    case 'low':
      return {
        particleCount: 18,
        blurPx: 8,
        ambientFps: 12,
        maxConcurrentOffloadTasks: 1,
        telemetrySampleRate: 0.5
      };
    case 'high':
      return {
        particleCount: 96,
        blurPx: 24,
        ambientFps: 60,
        maxConcurrentOffloadTasks: 4,
        telemetrySampleRate: 1
      };
    case 'medium':
    default:
      return {
        particleCount: 48,
        blurPx: 16,
        ambientFps: 30,
        maxConcurrentOffloadTasks: 2,
        telemetrySampleRate: 0.75
      };
  }
}

function uniqueReasons(reasons: RuntimeQualityReason[]): RuntimeQualityReason[] {
  return [...new Set(reasons)];
}
