import type { State } from '../sim/types';

/** An optional ending account of testimony routes, not a measure of anyone's worth. */
export function endingTally(s: State): string {
  if (!s.ended) return '';
  const own = s.routes.filter((route) => route.origin === 'hatice');
  const spoken = own.filter((route) => route.from === 'hatice').length;
  const relayed = own.length - spoken;
  return `<details aria-label="Words from your gate"><summary>See tally</summary><h2>Words from your gate: ${spoken + relayed}</h2><p>Total = your tellings (${spoken}) + onward tellings by neighbours (${relayed}). Each recorded route counts once, including withdrawals and words later withdrawn. Only routes that started with Hatice count.</p><p class="fine">This is the game's own reckoning of travelling words, not a measure of people. A larger total is not a better outcome.</p></details>`;
}
