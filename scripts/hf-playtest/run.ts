/** Read-only use of the local HF playtester. No build or write in its checkout. */
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { make } from './adapter.ts';

const hfPath =
  process.env.HF_PLAYTESTER ?? '/Users/abdul/code/human-framework/packages/playtester/src/index.ts';
const { PERSONAS, playSession, readSession, runCohort } = await import(pathToFileURL(hfPath).href);
const [command = 'run', ...args] = process.argv.slice(2);
const arg = (key: string, fallback: string) =>
  args.find((a) => a.startsWith(`${key}=`))?.slice(key.length + 1) ?? fallback;
const ids = arg('personas', 'commuter,mischief,rulesLawyer').split(',');
const personas = ids.map((id) => {
  if (!PERSONAS[id]) throw new Error(`No persona ${id}`);
  return PERSONAS[id];
});
let result: unknown;
if (command === 'session') {
  const trace = playSession(make(Number(arg('seed', '1'))), personas[0], Number(arg('seed', '1')));
  result = { report: readSession(trace), trace };
} else if (command === 'run') {
  result = runCohort({
    game: 'hearsay-0.1.0',
    build: arg('build', 'local'),
    make,
    personas,
    seeds: Array.from({ length: Number(arg('seeds', '2')) }, (_, i) => i + 1),
    maxMinutes: Number(arg('minutes', '12')),
  });
} else throw new Error('Use run or session');
const text = `${JSON.stringify(result, null, 2)}\n`;
const out = arg('out', '');
if (out) writeFileSync(out, text);
console.log(text);
