/** Headless text driver. node scripts/drive.ts [careful|quiet|reckless|cunning] [seed] [days] */
import { writeFileSync } from 'node:fs';
import { fingerprint } from '../src/sim/game.ts';
import { type Policy, runPolicy } from './policy.ts';

const policy = process.argv[2] ?? 'careful';
if (!['careful', 'quiet', 'reckless', 'cunning'].includes(policy))
  throw new Error('policy: careful, quiet, reckless, cunning');
const seed = Number(process.argv[3] ?? 1);
const days = Number(process.argv[4] ?? 14);
if (!Number.isInteger(seed) || !Number.isFinite(days) || days <= 0 || days > 14)
  throw new Error('Invalid seed/days');
const g = runPolicy(seed, policy as Policy, days * 1440);
for (const line of g.s.log) {
  const day = Math.floor(line.at / 1440) + 1;
  const time = `${Math.floor((line.at % 1440) / 60)}:${String(line.at % 60).padStart(2, '0')}`;
  console.log(`Day ${day} ${time} ${line.speaker ?? 'garden'}: ${line.text}`);
}
console.log(`Engagement: ${g.s.engagement}; garden: ${g.s.garden}; fingerprint: ${fingerprint(g.s)}`);
const out = process.argv.find((a) => a.startsWith('out='))?.slice(4);
if (out)
  writeFileSync(
    out,
    `${JSON.stringify({ seed, inputs: g.inputs, state: g.s, fingerprint: fingerprint(g.s) }, null, 2)}\n`,
  );
