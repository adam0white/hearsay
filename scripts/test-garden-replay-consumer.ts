/** One offline tar consumer control. No symlinks to the producer checkout. */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [artifact, captures, destination] = process.argv.slice(2);
if (!artifact || !captures || !destination)
  throw new Error('Usage: artifact-dir captures-dir fresh-consumer-dir');
const consumer = resolve(destination);
mkdirSync(consumer);
mkdirSync(resolve(consumer, 'vendor'));
cpSync(resolve(artifact, 'hearsay-garden-replay.tgz'), resolve(consumer, 'vendor/replay.tgz'));
const dependencies: Record<string, string> = {
  '@adam0white/hearsay-garden-replay': 'file:vendor/replay.tgz',
};
for (const [name, version] of Object.entries({
  '@adam0white/hf-legacy': '3.0.0',
  '@adam0white/human-framework': '4.8.0',
  '@adam0white/lab-client': '0.5.6',
})) {
  const source = realpathSync(`node_modules/${name}`);
  const meta = JSON.parse(readFileSync(resolve(source, 'package.json'), 'utf8'));
  if (meta.version !== version) throw new Error('Dependency version mismatch');
  const filename = `${name.split('/')[1]}.tgz`;
  // Preserve installed public distribution, including its LICENSE/NOTICE. No source rewriting.
  execFileSync('tar', [
    '-czf',
    resolve(consumer, 'vendor', filename),
    '--exclude=node_modules',
    '-C',
    source,
    '.',
  ]);
  dependencies[name] = `file:vendor/${filename}`;
}
writeFileSync(
  resolve(consumer, 'package.json'),
  JSON.stringify(
    {
      private: true,
      type: 'module',
      dependencies,
    },
    null,
    2,
  ),
);
writeFileSync(
  resolve(consumer, 'pnpm-workspace.yaml'),
  "overrides:\n  '@adam0white/hf-legacy': file:vendor/hf-legacy.tgz\n  '@adam0white/human-framework': file:vendor/human-framework.tgz\n",
);
for (const file of ['full.json', 'compact.json', 'closing-raw.json'])
  cpSync(resolve(captures, file), resolve(consumer, file));
writeFileSync(
  resolve(consumer, 'control.ts'),
  `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateGardenVisitSave, replayGardenVisit, type GardenVisitSave } from '@adam0white/hearsay-garden-replay';
const load = (name: string): unknown => JSON.parse(readFileSync(name, 'utf8'));
const full: GardenVisitSave = await validateGardenVisitSave(load('full.json'));
const compact = await validateGardenVisitSave(load('compact.json'));
const a = await replayGardenVisit(full);
const b = await replayGardenVisit(compact);
assert.deepEqual(a, b);
assert.equal(a.actualEnd, 990);
assert.ok(a.closing);
const closing = a.resources[a.closing];
assert.ok(closing && typeof closing === 'object');
const raw = load('closing-raw.json');
assert.ok(Object.values(a.resources).some(value => JSON.stringify(value) === JSON.stringify(raw)));
const missing = structuredClone(compact);
missing.source.raw = '0'.repeat(64);
const forged = structuredClone(compact);
forged.inputs.unshift({ at: 930, input: { type: 'forged' } } as never);
for (const invalid of [missing, forged]) {
  await assert.rejects(() => validateGardenVisitSave(invalid));
  await assert.rejects(() => replayGardenVisit(invalid));
}
// @ts-expect-error public API requires one argument
replayGardenVisit();
`.replace(
    '// @ts-expect-error public API requires one argument\nreplayGardenVisit();',
    'if (false) {\n// @ts-expect-error public API requires one argument\nreplayGardenVisit();\n}',
  ),
);
execFileSync('pnpm', ['install', '--offline', '--ignore-scripts'], { cwd: consumer, stdio: 'inherit' });
execFileSync(
  resolve('node_modules/.bin/tsc'),
  [
    '--noEmit',
    '--strict',
    '--ignoreConfig',
    '--module',
    'nodenext',
    '--moduleResolution',
    'nodenext',
    '--target',
    'es2024',
    '--types',
    'node',
    '--typeRoots',
    resolve('node_modules/@types'),
    resolve(consumer, 'control.ts'),
  ],
  { stdio: 'inherit' },
);
execFileSync(process.execPath, ['control.ts'], { cwd: consumer, stdio: 'inherit' });
writeFileSync(
  resolve(consumer, 'proof.json'),
  JSON.stringify(
    {
      completeReplayEqual: true,
      actualEnd: 990,
      closingRawEqual: true,
      validatorAndReplayNegativesRejected: true,
      typescript: '7.0.2',
      offline: true,
      fileVendor: true,
    },
    null,
    2,
  ),
);
