import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import {
  admitWorkspaceExperiencePresetBinding,
  admitWorkspacePresetContentReference,
  authorWorkspacePreset,
  createShellState,
  createWorkspace,
  createWorkspaceExperiencePresetBinding,
  createWorkspacePresetContentReference,
  createWorkspaceSessionState,
} from '../dist/index.js';

const content = {
  async sha256(value) {
    return createHash('sha256').update(value).digest('hex');
  },
};

test('Experience binds a preset revision to its exact canonical content', async () => {
  const preset = createPreset('proof.workspace', '1.0.0', 'Proof workspace');
  const reference = await createWorkspacePresetContentReference(preset, content);

  assert.deepEqual(
    { kind: reference.kind, id: reference.id, revision: reference.revision },
    { kind: 'workspace-preset', id: 'proof.workspace', revision: '1.0.0' },
  );
  assert.match(reference.contentId, /^[a-f0-9]{64}$/);
  assert.deepEqual(await admitWorkspacePresetContentReference(reference, preset, content), {
    ok: true,
    value: reference,
    diagnostics: [],
  });
});

test('Experience refuses a preset revision rebound to altered content', async () => {
  const source = createPreset('proof.workspace', '1.0.0', 'Proof workspace');
  const altered = { ...source, name: 'Altered workspace' };
  const reference = await createWorkspacePresetContentReference(source, content);
  const admitted = await admitWorkspacePresetContentReference(reference, altered, content);

  assert.equal(admitted.ok, false);
  assert.equal(admitted.diagnostics[0]?.code, 'experience.preset-content-conflict');
});

test('Experience distinguishes reference from explicit traceable override', async () => {
  const source = createPreset('proof.workspace', '1.0.0', 'Proof workspace');
  const result = createPreset('proof.workspace.behavior', '1.0.0', 'Behavior specialization');
  const referenced = await createWorkspaceExperiencePresetBinding({ source }, content);
  const overridden = await createWorkspaceExperiencePresetBinding({
    source,
    result,
    transformations: [{ order: 0, kind: 'specialize', summary: 'Bind a product tool registry.' }],
  }, content);

  assert.equal(referenced.ok, true);
  assert.equal(referenced.value.mode, 'reference');
  assert.equal(overridden.ok, true);
  assert.equal(overridden.value.mode, 'override');
  assert.equal(overridden.value.transformations[0]?.kind, 'specialize');
  assert.deepEqual(await admitWorkspaceExperiencePresetBinding({
    binding: overridden.value,
    source,
    result,
  }, content), overridden);
});

test('Experience refuses an override without semantic transformations', async () => {
  const source = createPreset('proof.workspace', '1.0.0', 'Proof workspace');
  const result = createPreset('proof.workspace.behavior', '1.0.0', 'Behavior specialization');
  const binding = await createWorkspaceExperiencePresetBinding({ source, result }, content);

  assert.equal(binding.ok, false);
  assert.equal(binding.diagnostics[0]?.code, 'experience.invalid-override');
});

function createPreset(id, version, name) {
  const catalog = {
    getDefinition() { return undefined; },
    list() { return []; },
  };
  const workspace = createWorkspace(catalog);
  const result = authorWorkspacePreset({
    id,
    name,
    version,
    compatibility: { fixtureSchemaVersions: ['1'], projectSchemaVersions: ['1'] },
    workspaceSession: createWorkspaceSessionState(workspace),
    shellState: createShellState(catalog),
  });
  assert.equal(result.ok, true);
  return result.artifact;
}
