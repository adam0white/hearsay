import { fingerprint, replay } from '../src/sim/game.ts';
import { runPolicy } from './policy.ts';

const start = performance.now();
const g = runPolicy(1, 'careful-relay');
const elapsed = (performance.now() - start) / 1000;
const replayed = replay(1, g.inputs, g.s.minute);
const equal = fingerprint(g.s) === fingerprint(replayed.s);
console.log(
  JSON.stringify(
    {
      seed: 1,
      policy: 'careful-relay',
      minute: g.s.minute,
      seconds: +elapsed.toFixed(3),
      people: Object.keys(g.s.people).length,
      inputs: g.inputs.length,
      routes: g.s.routes.length,
      fingerprint: fingerprint(g.s),
      replayEqual: equal,
    },
    null,
    2,
  ),
);
if (!equal) process.exitCode = 1;
