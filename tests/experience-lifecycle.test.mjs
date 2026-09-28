import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createWorkbenchExperience,
  createWorkbenchExperienceDraft,
  defineExperienceDraftIdentity,
  defineExperienceIdentity,
  defineExperienceRevisionIdentity,
  saveWorkbenchExperienceRevision,
  transitionWorkbenchExperienceLifecycle,
  updateWorkbenchExperienceDraft,
} from '../dist/index.js';

const originalBinding = Object.freeze({
  mode: 'reference',
  source: {
    kind: 'workspace-preset',
    id: 'proof.workspace',
    revision: '1.0.0',
    contentId: 'a'.repeat(64),
  },
});
const changedBinding = Object.freeze({
  mode: 'reference',
  source: {
    kind: 'workspace-preset',
    id: 'proof.workspace',
    revision: '2.0.0',
    contentId: 'b'.repeat(64),
  },
});

test('Experience creates an immutable draft from one explicit base revision', () => {
  const created = createFixture();
  const draft = createWorkbenchExperienceDraft({
    draftId: defineExperienceDraftIdentity('draft:proof'),
    revision: created.revision,
  });

  assert.deepEqual(draft, {
    id: { kind: 'experience-draft', value: 'draft:proof' },
    experienceId: created.experience.id,
    baseRevisionId: created.revision.id,
    preset: originalBinding,
    specialization: { product: 'proof' },
  });
  assert.equal(Object.isFrozen(draft), true);
  assert.equal(Object.isFrozen(draft.preset), true);
});

test('Experience saves a next revision without mutating its base', () => {
  const created = createFixture();
  const draft = updateWorkbenchExperienceDraft({
    draft: createWorkbenchExperienceDraft({
      draftId: defineExperienceDraftIdentity('draft:proof'),
      revision: created.revision,
    }),
    preset: changedBinding,
    specialization: { product: 'qualified-proof' },
  });
  const saved = saveWorkbenchExperienceRevision({
    experience: created.experience,
    draft,
    expectedHeadRevisionId: created.revision.id,
    revisionId: defineExperienceRevisionIdentity('revision:proof:2'),
    metadata: { title: 'Proof revised' },
  });

  assert.equal(saved.ok, true);
  assert.equal(saved.value.experience.headRevisionId.value, 'revision:proof:2');
  assert.deepEqual(saved.value.revision.parentRevisionId, created.revision.id);
  assert.equal(saved.value.revision.preset.source.revision, '2.0.0');
  assert.deepEqual(saved.value.revision.specialization, { product: 'qualified-proof' });
  assert.equal(created.experience.headRevisionId.value, 'revision:proof:1');
  assert.equal(created.revision.preset.source.revision, '1.0.0');
});

test('Experience save preserves an explicit derivation reference independently of its parent', () => {
  const created = createFixture();
  const derivedFrom = defineExperienceRevisionIdentity('revision:source:7');
  const saved = saveWorkbenchExperienceRevision({
    experience: created.experience,
    draft: createWorkbenchExperienceDraft({
      draftId: defineExperienceDraftIdentity('draft:derived-proof'),
      revision: created.revision,
    }),
    expectedHeadRevisionId: created.revision.id,
    revisionId: defineExperienceRevisionIdentity('revision:proof:2'),
    derivedFrom,
  });

  assert.equal(saved.ok, true);
  assert.deepEqual(saved.value.revision.parentRevisionId, created.revision.id);
  assert.deepEqual(saved.value.revision.derivedFrom, derivedFrom);
});

test('Experience refuses stale and cross-Experience drafts', () => {
  const created = createFixture();
  const draft = createWorkbenchExperienceDraft({
    draftId: defineExperienceDraftIdentity('draft:proof'),
    revision: created.revision,
  });
  const moved = {
    ...created.experience,
    headRevisionId: defineExperienceRevisionIdentity('revision:proof:2'),
  };
  const stale = saveWorkbenchExperienceRevision({
    experience: moved,
    draft,
    expectedHeadRevisionId: created.revision.id,
    revisionId: defineExperienceRevisionIdentity('revision:proof:3'),
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.diagnostics[0]?.code, 'experience.lifecycle.head-conflict');

  const foreign = saveWorkbenchExperienceRevision({
    experience: { ...created.experience, id: defineExperienceIdentity('experience:foreign') },
    draft,
    expectedHeadRevisionId: created.revision.id,
    revisionId: defineExperienceRevisionIdentity('revision:foreign:2'),
  });
  assert.equal(foreign.ok, false);
  assert.equal(foreign.diagnostics[0]?.code, 'experience.lifecycle.experience-mismatch');
});

test('Experience archive, restore and tombstone transitions are explicit and irreversible', () => {
  const created = createFixture();
  const archived = transitionWorkbenchExperienceLifecycle({
    experience: created.experience,
    expected: 'active',
    next: 'archived',
  });
  assert.equal(archived.ok, true);
  const restored = transitionWorkbenchExperienceLifecycle({
    experience: archived.value,
    expected: 'archived',
    next: 'active',
  });
  assert.equal(restored.ok, true);
  const tombstoned = transitionWorkbenchExperienceLifecycle({
    experience: restored.value,
    expected: 'active',
    next: 'tombstoned',
  });
  assert.equal(tombstoned.ok, true);
  const refused = transitionWorkbenchExperienceLifecycle({
    experience: tombstoned.value,
    expected: 'active',
    next: 'archived',
  });
  assert.equal(refused.ok, false);
  assert.equal(refused.diagnostics[0]?.code, 'experience.lifecycle.inactive');
});

function createFixture() {
  return createWorkbenchExperience({
    experienceId: defineExperienceIdentity('experience:proof'),
    revisionId: defineExperienceRevisionIdentity('revision:proof:1'),
    metadata: { title: 'Proof' },
    preset: originalBinding,
    specialization: { product: 'proof' },
  });
}
