/** HF4 continuity: validated portable people enter their authored garden roles. */
import { inspect, type PersonAuthoring, validatePortablePerson } from '@adam0white/human-framework';
import {
  admitPortablePerson,
  canonicalCast,
  claimPortablePerson,
  createPersona,
  type LifeBatchPreparation,
  type PersonaEnvelope,
  portablePassport,
  portablePersonOwner,
  portableWriteBlockers,
} from '@adam0white/lab-client';
import { GARDEN_CAST, GARDEN_IDS, type GardenPerson } from './garden-cast.ts';
import { departureReason } from './garden-departure-rules.ts';
import { GARDEN_ENGINE } from './garden-engine.ts';
import { type GardenRun, gardenAuthors, sessionOf } from './garden4.ts';
import type { GardenExport } from './garden4-export.ts';

export interface GardenChapter {
  version: 'hearsay-hf4-batch/1';
  claims: PersonaEnvelope[];
}
export interface SourceArchive {
  source: PersonaEnvelope['source'];
  export: GardenExport;
}

export function gardenId(castId: string): GardenPerson {
  const id = GARDEN_IDS.find((person) => GARDEN_CAST[person].castId === castId);
  if (!id) throw new Error('This person has no Hearsay role.');
  return id;
}
export function admitGardenBatch(batch: LifeBatchPreparation): PersonAuthoring[] {
  if (batch.blocked.length) throw new Error('A saved person is unavailable. Keep the existing chapter.');
  const authors = gardenAuthors();
  for (const { parent } of batch.inputs) {
    const id = gardenId(parent.castId),
      cast = canonicalCast(parent.castId);
    if (parent.terminal || parent.castRevision !== cast.revision)
      throw new Error('A saved person is closed or uses an older cast edition.');
    if (parent.transfer.castPassport === 'authored-cast/1') continue;
    if (
      parent.source.game === 'hearsay' &&
      (parent.source.engine !== GARDEN_ENGINE || parent.source.rules !== 'hearsay-hf4-1')
    )
      throw new Error('This saved person uses an unsupported chapter. Keep the file. Start fresh.');
    const portable = validatePortablePerson(parent.transfer.portable);
    if (portable.version !== 2)
      throw new Error('This older saved person cannot continue here. Keep the source file. Start fresh.');
    const authorIndex = authors.findIndex((p) => p.id === id);
    const author = authors[authorIndex];
    if (!author) throw new Error('This person has no authored garden role.');
    const mapping = { offsetMs: 360 * 60000 - portable.retained.at, references: [] };
    const owner = portablePersonOwner(parent);
    if (owner === 'hearsay') {
      author.portable = { person: portable, mapping };
    } else {
      authors[authorIndex] = admitPortablePerson(parent, 'hearsay', author, mapping);
    }

    const admitted = authors[authorIndex];
    if (!admitted) throw new Error('This person has no authored garden role.');
    admitted.state.heldNorms = [];
    admitted.state.sourceTrust = [];
  }
  return authors;
}

/** Keep each refused shelf head untouched while opening the remaining people. */
export function eligibleGardenBatch(batch: LifeBatchPreparation): LifeBatchPreparation {
  const blockedIds = new Set(batch.blocked.map((entry) => entry.castId));
  const inputs = batch.inputs.filter((input) => {
    const id = input.parent.castId;
    if (portablePassport(input.parent) && portableWriteBlockers(id, 'hearsay').length) {
      blockedIds.add(id);
      return false;
    }
    try {
      admitGardenBatch({ expectedHeads: {}, inputs: [input], blocked: [] });
      return true;
    } catch {
      blockedIds.add(id);
      return false;
    }
  });
  return {
    ...batch,
    inputs,
    blocked: [],
    expectedHeads: Object.fromEntries(
      Object.entries(batch.expectedHeads).filter(([id]) => !blockedIds.has(id)),
    ),
  };
}

export async function claimGardenBatch(
  batch: LifeBatchPreparation,
  source: PersonaEnvelope['source'],
): Promise<PersonaEnvelope[]> {
  return Promise.all(
    batch.inputs.map(({ parent, life }) => {
      const { revision, ...body } = parent;
      return createPersona({
        ...body,
        parentRevision: revision,
        source: portablePassport(parent) ? parent.source : source,
        transfer: {
          ...(portablePassport(parent) ? claimPortablePerson(parent, 'hearsay') : parent.transfer),
          life,
        },
      });
    }),
  );
}
export function captureGardenSource(g: GardenRun, id: GardenPerson) {
  const reason = departureReason(g, id);
  if (reason) throw new Error(reason);
  if (g.chat || g.lunch.pending || g.lunch.debt > 0)
    throw new Error(
      'Finish the current conversation and unpaid lunch responsibilities before saving this person.',
    );
  const cast = canonicalCast(GARDEN_CAST[id].castId);
  const result = inspect(sessionOf(g).run, {
    perspective: { kind: 'host' },
    people: [id],
    select: ['persona'],
    portable: { person: id, castId: cast.castId, castRevision: cast.revision },
  });
  if (!result.ok) throw new Error(result.error.message);
  const person = result.value.people[0];
  if (person?.kind !== 'host') throw new Error('The person could not be projected.');
  const part = person.parts.find((p) => p.select === 'persona');
  if (part?.select !== 'persona') throw new Error('The portable person is unavailable.');
  const portable = validatePortablePerson(part.value);
  const blockers = portableWriteBlockers(cast.castId, 'hearsay');
  if (blockers.length) throw new Error('This person cannot be saved across games yet. Keep this chapter.');
  return {
    transfer: {
      castPassport: `hf-portable-person/${portable.version}`,
      portable,
      portableLimitations:
        'Supported history and responsibilities continue with explicit calendar mapping; the source run remains in this device.',
    },
    limitations: ['The full source run remains in this device.'],
  };
}
