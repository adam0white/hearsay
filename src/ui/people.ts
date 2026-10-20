import type { State } from '../sim/types.ts';
import { PEOPLE } from '../sim/world.ts';

const neighbors = new Map(PEOPLE.map((person) => [person.id, person]));
const allIds = PEOPLE.filter((person) => person.id !== 'hatice').map((person) => person.id);
const roles: Record<string, string> = {
  riza: 'Elif’s father',
  cem: 'Rıza’s friend',
  emre: 'Your son',
  elif: 'Emre hopes to marry her',
};

/** Known relationships first; everyone else keeps their authored occupation. */
export function personRole(id: string): string {
  return roles[id] ?? neighbors.get(id)?.job ?? '';
}

export function personLabel(id: string): string {
  const person = neighbors.get(id);
  return person ? `${person.name} · ${personRole(id)}` : id;
}

/**
 * Prioritize known, unfinished business without hiding the rest of the village.
 * Candidates are a strict boundary: pass only present IDs for an action picker.
 */
export function focusedPeople(
  s: State,
  candidates: readonly string[] = allIds,
): { primary: string[]; others: string[] } {
  const allowed = new Set(candidates.filter((id) => id !== 'hatice' && neighbors.has(id)));
  const primary = new Set<string>();
  const add = (ids: readonly string[]) => {
    for (const id of ids) if (allowed.has(id)) primary.add(id);
  };
  add(['riza', 'cem', 'emre']);
  for (const thread of s.threads ?? []) {
    if (thread.status !== 'arrived') add([thread.who, thread.to]);
  }
  for (const promise of s.amends ?? []) {
    if (promise.listeners.length) add([promise.target, ...promise.listeners]);
  }
  for (const [who, errand] of Object.entries(s.errands ?? {})) {
    if (errand.until > s.minute) add([who, errand.target]);
  }
  if (s.scene && s.scene.until > s.minute) add(s.scene.who);
  add([...allowed].filter((id) => ['garden', 'fountain'].includes(s.locations[id] ?? '')));
  return { primary: [...primary], others: [...allowed].filter((id) => !primary.has(id)) };
}
