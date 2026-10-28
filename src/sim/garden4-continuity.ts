/** HF4 continuity: only validated native garden passports enter this edition. */
import { inspect, type PersonAuthoring, validatePortablePerson } from '@adam0white/human-framework';
import {
  canonicalCast,
  createPersona,
  type LifeBatchPreparation,
  type PersonaEnvelope,
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
      parent.source.game !== 'hearsay' ||
      parent.source.engine !== GARDEN_ENGINE ||
      parent.source.rules !== 'hearsay-hf4-1'
    )
      throw new Error(
        'This saved person uses an unsupported chapter. Keep that chapter or start with new local people.',
      );
    const portable = validatePortablePerson(parent.transfer.portable);
    if (
      portable.castId !== parent.castId ||
      portable.castRevision !== parent.castRevision ||
      portable.source.personId !== id ||
      portable.source.game !== 'hearsay' ||
      portable.source.engine !== GARDEN_ENGINE ||
      parent.transfer.castPassport !== `hf-portable-person/${portable.version}`
    )
      throw new Error('This saved person has incompatible source details.');
    const owner = parent.transfer.portableClaim as { game?: string } | undefined;
    if (owner && owner.game !== 'hearsay') throw new Error('This person still belongs to another chapter.');
    const author = authors.find((p) => p.id === id);
    if (!author) throw new Error('This person has no authored garden role.');
    if (portable.version === 2) {
      author.state.heldNorms = [];
      author.state.sourceTrust = [];
    }
    author.portable = {
      person: portable,
      mapping: { offsetMs: portable.version === 2 ? 360 * 60000 - portable.retained.at : 0, references: [] },
    };
  }
  return authors;
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
        source,
        transfer: {
          ...parent.transfer,
          life,
          ...(String(parent.transfer.castPassport).startsWith('hf-portable-person/')
            ? { portableClaim: { game: 'hearsay' } }
            : {}),
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
