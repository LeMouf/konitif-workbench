import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createBrowserWorkbenchExperienceRepository,
  createWorkbenchExperience,
  createWorkbenchExperienceDraft,
  defineExperienceDraftIdentity,
  defineExperienceIdentity,
  defineExperienceRevisionIdentity,
} from '../dist/index.js';

const binding = Object.freeze({
  mode: 'reference',
  source: {
    kind: 'workspace-preset',
    id: 'proof.workspace',
    revision: '1.0.0',
    contentId: 'a'.repeat(64),
  },
});

test('browser repository owns generic Experience persistence and lifecycle', async () => {
  const storage = createMemoryStorage();
  const repository = createBrowserWorkbenchExperienceRepository({
    storageKey: 'proof.experiences',
    storage,
  });
  const created = createFixture();

  assert.equal((await repository.create(created)).ok, true);
  const listed = await repository.list();
  assert.equal(listed.ok, true);
  assert.equal(listed.value[0].metadata.title, 'Proof');

  const draft = createWorkbenchExperienceDraft({
    draftId: defineExperienceDraftIdentity('draft:proof'),
    revision: created.revision,
  });
  const derivedFrom = defineExperienceRevisionIdentity('revision:source:7');
  const saved = await repository.saveRevision({
    experience: created.experience,
    draft,
    expectedHeadRevisionId: created.revision.id,
    revisionId: defineExperienceRevisionIdentity('revision:proof:2'),
    derivedFrom,
    metadata: { title: 'Proof revised' },
  });
  assert.equal(saved.ok, true);
  assert.deepEqual(saved.value.revision.parentRevisionId, created.revision.id);
  assert.deepEqual(saved.value.revision.derivedFrom, derivedFrom);

  const archived = await repository.transitionLifecycle({
    experienceId: created.experience.id,
    expected: 'active',
    next: 'archived',
  });
  assert.equal(archived.ok, true);
  assert.equal(archived.value.lifecycle, 'archived');

  const reloaded = createBrowserWorkbenchExperienceRepository({
    storageKey: 'proof.experiences',
    storage,
  });
  const snapshot = await reloaded.hydrate();
  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.value.experiences[0].headRevisionId.value, 'revision:proof:2');
  assert.equal(snapshot.value.revisions.length, 2);
});

test('browser repository refuses stale writes and malformed stored artifacts', async () => {
  const storage = createMemoryStorage();
  const repository = createBrowserWorkbenchExperienceRepository({
    storageKey: 'proof.experiences',
    storage,
  });
  const created = createFixture();
  await repository.create(created);
  const draft = createWorkbenchExperienceDraft({
    draftId: defineExperienceDraftIdentity('draft:proof'),
    revision: created.revision,
  });
  const moved = await repository.saveRevision({
    experience: created.experience,
    draft,
    expectedHeadRevisionId: created.revision.id,
    revisionId: defineExperienceRevisionIdentity('revision:proof:2'),
  });
  assert.equal(moved.ok, true);

  const stale = await repository.saveRevision({
    experience: created.experience,
    draft,
    expectedHeadRevisionId: created.revision.id,
    revisionId: defineExperienceRevisionIdentity('revision:proof:3'),
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.error.code, 'experience.repository.head-conflict');

  storage.setItem('proof.experiences', '{"schema":"other"}');
  const malformed = await repository.hydrate();
  assert.equal(malformed.ok, false);
  assert.equal(malformed.error.code, 'experience.repository.invalid-artifact');
});

function createFixture() {
  return createWorkbenchExperience({
    experienceId: defineExperienceIdentity('experience:proof'),
    revisionId: defineExperienceRevisionIdentity('revision:proof:1'),
    metadata: { title: 'Proof' },
    preset: binding,
    specialization: { product: 'proof' },
  });
}

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}
