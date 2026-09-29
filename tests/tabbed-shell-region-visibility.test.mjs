import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveTabbedShellRegionVisibilityIntent } from '../dist/index.js';

const createRegion = (overrides = {}) => ({
  id: 'right',
  isVisible: true,
  isOpen: true,
  size: 320,
  activeWidgetId: 'alpha',
  widgetIds: ['alpha', 'beta', 'gamma'],
  presentation: 'tabs',
  ...overrides,
});

test('closing one member of a tabbed region closes the group', () => {
  assert.deepEqual(
    resolveTabbedShellRegionVisibilityIntent(createRegion(), 'alpha', false),
    { kind: 'close-group' },
  );
});

test('opening one member of a tabbed region reveals its peers', () => {
  assert.deepEqual(
    resolveTabbedShellRegionVisibilityIntent(createRegion(), 'beta', true),
    { kind: 'open-group', revealWidgetIds: ['alpha', 'gamma'] },
  );
});

test('non-grouped visibility remains an individual widget decision', () => {
  assert.deepEqual(
    resolveTabbedShellRegionVisibilityIntent(
      createRegion({ widgetIds: ['alpha'] }),
      'alpha',
      false,
    ),
    { kind: 'widget' },
  );
  assert.deepEqual(
    resolveTabbedShellRegionVisibilityIntent(
      createRegion({ presentation: 'stack' }),
      'alpha',
      true,
    ),
    { kind: 'widget' },
  );
  assert.deepEqual(
    resolveTabbedShellRegionVisibilityIntent(createRegion(), 'unknown', true),
    { kind: 'widget' },
  );
});
