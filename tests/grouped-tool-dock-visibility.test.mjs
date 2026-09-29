import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeGroupedWorkbenchToolDockVisibility,
  normalizeGroupedWorkbenchToolDockVisibilityForShellState,
  resolveWorkbenchToolDockRootLocation,
} from '../dist/index.js';

const rightDocks = [
  { dockId: 'leds', defaultRegionId: 'right', defaultVisible: true },
  { dockId: 'layers', defaultRegionId: 'right', defaultVisible: true },
  { dockId: 'physics', defaultRegionId: 'right', defaultVisible: true },
];

const bottomDock = {
  dockId: 'timeline',
  defaultRegionId: 'bottom',
  defaultVisible: true,
};

const dockState = (values) => ({
  dockContainers: Object.fromEntries(
    Object.entries(values).map(([dockId, isVisible]) => [dockId, { isVisible }]),
  ),
});

const readDockVisibility = (state, dockId) =>
  state.dockContainers?.[dockId]?.isVisible === true;

const shellState = ({ left = [], right = [], bottom = [], hiddenRight = [] } = {}) => ({
  regions: {
    left: {
      id: 'left', isVisible: true, isOpen: true, size: 240,
      activeWidgetId: left[0] ?? null, widgetIds: left,
    },
    right: {
      id: 'right', isVisible: true, isOpen: true, size: 320,
      activeWidgetId: right[0] ?? null, widgetIds: right, hiddenWidgetIds: hiddenRight,
    },
    bottom: {
      id: 'bottom', isVisible: true, isOpen: true, size: 260,
      activeWidgetId: bottom[0] ?? null, widgetIds: bottom,
    },
  },
});

test('a single tab request closes every internal dock sharing its region', () => {
  const current = dockState({ leds: true, layers: true, physics: true, timeline: true });
  const requested = dockState({ leds: true, layers: false, physics: true, timeline: true });
  const result = normalizeGroupedWorkbenchToolDockVisibility(
    current,
    requested,
    [...rightDocks, bottomDock],
  );

  assert.deepEqual(
    rightDocks.map((dock) => readDockVisibility(result, dock.dockId)),
    [false, false, false],
  );
  assert.equal(readDockVisibility(result, bottomDock.dockId), true);
});

test('opening one internal tab repairs a partially hidden group atomically', () => {
  const current = dockState({ leds: false, layers: false, physics: false });
  const requested = dockState({ leds: false, layers: true, physics: false });
  const result = normalizeGroupedWorkbenchToolDockVisibility(current, requested, rightDocks);

  assert.deepEqual(
    rightDocks.map((dock) => readDockVisibility(result, dock.dockId)),
    [true, true, true],
  );
});

test('a root-managed widget remains independent from its former internal group', () => {
  const current = dockState({ leds: true, layers: true, physics: true });
  const requested = dockState({ leds: true, layers: false, physics: true });
  const result = normalizeGroupedWorkbenchToolDockVisibility(
    current,
    requested,
    rightDocks,
    new Set(['layers']),
  );

  assert.equal(result, requested);
});

test('shell-state normalization discovers root-managed docks without application policy', () => {
  const docks = rightDocks.map((dock) => ({
    ...dock,
    rootWidgetId: 'widget.' + dock.dockId,
  }));
  const current = dockState({ leds: true, layers: true, physics: true });
  const requested = dockState({ leds: true, layers: false, physics: true });

  const rootedResult = normalizeGroupedWorkbenchToolDockVisibilityForShellState(
    current, requested, docks, shellState({ right: ['widget.layers'] }),
  );
  const internalResult = normalizeGroupedWorkbenchToolDockVisibilityForShellState(
    current, requested, docks, shellState(),
  );

  assert.equal(rootedResult, requested);
  assert.deepEqual(
    rightDocks.map((dock) => readDockVisibility(internalResult, dock.dockId)),
    [false, false, false],
  );
});

test('root location projection preserves shell visibility and presentation', () => {
  const state = shellState({ right: ['widget.layers', 'widget.leds'], hiddenRight: ['widget.layers'] });
  state.regions.right.presentation = 'stack';

  assert.deepEqual(resolveWorkbenchToolDockRootLocation(state, 'widget.layers'), {
    regionId: 'right',
    isVisible: false,
    isOpen: true,
    activeWidgetId: 'widget.layers',
    presentation: 'stack',
    size: 320,
  });
  assert.equal(resolveWorkbenchToolDockRootLocation(state, 'widget.absent'), null);
});

test('multi-dock snapshots and isolated docks are not reinterpreted', () => {
  const current = dockState({ leds: true, layers: true, physics: true, timeline: true });
  const multiChange = dockState({ leds: false, layers: false, physics: true, timeline: true });
  const isolatedChange = dockState({ leds: true, layers: true, physics: true, timeline: false });
  const docks = [...rightDocks, bottomDock];

  assert.equal(
    normalizeGroupedWorkbenchToolDockVisibility(current, multiChange, docks),
    multiChange,
  );
  assert.equal(
    normalizeGroupedWorkbenchToolDockVisibility(current, isolatedChange, docks),
    isolatedChange,
  );
});
