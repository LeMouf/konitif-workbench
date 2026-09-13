import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('manifest is public, compiled and independent from workspace locators', () => {
  assert.equal(manifest.name, '@konitif/workbench');
  assert.equal(manifest.private, false);
  assert.equal(manifest.repository.url, 'git+https://github.com/LeMouf/konitif-workbench.git');
  assert.deepEqual(manifest.publishConfig, { access: 'public', registry: 'https://registry.npmjs.org/' });
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const version of Object.values(manifest[field] ?? {})) {
      assert.doesNotMatch(version, /^(?:workspace:|file:|link:|\.\.?[\\/])/);
    }
  }
  assert.deepEqual(manifest.files, ['dist', 'LICENSE.md', 'README.md', 'package.json']);
});

test('sources contain no application or partner namespace', () => {
  const root = new URL('../src/', import.meta.url);
  const files = [];
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.ts')) files.push(path);
    }
  }
  walk(root.pathname);
  assert.ok(files.length > 150);
  const privateProductPattern = /@maxtronics\/|packages\/maxtronics-|behavior-studio|Behavior Studio|\bapps\/|\bnao(?:qi)?\b|aldebaran|softbank/i;
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, privateProductPattern, file);
  }
});
