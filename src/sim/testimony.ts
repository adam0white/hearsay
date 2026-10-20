import type { Percept, Person } from '@adam0white/human-framework';
import { perceive, trustOf } from '@adam0white/human-framework';

export const OPPOSITE: Record<string, string> = {
  honest: 'dishonest',
  dishonest: 'honest',
  reliable: 'unreliable',
  unreliable: 'reliable',
  kind: 'cruel',
  cruel: 'kind',
  generous: 'stingy',
  stingy: 'generous',
  hardworking: 'lazy',
  lazy: 'hardworking',
};

/** Opposite trait names describe the same assertion with opposite truth values. */
export function completeClaims(percepts: Percept[]): Percept[] {
  return percepts.map((p) => ({
    ...p,
    claims: p.claims?.flatMap((c) => {
      const [target, trait] = c.prop.split(':');
      const opposite = OPPOSITE[trait!];
      return opposite && !p.claims?.some((other) => other.prop === `${target}:${opposite}`)
        ? [c, { ...c, prop: `${target}:${opposite}`, value: !c.value }]
        : [c];
    }),
  }));
}

/** Only a more trusted contradictory source can discredit earlier testimony. */
export function receiveTestimony(
  listener: Person,
  percepts: Percept[],
  contradicted?: (prop: string, value: boolean, source: string) => void,
) {
  const completed = completeClaims(percepts);
  for (const percept of completed) {
    if (percept.channel !== 'told' || !percept.actorId) continue;
    const trusted = trustOf(listener, percept.actorId);
    for (const claim of percept.claims ?? []) {
      const existing = listener.memory.beliefs.find((b) => b.prop === claim.prop);
      if (!existing || claim.confidence < 0.7) continue;
      for (const source of existing.sources) {
        if (source.id === percept.actorId || source.value === claim.value) continue;
        const priorTrust = trustOf(listener, source.id);
        if (trusted > priorTrust + 0.05) {
          listener.memory.sourceTrust[source.id] = Math.max(0, priorTrust - 0.12 * (trusted - priorTrust));
          contradicted?.(claim.prop, claim.value, source.id);
        }
      }
    }
  }
  return perceive(listener, completed);
}
