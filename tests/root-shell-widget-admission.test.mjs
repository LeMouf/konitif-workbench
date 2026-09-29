import assert from 'node:assert/strict';
import test from 'node:test';

import {
  admitShellWidgetPlacementPreservingRegionState,
  isShellWidgetAlreadyPlaced,
} from '../dist/index.js';

const createShell = (rightOverrides = {}) => ({
  regions: {
    left: {
      id: 'left',
      isVisible: false,
      isOpen: false,
      size: 240,
      activeWidgetId: null,
      widgetIds: [],
      hiddenWidgetIds: [],
    },
    right: {
      id: 'right',
      isVisible: true,
      isOpen: false,
      size: 320,
      activeWidgetId: 'layers',
      widgetIds: ['layers'],
      hiddenWidgetIds: [],
      ...rightOverrides,
    },
    bottom: {
      id: 'bottom',
      isVisible: false,
      isOpen: false,
      size: 220,
      activeWidgetId: null,
      widgetIds: [],
      hiddenWidgetIds: [],
    },
  },
});

const createActions = () => {
  const calls = [];
  return {
    calls,
    actions: {
      moveShellWidgetToRegion: (...args) => calls.push(['move', ...args]),
      activateShellWidget: (...args) => calls.push(['activate', ...args]),
      setShellRegionVisible: (...args) => calls.push(['visible', ...args]),
      setShellRegionOpen: (...args) => calls.push(['open', ...args]),
    },
  };
};

test('detects a Widget already placed in any root region', () => {
  const shell = createShell();

  assert.equal(isShellWidgetAlreadyPlaced(shell, 'layers'), true);
  assert.equal(isShellWidgetAlreadyPlaced(shell, 'missing'), false);
});

test('admits a missing Widget then restores the active and closed region state', () => {
  const shell = createShell();
  const { actions, calls } = createActions();

  assert.equal(
    admitShellWidgetPlacementPreservingRegionState(
      shell,
      actions,
      'right',
      'camera',
      { beforeWidgetId: 'layers' },
    ),
    true,
  );
  assert.deepEqual(calls, [
    ['move', 'right', 'camera', { beforeWidgetId: 'layers' }],
    ['activate', 'right', 'layers'],
    ['visible', 'right', true],
    ['open', 'right', false],
  ]);
});

test('admission is idempotent for a Widget already present', () => {
  const shell = createShell();
  const { actions, calls } = createActions();

  assert.equal(
    admitShellWidgetPlacementPreservingRegionState(shell, actions, 'right', 'layers'),
    false,
  );
  assert.deepEqual(calls, []);
});
