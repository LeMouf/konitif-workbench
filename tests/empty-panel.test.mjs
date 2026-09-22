import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkspace } from '../dist/application/workspace/createWorkspace.js';
import { createWorkspaceFromPreset } from '../dist/application/workspace/presets.js';
import { unassignTool } from '../dist/application/workspace/unassignTool.js';
import { listPanelsInWorkspace } from '../dist/domain/workspace/selectors.js';
import { InMemoryToolRegistry } from '../dist/infrastructure/tools/InMemoryToolRegistry.js';

test('empty creation and unassignment do not implicitly populate Welcome', () => {
  const catalog = new InMemoryToolRegistry();
  catalog.register({ definition: { id: 'example.welcome', title: 'Welcome', panelTitle: 'Welcome',
    description: '', initialState: {}, openingPolicy: { mode: 'multi-instance' } },
    loadComponent: async () => { throw new Error('Must not mount'); } });
  for (const workspace of [createWorkspace(catalog), createWorkspaceFromPreset(catalog)]) {
    assert.deepEqual(workspace.toolInstances, {});
    assert.equal(listPanelsInWorkspace(workspace)[0].title, 'Untitled panel');
    assert.equal(listPanelsInWorkspace(workspace)[0].toolInstanceId, null);
  }
  const explicit = createWorkspace(catalog, { initialToolId: 'example.welcome' });
  assert.equal(listPanelsInWorkspace(explicit)[0].title, 'Welcome');
  const cleared = unassignTool(explicit, 'example.welcome');
  assert.equal(listPanelsInWorkspace(cleared)[0].title, 'Untitled panel');
  assert.equal(listPanelsInWorkspace(cleared)[0].toolInstanceId, null);
  assert.deepEqual(cleared.toolInstances, {});
});
