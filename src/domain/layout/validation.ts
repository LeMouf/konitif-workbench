import type { LayoutNode } from './model';
import { listSplits, listStacks } from './selectors';

export const LAYOUT_MIN_SPLIT_SIZE = 0.02;

export interface LayoutValidationIssue {
  path: string;
  message: string;
}

export function normalizeSplitSizes([left, right]: [number, number]): [number, number] {
  const safeLeft = Number.isFinite(left) ? left : 1;
  const safeRight = Number.isFinite(right) ? right : 1;
  const total = safeLeft + safeRight;

  if (!Number.isFinite(total) || total <= 0) {
    return [0.5, 0.5];
  }

  const normalizedLeft = safeLeft / total;
  const normalizedRight = safeRight / total;

  if (normalizedLeft < LAYOUT_MIN_SPLIT_SIZE) {
    return [LAYOUT_MIN_SPLIT_SIZE, 1 - LAYOUT_MIN_SPLIT_SIZE];
  }

  if (normalizedRight < LAYOUT_MIN_SPLIT_SIZE) {
    return [1 - LAYOUT_MIN_SPLIT_SIZE, LAYOUT_MIN_SPLIT_SIZE];
  }

  return [normalizedLeft, normalizedRight];
}

export function isNormalizedSplitSizes([left, right]: [number, number]): boolean {
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return false;
  }

  if (left < LAYOUT_MIN_SPLIT_SIZE || right < LAYOUT_MIN_SPLIT_SIZE) {
    return false;
  }

  return Math.abs(left + right - 1) < 0.0001;
}

export function validateLayout(node: LayoutNode): LayoutValidationIssue[] {
  const issues: LayoutValidationIssue[] = [];
  const panelIds = new Set<string>();
  const stackIds = new Set<string>();
  const splitIds = new Set<string>();

  for (const stack of listStacks(node)) {
    if (stackIds.has(stack.id)) {
      issues.push({ path: stack.id, message: 'Duplicate stack id.' });
    }

    stackIds.add(stack.id);

    if (!stack.children.length) {
      issues.push({ path: stack.id, message: 'Stack must contain at least one panel.' });
    }

    if (!stack.children.some((panel) => panel.id === stack.activeChildId)) {
      issues.push({ path: stack.id, message: 'Stack activeChildId must reference a child panel.' });
    }

    for (const panel of stack.children) {
      if (panelIds.has(panel.id)) {
        issues.push({ path: panel.id, message: 'Duplicate panel id.' });
      }

      panelIds.add(panel.id);

      if (!panel.title.trim()) {
        issues.push({ path: panel.id, message: 'Panel title must not be empty.' });
      }

      if (panel.toolInstanceId !== null && typeof panel.toolInstanceId !== 'string') {
        issues.push({ path: panel.id, message: 'Panel toolInstanceId must be a string or null.' });
      }

      if (panel.showFullscreenToggle !== undefined && typeof panel.showFullscreenToggle !== 'boolean') {
        issues.push({ path: panel.id, message: 'Panel showFullscreenToggle must be a boolean when provided.' });
      }
    }
  }

  for (const split of listSplits(node)) {
    if (splitIds.has(split.id)) {
      issues.push({ path: split.id, message: 'Duplicate split id.' });
    }

    splitIds.add(split.id);

    if (!isNormalizedSplitSizes(split.sizes)) {
      issues.push({ path: split.id, message: 'Split sizes must be finite, clamped, and normalized.' });
    }
  }

  return issues;
}
