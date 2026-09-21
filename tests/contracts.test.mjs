import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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

test('workspace usage bundles preserve immutable authored identity', async () => {
  const workspace = root.createWorkspace();
  const workspaceSession = root.createWorkspaceSessionState(workspace);
  const shellState = root.createShellState({
    getDefinition() { return undefined; },
    list() { return []; },
  });
  const authored = root.authorWorkspacePreset({
    id: 'proof.workspace',
    name: 'Proof workspace',
    version: '1.0.0',
    compatibility: {
      fixtureSchemaVersions: ['1'],
      projectSchemaVersions: ['1'],
    },
    workspaceSession,
    shellState,
  });
  assert.equal(authored.ok, true);
  const context = { fixtureSchemaVersion: '1', projectSchemaVersion: '1', hostContract: 'proof.host/1' };
  const content = {
    async sha256(value) {
      return createHash('sha256').update(value).digest('hex');
    },
  };
  const created = await root.createWorkspaceUsageBundle({
    source: authored.artifact,
    context,
    fragments: { workspace, shell: shellState, focus: workspaceSession.focus },
    parentSnapshotId: null,
  }, content);
  assert.equal(created.ok, true);
  const admitted = await contracts.admitWorkspaceUsageBundle(created.bundle, context, content);
  assert.equal(admitted.ok, true);

  const altered = structuredClone(created.bundle);
  altered.fragments.workspace.id = 'altered';
  const refused = await root.admitWorkspaceUsageBundle(altered, context, content);
  assert.equal(refused.ok, false);
  assert.equal(refused.diagnostics[0]?.code, 'usage.invalid-content');
});
