import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as root from '../dist/index.js';
import * as hosting from '../dist/hosting.js';
import * as physics from '../dist/physics-runtime.js';
import * as contracts from '../dist/workspace-contracts.js';

test('public entries preserve one Workbench authority', () => {
  assert.equal(root.createWorkspace, hosting.createWorkspace);
  assert.equal(root.createWorkspace, contracts.createWorkspace);
  const workspace = root.createWorkspace();
  assert.deepEqual(root.validateWorkspace(workspace), []);
});

test('hosting stays usable without a UI or product runtime', () => {
  assert.equal(typeof window, 'undefined');
  const registry = new hosting.InMemoryToolRegistry();
  registry.register({
    definition: {
      id: 'proof.viewer',
      title: 'Viewer',
      panelTitle: 'Viewer',
      description: 'Independent host proof.',
      openingPolicy: { mode: 'multi-instance' },
      initialState: {},
    },
    component: {},
  });
  assert.equal(registry.getDefinition('proof.viewer')?.id, 'proof.viewer');
});

test('physics compatibility delegates to the published physical authority', () => {
  assert.equal(typeof physics.PhysicsService, 'function');
  assert.equal(typeof physics.NoopPhysicsBackend, 'function');
});
