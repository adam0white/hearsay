/** Local host artifact only. Output must be outside this checkout. */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { build } from 'vite';

const root = process.cwd();
const output = resolve(process.argv[2] ?? '');
const outside = (base: string, path: string) => {
  const pathFromBase = relative(base, path);
  return pathFromBase === '..' || pathFromBase.startsWith(`..${sep}`);
};
if (!process.argv[2] || !outside(root, output) || !outside(realpathSync(root), realpathSync(dirname(output))))
  throw new Error('Supply a fresh output directory outside the checkout');
mkdirSync(output, { recursive: false });
const pkg = resolve(output, 'package');
mkdirSync(pkg);
const dependencies = {
  '@adam0white/hf-legacy': '3.0.0',
  '@adam0white/human-framework': '4.6.0',
  '@adam0white/lab-client': '0.5.2',
};
for (const [name, version] of Object.entries(dependencies)) {
  const installed = JSON.parse(readFileSync(`node_modules/${name}/package.json`, 'utf8'));
  if (installed.version !== version) throw new Error(`Required ${name}@${version}`);
}
await build({
  configFile: false,
  build: {
    outDir: resolve(pkg, 'dist'),
    target: 'es2022',
    lib: { entry: resolve('src/sim/garden-visit-export.ts'), formats: ['es'], fileName: 'index' },
    rollupOptions: { external: Object.keys(dependencies) },
  },
});
execFileSync(
  resolve('node_modules/.bin/tsc'),
  ['-p', 'tsconfig.garden-replay.json', '--outDir', resolve(pkg, 'types')],
  { stdio: 'inherit' },
);
cpSync('LICENSE', resolve(pkg, 'LICENSE'));
const hash = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const source = ['garden-visit-export.ts', 'garden-visit.ts', 'garden-cast.ts'].map((name) => {
  const file = `src/sim/${name}`;
  return { file, sha256: hash(file) };
});
const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
  encoding: 'utf8',
}).trim();
const manifest = {
  schema: 'hearsay-garden-replay-artifact/1',
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  source,
  dirty: Boolean(dirty),
  prototype: Boolean(dirty),
  dependencies,
  publicAPI: ['validateGardenVisitSave', 'replayGardenVisit', 'exportGardenVisit', 'importGardenVisit'],
  license: 'MIT',
  scope: 'finite Task2 capture only; file origin; accepted:false; submitted:false',
  provenance:
    'Original dirty51ec source provenance is retained. No ownership, admission, accepted chat or source return.',
};
writeFileSync(resolve(pkg, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(
  resolve(pkg, 'NOTICE'),
  'Hearsay-owned host replay module. MIT LICENSE included. Exact external Human Framework 3.0.0 and 4.6.0 and lab-client 0.5.2 retain their own licenses. Original dirty51ec provenance is unchanged.\n',
);
writeFileSync(
  resolve(pkg, 'package.json'),
  `${JSON.stringify(
    {
      name: '@adam0white/hearsay-garden-replay',
      version: '0.0.0-task2',
      private: true,
      type: 'module',
      license: 'MIT',
      exports: { '.': { types: './types/sim/garden-visit-export.d.ts', default: './dist/index.js' } },
      peerDependencies: dependencies,
    },
    null,
    2,
  )}\n`,
);
execFileSync('tar', ['-czf', resolve(output, 'hearsay-garden-replay.tgz'), '-C', output, 'package']);
writeFileSync(resolve(output, 'tar-sha256.txt'), `${hash(resolve(output, 'hearsay-garden-replay.tgz'))}\n`);
