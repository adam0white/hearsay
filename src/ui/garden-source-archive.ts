import type { PersonaEnvelope } from '@adam0white/lab-client';
import type { GardenRun } from '../sim/garden4.ts';
import type { SourceArchive } from '../sim/garden4-continuity.ts';
import { exportGarden } from '../sim/garden4-export.ts';
import { get, putImmutable } from './store.ts';

/** Persist the complete departure before any bounded passport can be published. */
export async function retainGardenSource(g: GardenRun, source: PersonaEnvelope['source']): Promise<string> {
  const archive: SourceArchive = { source, export: exportGarden(g) };
  const bytes = new TextEncoder().encode(JSON.stringify(archive));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const key = `persona-departure:${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')}`;
  if (!(await putImmutable(key, archive)))
    throw new Error('The full source run could not be retained on this device.');
  return key;
}

export async function loadGardenSource(key: string): Promise<SourceArchive | null> {
  if (!/^persona-departure:[0-9a-f]{64}$/.test(key)) return null;
  const row = await get<SourceArchive>(key);
  if (!row) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(row.value)));
  const actual = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return key === `persona-departure:${actual}` ? row.value : null;
}
