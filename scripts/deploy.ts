/** Deploy only a clean origin/main source with successful exact-commit CI. */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const exec = (command: string, args: string[]) => execFileSync(command, args, { encoding: 'utf8' }).trim();
const git = (...args: string[]) => exec('git', args);
git('fetch', 'origin', 'main');
const commit = git('rev-parse', 'HEAD');
if (git('status', '--porcelain') || git('rev-parse', 'origin/main') !== commit)
  throw new Error('Deploy requires a clean checkout of origin/main.');
const runs = JSON.parse(
  exec('gh', [
    'run',
    'list',
    '--commit',
    commit,
    '--workflow',
    'CI',
    '--json',
    'headSha,status,conclusion,url',
  ]),
) as { headSha: string; status: string; conclusion: string; url: string }[];
const ci = runs.find(
  (run) => run.headSha === commit && run.status === 'completed' && run.conclusion === 'success',
);
if (!ci) throw new Error('Deploy requires successful CI on this exact commit.');
execFileSync('pnpm', ['run', 'build'], { stdio: 'inherit' });
const stamp = JSON.parse(readFileSync('dist/release.json', 'utf8'));
if (stamp.commit !== commit || stamp.dirty !== false || git('status', '--porcelain'))
  throw new Error('Build does not match the clean source.');
console.log('Exact green CI:', ci.url, 'Release:', stamp);
execFileSync('pnpm', ['exec', 'wrangler', 'deploy'], { stdio: 'inherit' });
