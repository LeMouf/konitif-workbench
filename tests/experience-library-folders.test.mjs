import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addLibraryFolder,
  emptyLibraryFolders,
  moveLibraryResource,
  organizeExperienceLibraryResources,
  readLibraryFolders
} from '../dist/workspace-contracts.js';

function source(experienceId, folderId, name, resourceKey) {
  return {
    id: resourceKey,
    resourceKey,
    experienceAssets: [{ experienceId, experienceName: name, folderId, parentName: 'Experiences' }]
  };
}

test('same-named experiences keep their separate root identities across reload', () => {
  const records = [
    source('experience.one', 'root-one', 'Demo', 'audio:one'),
    source('experience.two', 'root-two', 'Demo', 'audio:two')
  ];
  const organized = organizeExperienceLibraryResources(emptyLibraryFolders(), records);
  assert.equal(organized.assignments['audio:one'], 'root-one');
  assert.equal(organized.assignments['audio:two'], 'root-two');
  assert.equal(organized.folders.find(folder => folder.id === 'root-one').experienceId, 'experience.one');
  assert.equal(organized.folders.find(folder => folder.id === 'root-two').experienceId, 'experience.two');
  const restored = readLibraryFolders(JSON.stringify(organized));
  assert.deepEqual(organizeExperienceLibraryResources(restored, records), restored);
});

test('a manually moved resource keeps its folder when the catalogue refreshes', () => {
  const resource = source('experience.one', 'root-one', 'Demo', 'audio:one');
  const organized = organizeExperienceLibraryResources(emptyLibraryFolders(), [resource]);
  const custom = addLibraryFolder(organized, 'favorites', 'Favorites');
  const moved = moveLibraryResource(custom, resource.resourceKey, 'favorites');
  const restored = readLibraryFolders(JSON.stringify(moved));
  assert.equal(organizeExperienceLibraryResources(restored, [resource]).assignments[resource.resourceKey], 'favorites');
});
