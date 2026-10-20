import type { Percept, Person } from '@adam0white/human-framework';
import { perceive, trustOf } from '@adam0white/human-framework';
/** A person discounts an earlier source when a more trusted witness contradicts that source. */
export function receiveTestimony(listener: Person, percepts: Percept[]) {
  for (const percept of percepts) {
    if (percept.channel !== 'told' || !percept.actorId) continue;
    const trusted = trustOf(listener, percept.actorId);
    for (const claim of percept.claims ?? []) {
      const existing = listener.memory.beliefs.find((b) => b.prop === claim.prop);
      if (!existing || claim.confidence < 0.7) continue;
      for (const source of existing.sources) {
        if (source.id === percept.actorId || source.value === claim.value) continue;
        const priorTrust = trustOf(listener, source.id);
        if (trusted > priorTrust + 0.05)
          listener.memory.sourceTrust[source.id] = Math.max(0, priorTrust - 0.12 * (trusted - priorTrust));
      }
    }
  }
  return perceive(listener, percepts);
}
