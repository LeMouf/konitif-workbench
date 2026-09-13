import type { LayoutEdge } from '../../domain/layout/interaction';
import type { LayoutNode, SplitOrientation } from '../../domain/layout/model';
import type { Workspace } from '../../domain/workspace/model';
import { createPanel, createSplit, createStack } from '../../domain/workspace/factories';
import { canonicalizeLayout } from './canonicalizeLayout';
import { updateActiveWindowRoot } from './layoutTree';

interface CreatePeripheralBandsInput {
  windowId?: string;
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
}

export interface CreatePeripheralBandsResult {
  workspace: Workspace;
  createdPanelIds: string[];
}

const MIN_BAND_RATIO = 0.14;
const MAX_BAND_RATIO = 0.42;

function clampBandRatio(value: number): number {
  return Math.max(MIN_BAND_RATIO, Math.min(MAX_BAND_RATIO, Number(value.toFixed(4))));
}

export function createPeripheralBands(
  workspace: Workspace,
  input: CreatePeripheralBandsInput
): CreatePeripheralBandsResult {
  const createdPanelIds: string[] = [];
  const orderedBands = resolveOrderedBands(input);

  const targetWindowId = input.windowId ?? workspace.activeWindowId;
  if (orderedBands.length === 0 || !workspace.windows.some((window) => window.id === targetWindowId)) {
    return {
      workspace,
      createdPanelIds
    };
  }

  const targetWorkspace = targetWindowId === workspace.activeWindowId
    ? workspace : { ...workspace, activeWindowId: targetWindowId };
  const nextWorkspace = updateActiveWindowRoot(targetWorkspace, (root) => {
    let nextRoot = root;

    for (const band of orderedBands) {
      const panel = createPanel('New panel');
      createdPanelIds.push(panel.id);
      nextRoot = wrapRootWithPeripheralBand(nextRoot, band.edge, band.ratio, createStack([panel]));
    }

    return canonicalizeLayout(nextRoot);
  });

  return {
    workspace: nextWorkspace,
    createdPanelIds
  };
}

function resolveOrderedBands(input: CreatePeripheralBandsInput): Array<{ edge: LayoutEdge; ratio: number }> {
  const bands: Array<{ edge: LayoutEdge; ratio: number }> = [];

  if (typeof input.left === 'number') {
    bands.push({ edge: 'left', ratio: clampBandRatio(input.left) });
  }

  if (typeof input.right === 'number') {
    bands.push({ edge: 'right', ratio: clampBandRatio(input.right) });
  }

  if (typeof input.top === 'number') {
    bands.push({ edge: 'top', ratio: clampBandRatio(input.top) });
  }

  if (typeof input.bottom === 'number') {
    bands.push({ edge: 'bottom', ratio: clampBandRatio(input.bottom) });
  }

  // Columns first, then rows, so corner pulls yield a top/bottom band spanning
  // the full width while left/right bands occupy the remaining height.
  return bands.sort((leftBand, rightBand) => getBandPriority(leftBand.edge) - getBandPriority(rightBand.edge));
}

function getBandPriority(edge: LayoutEdge): number {
  return edge === 'left' || edge === 'right' ? 0 : 1;
}

function wrapRootWithPeripheralBand(
  root: LayoutNode,
  edge: LayoutEdge,
  ratio: number,
  bandStack: ReturnType<typeof createStack>
): LayoutNode {
  const orientation: SplitOrientation = edge === 'left' || edge === 'right' ? 'horizontal' : 'vertical';

  if (edge === 'left' || edge === 'top') {
    return createSplit(orientation, [bandStack, root], [ratio, 1 - ratio]);
  }

  return createSplit(orientation, [root, bandStack], [1 - ratio, ratio]);
}
