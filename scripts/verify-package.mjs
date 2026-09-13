import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkCompiledPackageFiles } from './compiled-package-files.mjs';

const root = realpathSync(fileURLToPath(new URL('..', import.meta.url)));
const evidence = mkdtempSync(join(tmpdir(), 'konitif-workbench-package-'));
const cache = join(evidence, 'npm-cache');
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
assert.equal(manifest.name, '@konitif/workbench');
assert.equal(manifest.private, false);
assert.deepEqual(manifest.dependencies, {
  '@konitif/tools': '0.284.3',
  '@konitif/physics': '0.284.1',
  '@konitif/widgets': '0.285.0',
  '@konitif/temporal': '0.284.1',
  '@konitif/core': '0.284.2',
});

const run = (command, args, cwd = root) => execFileSync(command, args, {
  cwd,
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
  env: { ...process.env, npm_config_offline: 'true', npm_config_cache: cache },
});
const packArgs = ['pack', '--offline', '--ignore-scripts', '--json', '--pack-destination', evidence];
let output;
if (process.platform === 'win32') {
  const npmCli = join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  assert.ok(existsSync(npmCli), `Installed npm CLI required at ${npmCli}`);
  output = run(process.execPath, [npmCli, ...packArgs]);
} else {
  output = run('npm', packArgs);
}
const [packed] = JSON.parse(output);
const files = packed.files.map(file => file.path).sort();
assert.deepEqual(checkCompiledPackageFiles(files), { unexpected: [], missing: [] });
assert.equal(files.length, 376);
const archive = join(evidence, packed.filename);
const bytes = readFileSync(archive);
assert.equal(packed.integrity, `sha512-${createHash('sha512').update(bytes).digest('base64')}`);

const consumer = join(evidence, 'consumer');
const packageRoot = join(consumer, 'node_modules', '@konitif', 'workbench');
mkdirSync(packageRoot, { recursive: true });
run('tar', ['-xzf', archive, '-C', packageRoot, '--strip-components=1']);
const privateProductPattern = /@maxtronics\/|maxtronics|\bnao(?:qi)?\b|aldebaran|softbank/i;
for (const file of files) {
  const source = readFileSync(join(packageRoot, file), 'utf8');
  assert.doesNotMatch(source, privateProductPattern, `Private product reference in archive: ${file}`);
}
for (const name of Object.keys(manifest.dependencies)) {
  const source = realpathSync(join(root, 'node_modules', name));
  const target = join(consumer, 'node_modules', name);
  mkdirSync(dirname(target), { recursive: true });
  symlinkSync(source, target, 'junction');
}
cpSync(join(root, 'tests', 'consumer.mts'), join(consumer, 'consumer.mts'));
run(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict',
  '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext',
  'consumer.mts'], consumer);
run(process.execPath, ['--input-type=module', '-e', `
  import assert from 'node:assert/strict';
  import * as root from '@konitif/workbench';
  import * as hosting from '@konitif/workbench/hosting';
  import * as contracts from '@konitif/workbench/workspace-contracts';
  import * as physics from '@konitif/workbench/physics-runtime';
  assert.equal(root.createWorkspace, hosting.createWorkspace);
  assert.equal(root.createWorkspace, contracts.createWorkspace);
  assert.deepEqual(root.validateWorkspace(root.createWorkspace()), []);
  assert.equal(typeof physics.PhysicsService, 'function');
`], consumer);

console.log(JSON.stringify({
  status: 'passed',
  name: manifest.name,
  version: manifest.version,
  integrity: packed.integrity,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  bytes: bytes.length,
  files: files.length,
  consumer: 'isolated native ESM and NodeNext declarations',
  evidence,
  archive,
}, null, 2));
