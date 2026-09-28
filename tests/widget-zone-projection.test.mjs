import assert from 'node:assert/strict';
import { test } from 'node:test';

import { projectWorkbenchWidgetZone } from '../dist/index.js';

test('a closed widget zone stays hidden regardless of its content', () => {
  assert.deepEqual(projectWorkbenchWidgetZone({
    containerOpen: false,
    visiblePlacementCount: 2,
    layoutEditingEnabled: true
  }), { visible: false, acceptsPlacementDrop: false, reason: 'closed' });
});

test('an empty open widget zone is a drop target only while editing', () => {
  assert.deepEqual(projectWorkbenchWidgetZone({
    containerOpen: true,
    visiblePlacementCount: 0,
    layoutEditingEnabled: true
  }), { visible: true, acceptsPlacementDrop: true, reason: 'empty-edit-drop-target' });

  assert.deepEqual(projectWorkbenchWidgetZone({
    containerOpen: true,
    visiblePlacementCount: 0,
    layoutEditingEnabled: false
  }), { visible: false, acceptsPlacementDrop: false, reason: 'empty-runtime' });
});

test('a populated open widget zone is visible and accepts moves only while editing', () => {
  assert.deepEqual(projectWorkbenchWidgetZone({
    containerOpen: true,
    visiblePlacementCount: 1,
    layoutEditingEnabled: false
  }), { visible: true, acceptsPlacementDrop: false, reason: 'visible-content' });

  assert.deepEqual(projectWorkbenchWidgetZone({
    containerOpen: true,
    visiblePlacementCount: 1,
    layoutEditingEnabled: true
  }), { visible: true, acceptsPlacementDrop: true, reason: 'visible-content' });
});
