import {
  exportRunJournal,
  type RunJournalChunk,
  type RunJournalCursor,
  type RunJournalHead,
  type RunJournalOpening,
  restoreRunJournal,
} from '@adam0white/human-framework';
import { validateGardenChapter } from '../sim/garden-chapter.ts';
import { requireCurrentGardenConfig } from '../sim/garden-dialogue.ts';
import { type GardenCheckpoint, restoreGardenSessionFromRun } from '../sim/garden-hf4.ts';
import { attachGardenSession, type GardenRun, sessionOf } from '../sim/garden4.ts';
import { get, putJournal } from './store.ts';

const KEY = 'garden-hf4-journal-1';
type Host = Omit<GardenCheckpoint, 'archive'>;
export type GardenJournalMeta = {
  fileOrigin: boolean;
  fileKey: string | null;
  ownedHeads: unknown;
  archives: unknown;
};
type Head = {
  version: 1;
  id: string;
  openingKey: string;
  chunkKeys: string[];
  head: RunJournalHead;
  state: Omit<GardenRun, 'engine'>;
  host: Host;
  meta: GardenJournalMeta;
};
type Cursor = { run: GardenRun; cursor: RunJournalCursor; head: Head };
let current: Cursor | undefined;
let queue: Promise<unknown> = Promise.resolve();

export function saveGardenJournal(run: GardenRun, meta: GardenJournalMeta): Promise<boolean> {
  const work = queue
    .then(async () => {
      validateGardenChapter(run.chapter, meta.ownedHeads);
      const session = sessionOf(run);
      const previous = current?.run === run ? current : undefined;
      const result = exportRunJournal(session.run, previous?.cursor);
      if (!result.ok) return false;
      const data = result.value;
      const id = previous?.head.id ?? crypto.randomUUID();
      const openingKey = previous?.head.openingKey ?? `${KEY}:${id}:opening`;
      const chunkKeys = [...(previous?.head.chunkKeys ?? [])];
      const records: [string, unknown][] = [];
      if (data.opening) records.push([openingKey, data.opening]);
      if (data.chunk) {
        const key = `${KEY}:${id}:${data.chunk.digest}`;
        chunkKeys.push(key);
        records.push([key, data.chunk]);
      }
      const { engine: _engine, ...state } = run;
      const head: Head = structuredClone({
        version: 1,
        id,
        openingKey,
        chunkKeys,
        head: data.head,
        state,
        host: {
          clock: session.clock,
          serial: session.serial,
          offerRevision: session.offerRevision,
          offers: session.offers,
          host: session.host,
        },
        meta,
      });
      if (!(await putJournal(records, KEY, head))) return false;
      current = { run, cursor: data.cursor, head };
      return true;
    })
    .catch(() => false);
  queue = work;
  return work;
}

export async function loadGardenJournal(): Promise<{ run: GardenRun; meta: GardenJournalMeta } | null> {
  const saved = await get<Head>(KEY);
  if (!saved) return null;
  const head = saved.value;
  if (head.version !== 1 || !Array.isArray(head.chunkKeys)) throw Error('Invalid saved garden. Start fresh.');
  requireCurrentGardenConfig(head.state?.config);
  validateGardenChapter(head.state?.chapter, head.meta?.ownedHeads);
  const opening = await get<RunJournalOpening>(head.openingKey);
  const chunks = await Promise.all(head.chunkKeys.map((key) => get<RunJournalChunk>(key)));
  if (!opening || chunks.some((chunk) => !chunk)) throw Error('Incomplete saved garden. Start fresh.');
  const restored = restoreRunJournal({
    opening: opening.value,
    chunks: chunks.map((chunk) => chunk?.value),
    head: head.head,
  });
  if (!restored.ok) throw Error('This saved garden cannot open. Start fresh.');
  const session = restoreGardenSessionFromRun(head.host, restored.value.run);
  const run = { ...head.state, engine: undefined } as unknown as GardenRun;
  attachGardenSession(run, session);
  current = { run, cursor: restored.value.cursor, head };
  return { run, meta: head.meta };
}
