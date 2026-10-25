import type { State } from '../sim/types';

/** An optional ending account of testimony routes, not a measure of anyone's worth. */
export function endingTally(s: State): string {
  if (!s.ended) return '';
  const own = s.routes.filter((route) => route.origin === 'hatice');
  const spoken = own.filter((route) => route.from === 'hatice').length;
  const relayed = own.length - spoken;
  return `<details aria-label="Claims that began with you"><summary>See the total</summary><h2>Claims that began with you: ${spoken + relayed}</h2><p>You made ${spoken} ${spoken === 1 ? 'claim' : 'claims'}. Neighbours repeated ${spoken === 1 ? 'it' : 'them'} ${relayed} ${relayed === 1 ? 'time' : 'times'}. Each recorded conversation counts once, including withdrawals and claims later withdrawn. Only claims that started with Hatice count.</p><p class="fine">This total does not measure anyone’s worth. A larger total is not a better outcome.</p></details>`;
}
